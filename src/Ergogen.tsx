import {useEffect, useRef, useState} from "react";
import ErrorBoundary from "./atoms/ErrorBoundary";
import {configErrors, revealLine, setShowConfigEditor} from "./utils/configErrors";
import styled from "styled-components";
import Split from "react-split";

import ConfigEditor from "./molecules/ConfigEditor";
import Downloads from "./molecules/Dowloads";
import FilePreview from "./molecules/FilePreview";
import LayoutEditor from "./molecules/LayoutEditor";

import {useConfigContext} from "./context/ConfigContext";
import Button from "./atoms/Button";
import Loading from "./atoms/Loading";
import Header from "./atoms/Header";
import DownloadIcon from "./atoms/DownloadIcon";
import {ConfigOption, exampleOptions } from "./examples";
import {colors, radius, shadow} from "./ui/theme";
import Select, {StylesConfig} from "react-select";
import ErgoCai from "./examples/ErgoCai";

// fills the screen below the header: 100vh minus the header (4rem) and the split padding (2rem)
const EditorContainer = styled.div`
  position: relative;
  height: calc(100vh - 6rem);
  display: flex;
  flex-direction: column;
  width: 100%;
  flex-grow: 1;
`;

// the rest of the window below the header: a few px more in a pane (Firefox) are cut off here, they no longer push
// the header smaller, and by another amount with the editor shown than hidden
const FlexContainer = styled.div`
  display: flex;
  flex-flow: wrap;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const Error = styled.div`
  /* an error the config's line is known for: a click shows it */
  &.located, .located {
    cursor: pointer;
  }

  &.located:hover, .located:hover {
    text-decoration: underline;
  }

  background: #ff6d6d;
  color: #a31111;
  padding: 1em;
  margin: 0.5em 0 0.5em 0;
  border: 1px solid #a31111;
  border-radius: 0.3em;
`;

const StyledFilePreview = styled(FilePreview)`
  height: 100%;
`;

// as tall as the previews (KicanvasPreview), so the spinner sits in the middle of the pane
const PreviewLoading = styled(Loading)`
  height: calc(100vh - 6rem);
`;

const StyledConfigEditor = styled(ConfigEditor)`
  position: relative;
  flex-grow: 1;
  min-height: 0;
`;

const GenerateContainer = styled.div`
  display: flex;
  gap: 0.5em;
`;

const GenerateButton = styled(Button)`
  flex-grow: 1;
`;

const IconButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  padding: 0 0.8rem;
`;

// saves the config as typed in the editor
const downloadConfig = (fileName: string, content: string) => {
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(new Blob([content], {type: "text/yaml"}));
    link.download = fileName;
    link.click();
    setTimeout(() => window.URL.revokeObjectURL(link.href), 1000);
};

// the example menu, where the header had the app's name: it reads as that title (its font and size), with a small
// arrow after it; the list is in the same type, smaller
const TITLE = {fontFamily: "'Noto Sans', sans-serif", fontSize: '1.5rem', fontWeight: 700};
const LIST = {...TITLE, fontSize: '1rem'};
const exampleMenuStyles: StylesConfig<ConfigOption, false> = {
    control: base => ({...base, ...TITLE, minHeight: 0, border: 'none', boxShadow: 'none', background: 'transparent', cursor: 'pointer'}),
    valueContainer: base => ({...base, padding: 0}),
    singleValue: base => ({...base, margin: 0, color: colors.strong}),
    placeholder: base => ({...base, margin: 0, color: colors.strong}),
    input: base => ({...base, margin: 0, padding: 0}),
    indicatorSeparator: () => ({display: 'none'}),
    dropdownIndicator: (base, state) => ({...base, padding: '0 0 0 0.35rem', color: state.isFocused ? colors.strong : colors.muted,
        ':hover': {color: colors.strong}}),
    menu: base => ({...base, ...LIST, width: 'max-content', minWidth: '100%', marginTop: '0.3rem', zIndex: 20,
        background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: radius.card, boxShadow: shadow}),
    menuList: base => ({...base, padding: '0.3rem 0', maxHeight: 'calc(100vh - 6rem)'}),
    group: base => ({...base, padding: '0.2rem 0'}),
    groupHeading: base => ({...base, color: colors.muted, fontSize: '0.75rem', fontWeight: 400, textTransform: 'none',
        margin: '0.2rem 0', padding: '0 0.9rem'}),
    option: (base, state) => ({...base, padding: '0.2rem 0.9rem', cursor: 'pointer',
        color: state.isSelected ? colors.accent : colors.strong,
        background: state.isFocused ? colors.buttonHover : 'transparent',
        ':active': {background: colors.button}}),
};

