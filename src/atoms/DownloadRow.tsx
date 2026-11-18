import styled, {css} from "styled-components";
import {Dispatch, SetStateAction} from "react";
import DownloadIcon from "./DownloadIcon";
import TrashIcon from "./TrashIcon";

type Props = {
    fileName: string,
    extension: string,
    content: string,
    preview?: string,
    // shown instead of the file name; an entry without content only previews
    label?: string,
    // the preview pane shows this file
    active?: boolean,
    setPreview: (preview: string) => void,
    setTabIndex: Dispatch<SetStateAction<number>> | undefined,
    // deletes what the row is from the config (after asking)
    onDelete?: () => void,
    // why ergogen could not make it
    error?: string,
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

// next to the download button: grey until pointed at
const DeleteButton = styled.button`
    display: inline-flex;
    flex-shrink: 0;
    margin-left: 0.35em;
    padding: 0.3rem;
    border: none;
    border-radius: 0.25rem;
    background-color: #4a4a4a;
    color: #d0d0d0;
    font: inherit;
    cursor: pointer;
    transition: background-color .15s ease-in-out;

    &:hover {
      background-color: #a33a3a;
      color: #ffffff;
    }
`;

// a row of something ergogen could not make: its name in red, the reason under the pointer
const Failed = styled.div`
    flex-grow: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #ff8a80;
    cursor: help;
`;

const DownloadRow = ({fileName, extension, content, preview, label, active = false, setPreview, setTabIndex, onDelete, error}: Props): JSX.Element => {
    const fullName = label || `${fileName}.${extension}`;
    return (
        <Row $previewable={!!preview} $active={active}>
            {error ? (
                <Failed title={error} data-failed={fileName}>⚠ {fullName}: could not be made</Failed>
            ) : preview ? (
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
            {content && (
                <DownloadLink target={"_blank"}
                   rel={"noreferrer"}
                   title={`Download ${fullName}`}
                   download={fullName}
                   href={window.URL.createObjectURL(new Blob([content], {type: "octet/stream"}))}>
                    <DownloadIcon/>
                </DownloadLink>
            )}
            {onDelete && (
                <DeleteButton title={`Delete ${label || fileName}`} onClick={onDelete}>
                    <TrashIcon/>
                </DeleteButton>
            )}
        </Row>
    );
};

export default DownloadRow;
