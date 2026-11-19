import {useRef, useState} from "react";
import styled from "styled-components";
import {usePanZoom} from "../ui";

type Props = {
  svg: string,
  width: number | string,
  height: number | string
};

const Frame = styled.div`
  position: relative;
  overflow: hidden;
  height: 100%;
`;

const InvertedImage = styled.img`
  filter: invert();
  transform-origin: 0 0;
  user-select: none;
  -webkit-user-drag: none;
`;

// An SVG (the points' demo), moved with the right mouse button held down and zoomed with the wheel, like the other
// previews
const SvgPreview = ({svg, width, height}: Props): JSX.Element => {
    const frame = useRef<HTMLDivElement>(null);
    const [at, setAt] = useState({x: 0, y: 0, scale: 1});
    usePanZoom(frame, {
        pan: ({dx, dy}) => setAt(a => ({...a, x: a.x + dx, y: a.y + dy})),
        // about the pointer: the point under it stays where it is
        zoom: (factor, px, py) => setAt(a => {
            const scale = Math.min(20, Math.max(0.2, a.scale / factor));
            const k = scale / a.scale;
            return {scale, x: px - (px - a.x) * k, y: py - (py - a.y) * k};
        }),
    });
    return (
        <Frame ref={frame} onDoubleClick={() => setAt({x: 0, y: 0, scale: 1})} title="Right-drag to move, the wheel to zoom, a double click to reset">
            <InvertedImage
                width={width || '100%'}
                height={height || '100%'}
                style={{transform: `translate(${at.x}px, ${at.y}px) scale(${at.scale})`}}
                src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
                alt={'Ergogen SVG Output preview'}
                draggable={false}
            />
        </Frame>
    );
};

export default SvgPreview;
