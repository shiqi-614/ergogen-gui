import NewCase from "./NewCase";
import NewOutline, {OutlineRequest} from "./NewOutline";
import DownloadRow from "../atoms/DownloadRow";
import Loading, {Spinner} from "../atoms/Loading";
import yaml from 'js-yaml';
import styled from "styled-components";
import {useConfigContext} from "../context/ConfigContext";
import {useContext, useState} from "react";
import {TabContext} from "../organisms/Tabs";


const DownloadsContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  padding-left: 1rem;
`;

const Title = styled.h3`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0;
`;

const SectionContainer = styled.div`
  margin-bottom: 0.5em;
`;

// the title opens and closes the section; Outlines and Cases also have a "+" for a new one
const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5em;
  padding: 0 0.5rem 0 0;
  border-radius: 0.25rem;
  background: #595959;
  transition: background-color 150ms ease-in-out;

  &:hover {
    background: #525252;
  }

  button {
    border: none;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }

  button.toggle {
    display: flex;
    justify-content: space-between;
    flex-grow: 1;
    padding: 0.5rem 0 0.5rem 1rem;
    background: transparent;
    text-align: left;
  }

  button.new {
    width: 1.4rem;
    height: 1.4rem;
    padding: 0;
    border-radius: 0.2rem;
    background: #6f6f6f;
    line-height: 1;
  }

  button.new:hover, button.new[aria-pressed="true"] {
    background: #28a745;
  }
`;

type Props = {
    setPreview: (key: string) => void,
    label: string | undefined,
    // what the preview pane shows, marked in the list
    previewKey?: string,
    // a new outline, for the layout editor to make
    onNewOutline: (request: OutlineRequest) => void,
};

type DownloadObj = {
    fileName: string,
    extension: string,
    content: string,
    preview?: string,
    // shown instead of the file name, for an entry that only previews (no content to download)
    label?: string,
};

type DownloadArr = Array<DownloadObj>;

type DownloadSection = {
    title: string,
    items: DownloadArr
};

const Downloads = ({setPreview, label, previewKey, onNewOutline}: Props) => {
    const configContext = useConfigContext();
    const tabContext = useContext(TabContext);
    // sections start closed, a click on the title opens one
    const [open, setOpen] = useState<Record<string, boolean>>({});
    // the section whose new-item form is open
    const [adding, setAdding] = useState<string | null>(null);
    if(!configContext) return null;

    const {configInput, results, error, running} = configContext;

    const sections: Array<DownloadSection> = [];
    const section = (title: string) => {
        const items: DownloadArr = [];
        sections.push({title, items});
        return items;
    };

    if (results?.demo) {
        let rawFileName = label + "_raw";
        section('Config & points').push({
                fileName: rawFileName,
                extension: 'yaml',
                content: configInput ?? ''
            },
            {
                fileName: 'demo',
                extension: 'dxf',
                content: results?.demo?.dxf,
                preview: "demo.svg"
            },
            {
                fileName: 'points',
                extension: 'yaml',
                content: yaml.dump(results.points)
            },
            {
                fileName: 'units',
                extension: 'yaml',
                content: yaml.dump(results.units)
            });
    }

    if (results) {
        const outlines = section('Outlines');
        for (const [name, outline] of Object.entries(results.outlines ?? {})) {
            outlines.push(
                {
                    fileName: name,
                    extension: 'dxf',
                    // @ts-ignore
                    content: outline.dxf,
                    preview: `outlines.${name}.svg`
                }
                // {
                    // fileName: name,
                    // extension: 'yaml',
                    // // @ts-ignore
                    // content: yaml.dump(outline.yaml)
                // }
            )
        }

    }

    if (results?.pcbs) {
        const pcbs = section('PCBs');
        for (const [pcb_name, pcb_data] of Object.entries(results.pcbs as Record<string, { preview?: { kicad_pcb?: string } }>)) {
            if (pcb_data?.preview?.kicad_pcb) {
                pcbs.push({
                        fileName: pcb_name,
                        extension: 'kicad_pcb',
                        content: pcb_data.preview.kicad_pcb,
                        preview: `pcbs.${pcb_name}.preview.kicad_pcb`,
                    }
                )
            }
        }
    }


    if (results) {
        const cases = section('Cases');
        for (const [name, caseObj] of Object.entries(results.cases ?? {})) {
            cases.push(
                {
                    fileName: name,
                    extension: 'stl',
                    // @ts-ignore
                    content: caseObj.stl,
                    preview: `cases.${name}.stl`
                }
            )
        }

    }

    if (results?.kicad) {
        const kicad = section('KiCad projects');
        for (const [name, content] of Object.entries(results.kicad)) {
            if (typeof content === "string") {
                const binaryString = atob(content);

                // Create a Uint8Array from the binary string
                const binaryArray = new Uint8Array(binaryString.length);

                for (let i = 0; i < binaryString.length; i++) {
                    binaryArray[i] = binaryString.charCodeAt(i);
                }

                kicad.push(
                    {
                        fileName: name,
                        extension: 'zip',
                        // @ts-ignore
                        content: binaryArray
                    }
                )
            }
        }
    }



    // the case parts stacked around a board (config.assemblies): shown in the board's 3D view, which downloads them
    if (results?.assemblies) {
        const assemblies = section('Assemblies');
        for (const [name, assembly] of Object.entries(results.assemblies as Record<string, { pcb?: { name: string } }>)) {
            const board = assembly?.pcb?.name;
            if (!board || !results?.pcbs?.[board]?.preview?.kicad_pcb) continue;
            assemblies.push({fileName: name, extension: '', content: '', preview: `assemblies.${name}`, label: name});
        }
    }

    return (
      <DownloadsContainer>
          <Title>
              Downloads
              {/* a run after the first: the files below are about to change */}
              {running && results && <Spinner $size="0.9rem" title="Generating…" role="status" aria-label="Generating"/>}
          </Title>
          {!results && !error && <Loading text="Generating…"/>}
          {
              sections.map(({title, items}) => {
                  const shown = items.filter(download => !download.fileName.startsWith("_"));
                  const addable = title === 'Outlines' || title === 'Cases';
                  if (!shown.length && !addable) return null;
                  const isOpen = !!open[title];
                  const what = title === 'Outlines' ? 'outline' : 'case';

                  return (
                      <SectionContainer key={title}>
                          <SectionHeader>
                              <button className="toggle" aria-expanded={isOpen} onClick={() => setOpen({...open, [title]: !isOpen})}>
                                  <span>{isOpen ? '▾' : '▸'} {title}</span>
                                  <span>{shown.length}</span>
                              </button>
                              {addable && (
                                  <button className="new" title={`A new ${what}`} aria-pressed={adding === title}
                                          onClick={() => { setAdding(title); setOpen({...open, [title]: true}); }}>+</button>
                              )}
                          </SectionHeader>
                          {adding === title && title === 'Outlines' &&
                              <NewOutline onCancel={() => setAdding(null)} onCreate={request => { setAdding(null); onNewOutline(request); }}/>}
                          {adding === title && title === 'Cases' &&
                              <NewCase onCancel={() => setAdding(null)} onCreated={key => { setAdding(null); setPreview(key); }}/>}
                          {isOpen && shown.map((download, i) =>
                              <DownloadRow key={i} {...download} setPreview={setPreview} setTabIndex={tabContext?.setTabIndex}
                                           active={!!download.preview && download.preview === previewKey}/>
                          )}
                      </SectionContainer>
                  );
              })
          }
      </DownloadsContainer>
  );
};

      export default Downloads;
