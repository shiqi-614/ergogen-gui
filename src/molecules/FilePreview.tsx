import SvgPreview from "../atoms/SvgPreview";
import StlPreview from "../atoms/StlPreview";
import PcbPreview from "./PcbPreview";
import {useConfigContext} from "../context/ConfigContext";

type Props = {
    previewKey: string,
    previewContent: string | Blob,
    width?: number | string,
    height?: number | string,
    className?: string
};

const FilePreview = ({previewKey, previewContent, width = '100%', height = '100%', className}: Props) => {
    const previewExt = previewKey.split(".").slice(-1)[0];
    const text = typeof previewContent === 'string' ? previewContent : "";
    const results = useConfigContext()?.results as any;
    // assemblies.<name>: the board it holds, in 3D with its case
    const assembly = previewKey.startsWith('assemblies.') ? results?.assemblies?.[previewKey.slice('assemblies.'.length)] : null;
    if (assembly) {
        const board = assembly.pcb?.name;
        return (
            <div className={className}>
                <PcbPreview pcb={results?.pcbs?.[board]?.preview?.kicad_pcb || ''} board={board} initialView="3d"/>
            </div>
        );
    }

    const renderFilePreview = (previewExt: string) => {
        switch (previewExt) {
            case 'svg':
                return (
                    <SvgPreview svg={text} width={width} height={height}/>
                )
            case 'stl':
                return (
                    <StlPreview stl={previewContent instanceof Blob ? previewContent : null}/>
                )
            case 'kicad_pcb':
                return (
                    <PcbPreview pcb={text} board={previewKey.split(".")[1]}/>
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