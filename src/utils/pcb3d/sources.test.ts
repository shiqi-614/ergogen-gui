import {expect, it} from "vitest";
import {addressOf, formatOf, parseSources} from "./sources";

const sources = parseSources(`
"\${ERGOCAI_LIB}": github:shiqi-614/ErgoCaiLib
"\${KICAD8_3DMODEL_DIR}": https://raw.githubusercontent.com/KiCad/kicad-packages3D/5.1.7/
"\${KICAD8_3RD_PARTY}/3dmodels/com_github_ebastler_marbastlib": https://example.com/marbastlib/3dmodels
"\${KICAD8_3RD_PARTY}/3dmodels/com_github_ebastler_marbastlib/odd.step": https://example.com/elsewhere/odd.STEP
"\${OTHER}": github:someone/lib/models/
`);

it('reads a model from a GitHub repo, under the path that follows the variable', () => {
    expect(addressOf('${ERGOCAI_LIB}/3dmodels/KS-3X Full Black Switch.stp', sources))
        .toEqual({repo: 'shiqi-614/ErgoCaiLib', file: '3dmodels/KS-3X Full Black Switch.stp'});
    expect(addressOf('${OTHER}/a.wrl', sources)).toEqual({repo: 'someone/lib', file: 'models/a.wrl'});
});

it('builds a URL with each part of the path encoded', () => {
    expect(addressOf('${KICAD8_3DMODEL_DIR}/Resistor_SMD.3dshapes/R 0603.wrl', sources))
        .toEqual({url: 'https://raw.githubusercontent.com/KiCad/kicad-packages3D/5.1.7/Resistor_SMD.3dshapes/R%200603.wrl'});
});

it('takes the longest entry, a whole path included', () => {
    expect(addressOf('${KICAD8_3RD_PARTY}/3dmodels/com_github_ebastler_marbastlib/ebyte.step', sources))
        .toEqual({url: 'https://example.com/marbastlib/3dmodels/ebyte.step'});
    expect(addressOf('${KICAD8_3RD_PARTY}/3dmodels/com_github_ebastler_marbastlib/odd.step', sources))
        .toEqual({url: 'https://example.com/elsewhere/odd.STEP'});
});

it('reads KiCad 5 variables and backslashes, and knows no address for the rest', () => {
    expect(addressOf('$(ERGOCAI_LIB)\\3dmodels\\a.step', sources)).toEqual({repo: 'shiqi-614/ErgoCaiLib', file: '3dmodels/a.step'});
    expect(addressOf('/Users/me/a.step', sources)).toBeNull();
    // a prefix only counts up to a "/"
    expect(addressOf('${ERGOCAI_LIBRARY}/a.step', sources)).toBeNull();
});

it('picks the converter by extension', () => {
    expect(['a.STEP', 'a.stp', 'a.igs', 'a.wrl', 'a.obj'].map(formatOf)).toEqual(['step', 'step', 'iges', 'vrml', null]);
});