// the strip the hidden config editor leaves: a click shows the editor
const ShowButton = styled.button`
  width: 100%;
  height: calc(100vh - 6rem);
  writing-mode: vertical-rl;
  letter-spacing: 0.05em;
  border: none;
  border-radius: 0.25rem;
  background: #595959;
  color: #ffffff;
  font: inherit;
  cursor: pointer;

  &:hover {
    background: #6f6f6f;
  }
`;

// the strip the hidden editor leaves, in px
const FOLDED_WIDTH = 32;

// @ts-ignore
const StyledSplit = styled(Split)`
  width: 100%;
  height: 100%;
  display: flex;
  padding: 1rem;

  .gutter {
    background-color: #878787;
    border-radius: 0.15rem;

    background-repeat: no-repeat;
    background-position: 50%;

    &:hover {
      background-color: #a0a0a0;
    }

    &.gutter-horizontal {
      cursor: col-resize;
      background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAeCAYAAADkftS9AAAAIklEQVQoU2M4c+bMfxAGAgYYmwGrIIiDjrELjpo5aiZeMwF+yNnOs5KSvgAAAABJRU5ErkJggg==');
    }
  }
`;

// the outer split already pads the page, the nested one lines up with the editor's top
// @ts-ignore
const InnerSplit = styled(StyledSplit)`
  padding: 0;
`;

type Mode = 'preview' | 'layout';

const LeftSplitPane = styled.div`
    position: relative;
`;

const RightSplitPane = styled.div`
    position: relative;
`;

// the Downloads list scrolls in its pane, as tall as the previews: the page below the header does not scroll
const DownloadsPane = styled.div`
    height: calc(100vh - 6rem);
    overflow-y: auto;
`;

