import Editor from "@monaco-editor/react";

import React, {useEffect, useRef} from "react";
import {configErrors, setConfigEditor} from "../utils/configErrors";
import {useConfigContext} from "../context/ConfigContext";

type Props = {
  className?: string
};

const ConfigEditor = ({className}: Props) => {
    const configContext = useConfigContext();

    // @ts-ignore
    const {configInput, setConfigInput} = configContext;

    const handleChange = async (textInput: string | undefined) => {
        if(!textInput) return null;

        setConfigInput(textInput);
    }

    useEffect(() => {
        handleChange(configInput);
    }, []);

    // what ergogen could not make, underlined where the config says it, its message under the pointer
    const monacoRef = useRef<any>(null);
    const editorRef = useRef<any>(null);
    const error = configContext?.error;
    const itemErrors = (configContext?.results as any)?.errors;
    useEffect(() => {
        const monaco = monacoRef.current, model = editorRef.current?.getModel();
        if (!monaco || !model) return;
        const markers = configErrors(model.getValue(), error, itemErrors).map(e => {
            const word = model.getWordAtPosition({lineNumber: e.line, column: e.column});
            return {
                severity: monaco.MarkerSeverity.Error, message: e.item ? `${e.item} could not be made: ${e.message}` : e.message,
                startLineNumber: e.line, startColumn: e.column, endLineNumber: e.line,
                endColumn: word ? word.endColumn : model.getLineMaxColumn(e.line),
            };
        });
        monaco.editor.setModelMarkers(model, 'ergogen', markers);
    }, [error, itemErrors]);

    return (
        <div className={className}>
            <Editor
                height="100%"
                options={{automaticLayout: true}}
                defaultLanguage="JSON"
                onChange={handleChange}
                value={configInput}
                theme={"vs-dark"}
                onMount={(instance, monaco) => { editorRef.current = instance; monacoRef.current = monaco; setConfigEditor(instance); }}
                defaultValue={configInput}
            />
        </div>
    );
}

export default ConfigEditor;