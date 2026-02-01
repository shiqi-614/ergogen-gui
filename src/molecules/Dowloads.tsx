import DownloadRow from "../atoms/DownloadRow";
import yaml from 'js-yaml';
import styled from "styled-components";
import {useConfigContext} from "../context/ConfigContext";
import {Dispatch, SetStateAction, useContext} from "react";
import {TabContext} from "../organisms/Tabs";


const DownloadsContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
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

const Downloads = ({setPreview, label}: Props) => {
    let downloads: DownloadArr = [];
    const configContext = useConfigContext();
    const tabContext = useContext(TabContext);
    if(!configContext) return null;

    const {configInput, results} = configContext;

    if (results?.demo) {
        let rawFileName = label + "_raw";
        downloads.push({
                fileName: rawFileName,
                extension: 'yaml',
                content: configInput ?? ''
            }, {
                fileName: 'canonical',
                extension: 'yaml',
                content: yaml.dump(results.points)
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
        for (const [name, outline] of Object.entries(results.outlines)) {
            downloads.push(
                {
                    fileName: name,
                    extension: 'dxf',
                    // @ts-ignore
                    content: outline.dxf,
                    preview: `outlines.${name}.svg`
                },
                {
                    fileName: name,
                    extension: 'yaml',
                    // @ts-ignore
                    content: yaml.dump(outline.yaml)
                }
            )
        }

    }

    if (results?.pcbs) {
        for (const [pcb_name, pcb_data] of Object.entries(results.pcbs as Record<string, { preview?: { dxf: any; svg: any} }>)) {
            if (pcb_data?.preview) {
                downloads.push({
                        fileName: pcb_name,
                        extension: 'dxf',
                        content: pcb_data.preview.dxf,
                        preview: `pcbs.${pcb_name}.preview.svg`, 
                    }
                )
            }
        }
    }


    if (results?.cases) {
        for (const [name, caseObj] of Object.entries(results.cases)) {
            downloads.push(
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
        for (const [name, content] of Object.entries(results.kicad)) {
            if (typeof content === "string") {
                const binaryString = atob(content);

                // Create a Uint8Array from the binary string
                const binaryArray = new Uint8Array(binaryString.length);

                for (let i = 0; i < binaryString.length; i++) {
                    binaryArray[i] = binaryString.charCodeAt(i);
                }

                downloads.push(
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
          <h3>Downloads</h3>
          {
              downloads.map(
                  (download, i) => {
                      if (download.fileName.startsWith("_")) return false;

                      return <DownloadRow key={i} {...download} setPreview={setPreview} setTabIndex={tabContext?.setTabIndex}/>;
                  }
              )
          }
      </DownloadsContainer>
  );
};

      export default Downloads;
