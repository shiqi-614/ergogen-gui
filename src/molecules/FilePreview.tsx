import SvgPreview from "../atoms/SvgPreview";
import JscadPreview from "../atoms/JscadPreview";
import KicanvasPreview from "../atoms/KicanvasPreview";

type Props = {
    previewKey: string,
    previewContent: string,
    width?: number | string,
    height?: number | string,
    className?: string
};

const FilePreview = ({previewKey, previewContent, width = '100%', height = '100%', className}: Props) => {
    const previewExt = previewKey.split(".").slice(-1)[0];

    const renderFilePreview = (previewExt: string) => {
        switch (previewExt) {
            case 'svg':
                return (
                    <SvgPreview svg={previewContent} width={width} height={height}/>
                )
            case 'jscad':
                return (
                    <JscadPreview previewContent={previewContent}/>
                )
            case 'kicad_pcb':
                return (
                    <KicanvasPreview pcb={previewContent} name={`${previewKey.split(".")[1]}_preview.kicad_pcb`}/>
                )
            default:
                return <></>;
        }
    };

    return (
        <div className={className}>
            {renderFilePreview(previewExt)}
        </div>
    );
}

export default FilePreview;