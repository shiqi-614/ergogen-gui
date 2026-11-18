import {useEffect, useRef, useState} from "react";
import ErrorBoundary from "./atoms/ErrorBoundary";
import {configErrors, revealLine} from "./utils/configErrors";
import styled from "styled-components";
import Split from "react-split";

import ConfigEditor from "./molecules/ConfigEditor";
import Downloads from "./molecules/Dowloads";
import FilePreview from "./molecules/FilePreview";
import {OutlineRequest} from "./molecules/NewOutline";
import LayoutEditor from "./molecules/LayoutEditor";

import {useConfigContext} from "./context/ConfigContext";
import Button from "./atoms/Button";
import Loading from "./atoms/Loading";
import Select from "react-select";
import DownloadIcon from "./atoms/DownloadIcon";
import {ConfigOption, exampleOptions } from "./examples";
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

const FlexContainer = styled.div`
  display: flex;
  flex-flow: wrap;
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

const StyledSelect = styled(Select)`
    color: black;
    white-space: nowrap;
`;

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

// switches the middle pane between the file preview and the layout editor
const ModeBar = styled.div`
  position: absolute;
  top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: flex;
  border-radius: 0.25rem;
  overflow: hidden;
  background: #595959;
`;

const ModeTab = styled.button<{ active: boolean }>`
  padding: 0.3rem 0.9rem;
  border: none;
  background: ${p => p.active ? '#28a745' : 'transparent'};
  color: #ffffff;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
`;

type Mode = 'preview' | 'layout';

const LeftSplitPane = styled.div`
    position: relative;
`;

const RightSplitPane = styled.div`
    position: relative;
`;

const Ergogen = () => {
    const [previewKey, setPreviewKey] = useState("demo.svg");
    const [selectedOption, setSelectedOption] = useState<ConfigOption|null>(ErgoCai);
    const configContext = useConfigContext();
    const [isProcessing, setIsProcessing] = useState(false);
    const [mode, setMode] = useState<Mode>('preview');
    const configOnEnteringLayout = useRef<string | undefined>();
    // a new outline asked for in the Downloads list, made by the layout editor
    const [outlineRequest, setOutlineRequest] = useState<OutlineRequest | null>(null);

    // the cases are made only while a case or an assembly is on show (they take most of a run's time)
    const wantCases = mode === 'preview' && (previewKey.startsWith('cases.') || previewKey.startsWith('assemblies.'));
    useEffect(() => configContext?.setWantCases(wantCases), [wantCases]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(()=>{
        if(selectedOption?.value) {
            configContext?.setConfigInput(selectedOption.value)
        }
    }, [selectedOption]);

    if (!configContext) return null;


    let walkArray = configContext?.results;
    // Walk through the JSON keys until we get the content of the desired previewKey
    previewKey.split(".").forEach((key) => walkArray = walkArray?.[key]);

    let previewContent: string | Blob = typeof walkArray === 'string' || walkArray instanceof Blob ? walkArray : "";
    let selectedOptionLabel = selectedOption?.label;

    // A full preview blocks the page for minutes, so it pauses while the layout editor is
    // open and runs once on the way out if the layout changed
    const switchMode = (next: Mode) => {
        if (next === mode) return;
        if (next === 'layout') {
            configOnEnteringLayout.current = configContext.configInput;
            configContext.setAutoGen(false);
        } else {
            configContext.setAutoGen(true);
            if (configContext.configInput !== configOnEnteringLayout.current) {
                configContext.processInput(configContext.configInput, {is_preview: true});
            }
        }
        setMode(next);
    };

    const showPreview = (key: string) => {
        setPreviewKey(key);
        switchMode('preview');
    };

    const newOutline = (request: OutlineRequest) => {
        setOutlineRequest(request);
        switchMode('layout');
    };

    return (
        <FlexContainer>
            <StyledSplit
                direction={"horizontal"}
                sizes={[30, 70]}
                minSize={100}
                gutterSize={10}
                snapOffset={0}
            >
                <LeftSplitPane>
                    <EditorContainer>
                        <StyledSelect
                            options={exampleOptions}
                            value={selectedOption}
                            // @ts-ignore
                            onChange={(newValue: ConfigOption|null) => setSelectedOption(newValue)}
                            placeholder={"Paste your config below, or select an example here!"}
                        />
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
                            <ModeBar>
                                <ModeTab active={mode === 'preview'} onClick={() => switchMode('preview')}>Preview</ModeTab>
                                <ModeTab active={mode === 'layout'} onClick={() => switchMode('layout')}>Layout</ModeTab>
                            </ModeBar>
                            <ErrorBoundary area={mode === 'layout' ? 'the layout editor' : 'the preview'}
                                           resetKey={`${mode} ${previewKey} ${configContext.configInput}`}>
                                {mode === 'layout'
                                    ? <LayoutEditor request={outlineRequest} onRequestDone={() => setOutlineRequest(null)}/>
                                    // until the first run has results (or an error) there is nothing to preview
                                    : configContext.results || configContext.error
                                        ? <StyledFilePreview key={previewKey} previewKey={previewKey} previewContent={previewContent}/>
                                        : <PreviewLoading text="Generating the preview…"/>}
                            </ErrorBoundary>
                        </LeftSplitPane>
                        <RightSplitPane>
                            <ErrorBoundary area="the Downloads list" resetKey={configContext.configInput}>
                                <Downloads setPreview={showPreview} label={selectedOptionLabel} onNewOutline={newOutline}
                                           previewKey={mode === 'preview' ? previewKey : undefined}/>
                            </ErrorBoundary>
                        </RightSplitPane>
                    </InnerSplit>
                </RightSplitPane>
            </StyledSplit>
        </FlexContainer>
    );
}

export default Ergogen;
