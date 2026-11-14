import styled from "styled-components";
import {Dispatch, SetStateAction} from "react";
import DownloadIcon from "./DownloadIcon";

type Props = {
    fileName: string,
    extension: string,
    content: string,
    preview?: string,
    setPreview: (preview: string) => void,
    setTabIndex: Dispatch<SetStateAction<number>> | undefined
};

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5em
`;

const FileName = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
`;

// a file with a preview opens it when its name is clicked
const PreviewLink = styled.button`
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      color: #28a745;
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

const DownloadRow = ({fileName, extension, content, preview, setPreview, setTabIndex}: Props): JSX.Element => {
    const fullName = `${fileName}.${extension}`;
    return (
        <Row>
            {preview ? (
                <PreviewLink
                    title={`Preview ${fullName}`}
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
