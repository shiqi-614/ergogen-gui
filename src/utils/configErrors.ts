import {fieldOf, locateField} from "./layoutEdit";

// What ergogen could not make, and where in the config: the run's error, and each item tolerant mode left out
// (results.errors, "pcbs.left": its message). Without a field in its message an item points at the item itself.
export type ConfigError = { message: string, field: string, line: number, column: number, item?: string };

export const configErrors = (text: string, error: string | null | undefined, itemErrors: Record<string, string> | undefined): ConfigError[] => {
    const found: ConfigError[] = [];
    const add = (message: string, field: string | null, item?: string) => {
        const at = field ? locateField(text, field) : null;
        if (at) found.push({message, field: field as string, line: at.line, column: at.column, item});
    };
    if (error) add(String(error).replace(/^Error: /, ''), fieldOf(String(error)));
    for (const [item, message] of Object.entries(itemErrors ?? {})) add(message, fieldOf(message) ?? item, item);
    return found;
};

// The config editor, once it is there: the error rows and the error box move its cursor to a line
let editor: any = null;
export const setConfigEditor = (instance: any) => { editor = instance; };
// what shows the editor when it is hidden (the page starts with it hidden)
let showEditor: (() => void) | null = null;
export const setShowConfigEditor = (show: (() => void) | null) => { showEditor = show; };

export const revealLine = (line: number, column = 1) => {
    if (!editor) return;
    showEditor?.();
    // a frame later, once a hidden editor is shown and has its size again
    requestAnimationFrame(() => {
        editor.layout();
        editor.revealLineInCenter(line);
        editor.setPosition({lineNumber: line, column});
        editor.focus();
    });
};
