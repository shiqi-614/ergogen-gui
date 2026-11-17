import styled, {css} from "styled-components";
import {Dispatch, SetStateAction} from "react";
import DownloadIcon from "./DownloadIcon";

type Props = {
    fileName: string,
    extension: string,
    content: string,
    preview?: string,
    // the preview pane shows this file
    active?: boolean,
    setPreview: (preview: string) => void,
    setTabIndex: Dispatch<SetStateAction<number>> | undefined
};

// a file with a preview shows a hand and lights up under the pointer; the one on show stays marked
const Row = styled.div<{ $previewable: boolean, $active: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3em;
  padding: 0.1rem 0.1rem 0.1rem 0.35rem;
  border-left: 0.2rem solid ${p => p.$active ? '#28a745' : 'transparent'};
  border-radius: 0.25rem;
  background: ${p => p.$active ? 'rgba(40, 167, 69, 0.18)' : 'transparent'};
  transition: background-color 150ms ease-in-out;

  ${p => p.$previewable && !p.$active && css`
    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }
  `}
`;

// a file that only downloads: dimmer
const FileName = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
    color: #a6a6a6;
`;

// a file with a preview opens it when its name is clicked
const PreviewLink = styled.button<{ $active: boolean }>`
    flex-grow: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0.1rem 0;
    border: none;
    background: none;
    color: ${p => p.$active ? '#5fd17a' : '#ffffff'};
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      color: #5fd17a;
      text-decoration: underline;
    }
`;

const DownloadLink = styled.a`
    display: inline-flex;
    flex-shrink: 0;
    margin-left: 0.5em;
    padding: 0.3rem;
    border-radius: 0.25rem;
    background-color: #28a745;
    color: #ffffff;
    transition: background-color .15s ease-in-out;

    &:hover {
      background-color: #218838;
    }
`;

const DownloadRow = ({fileName, extension, content, preview, active = false, setPreview, setTabIndex}: Props): JSX.Element => {
    const fullName = `${fileName}.${extension}`;
    return (
        <Row $previewable={!!preview} $active={active}>
            {preview ? (
                <PreviewLink
                    $active={active}
                    title={`Preview ${fullName}`}
                    aria-current={active || undefined}
                    onClick={()=>{
                        setPreview(preview);
                        setTabIndex?.(0)
                    }}
                >
                    {fullName}
                </PreviewLink>
            ) : (
                <FileName>{fullName}</FileName>
            )}
            <DownloadLink target={"_blank"}
               rel={"noreferrer"}
               title={`Download ${fullName}`}
               download={fullName}
               href={window.URL.createObjectURL(new Blob([content], {type: "octet/stream"}))}>
                <DownloadIcon/>
            </DownloadLink>
        </Row>
    );
};

export default DownloadRow;
