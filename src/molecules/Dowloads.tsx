import DownloadRow from "../atoms/DownloadRow";
import yaml from 'js-yaml';
import styled from "styled-components";
import {useConfigContext} from "../context/ConfigContext";
import {Dispatch, SetStateAction, useContext, useState} from "react";
import {TabContext} from "../organisms/Tabs";


const DownloadsContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  padding-left: 0.5rem;
`;

const Title = styled.h3`
  margin-top: 0;
`;

const SectionContainer = styled.div`
  margin-bottom: 0.5em;
`;

const SectionHeader = styled.button`
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 0.5em;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  background: #595959;
  color: #ffffff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms ease-in-out;

  &:hover {
    background: #525252;
  }
`;

type Props = {
    setPreview: Dispatch<SetStateAction<string>>,
    label: string | undefined
};

type DownloadObj = {
    fileName: string,
    extension: string,
    content: string,
    preview?: string,
};

type DownloadArr = Array<DownloadObj>;

type DownloadSection = {
    title: string,
    items: DownloadArr
};

const Downloads = ({setPreview, label}: Props) => {
    const configContext = useConfigContext();
    const tabContext = useContext(TabContext);
    // sections start closed, a click on the title opens one
    const [open, setOpen] = useState<Record<string, boolean>>({});
    if(!configContext) return null;

    const {configInput, results} = configContext;

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

    if (results?.outlines) {
        const outlines = section('Outlines');
        for (const [name, outline] of Object.entries(results.outlines)) {
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


    if (results?.cases) {
        const cases = section('Cases');
        for (const [name, caseObj] of Object.entries(results.cases)) {
            cases.push(
                {
                    fileName: name,
                    extension: 'stl',
                    // @ts-ignore
                    content: caseObj.stl,
                    preview: `cases.${name}.jscad`
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



    return (
      <DownloadsContainer>
          <Title>Downloads</Title>
          {
              sections.map(({title, items}) => {
                  const shown = items.filter(download => !download.fileName.startsWith("_"));
                  if (!shown.length) return null;
                  const isOpen = !!open[title];

                  return (
                      <SectionContainer key={title}>
                          <SectionHeader aria-expanded={isOpen} onClick={() => setOpen({...open, [title]: !isOpen})}>
                              <span>{isOpen ? '▾' : '▸'} {title}</span>
                              <span>{shown.length}</span>
                          </SectionHeader>
                          {isOpen && shown.map((download, i) =>
                              <DownloadRow key={i} {...download} setPreview={setPreview} setTabIndex={tabContext?.setTabIndex}/>
                          )}
                      </SectionContainer>
                  );
              })
          }
      </DownloadsContainer>
  );
};

      export default Downloads;
