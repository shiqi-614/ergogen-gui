/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ERGOGEN_API_URL?: string;
}

interface Window {
    ergogen: any;
}