const Ergogen = () => {
    const [previewKey, setPreviewKey] = useState("demo.svg");
    const [selectedOption, setSelectedOption] = useState<ConfigOption|null>(ErgoCai);
    const configContext = useConfigContext();
    const [isProcessing, setIsProcessing] = useState(false);
    // demo.svg is the points and outlines, shown in the layout editor; everything else in its own preview
    const mode: Mode = previewKey === 'demo.svg' ? 'layout' : 'preview';

    // the cases are made only while a case or an assembly is on show (they take most of a run's time)
    const wantCases = mode === 'preview' && (previewKey.startsWith('cases.') || previewKey.startsWith('assemblies.'));
    useEffect(() => configContext?.setWantCases(wantCases), [wantCases]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(()=>{
        if(selectedOption?.value) {
            configContext?.setConfigInput(selectedOption.value)
        }
    }, [selectedOption]);

    // the config editor, hidden down to a strip at the left, as the page starts: the preview has the room until ▸
    // Config, or a jump to an error's line, shows it. It hides again once the pointer has left it (and the strip
    // between it and the preview, which a drag widens it by). The split's sizes it goes back to
    const [editorHidden, setEditorHidden] = useState(true);
    const [openSizes, setOpenSizes] = useState([30, 70]);
    const hideTimer = useRef<number>();
    const dragging = useRef(false);
    const stay = () => window.clearTimeout(hideTimer.current);
    const leave = () => {
        stay();
        if (!dragging.current) hideTimer.current = window.setTimeout(() => setEditorHidden(true), 300);
    };
    useEffect(() => stay, []);
    useEffect(() => {
        setShowConfigEditor(() => setEditorHidden(false));
        return () => setShowConfigEditor(null);
    }, []);

    if (!configContext) return null;


    let walkArray = configContext?.results;
    // Walk through the JSON keys until we get the content of the desired previewKey
    previewKey.split(".").forEach((key) => walkArray = walkArray?.[key]);

    let previewContent: string | Blob = typeof walkArray === 'string' || walkArray instanceof Blob ? walkArray : "";
    let selectedOptionLabel = selectedOption?.label;

    // the full run goes on in the layout editor too: without the cases (made only while one is on show) it is quick
    const showPreview = (key: string) => setPreviewKey(key);

    return (
        <>
        {/* the example menu in the header: hiding the config editor does not hide it */}
        <Header>
            <Select<ConfigOption, false>
                aria-label="Example"
                classNamePrefix="example-menu"
                options={exampleOptions}
                value={selectedOption}
                onChange={option => setSelectedOption(option)}
                isSearchable={false}
                placeholder="Ergogen"
                styles={exampleMenuStyles}
            />
        </Header>
        <FlexContainer>
            <StyledSplit
                direction={"horizontal"}
                // hidden, the editor's pane shrinks to its minimum: the strip with the button that shows it
                sizes={editorHidden ? [0, 100] : openSizes}
                minSize={[FOLDED_WIDTH, 100]}
                gutterSize={10}
                snapOffset={0}
                // the strip between the editor and the preview counts as the editor's: the pointer on it keeps it
                gutter={(index: number, direction: string) => {
                    const gutter = document.createElement('div');
                    gutter.className = `gutter gutter-${direction}`;
                    gutter.addEventListener('mouseenter', stay);
                    gutter.addEventListener('mouseleave', leave);
                    return gutter;
                }}
                onDragStart={() => { dragging.current = true; stay(); }}
                // dragging the strip out shows the editor again, at the width it is dragged to
                onDragEnd={(sizes: number[]) => { dragging.current = false; setEditorHidden(false); setOpenSizes(sizes); }}
            >
                <LeftSplitPane onMouseEnter={stay} onMouseLeave={leave}>
                    {editorHidden && <ShowButton title="Show the config editor" onClick={() => setEditorHidden(false)}>▸ Config</ShowButton>}
                    {/* hidden, not unmounted: the editor keeps its undo history */}
                    <EditorContainer style={editorHidden ? {display: 'none'} : undefined}>
                        <ErrorBoundary area="the config editor"><StyledConfigEditor/></ErrorBoundary>

                        <GenerateContainer>
                            <GenerateButton
                              size={'medium'}
                              disabled={isProcessing}
                              onClick={() => configContext?.processInput(
                                configContext?.configInput,
                                {
                                    is_preview: false,
                                    setProcessing: setIsProcessing
                                }
                              )}
                            >
                              {isProcessing ? 'Processing...' : 'Generate'}
                            </GenerateButton>
                            <IconButton
                              size={'medium'}
                              title={'Download the config'}
                              disabled={!configContext?.configInput}
                              onClick={() => downloadConfig(`${selectedOptionLabel ?? "config"}_raw.yaml`, configContext?.configInput ?? '')}
                            >
                              <DownloadIcon/>
                            </IconButton>
                        </GenerateContainer>
                        {configContext?.error && (() => {
                            const at = configErrors(configContext.configInput ?? '', configContext.error, undefined)[0];
                            return <Error role="alert" data-ergogen-error className={at ? 'located' : ''} title={at ? `Show line ${at.line} in the config` : undefined}
                                          onClick={() => at && revealLine(at.line, at.column)}>{configContext?.error?.toString()}</Error>;
                        })()}
                        {/* the parts ergogen could not make; the rest is made and shown */}
                        {!configContext?.error && Object.keys(configContext?.results?.errors ?? {}).length > 0 && (
                            <Error role="alert" data-ergogen-error>
                                {Object.entries(configContext.results.errors as Record<string, string>).map(([item, message]) => {
                                    const at = configErrors(configContext.configInput ?? '', null, {[item]: message})[0];
                                    return (
                                        <div key={item} className={at ? 'located' : ''} title={at ? `Show line ${at.line} in the config` : undefined}
                                             onClick={() => at && revealLine(at.line, at.column)}><b>{item}</b> could not be made: {message}</div>
                                    );
                                })}
                            </Error>
                        )}
                    </EditorContainer>
                </LeftSplitPane>

                <RightSplitPane>
                    <InnerSplit
                        direction={"horizontal"}
                        sizes={[70, 30]}
                        minSize={100}
                        gutterSize={10}
                        snapOffset={0}
                    >
                        <LeftSplitPane>
                            <ErrorBoundary area={mode === 'layout' ? 'the layout editor' : 'the preview'}
                                           resetKey={`${mode} ${previewKey} ${configContext.configInput}`}>
                                {mode === 'layout'
                                    ? <LayoutEditor/>
                                    // until the first run has results (or an error) there is nothing to preview
                                    : configContext.results || configContext.error
                                        ? <StyledFilePreview key={previewKey} previewKey={previewKey} previewContent={previewContent}/>
                                        : <PreviewLoading text="Generating the preview…"/>}
                            </ErrorBoundary>
                        </LeftSplitPane>
                        <RightSplitPane>
                            <DownloadsPane>
                                <ErrorBoundary area="the Downloads list" resetKey={configContext.configInput}>
                                    <Downloads setPreview={showPreview} label={selectedOptionLabel}
                                               previewKey={previewKey}/>
                                </ErrorBoundary>
                            </DownloadsPane>
                        </RightSplitPane>
                    </InnerSplit>
                </RightSplitPane>
            </StyledSplit>
        </FlexContainer>
        </>
    );
}

export default Ergogen;
