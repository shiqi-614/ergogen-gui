// Where the 3D preview downloads a footprint's 3D model from. ErgoCaiLib keeps the table in 3dmodels/sources.yaml
// (the comment there says how it is read): each entry is the start of a KiCad model path and the address its files
// are at, a GitHub repo ("github:owner/repo[/folder]") or a URL.
import yaml from "js-yaml";

export const SOURCES_FILE = {repo: 'shiqi-614/ErgoCaiLib', file: '3dmodels/sources.yaml'};

export type Source = { prefix: string, repo?: string, folder?: string, url?: string };
export type ModelAddress = { repo: string, file: string } | { url: string };

// KiCad 5 also wrote $(VAR) for ${VAR}, and Windows paths have backslashes
export const normalizePath = (path: string) =>
    path.trim().replace(/\\/g, '/').replace(/\$\(([^)]+)\)/g, '${$1}');

export const parseSources = (text: string): Source[] => {
    const table = yaml.load(text);
    if (!table || typeof table !== 'object' || Array.isArray(table)) throw new Error('the file is not a table');
    return Object.entries(table as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([prefix, address]): Source => {
            const p = normalizePath(prefix).replace(/\/+$/, '');
            const github = address.trim().match(/^github:([^/\s]+\/[^/\s]+?)(?:\/(.*?))?\/?$/);
            return github ? {prefix: p, repo: github[1], folder: github[2] || ''} : {prefix: p, url: address.trim().replace(/\/+$/, '')};
        })
        // the longest prefix that fits a path wins
        .sort((a, b) => b.prefix.length - a.prefix.length);
};

export const addressOf = (path: string, sources: Source[]): ModelAddress | null => {
    const p = normalizePath(path);
    const source = sources.find(s => p === s.prefix || p.startsWith(s.prefix + '/'));
    if (!source) return null;
    const rest = p.slice(source.prefix.length).replace(/^\/+/, '');
    if (source.repo) return {repo: source.repo, file: [source.folder, rest].filter(Boolean).join('/')};
    return {url: source.url + (rest ? '/' + rest.split('/').map(encodeURIComponent).join('/') : '')};
};

// the converter a model needs, by its file's extension
export const formatOf = (path: string): 'step' | 'iges' | 'vrml' | null => {
    const ext = (path.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
    if (ext === 'step' || ext === 'stp') return 'step';
    if (ext === 'iges' || ext === 'igs') return 'iges';
    if (ext === 'wrl' || ext === 'vrml') return 'vrml';
    return null;
};
