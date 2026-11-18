import NewCase from "./NewCase";
import NewOutline, {OutlineRequest} from "./NewOutline";
import NewPcb from "./NewPcb";
import NewAssembly from "./NewAssembly";
import {NewUnit, UnitList, useUnits} from "./Units";
import {ConfirmDelete, Deletable} from "./DeleteItem";
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

// the title opens and closes the section; Outlines, PCBs, Cases and Assemblies also have a "+" for a new one
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

// the sections a new item can be added to, and what it is called
const NEW_ITEM: Record<string, string> = {Outlines: 'outline', PCBs: 'PCB', Cases: 'case', Assemblies: 'assembly'};

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
    // why ergogen could not make it (it has nothing to show or download, but it can be deleted)
    error?: string,
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
    const units = useUnits();
    // the row whose delete is being confirmed
    const [deleting, setDeleting] = useState<{ kind: Deletable, name: string } | null>(null);
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

    if (results) {
        const pcbs = section('PCBs');
        for (const [pcb_name, pcb_data] of Object.entries((results.pcbs ?? {}) as Record<string, { preview?: { kicad_pcb?: string } }>)) {
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

    // what ergogen could not make, in its section: e.g. "pcbs.left" under PCBs
    const SECTION_OF: Record<string, string> = {outlines: 'Outlines', pcbs: 'PCBs', cases: 'Cases', assemblies: 'Assemblies'};
    for (const [item, message] of Object.entries((results?.errors ?? {}) as Record<string, string>)) {
        const [kind, ...rest] = item.split('.');
        const found = sections.find(s => s.title === SECTION_OF[kind]);
        if (found) found.items.push({fileName: rest.join('.'), extension: '', content: '', label: rest.join('.'), error: message});
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
    if (results) {
        const assemblies = section('Assemblies');
        for (const [name, assembly] of Object.entries((results.assemblies ?? {}) as Record<string, { pcb?: { name: string } }>)) {
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
          {deleting && (
              <ConfirmDelete kind={deleting.kind} name={deleting.name} onDone={deleted => {
                  // what the preview showed is gone: back to the points
                  const shown = previewKey ?? '';
                  if (deleted && [`outlines.${deleting.name}.svg`, `pcbs.${deleting.name}.preview.kicad_pcb`, `cases.${deleting.name}.stl`,
                      `assemblies.${deleting.name}`].includes(shown)) setPreview('demo.svg');
                  setDeleting(null);
              }}/>
          )}
          {/* the config's own units: not a download, but what everything below is measured in */}
          {results && (
              <SectionContainer>
                  <SectionHeader>
                      <button className="toggle" aria-expanded={!!open.Units} onClick={() => setOpen({...open, Units: !open.Units})}>
                          <span>{open.Units ? '▾' : '▸'} Units</span>
                          <span>{units.length}</span>
                      </button>
                      <button className="new" title="A new unit" aria-pressed={adding === 'Units'}
                              onClick={() => { setAdding('Units'); setOpen({...open, Units: true}); }}>+</button>
                  </SectionHeader>
                  {adding === 'Units' && <NewUnit onClose={() => setAdding(null)}/>}
                  {open.Units && <UnitList/>}
              </SectionContainer>
          )}
          {
              sections.map(({title, items}) => {
                  const shown = items.filter(download => !download.fileName.startsWith("_"));
                  const what = NEW_ITEM[title];
                  const addable = !!what;
                  if (!shown.length && !addable) return null;
                  const isOpen = !!open[title];

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
                          {adding === title && title === 'PCBs' &&
                              <NewPcb onCancel={() => setAdding(null)} onCreated={key => { setAdding(null); setPreview(key); }}/>}
                          {adding === title && title === 'Assemblies' &&
                              <NewAssembly onCancel={() => setAdding(null)} onCreated={key => { setAdding(null); setPreview(key); }}/>}
                          {isOpen && shown.map((download, i) =>
                              <DownloadRow key={i} {...download} setPreview={setPreview} setTabIndex={tabContext?.setTabIndex}
                                           active={!!download.preview && download.preview === previewKey}
                                           onDelete={what ? () => setDeleting({kind: what as Deletable, name: download.fileName}) : undefined}/>
                          )}
                      </SectionContainer>
                  );
              })
          }
      </DownloadsContainer>
  );
};

      export default Downloads;
