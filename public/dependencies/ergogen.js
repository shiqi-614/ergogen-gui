/*!
 * Ergogen v4.1.0
 * https://ergogen.xyz
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('makerjs'), require('js-yaml'), require('jszip'), require('mathjs'), require('kle-serial'), require('axios'), require('fs'), require('path')) :
	typeof define === 'function' && define.amd ? define(['makerjs', 'js-yaml', 'jszip', 'mathjs', 'kle-serial', 'axios', 'fs', 'path'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.ergogen = factory(global.makerjs, global.jsyaml, global.jszip, global.math, global.kle, global.axios, global.require$$0$2, global.require$$2));
})(this, (function (require$$0, require$$1$1, require$$1$2, require$$3, require$$1, require$$0$1, require$$0$2, require$$2) { 'use strict';

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var utils = {};

	const m$9 = require$$0;

	utils.deepcopy = value => {
	    if (value === undefined) return undefined
	    return JSON.parse(JSON.stringify(value))
	};

	const deep = utils.deep = (obj, key, val) => {
	    const levels = key.split('.');
	    const last = levels.pop();
	    let step = obj;
	    for (const level of levels) {
	        step[level] = step[level] || {};
	        step = step[level];
	    }
	    if (val === undefined) return step[last]
	    step[last] = val;
	    return obj
	};

	utils.template = (str, vals={}) => {
	    const regex = /\{\{([^}]*)\}\}/g;
	    let res = str;
	    let shift = 0;
	    for (const match of str.matchAll(regex)) {
	        const replacement = (deep(vals, match[1]) || '') + '';
	        res = res.substring(0, match.index + shift)
	            + replacement
	            + res.substring(match.index + shift + match[0].length);
	        shift += replacement.length - match[0].length;
	    }
	    return res
	};

	const eq = utils.eq = (a=[], b=[]) => {
	    return a[0] === b[0] && a[1] === b[1]
	};

	const line = utils.line = (a, b) => {
	    return new m$9.paths.Line(a, b)
	};

	utils.circle = (p, r) => {
	    return {paths: {circle: new m$9.paths.Circle(p, r)}}
	};

	utils.rect = (w, h, o=[0, 0]) => {
	    const res = {
	        top:    line([0, h], [w, h]),
	        right:  line([w, h], [w, 0]),
	        bottom: line([w, 0], [0, 0]),
	        left:   line([0, 0], [0, h])
	    };
	    return m$9.model.move({paths: res}, o)
	};

	utils.poly = (arr) => {
	    let counter = 0;
	    let prev = arr[arr.length - 1];
	    const res = {
	        paths: {}
	    };
	    for (const p of arr) {
	        if (eq(prev, p)) continue
	        res.paths['p' + (++counter)] = line(prev, p);
	        prev = p;
	    }
	    return res
	};

	utils.bbox = (arr) => {
	    let minx = Infinity;
	    let miny = Infinity;
	    let maxx = -Infinity;
	    let maxy = -Infinity;
	    for (const p of arr) {
	        minx = Math.min(minx, p[0]);
	        miny = Math.min(miny, p[1]);
	        maxx = Math.max(maxx, p[0]);
	        maxy = Math.max(maxy, p[1]);
	    }
	    return {low: [minx, miny], high: [maxx, maxy]}
	};

	const farPoint = utils.farPoint = [1234.1234, 2143.56789];

	utils.union = utils.add = (a, b) => {
	    return m$9.model.combine(a, b, false, true, false, true, {
	        farPoint
	    })
	};

	utils.subtract = (a, b) => {
	    return m$9.model.combine(a, b, false, true, true, false, {
	        farPoint
	    })
	};

	utils.intersect = (a, b) => {
	    return m$9.model.combine(a, b, true, false, true, false, {
	        farPoint
	    })
	};

	utils.stack = (a, b) => {
	    return {
	        models: {
	            a, b
	        }
	    }
	};

	const semver = utils.semver = (str, name='') => {
	    let main = str.split('-')[0];
	    if (main.startsWith('v')) {
	        main = main.substring(1);
	    }
	    while (main.split('.').length < 3) {
	        main += '.0';
	    }
	    if (/^\d+\.\d+\.\d+$/.test(main)) {
	        const parts = main.split('.').map(part => parseInt(part, 10));
	        return {major: parts[0], minor: parts[1], patch: parts[2]}
	    } else throw new Error(`Invalid semver "${str}" at ${name}!`)
	};

	utils.satisfies = (current, expected) => {
	    if (current.major === undefined) current = semver(current);
	    if (expected.major === undefined) expected = semver(expected);
	    return current.major === expected.major && (
	        current.minor > expected.minor || (
	            current.minor === expected.minor && 
	            current.patch >= expected.patch
	        )
	    )
	};

	var io$1 = {};

	var assert$1 = {};

	const m$8 = require$$0;
	const u$8 = utils;

	var point = class Point {
	    constructor(x=0, y=0, r=0, meta={}) {
	        if (Array.isArray(x)) {
	            this.x = x[0];
	            this.y = x[1];
	            this.r = 0;
	            this.meta = {};
	        } else {
	            this.x = x;
	            this.y = y;
	            this.r = r;
	            this.meta = meta;
	        }
	    }

	    get p() {
	        return [this.x, this.y]
	    }

	    set p(val) {
	        [this.x, this.y] = val;
	    }

	    shift(s, relative=true, resist=false) {
	        s[0] *= (!resist && this.meta.mirrored) ? -1 : 1;
	        if (relative) {
	            s = m$8.point.rotate(s, this.r);
	        }
	        this.x += s[0];
	        this.y += s[1];
	        return this
	    }

	    rotate(angle, origin=[0, 0], resist=false) {
	        angle *= (!resist && this.meta.mirrored) ? -1 : 1;
	        if (origin) {
	            this.p = m$8.point.rotate(this.p, angle, origin);
	        }
	        this.r += angle;
	        return this
	    }

	    mirror(x) {
	        this.x = 2 * x - this.x;
	        this.r = -this.r;
	        return this
	    }

	    clone() {
	        return new Point(
	            this.x,
	            this.y,
	            this.r,
	            u$8.deepcopy(this.meta)
	        )
	    }

	    position(model) {
	        return m$8.model.moveRelative(m$8.model.rotate(model, this.r), this.p)
	    }

	    unposition(model) {
	        return m$8.model.rotate(m$8.model.moveRelative(model, [-this.x, -this.y]), -this.r)
	    }

	    rect(size=14) {
	        let rect = u$8.rect(size, size, [-size/2, -size/2]);
	        return this.position(rect)
	    }

	    angle(other) {
	        const dx = other.x - this.x;
	        const dy = other.y - this.y;
	        return -Math.atan2(dx, dy) * (180 / Math.PI)
	    }

	    equals(other) {
	        return this.x === other.x
	            && this.y === other.y
	            && this.r === other.r
	            && JSON.stringify(this.meta) === JSON.stringify(other.meta)
	    }
	};

	const mathjs = require$$3;

	const mathnum = assert$1.mathnum = raw => units => {
	    return mathjs.evaluate(`${raw}`, units || {})
	};

	const assert = assert$1.assert = (exp, msg) => {
	    if (!exp) {
	        throw new Error(msg)
	    }
	};

	const type = assert$1.type = val => units => {
	    if (Array.isArray(val)) return 'array'
	    if (val === null) return 'null'
	    try {
	        const num = mathnum(val)(units);
	        if (typeof num === 'number') return 'number'
	    } catch (err) {}
	    return typeof val
	};

	const sane = assert$1.sane = (val, name, _type) => units => {
	    assert(type(val)(units) == _type, `Field "${name}" should be of type ${_type}!`);
	    if (_type == 'number') return mathnum(val)(units)
	    return val
	};

	assert$1.unexpected = (obj, name, expected) => {
	    const sane_obj = sane(obj, name, 'object')();
	    for (const key of Object.keys(sane_obj)) {
	        assert(expected.includes(key), `Unexpected key "${key}" within field "${name}"!`);
	    }
	};

	const _in = assert$1.in = (raw, name, arr) => {
	    assert(arr.includes(raw), `Field "${name}" should be one of [${arr.join(', ')}]!`);
	    return raw
	};

	const arr = assert$1.arr = (raw, name, length, _type, _default) => units => {
	    assert(type(raw)(units) == 'array', `Field "${name}" should be an array!`);
	    assert(length == 0 || raw.length == length, `Field "${name}" should be an array of length ${length}!`);
	    raw = raw.map(val => val === undefined ? _default : val);
	    raw.map(val => assert(type(val)(units) == _type, `Field "${name}" should contain ${_type}s!`));
	    if (_type == 'number') {
	        raw = raw.map(val => mathnum(val)(units));
	    }
	    return raw
	};

	const numarr = assert$1.numarr = (raw, name, length) => units => arr(raw, name, length, 'number', 0)(units);
	assert$1.strarr = (raw, name) => arr(raw, name, 0, 'string', '')();

	const xy = assert$1.xy = (raw, name) => units => numarr(raw, name, 2)(units);

	assert$1.wh = (raw, name) => units => {
	    if (!Array.isArray(raw)) raw = [raw, raw];
	    return xy(raw, name)(units)
	};

	assert$1.trbl = (raw, name, _default=0) => units => {
	    if (!Array.isArray(raw)) raw = [raw, raw, raw, raw];
	    if (raw.length == 2) raw = [raw[1], raw[0], raw[1], raw[0]];
	    return arr(raw, name, 4, 'number', _default)(units)
	};

	assert$1.asym = (raw, name) => {
	    // allow different aliases
	    const source_aliases = ['source', 'origin', 'base', 'primary', 'left'];
	    const clone_aliases = ['clone', 'image', 'derived', 'secondary', 'right'];
	    _in(raw, name, ['both'].concat(source_aliases, clone_aliases));
	    // return aliases to canonical names
	    if (source_aliases.includes(raw)) return 'source'
	    if (clone_aliases.includes(raw)) return 'clone'
	    return raw
	};

	var kle$2 = {};

	const u$7 = utils;
	const kle$1 = require$$1;
	const yaml$1 = require$$1$1;

	kle$2.convert = (config, logger) => {
	    const keyboard = kle$1.Serial.deserialize(config);
	    const result = {points: {zones: {}}, pcbs: {main: {}}};

	    // if the keyboard notes are valid YAML/JSON, they get added to each key as metadata
	    let meta;
	    try {
	        meta = yaml$1.load(keyboard.meta.notes);
	    } catch (ex) {
	        // notes were not valid YAML/JSON, oh well...
	    }
	    meta = meta || {};

	    let index = 1;
	    for (const key of keyboard.keys) {
	        const id = `key${index++}`;
	        const colid = `${id}col`;
	        const rowid = `${id}row`;
	        // we try to look at the first non-empty label
	        const label = key.labels.filter(e => !!e)[0] || ''; 

	        // PCB nets can be specified through key labels
	        let row_net = id;
	        let col_net = 'GND';
	        if (label.match(/^\d+_\d+$/)) {
	            const parts = label.split('_');
	            row_net = `row_${parts[0]}`;
	            col_net = `col_${parts[1]}`;
	        }

	        // need to account for keycap sizes, as KLE anchors
	        // at the corners, while we consider the centers
	        const x = key.x + (key.width - 1) / 2;
	        const y = key.y + (key.height - 1) / 2;
	        
	        // KLE deals in absolute rotation origins so we calculate
	        // a relative difference as an origin for the column rotation
	        // again, considering corner vs. center with the extra half width/height
	        const diff_x = key.rotation_x - (key.x + key.width / 2);
	        const diff_y = key.rotation_y - (key.y + key.height / 2);

	        // anchoring the per-key zone to the KLE-computed coords
	        const converted = {
	            anchor: {
	                shift: [`${x} u`, `${-y} u`],
	            },
	            columns: {}
	        };
	        
	        // adding a column-level rotation with origin
	        converted.columns[colid] = {
	            rotate: -key.rotation_angle,
	            origin: [`${diff_x} u`, `${-diff_y} u`],
	            rows: {}
	        };
	        
	        // passing along metadata to each key
	        converted.columns[colid].rows[rowid] = u$7.deepcopy(meta);
	        converted.columns[colid].rows[rowid].width = key.width;
	        converted.columns[colid].rows[rowid].height = key.height;
	        converted.columns[colid].rows[rowid].label = label;
	        converted.columns[colid].rows[rowid].column_net = col_net;
	        converted.columns[colid].rows[rowid].row_net = row_net;
	        
	        result.points.zones[id] = converted;
	    }

	    return result
	};

	var name = "ergogen";
	var version$2 = "4.1.0";
	var description = "Ergonomic keyboard layout generator";
	var author = "Bán Dénes <mr@zealot.hu>";
	var license = "MIT";
	var homepage = "https://ergogen.xyz";
	var repository = "github:ergogen/ergogen";
	var bugs = "https://github.com/ergogen/ergogen/issues";
	var main = "./src/ergogen.js";
	var bin = "./src/cli.js";
	var scripts = {
		build: "rollup -c",
		test: "mocha -r test/helpers/register test/index.js",
		coverage: "nyc --reporter=html --reporter=text npm test"
	};
	var dependencies = {
		axios: "^1.7.7",
		"body-parser": "^1.20.3",
		cors: "^2.8.5",
		express: "^4.21.0",
		"fs-extra": "^11.1.0",
		"js-yaml": "^3.14.1",
		jszip: "^3.10.1",
		"kle-serial": "github:ergogen/kle-serial#ergogen",
		makerjs: "^0.18.1",
		mathjs: "^11.5.0",
		"node-fetch": "^3.3.2",
		pouchdb: "^9.0.0",
		yargs: "^17.6.2"
	};
	var devDependencies = {
		"@rollup/plugin-commonjs": "^24.0.1",
		"@rollup/plugin-json": "^6.0.0",
		chai: "^4.3.7",
		"chai-as-promised": "^7.1.1",
		"dir-compare": "^4.0.0",
		glob: "^8.1.0",
		mocha: "^10.2.0",
		nyc: "^15.1.0",
		rollup: "^3.10.1",
		sinon: "^15.0.1"
	};
	var nyc = {
		all: true,
		include: [
			"src/**/*.js"
		],
		exclude: [
			"src/templates/kicad8.js"
		]
	};
	var require$$12 = {
		name: name,
		version: version$2,
		description: description,
		author: author,
		license: license,
		homepage: homepage,
		repository: repository,
		bugs: bugs,
		main: main,
		bin: bin,
		scripts: scripts,
		dependencies: dependencies,
		devDependencies: devDependencies,
		nyc: nyc
	};

	const yaml = require$$1$1;
	const makerjs = require$$0;

	const u$6 = utils;
	const a$9 = assert$1;
	const kle = kle$2;

	const package_json = require$$12;

	const fake_require = io$1.fake_require = injection => name => {
	    const dependencies = {
	        makerjs
	    };
	    if (name.endsWith('package.json')) {
	        return package_json
	    } else if (dependencies[name]) {
	        return dependencies[name]
	    } else throw new Error(`Unknown dependency "${name}" among the requirements of injection "${injection}"!`)
	};

	io$1.unpack = async (zip) => {

	    // main config text (has to be called "config.ext" where ext is one of yaml/json/js)
	    const candidates = zip.file(/^config\.(yaml|json|js)$/);
	    if (candidates.length != 1) {
	        throw new Error('Ambiguous config in bundle!')
	    }
	    const config_text = await candidates[0].async('string');
	    const injections = [];

	    // bundled footprints
	    const fps = zip.folder('footprints');
	    const module_prefix = 'const module = {};\n\n';
	    const module_suffix = '\n\nreturn module.exports;';
	    for (const fp of fps.file(/.*\.js$/)) {
	        const name = fp.name.slice('footprints/'.length).split('.')[0];
	        const text = await fp.async('string');
	        const parsed = new Function('require', module_prefix + text + module_suffix)(fake_require(name));
	        // TODO: some sort of footprint validation?
	        injections.push(['footprint', name, parsed]);
	    }

	    // bundled pcb templates
	    const tpls = zip.folder('templates');
	    for (const tpl of tpls.file(/.*\.js$/)) {
	        const name = tpl.name.slice('templates/'.length).split('.')[0];
	        const text = await tpl.async('string');
	        const parsed = new Function('require', module_prefix + text + module_suffix)(fake_require(name));
	        // TODO: some sort of template validation?
	        injections.push(['template', name, parsed]);
	    }

	    return [config_text, injections]
	};

	io$1.interpret = (raw, logger) => {
	    let config = raw;
	    let format = 'OBJ';
	    if (a$9.type(raw)() == 'string') {
	        try {
	            config = yaml.safeLoad(raw);
	            format = 'YAML';
	        } catch (yamlex) {
	            try {
	                config = new Function(raw)();
	                a$9.assert(
	                    a$9.type(config)() == 'object',
	                    'Input JS Code doesn\'t resolve into an object!'
	                );
	                format = 'JS';
	            } catch (codeex) {
	                logger('YAML exception:', yamlex);
	                logger('Code exception:', codeex);
	                throw new Error('Input is not valid YAML, JSON, or JS Code!')
	            }
	        }
	    }
	    
	    try {
	        // assume it's KLE and try to convert it
	        config = kle.convert(config, logger);
	        format = 'KLE';
	    } catch (kleex) {
	        // nope... nevermind
	    }

	    if (a$9.type(config)() != 'object') {
	        throw new Error('Input doesn\'t resolve into an object!')
	    }

	    if (!Object.keys(config).length) {
	        throw new Error('Input appears to be empty!')
	    }

	    return [config, format]
	};

	io$1.twodee = (model, debug) => {
	    const assembly = makerjs.model.originate({
	        models: {
	            export: u$6.deepcopy(model)
	        },
	        units: 'mm'
	    });

	    const result = {
	        dxf: makerjs.exporter.toDXF(assembly),
	    };
	    if (debug) {
	        result.yaml = assembly;
	        const svgOptions = {
	            stroke: 'black',
	            strokeWidth: 1.0  // 这里设置线条粗细
	        };

	        result.svg = makerjs.exporter.toSVG(assembly, svgOptions);
	    }
	    return result
	};

	var prepare$1 = {};

	const u$5 = utils;
	const a$8 = assert$1;

	const _extend = prepare$1._extend = (to, from) => {
	    const to_type = a$8.type(to)();
	    const from_type = a$8.type(from)();
	    if (from === undefined || from === null) return to
	    if (from === '$unset') return undefined
	    if (to_type != from_type) return from
	    if (from_type == 'object') {
	        const res = u$5.deepcopy(to);
	        for (const key of Object.keys(from)) {
	            res[key] = _extend(to[key], from[key]);
	            if (res[key] === undefined) delete res[key];
	        }
	        return res
	    } else if (from_type == 'array') {
	        const res = u$5.deepcopy(to);
	        for (const [i, val] of from.entries()) {
	            res[i] = _extend(res[i], val);
	        }
	        return res
	    } else return from
	};

	const extend = prepare$1.extend = (...args) => {
	    let res = args[0];
	    for (const arg of args) {
	        if (res == arg) continue
	        res = _extend(res, arg);
	    }
	    return res
	};

	const traverse = prepare$1.traverse = (config, root, breadcrumbs, op) => {
	    if (a$8.type(config)() == 'object') {
	        const result = {};
	        for (const [key, val] of Object.entries(config)) {
	            breadcrumbs.push(key);
	            op(result, key, traverse(val, root, breadcrumbs, op), root, breadcrumbs);
	            breadcrumbs.pop();
	        }
	        return result
	    } else if (a$8.type(config)() == 'array') {
	        // needed so that arrays can set output the same way as objects within ops
	        const dummy = {};
	        const result = [];
	        let index = 0;
	        for (const val of config) {
	            breadcrumbs.push(`[${index}]`);
	            op(dummy, 'dummykey', traverse(val, root, breadcrumbs, op), root, breadcrumbs);
	            result[index] = dummy.dummykey;
	            breadcrumbs.pop();
	            index++;
	        }
	        return result
	    }
	    return config
	};

	prepare$1.unnest = config => traverse(config, config, [], (target, key, val) => {
	    u$5.deep(target, key, val);
	});

	prepare$1.inherit = config => traverse(config, config, [], (target, key, val, root, breadcrumbs) => {
	    if (val && val.$extends !== undefined) {
	        let candidates = u$5.deepcopy(val.$extends);
	        if (a$8.type(candidates)() !== 'array') candidates = [candidates];
	        const list = [val];
	        while (candidates.length) {
	            const path = candidates.shift();
	            const other = u$5.deep(root, path);
	            a$8.assert(other, `"${path}" (reached from "${breadcrumbs.join('.')}.$extends") does not name a valid inheritance target!`);
	            let parents = other.$extends || [];
	            if (a$8.type(parents)() !== 'array') parents = [parents];
	            candidates = candidates.concat(parents);
	            a$8.assert(!list.includes(other), `"${path}" (reached from "${breadcrumbs.join('.')}.$extends") leads to a circular dependency!`);
	            list.unshift(other);
	        }
	        val = extend.apply(null, list);
	        delete val.$extends;
	    }
	    target[key] = val;
	});

	prepare$1.parameterize = config => traverse(config, config, [], (target, key, val, root, breadcrumbs) => {

	    // we only care about objects
	    if (a$8.type(val)() !== 'object') {
	        target[key] = val;
	        return 
	    }

	    let params = val.$params;
	    let args = val.$args;

	    // explicitly skipped (probably intermediate) template, remove (by not setting it)
	    if (val.$skip) return

	    // nothing to do here, just pass the original value through
	    if (!params && !args) {
	        target[key] = val;
	        return
	    }

	    // unused template, remove (by not setting it)
	    if (params && !args) return

	    if (!params && args) {
	        throw new Error(`Trying to parameterize through "${breadcrumbs}.$args", but the corresponding "$params" field is missing!`)
	    }

	    params = a$8.strarr(params, `${breadcrumbs}.$params`);
	    args = a$8.sane(args, `${breadcrumbs}.$args`, 'array')();
	    if (params.length !== args.length) {
	        throw new Error(`The number of "$params" and "$args" don't match for "${breadcrumbs}"!`)
	    }

	    let str = JSON.stringify(val);
	    const zip = rows => rows[0].map((_, i) => rows.map(row => row[i]));
	    for (const [par, arg] of zip([params, args])) {
	        str = str.replace(new RegExp(`${par}`, 'g'), arg);
	    }
	    try {
	        val = JSON.parse(str);
	    } catch (ex) {
	        throw new Error(`Replacements didn't lead to a valid JSON object at "${breadcrumbs}"! ` + ex)
	    }

	    delete val.$params;
	    delete val.$args;
	    target[key] = val;
	});

	var units = {};

	const a$7 = assert$1;
	const prep$2 = prepare$1;

	const default_units = {
	    U: 19.05,
	    u: 19,
	    cx: 18,
	    cy: 17,
	    $default_stagger: 0,
	    $default_spread: 'u',
	    $default_splay: 0,
	    $default_height: 'u-1',
	    $default_width: 'u-1',
	    $default_padding: 'u',
	    $default_autobind: 10
	};

	units.parse = (config = {}) => {
	    const raw_units = prep$2.extend(
	        default_units,
	        a$7.sane(config.units || {}, 'units', 'object')(),
	        a$7.sane(config.variables || {}, 'variables', 'object')()
	    );
	    const units = {};
	    for (const [key, val] of Object.entries(raw_units)) {
	        units[key] = a$7.mathnum(val)(units);
	    }
	    return units
	};

	var points = {};

	var anchor$5 = {};

	const a$6 = assert$1;
	const Point$2 = point;
	const m$7 = require$$0;

	const mirror_ref = anchor$5.mirror = (ref, mirror=true) => {
	    if (mirror) {
	        if (ref.startsWith('mirror_')) {
	            return ref.substring(7)
	        }
	        return 'mirror_' + ref
	    }
	    return ref
	};

	const aggregator_common = ['parts', 'method'];

	const aggregators = {
	    average: (config, name, parts) => {
	        a$6.unexpected(config, name, aggregator_common);
	        const len = parts.length;
	        if (len == 0) {
	          return new Point$2()
	        }
	        let x = 0, y = 0, r = 0;
	        for (const part of parts) {
	            x += part.x;
	            y += part.y;
	            r += part.r;
	        }
	        return new Point$2(x / len, y / len, r / len)
	    },
	    intersect: (config, name, parts) => {
	        // a line is generated from a point by taking their
	        // (rotated) Y axis. The line is not extended to
	        // +/- Infinity as that doesn't work with makerjs.
	        // An arbitrary offset of 1 meter is considered
	        // sufficient for practical purposes, and the point
	        // coordinates are used as pivot point for the rotation.
	        const get_line_from_point = (point, offset=1000) => {
	            const origin = [point.x, point.y];
	            const p1 = [point.x, point.y - offset];
	            const p2 = [point.x, point.y + offset];

	            let line = new m$7.paths.Line(p1, p2);
	            line = m$7.path.rotate(line, point.r, origin);

	            return line
	        };

	        a$6.unexpected(config, name, aggregator_common);
	        a$6.assert(parts.length==2, `Intersect expects exactly two parts, but it got ${parts.length}!`);

	        const line1 = get_line_from_point(parts[0]);
	        const line2 = get_line_from_point(parts[1]);
	        const intersection = m$7.path.intersection(line1, line2);

	        a$6.assert(intersection, `The points under "${name}.parts" do not intersect!`);

	        const intersection_point_arr = intersection.intersectionPoints[0];
	        const intersection_point = new Point$2(
	            intersection_point_arr[0], intersection_point_arr[1], 0
	        );

	        return intersection_point
	    },
	};

	const anchor$4 = anchor$5.parse = (raw, name, points={}, start=new Point$2(), mirror=false) => units => {

	    //
	    // Anchor type handling
	    //

	    if (a$6.type(raw)() == 'string') {
	        raw = {ref: raw};
	    }

	    else if (a$6.type(raw)() == 'array') {
	        // recursive call with incremental start mods, according to `affect`s
	        let current = start.clone();
	        let index = 1;
	        for (const step of raw) {
	            current = anchor$4(step, `${name}[${index++}]`, points, current, mirror)(units);
	        }
	        return current
	    }

	    a$6.unexpected(raw, name, ['ref', 'aggregate', 'orient', 'shift', 'rotate', 'affect', 'resist']);

	    //
	    // Reference or aggregate handling
	    //

	    let point = start.clone();
	    if (raw.ref !== undefined && raw.aggregate !== undefined) {
	        throw new Error(`Fields "ref" and "aggregate" cannot appear together in anchor "${name}"!`)
	    }

	    if (raw.ref !== undefined) {
	        // base case, resolve directly
	        if (a$6.type(raw.ref)() == 'string') {
	            const parsed_ref = mirror_ref(raw.ref, mirror);
	            a$6.assert(points[parsed_ref], `Unknown point reference "${parsed_ref}" in anchor "${name}"!`);
	            point = points[parsed_ref].clone();
	        // recursive case
	        } else {
	            point = anchor$4(raw.ref, `${name}.ref`, points, start, mirror)(units);
	        }
	    }

	    if (raw.aggregate !== undefined) {
	        raw.aggregate = a$6.sane(raw.aggregate, `${name}.aggregate`, 'object')();
	        raw.aggregate.method = a$6.sane(raw.aggregate.method || 'average', `${name}.aggregate.method`, 'string')();
	        a$6.assert(aggregators[raw.aggregate.method], `Unknown aggregator method "${raw.aggregate.method}" in anchor "${name}"!`);
	        raw.aggregate.parts = a$6.sane(raw.aggregate.parts || [], `${name}.aggregate.parts`, 'array')();

	        const parts = [];
	        let index = 1;
	        for (const part of raw.aggregate.parts) {
	            parts.push(anchor$4(part, `${name}.aggregate.parts[${index++}]`, points, start, mirror)(units));
	        }

	        point = aggregators[raw.aggregate.method](raw.aggregate, `${name}.aggregate`, parts);
	    }

	    //
	    // Actual orient/shift/rotate/affect handling
	    //

	    const resist = a$6.sane(raw.resist || false, `${name}.resist`, 'boolean')();
	    const rotator = (config, name, point) => {
	        // simple case: number gets added to point rotation
	        if (a$6.type(config)(units) == 'number') {
	            let angle = a$6.sane(config, name, 'number')(units);
	            point.rotate(angle, false, resist);
	        // recursive case: points turns "towards" target anchor
	        } else {
	            const target = anchor$4(config, name, points, start, mirror)(units);
	            point.r = point.angle(target);
	        }
	    };

	    if (raw.orient !== undefined) {
	        rotator(raw.orient, `${name}.orient`, point);
	    }
	    if (raw.shift !== undefined) {
	        const xyval = a$6.wh(raw.shift, `${name}.shift`)(units);
	        point.shift(xyval, true, resist);
	    }
	    if (raw.rotate !== undefined) {
	        rotator(raw.rotate, `${name}.rotate`, point);
	    }
	    if (raw.affect !== undefined) {
	        const candidate = point.clone();
	        point = start.clone();
	        point.meta = candidate.meta;
	        let affect = raw.affect;
	        if (a$6.type(affect)() == 'string') affect = affect.split('');
	        affect = a$6.strarr(affect, `${name}.affect`);
	        let i = 0;
	        for (const aff of affect) {
	            a$6.in(aff, `${name}.affect[${++i}]`, ['x', 'y', 'r']);
	            point[aff] = candidate[aff];
	        }
	    }

	    return point
	};

	const m$6 = require$$0;
	const u$4 = utils;
	const a$5 = assert$1;
	const prep$1 = prepare$1;
	const anchor_lib$1 = anchor$5;

	const push_rotation = points._push_rotation = (list, angle, origin) => {
	    let candidate = origin;
	    for (const r of list) {
	        candidate = m$6.point.rotate(candidate, r.angle, r.origin);
	    }
	    list.push({
	        angle: angle,
	        origin: candidate
	    });
	};

	const render_zone = points._render_zone = (zone_name, zone, anchor, global_key, units) => {

	    // zone-wide sanitization

	    a$5.unexpected(zone, `points.zones.${zone_name}`, ['columns', 'rows', 'key']);
	    // the anchor comes from "above", because it needs other zones too (for references)
	    const cols = zone.columns = a$5.sane(zone.columns || {}, `points.zones.${zone_name}.columns`, 'object')();
	    const zone_wide_rows = a$5.sane(zone.rows || {}, `points.zones.${zone_name}.rows`, 'object')();
	    for (const [key, val] of Object.entries(zone_wide_rows)) {
	        zone_wide_rows[key] = val || {}; // no check yet, as it will be extended later
	    }
	    const zone_wide_key = a$5.sane(zone.key || {}, `points.zones.${zone_name}.key`, 'object')();

	    // algorithm prep

	    const points = {};
	    const rotations = [];
	    const zone_anchor = anchor.clone();
	    // transferring the anchor rotation to "real" rotations
	    rotations.push({
	        angle: zone_anchor.r,
	        origin: zone_anchor.p
	    });
	    // and now clear it from the anchor so that we don't apply it twice
	    zone_anchor.r = 0;

	    // column layout

	    if (!Object.keys(cols).length) {
	        cols.default = {};
	    }
	    let first_col = true;
	    for (let [col_name, col] of Object.entries(cols)) {

	        // column-level sanitization

	        col = col || {};

	        a$5.unexpected(
	            col,
	            `points.zones.${zone_name}.columns.${col_name}`,
	            ['rows', 'key']
	        );
	        col.rows = a$5.sane(
	            col.rows || {},
	            `points.zones.${zone_name}.columns.${col_name}.rows`,
	            'object'
	        )();
	        for (const [key, val] of Object.entries(col.rows)) {
	            col.rows[key] = val || {}; // again, no check yet, as it will be extended later
	        }
	        col.key = a$5.sane(
	            col.key || {},
	            `points.zones.${zone_name}.columns.${col_name}.key`,
	            'object'
	        )();

	        // combining row data from zone-wide defs and col-specific defs

	        const actual_rows = Object.keys(prep$1.extend(zone_wide_rows, col.rows));
	        if (!actual_rows.length) {
	            actual_rows.push('default');
	        }

	        // getting key config through the 5-level extension

	        const keys = [];
	        const default_key = {
	            stagger: units.$default_stagger,
	            spread: units.$default_spread,
	            splay: units.$default_splay,
	            origin: [0, 0],
	            orient: 0,
	            shift: [0, 0],
	            rotate: 0,
	            adjust: {},
	            width: units.$default_width,
	            height: units.$default_height,
	            padding: units.$default_padding,
	            autobind: units.$default_autobind,
	            skip: false,
	            asym: 'both',
	            colrow: '{{col.name}}_{{row}}',
	            name: '{{zone.name}}_{{colrow}}'
	        };
	        for (const row of actual_rows) {
	            const key = prep$1.extend(
	                default_key,
	                global_key,
	                zone_wide_key,
	                col.key,
	                zone_wide_rows[row] || {},
	                col.rows[row] || {}
	            );

	            key.zone = zone;
	            key.zone.name = zone_name;
	            key.col = col;
	            key.col.name = col_name;
	            key.row = row;

	            key.stagger = a$5.sane(key.stagger, `${key.name}.stagger`, 'number')(units);
	            key.spread = a$5.sane(key.spread, `${key.name}.spread`, 'number')(units);
	            key.splay = a$5.sane(key.splay, `${key.name}.splay`, 'number')(units);
	            key.origin = a$5.xy(key.origin, `${key.name}.origin`)(units);
	            key.orient = a$5.sane(key.orient, `${key.name}.orient`, 'number')(units);
	            key.shift = a$5.xy(key.shift, `${key.name}.shift`)(units);
	            key.rotate = a$5.sane(key.rotate, `${key.name}.rotate`, 'number')(units);
	            key.width = a$5.sane(key.width, `${key.name}.width`, 'number')(units);
	            key.height = a$5.sane(key.height, `${key.name}.height`, 'number')(units);
	            key.padding = a$5.sane(key.padding, `${key.name}.padding`, 'number')(units);
	            key.skip = a$5.sane(key.skip, `${key.name}.skip`, 'boolean')();
	            key.asym = a$5.asym(key.asym, `${key.name}.asym`);

	            // templating support
	            for (const [k, v] of Object.entries(key)) {
	                if (a$5.type(v)(units) == 'string') {
	                    key[k] = u$4.template(v, key);
	                }
	            }

	            keys.push(key);
	        }

	        // setting up column-level anchor
	        if (!first_col) {
	            zone_anchor.x += keys[0].spread;
	        }
	        zone_anchor.y += keys[0].stagger;
	        const col_anchor = zone_anchor.clone();

	        // applying col-level rotation (cumulatively, for the next columns as well)

	        if (keys[0].splay) {
	            push_rotation(
	                rotations,
	                keys[0].splay,
	                col_anchor.clone().shift(keys[0].origin, false).p
	            );
	        }

	        // actually laying out keys
	        let running_anchor = col_anchor.clone();
	        for (const r of rotations) {
	            running_anchor.rotate(r.angle, r.origin);
	        }

	        for (const key of keys) {

	            // copy the current column anchor
	            let point = running_anchor.clone();

	            // apply cumulative per-key adjustments
	            point.r += key.orient;
	            point.shift(key.shift);
	            point.r += key.rotate;

	            // commit running anchor
	            running_anchor = point.clone();

	            // apply independent adjustments
	            point = anchor_lib$1.parse(key.adjust, `${key.name}.adjust`, {}, point)(units);

	            // save new key
	            point.meta = key;
	            points[key.name] = point;

	            // advance the running anchor to the next position
	            running_anchor.shift([0, key.padding]);
	        }

	        first_col = false;
	    }

	    return points
	};

	const parse_axis = points._parse_axis = (config, name, points, units) => {
	    if (!['number', 'undefined'].includes(a$5.type(config)(units))) {
	        const mirror_obj = a$5.sane(config, name, 'object')();
	        const distance = a$5.sane(mirror_obj.distance || 0, `${name}.distance`, 'number')(units);
	        delete mirror_obj.distance;
	        let axis = anchor_lib$1.parse(mirror_obj, name, points)(units).x;
	        axis += distance / 2;
	        return axis
	    } else return config
	};

	const perform_mirror = points._perform_mirror = (point, axis) => {
	    point.meta.mirrored = false;
	    if (point.meta.asym == 'source') return ['', null]
	    const mp = point.clone().mirror(axis);
	    const mirrored_name = `mirror_${point.meta.name}`;
	    mp.meta = prep$1.extend(mp.meta, mp.meta.mirror || {});
	    mp.meta.name = mirrored_name;
	    mp.meta.colrow = `mirror_${mp.meta.colrow}`;
	    mp.meta.mirrored = true;
	    if (point.meta.asym == 'clone') {
	        point.meta.skip = true;
	    }
	    return [mirrored_name, mp]
	};

	const perform_autobind = points._perform_autobind = (points, units) => {

	    const bounds = {};
	    const col_lists = {};
	    const mirrorzone = p => (p.meta.mirrored ? 'mirror_' : '') + p.meta.zone.name;

	    // round one: get column upper/lower bounds and per-zone column lists
	    for (const p of Object.values(points)) {

	        const zone = mirrorzone(p);
	        const col = p.meta.col.name;

	        if (!bounds[zone]) bounds[zone] = {};
	        if (!bounds[zone][col]) bounds[zone][col] = {min: Infinity, max: -Infinity};
	        if (!col_lists[zone]) col_lists[zone] = Object.keys(p.meta.zone.columns);

	        bounds[zone][col].min = Math.min(bounds[zone][col].min, p.y);
	        bounds[zone][col].max = Math.max(bounds[zone][col].max, p.y);
	    }

	    // round two: apply autobind as appropriate
	    for (const p of Object.values(points)) {

	        const autobind = a$5.sane(p.meta.autobind, `${p.meta.name}.autobind`, 'number')(units);
	        if (!autobind) continue

	        const zone = mirrorzone(p);
	        const col = p.meta.col.name;
	        const col_list = col_lists[zone];
	        const col_bounds = bounds[zone][col];

	        
	        // specify default as -1, so we can recognize where it was left undefined even after number-ification
	        const bind = p.meta.bind = a$5.trbl(p.meta.bind, `${p.meta.name}.bind`, -1)(units);

	        // up
	        if (bind[0] == -1) {
	            if (p.y < col_bounds.max) bind[0] = autobind;
	            else bind[0] = 0;
	        }

	        // down
	        if (bind[2] == -1) {
	            if (p.y > col_bounds.min) bind[2] = autobind;
	            else bind[2] = 0;
	        }

	        // left
	        if (bind[3] == -1) {
	            bind[3] = 0;
	            const col_index = col_list.indexOf(col);
	            if (col_index > 0) {
	                const left = bounds[zone][col_list[col_index - 1]];
	                if (left && p.y >= left.min && p.y <= left.max) {
	                    bind[3] = autobind;
	                }
	            }
	        }

	        // right
	        if (bind[1] == -1) {
	            bind[1] = 0;
	            const col_index = col_list.indexOf(col);
	            if (col_index < col_list.length - 1) {
	                const right = bounds[zone][col_list[col_index + 1]];
	                if (right && p.y >= right.min && p.y <= right.max) {
	                    bind[1] = autobind;
	                }
	            }
	        }
	    }
	};

	points.parse = (config, units) => {

	    // config sanitization
	    a$5.unexpected(config, 'points', ['zones', 'key', 'rotate', 'mirror']);
	    const zones = a$5.sane(config.zones, 'points.zones', 'object')();
	    const global_key = a$5.sane(config.key || {}, 'points.key', 'object')();
	    const global_rotate = a$5.sane(config.rotate || 0, 'points.rotate', 'number')(units);
	    const global_mirror = config.mirror;
	    let points = {};

	    // rendering zones
	    for (let [zone_name, zone] of Object.entries(zones)) {

	        // zone sanitization
	        zone = a$5.sane(zone || {}, `points.zones.${zone_name}`, 'object')();

	        // extracting keys that are handled here, not at the zone render level
	        const anchor = anchor_lib$1.parse(zone.anchor || {}, `points.zones.${zone_name}.anchor`, points)(units);
	        const rotate = a$5.sane(zone.rotate || 0, `points.zones.${zone_name}.rotate`, 'number')(units);
	        const mirror = zone.mirror;
	        delete zone.anchor;
	        delete zone.rotate;
	        delete zone.mirror;

	        // creating new points
	        let new_points = render_zone(zone_name, zone, anchor, global_key, units);

	        // simplifying the names in individual point "zones" and single-key columns
	        while (Object.keys(new_points).some(k => k.endsWith('_default'))) {
	            for (const key of Object.keys(new_points).filter(k => k.endsWith('_default'))) {
	                const new_key = key.slice(0, -8);
	                new_points[new_key] = new_points[key];
	                new_points[new_key].meta.name = new_key;
	                delete new_points[key];
	            }
	        }

	        // adjusting new points
	        for (const [new_name, new_point] of Object.entries(new_points)) {
	            
	            // issuing a warning for duplicate keys
	            if (Object.keys(points).includes(new_name)) {
	                throw new Error(`Key "${new_name}" defined more than once!`)
	            }

	            // per-zone rotation
	            if (rotate) {
	                new_point.rotate(rotate);
	            }
	        }

	        // adding new points so that they can be referenced from now on
	        points = Object.assign(points, new_points);

	        // per-zone mirroring for the new keys
	        const axis = parse_axis(mirror, `points.zones.${zone_name}.mirror`, points, units);
	        if (axis !== undefined) {
	            const mirrored_points = {};
	            for (const new_point of Object.values(new_points)) {
	                const [mname, mp] = perform_mirror(new_point, axis);
	                if (mp) {
	                    mirrored_points[mname] = mp;
	                }
	            }
	            points = Object.assign(points, mirrored_points);
	        }
	    }

	    // applying global rotation
	    for (const point of Object.values(points)) {
	        if (global_rotate) {
	            point.rotate(global_rotate);
	        }
	    }

	    // global mirroring for points that haven't been mirrored yet
	    const global_axis = parse_axis(global_mirror, `points.mirror`, points, units);
	    const global_mirrored_points = {};
	    for (const point of Object.values(points)) {
	        if (global_axis !== undefined && point.meta.mirrored === undefined) {
	            const [mname, mp] = perform_mirror(point, global_axis);
	            if (mp) {
	                global_mirrored_points[mname] = mp;
	            }
	        }
	    }
	    points = Object.assign(points, global_mirrored_points);

	    // removing temporary points
	    const filtered = {};
	    for (const [k, p] of Object.entries(points)) {
	        if (p.meta.skip) continue
	        filtered[k] = p;
	    }

	    // apply autobind
	    perform_autobind(filtered, units);

	    // done
	    return filtered
	};

	points.visualize = (points, units) => {
	    const models = {};
	    for (const [pname, p] of Object.entries(points)) {
	        const w = p.meta.width;
	        const h = p.meta.height;
	        const rect = u$4.rect(w, h, [-w/2, -h/2]);
	        models[pname] = p.position(rect);
	    }
	    return {models: models}
	};

	var outlines = {};

	var operation = {};

	const op_prefix = operation.op_prefix = str => {

	    const prefix = str[0];
	    const suffix = str.slice(1);
	    const result = {name: suffix, operation: 'add'};

	    if (prefix == '+') ; // noop
	    else if (prefix == '-') result.operation = 'subtract';
	    else if (prefix == '~') result.operation = 'intersect';
	    else if (prefix == '^') result.operation = 'stack';
	    else result.name = str; // no prefix, so the name was the whole string

	    return result
	};

	operation.operation = (str, choices={}, order=Object.keys(choices)) => {
	    let res = op_prefix(str);
	    for (const key of order) {
	        if (choices[key].includes(res.name)) {
	            res.what = key;
	            break
	        }
	    }
	    return res
	};

	var filter$3 = {};

	const u$3 = utils;
	const a$4 = assert$1;
	const anchor_lib = anchor$5;
	const Point$1 = point;
	const anchor$3 = anchor_lib.parse;

	const _true = () => true;
	const _false = () => false;
	const _and = arr => p => arr.map(e => e(p)).reduce((a, b) => a && b);
	const _or = arr => p => arr.map(e => e(p)).reduce((a, b) => a || b);

	const similar = (keys, reference, name, units) => {
	    let neg = false;
	    if (reference.startsWith('-')) {
	        neg = true;
	        reference = reference.slice(1);
	    }

	    // support both string or regex as reference
	    let internal_tester = val => (''+val) == reference;
	    if (reference.startsWith('/')) {
	        try {
	            const regex_parts = reference.split('/');
	            regex_parts.shift(); // remove starting slash
	            const flags = regex_parts.pop();
	            const regex = new RegExp(regex_parts.join('/'), flags);
	            internal_tester = val => regex.test(''+val);
	        } catch (ex) {
	            throw new Error(`Invalid regex "${reference}" found at filter "${name}"!`)
	        }
	    }

	    // support strings, arrays, or objects as key
	    const external_tester = (point, key) => {
	        const value = u$3.deep(point, key);
	        if (a$4.type(value)() == 'array') {
	            return value.some(subkey => internal_tester(subkey))
	        } else if (a$4.type(value)() == 'object') {
	            return Object.keys(value).some(subkey => internal_tester(subkey))
	        } else {
	            return internal_tester(value)
	        }
	    };

	    // consider negation
	    if (neg) {
	        return point => keys.every(key => !external_tester(point, key))
	    } else {
	        return point => keys.some(key => external_tester(point, key))
	    }
	};

	const comparators = {
	    '~': similar
	    // TODO: extension point for other operators...
	};
	const symbols = Object.keys(comparators);

	const simple = (exp, name, units) => {

	    let keys = ['meta.name', 'meta.tags'];
	    let op = '~';
	    let value;
	    const parts = exp.split(/\s+/g);

	    // full case
	    if (symbols.includes(parts[1])) {
	        keys = parts[0].split(',');
	        op = parts[1];
	        value = parts.slice(2).join(' ');
	    
	    // middle case, just an operator spec, default "keys"
	    } else if (symbols.includes(parts[0])) {
	        op = parts[0];
	        value = parts.slice(1).join(' ');

	    // basic case, only "value"
	    } else {
	        value = exp;
	    }

	    return point => comparators[op](keys, value, name, units)(point)
	};

	const complex = (config, name, units, aggregator=_or) => {

	    // we branch by type
	    const type = a$4.type(config)(units);
	    switch(type) {

	        // boolean --> either all or nothing
	        case 'boolean':
	            return config ? _true : _false
	 
	        // string --> base case, meaning a simple/single filter
	        case 'string':
	            return simple(config, name, units)
	        
	        // array --> aggregated simple filters with alternating and/or conditions
	        case 'array':
	            const alternate = aggregator == _and ? _or : _and;
	            return aggregator(config.map(elem => complex(elem, name, units, alternate)))

	        default:
	            throw new Error(`Unexpected type "${type}" found at filter "${name}"!`)
	    }
	};

	const contains_object = (val) => {
	    if (a$4.type(val)() == 'object') return true
	    if (a$4.type(val)() == 'array') return val.some(el => contains_object(el))
	    return false
	};

	filter$3.parse = (config, name, points={}, units={}, asym='source') => {

	    let result = [];

	    // if a filter decl is undefined, it's just the default point at [0, 0]
	    if (config === undefined) {
	        result.push(new Point$1());

	    // if a filter decl is an object, or an array that contains an object at any depth, it is an anchor
	    } else if (contains_object(config)) {
	        if (['source', 'both'].includes(asym)) {
	            result.push(anchor$3(config, name, points)(units));
	        }
	        if (['clone', 'both'].includes(asym)) {
	            // this is strict: if the ref of the anchor doesn't have a mirror pair, it will error out
	            // also, we check for duplicates as ref-less anchors mirror to themselves
	            const clone = anchor$3(config, name, points, undefined, true)(units);
	            if (result.every(p => !p.equals(clone))) {
	                result.push(clone);
	            }
	        }
	        
	    // otherwise, it is treated as a condition to filter all available points
	    } else {
	        const source = Object.values(points).filter(complex(config, name, units));
	        if (['source', 'both'].includes(asym)) {
	            result = result.concat(source);
	        }
	        if (['clone', 'both'].includes(asym)) {
	            // this is permissive: we only include mirrored versions if they exist, and don't fuss if they don't
	            // also, we check for duplicates as clones can potentially refer back to their sources, too
	            const pool = result.map(p => p.meta.name);
	            result = result.concat(
	                source.map(p => points[anchor_lib.mirror(p.meta.name)])
	                .filter(p => !!p)
	                .filter(p => !pool.includes(p.meta.name))
	            );
	        }
	    }

	    return result
	};

	const m$5 = require$$0;
	const u$2 = utils;
	const a$3 = assert$1;
	const o$2 = operation;
	const Point = point;
	const prep = prepare$1;
	const anchor$2 = anchor$5.parse;
	const filter$2 = filter$3.parse;

	const binding = (base, bbox, point, units) => {

	    let bind = a$3.trbl(point.meta.bind || 0, `${point.meta.name}.bind`)(units);
	    // if it's a mirrored key, we swap the left and right bind values
	    if (point.meta.mirrored) {
	        bind = [bind[0], bind[3], bind[2], bind[1]];
	    }

	    const bt = Math.max(bbox.high[1], 0) + Math.max(bind[0], 0);
	    const br = Math.max(bbox.high[0], 0) + Math.max(bind[1], 0);
	    const bd = Math.min(bbox.low[1], 0) - Math.max(bind[2], 0);
	    const bl = Math.min(bbox.low[0], 0) - Math.max(bind[3], 0);

	    if (bind[0] || bind[1]) base = u$2.union(base, u$2.rect(br, bt));
	    if (bind[1] || bind[2]) base = u$2.union(base, u$2.rect(br, -bd, [0, bd]));
	    if (bind[2] || bind[3]) base = u$2.union(base, u$2.rect(-bl, -bd, [bl, bd]));
	    if (bind[3] || bind[0]) base = u$2.union(base, u$2.rect(-bl, bt, [bl, 0]));

	    return base
	};

	const rectangle = (config, name, points, outlines, units) => {

	    // prepare params
	    a$3.unexpected(config, `${name}`, ['size', 'corner', 'bevel']);
	    const size = a$3.wh(config.size, `${name}.size`)(units);
	    const rec_units = prep.extend({
	        sx: size[0],
	        sy: size[1]
	    }, units);
	    const corner = a$3.sane(config.corner || 0, `${name}.corner`, 'number')(rec_units);
	    const bevel = a$3.sane(config.bevel || 0, `${name}.bevel`, 'number')(rec_units);

	    // return shape function and its units
	    return [() => {

	        const error = (dim, val) => `Rectangle for "${name}" isn't ${dim} enough for its corner and bevel (${val} - 2 * ${corner} - 2 * ${bevel} <= 0)!`;
	        const [w, h] = size;
	        const mod = 2 * (corner + bevel);
	        const cw = w - mod;
	        a$3.assert(cw >= 0, error('wide', w));
	        const ch = h - mod;
	        a$3.assert(ch >= 0, error('tall', h));

	        let rect = new m$5.models.Rectangle(cw, ch);
	        if (bevel) {
	            rect = u$2.poly([
	                [-bevel, 0],
	                [-bevel, ch],
	                [0, ch + bevel],
	                [cw, ch + bevel],
	                [cw + bevel, ch],
	                [cw + bevel, 0],
	                [cw, -bevel],
	                [0, -bevel]
	            ]);
	        }
	        if (corner > 0) rect = m$5.model.outline(rect, corner, 0);
	        rect = m$5.model.moveRelative(rect, [-cw/2, -ch/2]);
	        const bbox = {high: [w/2, h/2], low: [-w/2, -h/2]};

	        return [rect, bbox]
	    }, rec_units]
	};

	const circle = (config, name, points, outlines, units) => {

	    // prepare params
	    a$3.unexpected(config, `${name}`, ['radius']);
	    const radius = a$3.sane(config.radius, `${name}.radius`, 'number')(units);
	    const circ_units = prep.extend({
	        r: radius
	    }, units);

	    // return shape function and its units
	    return [() => {
	        let circle = u$2.circle([0, 0], radius);
	        const bbox = {high: [radius, radius], low: [-radius, -radius]};
	        return [circle, bbox]
	    }, circ_units]
	};

	const polygon = (config, name, points, outlines, units) => {

	    // prepare params
	    a$3.unexpected(config, `${name}`, ['points']);
	    const poly_points = a$3.sane(config.points, `${name}.points`, 'array')();

	    // return shape function and its units
	    return [point => {
	        const parsed_points = [];
	        // the poly starts at [0, 0] as it will be positioned later
	        // but we keep the point metadata for potential mirroring purposes
	        let last_anchor = new Point(0, 0, 0, point.meta);
	        let poly_index = -1;
	        for (const poly_point of poly_points) {
	            const poly_name = `${name}.points[${++poly_index}]`;
	            last_anchor = anchor$2(poly_point, poly_name, points, last_anchor)(units);
	            parsed_points.push(last_anchor.p);
	        }
	        let poly = u$2.poly(parsed_points);
	        const bbox = u$2.bbox(parsed_points);
	        return [poly, bbox]
	    }, units]
	};

	const outline = (config, name, points, outlines, units) => {

	    // prepare params
	    a$3.unexpected(config, `${name}`, ['name', 'origin']);
	    a$3.assert(outlines[config.name], `Field "${name}.name" does not name an existing outline!`);
	    const origin = anchor$2(config.origin || {}, `${name}.origin`, points)(units);
	    
	    // return shape function and its units
	    return [() => {
	        let o = u$2.deepcopy(outlines[config.name]);
	        o = origin.unposition(o);
	        const bbox = m$5.measure.modelExtents(o);
	        return [o, bbox]
	    }, units]
	};

	const whats = {
	    rectangle,
	    circle,
	    polygon,
	    outline
	};

	const expand_shorthand = (config, name, units) => {
	    if (a$3.type(config.expand)(units) == 'string') {
	        const prefix = config.expand.slice(0, -1);
	        const suffix = config.expand.slice(-1);
	        const valid_suffixes = [')', '>', ']'];
	        a$3.assert(valid_suffixes.includes(suffix), `If field "${name}" is a string, ` +
	            `it should end with one of [${valid_suffixes.map(s => `'${s}'`).join(', ')}]!`);
	        config.expand = prefix;
	        config.joints = config.joints || valid_suffixes.indexOf(suffix);
	    }
	    
	    if (a$3.type(config.joints)(units) == 'string') {
	        if (config.joints == 'round') config.joints = 0;
	        if (config.joints == 'pointy') config.joints = 1;
	        if (config.joints == 'beveled') config.joints = 2;
	    }
	};

	outlines.parse = (config, points, units) => {

	    // output outlines will be collected here
	    const outlines = {};

	    // the config must be an actual object so that the exports have names
	    config = a$3.sane(config, 'outlines', 'object')();
	    for (let [outline_name, parts] of Object.entries(config)) {

	        // placeholder for the current outline
	        outlines[outline_name] = {models: {}};

	        // each export can consist of multiple parts
	        // either sub-objects or arrays are fine...
	        if (a$3.type(parts)() == 'array') {
	            parts = {...parts};
	        }
	        parts = a$3.sane(parts, `outlines.${outline_name}`, 'object')();
	        
	        for (let [part_name, part] of Object.entries(parts)) {
	            
	            const name = `outlines.${outline_name}.${part_name}`;

	            // string part-shortcuts are expanded first
	            if (a$3.type(part)() == 'string') {
	                part = o$2.operation(part, {outline: Object.keys(outlines)});
	            }

	            // process keys that are common to all part declarations
	            const operation = u$2[a$3.in(part.operation || 'add', `${name}.operation`, ['add', 'subtract', 'intersect', 'stack'])];
	            const what = a$3.in(part.what || 'outline', `${name}.what`, ['rectangle', 'circle', 'polygon', 'outline']);
	            const bound = !!part.bound;
	            const asym = a$3.asym(part.asym || 'source', `${name}.asym`);

	            // `where` is delayed until we have all, potentially what-dependent units
	            // default where is [0, 0], as per filter parsing
	            const original_where = part.where; // need to save, so the delete's don't get rid of it below
	            const where = units => filter$2(original_where, `${name}.where`, points, units, asym);
	            
	            const original_adjust = part.adjust; // same as above
	            const fillet = a$3.sane(part.fillet || 0, `${name}.fillet`, 'number')(units);
	            expand_shorthand(part, `${name}.expand`, units);
	            const expand = a$3.sane(part.expand || 0, `${name}.expand`, 'number')(units);
	            const joints = a$3.in(a$3.sane(part.joints || 0, `${name}.joints`, 'number')(units), `${name}.joints`, [0, 1, 2]);
	            const scale = a$3.sane(part.scale || 1, `${name}.scale`, 'number')(units);

	            // these keys are then removed, so ops can check their own unexpected keys without interference
	            delete part.operation;
	            delete part.what;
	            delete part.bound;
	            delete part.asym;
	            delete part.where;
	            delete part.adjust;
	            delete part.fillet;
	            delete part.expand;
	            delete part.joints;
	            delete part.scale;

	            // a prototype "shape" maker (and its units) are computed
	            const [shape_maker, shape_units] = whats[what](part, name, points, outlines, units);
	            const adjust = start => anchor$2(original_adjust || {}, `${name}.adjust`, points, start)(shape_units);

	            // and then the shape is repeated for all where positions
	            for (const w of where(shape_units)) {
	                const point = adjust(w.clone());
	                // console.log("outline point: " + JSON.stringify(point));
	                let [shape, bbox] = shape_maker(point); // point is passed for mirroring metadata only...
	                if (bound) {
	                    shape = binding(shape, bbox, point, shape_units);
	                }
	                shape = point.position(shape); // ...actual positioning happens here
	                outlines[outline_name] = operation(outlines[outline_name], shape);
	            }

	            if (scale !== 1) {
	                outlines[outline_name] = m$5.model.scale(outlines[outline_name], scale);
	            }
	    
	            if (expand) {
	                outlines[outline_name] = m$5.model.outline(
	                    outlines[outline_name], Math.abs(expand), joints, (expand < 0), {farPoint: u$2.farPoint}
	                );
	            }

	            if (fillet) {
	                for (const [index, chain] of m$5.model.findChains(outlines[outline_name]).entries()) {
	                    outlines[outline_name].models[`fillet_${part_name}_${index}`] = m$5.chain.fillet(chain, fillet);
	                }
	            }
	        }

	        // final adjustments
	        m$5.model.originate(outlines[outline_name]);
	        m$5.model.simplify(outlines[outline_name]);

	    }

	    return outlines
	};

	var cases = {};

	const m$4 = require$$0;
	const a$2 = assert$1;
	const o$1 = operation;

	cases.parse = (config, outlines, units) => {

	    const cases_config = a$2.sane(config, 'cases', 'object')();

	    const scripts = {};
	    const cases = {};
	    const results = {};

	    const resolve = (case_name, resolved_scripts=new Set(), resolved_cases=new Set()) => {
	        for (const o of Object.values(cases[case_name].outline_dependencies)) {
	            resolved_scripts.add(o);
	        }
	        for (const c of Object.values(cases[case_name].case_dependencies)) {
	            resolved_cases.add(c);
	            resolve(c, resolved_scripts, resolved_cases);
	        }
	        const result = [];
	        for (const o of resolved_scripts) {
	            result.push(scripts[o] + '\n\n');
	        }
	        for (const c of resolved_cases) {
	            result.push(cases[c].body);
	        }
	        result.push(cases[case_name].body);
	        result.push(`
        
            function main() {
                return ${case_name}_case_fn();
            }

        `);
	        return result.join('')
	    };

	    for (let [case_name, case_config] of Object.entries(cases_config)) {

	        // config sanitization
	        if (a$2.type(case_config)() == 'array') {
	            case_config = {...case_config};
	        }
	        const parts = a$2.sane(case_config, `cases.${case_name}`, 'object')();

	        const body = [];
	        const case_dependencies = [];
	        const outline_dependencies = [];
	        let first = true;
	        for (let [part_name, part] of Object.entries(parts)) {
	            if (a$2.type(part)() == 'string') {
	                part = o$1.operation(part, {
	                    outline: Object.keys(outlines),
	                    case: Object.keys(cases)
	                }, ['case', 'outline']);
	            }
	            const part_qname = `cases.${case_name}.${part_name}`;
	            const part_var = `${case_name}__part_${part_name}`;
	            a$2.unexpected(part, part_qname, ['what', 'name', 'extrude', 'shift', 'rotate', 'operation']);
	            const what = a$2.in(part.what || 'outline', `${part_qname}.what`, ['outline', 'case']);
	            const name = a$2.sane(part.name, `${part_qname}.name`, 'string')();
	            const shift = a$2.numarr(part.shift || [0, 0, 0], `${part_qname}.shift`, 3)(units);
	            const rotate = a$2.numarr(part.rotate || [0, 0, 0], `${part_qname}.rotate`, 3)(units);
	            const operation = a$2.in(part.operation || 'add', `${part_qname}.operation`, ['add', 'subtract', 'intersect']);

	            let base;
	            if (what == 'outline') {
	                const extrude = a$2.sane(part.extrude || 1, `${part_qname}.extrude`, 'number')(units);
	                const outline = outlines[name];
	                a$2.assert(outline, `Field "${part_qname}.name" does not name a valid outline!`);
	                // This is a hack to separate multiple calls to the same outline with different extrude values
	                // I know it needlessly duplicates a lot of code, but it's the quickest fix in the short term
	                // And on the long run, we'll probably be moving to CADQuery anyway...
	                const extruded_name = `${name}_extrude_` + ('' + extrude).replace(/\D/g, '_');
	                if (!scripts[extruded_name]) {
	                    scripts[extruded_name] = m$4.exporter.toJscadScript(outline, {
	                        functionName: `${extruded_name}_outline_fn`,
	                        extrude: extrude,
	                        indent: 4
	                    });
	                }
	                outline_dependencies.push(extruded_name);
	                base = `${extruded_name}_outline_fn()`;
	            } else {
	                a$2.assert(part.extrude === undefined, `Field "${part_qname}.extrude" should not be used when what=case!`);
	                a$2.in(name, `${part_qname}.name`, Object.keys(cases));
	                case_dependencies.push(name);
	                base = `${name}_case_fn()`;
	            }

	            let op = 'union';
	            if (operation == 'subtract') op = 'subtract';
	            else if (operation == 'intersect') op = 'intersect';

	            let op_statement = `let result = ${part_var};`;
	            if (!first) {
	                op_statement = `result = result.${op}(${part_var});`;
	            }
	            first = false;

	            body.push(`

                // creating part ${part_name} of case ${case_name}
                let ${part_var} = ${base};

                // make sure that rotations are relative
                let ${part_var}_bounds = ${part_var}.getBounds();
                let ${part_var}_x = ${part_var}_bounds[0].x + (${part_var}_bounds[1].x - ${part_var}_bounds[0].x) / 2
                let ${part_var}_y = ${part_var}_bounds[0].y + (${part_var}_bounds[1].y - ${part_var}_bounds[0].y) / 2
                ${part_var} = translate([-${part_var}_x, -${part_var}_y, 0], ${part_var});
                ${part_var} = rotate(${JSON.stringify(rotate)}, ${part_var});
                ${part_var} = translate([${part_var}_x, ${part_var}_y, 0], ${part_var});

                ${part_var} = translate(${JSON.stringify(shift)}, ${part_var});
                ${op_statement}
                
            `);
	        }

	        cases[case_name] = {
	            body: `

                function ${case_name}_case_fn() {
                    ${body.join('')}
                    return result;
                }
            
            `,
	            case_dependencies,
	            outline_dependencies
	        };

	        results[case_name] = resolve(case_name);
	    }

	    return results
	};

	var pcbs = {};

	var alps = {
	    params: {
	        designator: 'S',
	        from: undefined,
	        to: undefined
	    },
	    body: p => `

    (module ALPS (layer F.Cu) (tedit 5CF31DEF)

        ${p.at /* parametric position */}
        
        ${'' /* footprint reference */}
        (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
        (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))
        
        ${''/* corner marks */}
        (fp_line (start -7 -6) (end -7 -7) (layer Dwgs.User) (width 0.15))
        (fp_line (start -7 7) (end -6 7) (layer Dwgs.User) (width 0.15))
        (fp_line (start -6 -7) (end -7 -7) (layer Dwgs.User) (width 0.15))
        (fp_line (start -7 7) (end -7 6) (layer Dwgs.User) (width 0.15))
        (fp_line (start 7 6) (end 7 7) (layer Dwgs.User) (width 0.15))
        (fp_line (start 7 -7) (end 6 -7) (layer Dwgs.User) (width 0.15))
        (fp_line (start 6 7) (end 7 7) (layer Dwgs.User) (width 0.15))
        (fp_line (start 7 -7) (end 7 -6) (layer Dwgs.User) (width 0.15))

        ${''/* pins */}
        (pad 1 thru_hole circle (at 2.5 -4.5) (size 2.25 2.25) (drill 1.47) (layers *.Cu *.Mask) ${p.from})
        (pad 2 thru_hole circle (at -2.5 -4) (size 2.25 2.25) (drill 1.47) (layers *.Cu *.Mask) ${p.to})
    )

    `
	};

	var button = {
	    params: {
	        designator: 'B', // for Button
	        side: 'F',
	        from: undefined,
	        to: undefined
	    },
	    body: p => `
    
    (module E73:SW_TACT_ALPS_SKQGABE010 (layer F.Cu) (tstamp 5BF2CC94)

        (descr "Low-profile SMD Tactile Switch, https://www.e-switch.com/product-catalog/tact/product-lines/tl3342-series-low-profile-smt-tact-switch")
        (tags "SPST Tactile Switch")

        ${p.at /* parametric position */}
        ${'' /* footprint reference */}
        (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
        (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))
        
        ${'' /* outline */}
        (fp_line (start 2.75 1.25) (end 1.25 2.75) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start 2.75 -1.25) (end 1.25 -2.75) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start 2.75 -1.25) (end 2.75 1.25) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -1.25 2.75) (end 1.25 2.75) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -1.25 -2.75) (end 1.25 -2.75) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -2.75 1.25) (end -1.25 2.75) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -2.75 -1.25) (end -1.25 -2.75) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -2.75 -1.25) (end -2.75 1.25) (layer ${p.side}.SilkS) (width 0.15))
        
        ${'' /* pins */}
        (pad 1 smd rect (at -3.1 -1.85 ${p.r}) (size 1.8 1.1) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.from})
        (pad 1 smd rect (at 3.1 -1.85 ${p.r}) (size 1.8 1.1) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.from})
        (pad 2 smd rect (at -3.1 1.85 ${p.r}) (size 1.8 1.1) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.to})
        (pad 2 smd rect (at 3.1 1.85 ${p.r}) (size 1.8 1.1) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.to})
    )
    
    `
	};

	// Kailh Choc PG1350
	// Nets
	//    from: corresponds to pin 1
	//    to: corresponds to pin 2
	// Params
	//    hotswap: default is false
	//      if true, will include holes and pads for Kailh choc hotswap sockets
	//    reverse: default is false
	//      if true, will flip the footprint such that the pcb can be reversible
	//    keycaps: default is false
	//      if true, will add choc sized keycap box around the footprint
	// 
	// note: hotswap and reverse can be used simultaneously

	var choc = {
	  params: {
	    designator: 'S',
	    hotswap: false,
	    reverse: false,
	    keycaps: false,
	    from: undefined,
	    to: undefined
	  },
	  body: p => {
	    const standard = `
      (module PG1350 (layer F.Cu) (tedit 5DD50112)
      ${p.at /* parametric position */}

      ${'' /* footprint reference */}
      (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
      (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))

      ${''/* corner marks */}
      (fp_line (start -7 -6) (end -7 -7) (layer Dwgs.User) (width 0.15))
      (fp_line (start -7 7) (end -6 7) (layer Dwgs.User) (width 0.15))
      (fp_line (start -6 -7) (end -7 -7) (layer Dwgs.User) (width 0.15))
      (fp_line (start -7 7) (end -7 6) (layer Dwgs.User) (width 0.15))
      (fp_line (start 7 6) (end 7 7) (layer Dwgs.User) (width 0.15))
      (fp_line (start 7 -7) (end 6 -7) (layer Dwgs.User) (width 0.15))
      (fp_line (start 6 7) (end 7 7) (layer Dwgs.User) (width 0.15))
      (fp_line (start 7 -7) (end 7 -6) (layer Dwgs.User) (width 0.15))      
      
      ${''/* middle shaft */}
      (pad "" np_thru_hole circle (at 0 0) (size 3.429 3.429) (drill 3.429) (layers *.Cu *.Mask))
        
      ${''/* stabilizers */}
      (pad "" np_thru_hole circle (at 5.5 0) (size 1.7018 1.7018) (drill 1.7018) (layers *.Cu *.Mask))
      (pad "" np_thru_hole circle (at -5.5 0) (size 1.7018 1.7018) (drill 1.7018) (layers *.Cu *.Mask))
      `;
	    const keycap = `
      ${'' /* keycap marks */}
      (fp_line (start -9 -8.5) (end 9 -8.5) (layer Dwgs.User) (width 0.15))
      (fp_line (start 9 -8.5) (end 9 8.5) (layer Dwgs.User) (width 0.15))
      (fp_line (start 9 8.5) (end -9 8.5) (layer Dwgs.User) (width 0.15))
      (fp_line (start -9 8.5) (end -9 -8.5) (layer Dwgs.User) (width 0.15))
      `;
	    function pins(def_neg, def_pos, def_side) {
	      if(p.hotswap) {
	        return `
          ${'' /* holes */}
          (pad "" np_thru_hole circle (at ${def_pos}5 -3.75) (size 3 3) (drill 3) (layers *.Cu *.Mask))
          (pad "" np_thru_hole circle (at 0 -5.95) (size 3 3) (drill 3) (layers *.Cu *.Mask))
      
          ${'' /* net pads */}
          (pad 1 smd rect (at ${def_neg}3.275 -5.95 ${p.r}) (size 2.6 2.6) (layers ${def_side}.Cu ${def_side}.Paste ${def_side}.Mask)  ${p.from})
          (pad 2 smd rect (at ${def_pos}8.275 -3.75 ${p.r}) (size 2.6 2.6) (layers ${def_side}.Cu ${def_side}.Paste ${def_side}.Mask)  ${p.to})
        `
	      } else {
	          return `
            ${''/* pins */}
            (pad 1 thru_hole circle (at ${def_pos}5 -3.8) (size 2.032 2.032) (drill 1.27) (layers *.Cu *.Mask) ${p.from})
            (pad 2 thru_hole circle (at ${def_pos}0 -5.9) (size 2.032 2.032) (drill 1.27) (layers *.Cu *.Mask) ${p.to})
          `
	      }
	    }
	    if(p.reverse) {
	      return `
        ${standard}
        ${p.keycaps ? keycap : ''}
        ${pins('-', '', 'B')}
        ${pins('', '-', 'F')})
        `
	    } else {
	      return `
        ${standard}
        ${p.keycaps ? keycap : ''}
        ${pins('-', '', 'B')})
        `
	    }
	  }
	};

	// Kailh Choc PG1232
	// Nets
	//    from: corresponds to pin 1
	//    to: corresponds to pin 2
	// Params
	//    reverse: default is false
	//      if true, will flip the footprint such that the pcb can be reversible 
	//    keycaps: default is false
	//      if true, will add choc sized keycap box around the footprint

	var chocmini = {
	    params: {
	      designator: 'S',
			  side: 'F',
			  reverse: false,
	      keycaps: false,
	      from: undefined,
	      to: undefined
	    },
	    body: p => {
		    const standard = `
        (module lib:Kailh_PG1232 (layer F.Cu) (tedit 5E1ADAC2)
        ${p.at /* parametric position */} 

        ${'' /* footprint reference */}        
        (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
        (fp_text value Kailh_PG1232 (at 0 -7.3) (layer F.Fab) (effects (font (size 1 1) (thickness 0.15))))

        ${'' /* corner marks */}
        (fp_line (start -7.25 -6.75) (end -6.25 -6.75) (layer Dwgs.User) (width 0.15))
        (fp_line (start -7.25 -6.75) (end -7.25 -5.75) (layer Dwgs.User) (width 0.15))

        (fp_line (start -7.25 6.75) (end -6.25 6.75) (layer Dwgs.User) (width 0.15))
        (fp_line (start -7.25 6.75) (end -7.25 5.75) (layer Dwgs.User) (width 0.15))

        (fp_line (start 7.25 -6.75) (end 6.25 -6.75) (layer Dwgs.User) (width 0.15))
        (fp_line (start 7.25 -6.75) (end 7.25 -5.75) (layer Dwgs.User) (width 0.15))

        (fp_line (start 7.25 6.75) (end 6.25 6.75) (layer Dwgs.User) (width 0.15))
        (fp_line (start 7.25 6.75) (end 7.25 5.75) (layer Dwgs.User) (width 0.15))


        (fp_line (start 2.8 -5.35) (end -2.8 -5.35) (layer Dwgs.User) (width 0.15))
        (fp_line (start -2.8 -3.2) (end 2.8 -3.2) (layer Dwgs.User) (width 0.15))
        (fp_line (start 2.8 -3.2) (end 2.8 -5.35) (layer Dwgs.User) (width 0.15))
        (fp_line (start -2.8 -3.2) (end -2.8 -5.35) (layer Dwgs.User) (width 0.15))
        
        ${''/* middle shaft */}        	 
        (fp_line (start 2.25 2.6) (end 5.8 2.6) (layer Edge.Cuts) (width 0.12))
        (fp_line (start -2.25 2.6) (end -5.8 2.6) (layer Edge.Cuts) (width 0.12))
        (fp_line (start 2.25 3.6) (end 2.25 2.6) (layer Edge.Cuts) (width 0.12))
        (fp_line (start -2.25 3.6) (end 2.25 3.6) (layer Edge.Cuts) (width 0.12))
        (fp_line (start -2.25 2.6) (end -2.25 3.6) (layer Edge.Cuts) (width 0.12))
        (fp_line (start -5.8 2.6) (end -5.8 -2.95) (layer Edge.Cuts) (width 0.12))
        (fp_line (start 5.8 -2.95) (end 5.8 2.6) (layer Edge.Cuts) (width 0.12))
        (fp_line (start -5.8 -2.95) (end 5.8 -2.95) (layer Edge.Cuts) (width 0.12))
        
        ${''/* stabilizers */}    
        (pad 3 thru_hole circle (at 5.3 -4.75) (size 1.6 1.6) (drill 1.1) (layers *.Cu *.Mask) (clearance 0.2))
        (pad 4 thru_hole circle (at -5.3 -4.75) (size 1.6 1.6) (drill 1.1) (layers *.Cu *.Mask) (clearance 0.2))
      `;
	      const keycap = `
        ${'' /* keycap marks */}
        (fp_line (start -9 -8.5) (end 9 -8.5) (layer Dwgs.User) (width 0.15))
        (fp_line (start 9 -8.5) (end 9 8.5) (layer Dwgs.User) (width 0.15))
        (fp_line (start 9 8.5) (end -9 8.5) (layer Dwgs.User) (width 0.15))
        (fp_line (start -9 8.5) (end -9 -8.5) (layer Dwgs.User) (width 0.15))
        `;
	      function pins(def_neg, def_pos) {
	        return `
        ${''/* pins */}
        (pad 1 thru_hole circle (at ${def_neg}4.58 5.1) (size 1.6 1.6) (drill 1.1) (layers *.Cu *.Mask) ${p.from} (clearance 0.2))
        (pad 2 thru_hole circle (at ${def_pos}2 5.4) (size 1.6 1.6) (drill 1.1) (layers *.Cu *.Mask) ${p.to} (clearance 0.2))
			  `
	      }
	      if(p.reverse){
	        return `
          ${standard}
          ${p.keycaps ? keycap : ''}
          ${pins('-', '')}
          ${pins('', '-')})

          `
	      } else {
	        return `
          ${standard}
          ${p.keycaps ? keycap : ''}
          ${pins('-', '')})
          `
	      }
	    }
	  };

	var diode = {
	    params: {
	        designator: 'D',
	        from: undefined,
	        to: undefined
	    },
	    body: p => `
  
    (module ComboDiode (layer F.Cu) (tedit 5B24D78E)


        ${p.at /* parametric position */}

        ${'' /* footprint reference */}
        (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
        (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))
        
        ${''/* diode symbols */}
        (fp_line (start 0.25 0) (end 0.75 0) (layer F.SilkS) (width 0.1))
        (fp_line (start 0.25 0.4) (end -0.35 0) (layer F.SilkS) (width 0.1))
        (fp_line (start 0.25 -0.4) (end 0.25 0.4) (layer F.SilkS) (width 0.1))
        (fp_line (start -0.35 0) (end 0.25 -0.4) (layer F.SilkS) (width 0.1))
        (fp_line (start -0.35 0) (end -0.35 0.55) (layer F.SilkS) (width 0.1))
        (fp_line (start -0.35 0) (end -0.35 -0.55) (layer F.SilkS) (width 0.1))
        (fp_line (start -0.75 0) (end -0.35 0) (layer F.SilkS) (width 0.1))
        (fp_line (start 0.25 0) (end 0.75 0) (layer B.SilkS) (width 0.1))
        (fp_line (start 0.25 0.4) (end -0.35 0) (layer B.SilkS) (width 0.1))
        (fp_line (start 0.25 -0.4) (end 0.25 0.4) (layer B.SilkS) (width 0.1))
        (fp_line (start -0.35 0) (end 0.25 -0.4) (layer B.SilkS) (width 0.1))
        (fp_line (start -0.35 0) (end -0.35 0.55) (layer B.SilkS) (width 0.1))
        (fp_line (start -0.35 0) (end -0.35 -0.55) (layer B.SilkS) (width 0.1))
        (fp_line (start -0.75 0) (end -0.35 0) (layer B.SilkS) (width 0.1))
    
        ${''/* SMD pads on both sides */}
        (pad 1 smd rect (at -1.65 0 ${p.r}) (size 0.9 1.2) (layers F.Cu F.Paste F.Mask) ${p.to})
        (pad 2 smd rect (at 1.65 0 ${p.r}) (size 0.9 1.2) (layers B.Cu B.Paste B.Mask) ${p.from})
        (pad 1 smd rect (at -1.65 0 ${p.r}) (size 0.9 1.2) (layers B.Cu B.Paste B.Mask) ${p.to})
        (pad 2 smd rect (at 1.65 0 ${p.r}) (size 0.9 1.2) (layers F.Cu F.Paste F.Mask) ${p.from})
        
        ${''/* THT terminals */}
        (pad 1 thru_hole rect (at -3.81 0 ${p.r}) (size 1.778 1.778) (drill 0.9906) (layers *.Cu *.Mask) ${p.to})
        (pad 2 thru_hole circle (at 3.81 0 ${p.r}) (size 1.905 1.905) (drill 0.9906) (layers *.Cu *.Mask) ${p.from})
    )
  
    `
	};

	var jstph = {
	    params: {
	        designator: 'JST',
	        side: 'F',
	        pos: undefined,
	        neg: undefined
	    },
	    body: p => `
    
    (module JST_PH_S2B-PH-K_02x2.00mm_Angled (layer F.Cu) (tedit 58D3FE32)

        (descr "JST PH series connector, S2B-PH-K, side entry type, through hole, Datasheet: http://www.jst-mfg.com/product/pdf/eng/ePH.pdf")
        (tags "connector jst ph")

        ${p.at /* parametric position */}

        ${'' /* footprint reference */}
        (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
        (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))

        (fp_line (start -2.25 0.25) (end -2.25 -1.35) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -2.25 -1.35) (end -2.95 -1.35) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -2.95 -1.35) (end -2.95 6.25) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -2.95 6.25) (end 2.95 6.25) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start 2.95 6.25) (end 2.95 -1.35) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start 2.95 -1.35) (end 2.25 -1.35) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start 2.25 -1.35) (end 2.25 0.25) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start 2.25 0.25) (end -2.25 0.25) (layer ${p.side}.SilkS) (width 0.15))

        (fp_line (start -1 1.5) (end -1 2.0) (layer ${p.side}.SilkS) (width 0.15))
        (fp_line (start -1.25 1.75) (end -0.75 1.75) (layer ${p.side}.SilkS) (width 0.15))

        (pad 1 thru_hole rect (at -1 0 ${p.r}) (size 1.2 1.7) (drill 0.75) (layers *.Cu *.Mask) ${p.pos})
        (pad 2 thru_hole oval (at 1 0 ${p.r}) (size 1.2 1.7) (drill 0.75) (layers *.Cu *.Mask) ${p.neg})
            
    )
    
    `
	};

	var jumper = {
	    params: {
	        designator: 'J',
	        side: 'F',
	        from: undefined,
	        to: undefined
	    },
	    body: p => `
        (module lib:Jumper (layer F.Cu) (tedit 5E1ADAC2)
        ${p.at /* parametric position */} 

        ${'' /* footprint reference */}        
        (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
        (fp_text value Jumper (at 0 -7.3) (layer F.Fab) (effects (font (size 1 1) (thickness 0.15))))

        ${'' /* pins */}
        (pad 1 smd rect (at -0.50038 0 ${p.r}) (size 0.635 1.143) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask)
        (clearance 0.1905) ${p.from})
        (pad 2 smd rect (at 0.50038 0 ${p.r}) (size 0.635 1.143) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask)
        (clearance 0.1905) ${p.to}))
    `
	};

	// Any MX switch
	// Nets
	//    from: corresponds to pin 1
	//    to: corresponds to pin 2
	// Params
	//    hotswap: default is false
	//      if true, will include holes and pads for Kailh MX hotswap sockets
	//    reverse: default is false
	//      if true, will flip the footprint such that the pcb can be reversible 
	//    keycaps: default is false
	//      if true, will add choc sized keycap box around the footprint
	//
	// note: hotswap and reverse can be used simultaneously

	var mx = {
	  params: {
	    designator: 'S',
	    hotswap: false,
	    reverse: false,
	    keycaps: false,
	    from: undefined,
	    to: undefined
	  },
	  body: p => {
	    const standard = `
      (module MX (layer F.Cu) (tedit 5DD4F656)
      ${p.at /* parametric position */}

      ${'' /* footprint reference */}
      (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
      (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))

      ${''/* corner marks */}
      (fp_line (start -7 -6) (end -7 -7) (layer Dwgs.User) (width 0.15))
      (fp_line (start -7 7) (end -6 7) (layer Dwgs.User) (width 0.15))
      (fp_line (start -6 -7) (end -7 -7) (layer Dwgs.User) (width 0.15))
      (fp_line (start -7 7) (end -7 6) (layer Dwgs.User) (width 0.15))
      (fp_line (start 7 6) (end 7 7) (layer Dwgs.User) (width 0.15))
      (fp_line (start 7 -7) (end 6 -7) (layer Dwgs.User) (width 0.15))
      (fp_line (start 6 7) (end 7 7) (layer Dwgs.User) (width 0.15))
      (fp_line (start 7 -7) (end 7 -6) (layer Dwgs.User) (width 0.15))
    
      ${''/* middle shaft */}
      (pad "" np_thru_hole circle (at 0 0) (size 3.9878 3.9878) (drill 3.9878) (layers *.Cu *.Mask))

      ${''/* stabilizers */}
      (pad "" np_thru_hole circle (at 5.08 0) (size 1.7018 1.7018) (drill 1.7018) (layers *.Cu *.Mask))
      (pad "" np_thru_hole circle (at -5.08 0) (size 1.7018 1.7018) (drill 1.7018) (layers *.Cu *.Mask))
      `;
	    const keycap = `
      ${'' /* keycap marks */}
      (fp_line (start -9.5 -9.5) (end 9.5 -9.5) (layer Dwgs.User) (width 0.15))
      (fp_line (start 9.5 -9.5) (end 9.5 9.5) (layer Dwgs.User) (width 0.15))
      (fp_line (start 9.5 9.5) (end -9.5 9.5) (layer Dwgs.User) (width 0.15))
      (fp_line (start -9.5 9.5) (end -9.5 -9.5) (layer Dwgs.User) (width 0.15))
      `;
	    function pins(def_neg, def_pos, def_side) {
	      if(p.hotswap) {
	        return `
        ${'' /* holes */}
        (pad "" np_thru_hole circle (at ${def_pos}2.54 -5.08) (size 3 3) (drill 3) (layers *.Cu *.Mask))
        (pad "" np_thru_hole circle (at ${def_neg}3.81 -2.54) (size 3 3) (drill 3) (layers *.Cu *.Mask))
        
        ${'' /* net pads */}
        (pad 1 smd rect (at ${def_neg}7.085 -2.54 ${p.r}) (size 2.55 2.5) (layers ${def_side}.Cu ${def_side}.Paste ${def_side}.Mask) ${p.from})
        (pad 2 smd rect (at ${def_pos}5.842 -5.08 ${p.r}) (size 2.55 2.5) (layers ${def_side}.Cu ${def_side}.Paste ${def_side}.Mask) ${p.to})
        `
	      } else {
	          return `
            ${''/* pins */}
            (pad 1 thru_hole circle (at ${def_pos}2.54 -5.08) (size 2.286 2.286) (drill 1.4986) (layers *.Cu *.Mask) ${p.from})
            (pad 2 thru_hole circle (at ${def_neg}3.81 -2.54) (size 2.286 2.286) (drill 1.4986) (layers *.Cu *.Mask) ${p.to})
          `
	      }
	    }
	    if(p.reverse){
	      return `
        ${standard}
        ${p.keycaps ? keycap : ''}
        ${pins('-', '', 'B')}
        ${pins('', '-', 'F')})
        `
	    } else {
	      return `
        ${standard}
        ${p.keycaps ? keycap : ''}
        ${pins('-', '', 'B')})
        `
	    }
	  }
	};

	var oled = {
	    params: {
	        designator: 'OLED',
	        side: 'F',
	        VCC: {type: 'net', value: 'VCC'},
	        GND: {type: 'net', value: 'GND'},
	        SDA: undefined,
	        SCL: undefined
	    },
	    body: p => `
        (module lib:OLED_headers (layer F.Cu) (tedit 5E1ADAC2)
        ${p.at /* parametric position */} 

        ${'' /* footprint reference */}        
        (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
        (fp_text value OLED (at 0 -7.3) (layer F.Fab) (effects (font (size 1 1) (thickness 0.15))))

        ${'' /* pins */}
        (pad 4 thru_hole oval (at 1.6 2.18 ${p.r+270}) (size 1.7 1.7) (drill 1) (layers *.Cu *.Mask)
        ${p.SDA})
        (pad 3 thru_hole oval (at 1.6 4.72 ${p.r+270}) (size 1.7 1.7) (drill 1) (layers *.Cu *.Mask)
        ${p.SCL})
        (pad 2 thru_hole oval (at 1.6 7.26 ${p.r+270}) (size 1.7 1.7) (drill 1) (layers *.Cu *.Mask)
        ${p.VCC})
        (pad 1 thru_hole rect (at 1.6 9.8 ${p.r+270}) (size 1.7 1.7) (drill 1) (layers *.Cu *.Mask)
        ${p.GND})
        )
        `
	};

	var omron = {
	    params: {
	        designator: 'S',
	        from: undefined,
	        to: undefined
	    },
	    body: p => `
    
    (module OMRON_B3F-4055 (layer F.Cu) (tstamp 5BF2CC94)

        ${p.at /* parametric position */}
        ${'' /* footprint reference */}
        (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
        (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))
        
        ${'' /* stabilizers */}
        (pad "" np_thru_hole circle (at 0 -4.5) (size 1.8 1.8) (drill 1.8) (layers *.Cu *.Mask))
        (pad "" np_thru_hole circle (at 0 4.5) (size 1.8 1.8) (drill 1.8) (layers *.Cu *.Mask))

        ${'' /* switch marks */}
        (fp_line (start -6 -6) (end 6 -6) (layer Dwgs.User) (width 0.15))
        (fp_line (start 6 -6) (end 6 6) (layer Dwgs.User) (width 0.15))
        (fp_line (start 6 6) (end -6 6) (layer Dwgs.User) (width 0.15))
        (fp_line (start -6 6) (end -6 -6) (layer Dwgs.User) (width 0.15))

        ${'' /* pins */}
        (pad 1 np_thru_hole circle (at 6.25 -2.5) (size 1.2 1.2) (drill 1.2) (layers *.Cu *.Mask) ${p.from})
        (pad 2 np_thru_hole circle (at -6.25 -2.5) (size 1.2 1.2) (drill 1.2) (layers *.Cu *.Mask) ${p.from})
        (pad 3 np_thru_hole circle (at 6.25 2.5) (size 1.2 1.2) (drill 1.2) (layers *.Cu *.Mask) ${p.to})
        (pad 4 np_thru_hole circle (at -6.25 2.5 ) (size 1.2 1.2) (drill 1.2) (layers *.Cu *.Mask) ${p.to})
    )
    
    `
	};

	var pad = {
	    params: {
	        designator: 'PAD',
	        width: 1,
	        height: 1,
	        front: true,
	        back: true,
	        text: '',
	        align: 'left',
	        mirrored: {type: 'boolean', value: '{{mirrored}}'},
	        net: undefined
	    },
	    body: p => {

	        const layout = (toggle, side) => {
	            if (!toggle) return ''
	            let x = 0, y = 0;
	            const mirror = side == 'B' ? '(justify mirror)' : '';
	            const plus = (p.text.length + 1) * 0.5;
	            let align = p.align;
	            if (p.mirrored === true) {
	                if (align == 'left') align = 'right';
	                else if (align == 'right') align = 'left';
	            }
	            if (align == 'left') x -= p.width / 2 + plus;
	            if (align == 'right') x += p.width / 2 + plus;
	            if (align == 'up') y += p.height / 2 + plus;
	            if (align == 'down') y -= p.height / 2 + plus;
	            let text = '';
	            if (p.text.length) {
	                text = `(fp_text user ${p.text} (at ${x} ${y} ${p.r}) (layer ${side}.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15)) ${mirror}))`;
	            }
	            return `(pad 1 smd rect (at 0 0 ${p.r}) (size ${p.width} ${p.height}) (layers ${side}.Cu ${side}.Paste ${side}.Mask) ${p.net})\n${text}`
	        };

	        return `
    
        (module SMDPad (layer F.Cu) (tedit 5B24D78E)

            ${p.at /* parametric position */}

            ${'' /* footprint reference */}
            (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
            (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))
            
            ${''/* SMD pads */}
            ${layout(p.front, 'F')}
            ${layout(p.back, 'B')}
            
        )
    
        `
	    }
	};

	// Arduino ProMicro atmega32u4au
	// Params
	//  orientation: default is down
	//    if down, power led will face the pcb
	//    if up, power led will face away from pcb

	var promicro = {
	  params: {
	    designator: 'MCU',
	    orientation: 'down',
	    RAW: {type: 'net', value: 'RAW'},
	    GND: {type: 'net', value: 'GND'},
	    RST: {type: 'net', value: 'RST'},
	    VCC: {type: 'net', value: 'VCC'},
	    P21: {type: 'net', value: 'P21'},
	    P20: {type: 'net', value: 'P20'},
	    P19: {type: 'net', value: 'P19'},
	    P18: {type: 'net', value: 'P18'},
	    P15: {type: 'net', value: 'P15'},
	    P14: {type: 'net', value: 'P14'},
	    P16: {type: 'net', value: 'P16'},
	    P10: {type: 'net', value: 'P10'},
	    P1: {type: 'net', value: 'P1'},
	    P0: {type: 'net', value: 'P0'},
	    P2: {type: 'net', value: 'P2'},
	    P3: {type: 'net', value: 'P3'},
	    P4: {type: 'net', value: 'P4'},
	    P5: {type: 'net', value: 'P5'},
	    P6: {type: 'net', value: 'P6'},
	    P7: {type: 'net', value: 'P7'},
	    P8: {type: 'net', value: 'P8'},
	    P9: {type: 'net', value: 'P9'}
	  },
	  body: p => {
	    const standard = `
      (module ProMicro (layer F.Cu) (tedit 5B307E4C)
      ${p.at /* parametric position */}

      ${'' /* footprint reference */}
      (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
      (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))
    
      ${''/* illustration of the (possible) USB port overhang */}
      (fp_line (start -19.304 -3.81) (end -14.224 -3.81) (layer Dwgs.User) (width 0.15))
      (fp_line (start -19.304 3.81) (end -19.304 -3.81) (layer Dwgs.User) (width 0.15))
      (fp_line (start -14.224 3.81) (end -19.304 3.81) (layer Dwgs.User) (width 0.15))
      (fp_line (start -14.224 -3.81) (end -14.224 3.81) (layer Dwgs.User) (width 0.15))
    
      ${''/* component outline */}
      (fp_line (start -17.78 8.89) (end 15.24 8.89) (layer F.SilkS) (width 0.15))
      (fp_line (start 15.24 8.89) (end 15.24 -8.89) (layer F.SilkS) (width 0.15))
      (fp_line (start 15.24 -8.89) (end -17.78 -8.89) (layer F.SilkS) (width 0.15))
      (fp_line (start -17.78 -8.89) (end -17.78 8.89) (layer F.SilkS) (width 0.15))
      `;
	    function pins(def_neg, def_pos) {
	      return `
        ${''/* extra border around "RAW", in case the rectangular shape is not distinctive enough */}
        (fp_line (start -15.24 ${def_pos}6.35) (end -12.7 ${def_pos}6.35) (layer F.SilkS) (width 0.15))
        (fp_line (start -15.24 ${def_pos}6.35) (end -15.24 ${def_pos}8.89) (layer F.SilkS) (width 0.15))
        (fp_line (start -12.7 ${def_pos}6.35) (end -12.7 ${def_pos}8.89) (layer F.SilkS) (width 0.15))
      
        ${''/* pin names */}
        (fp_text user RAW (at -13.97 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user GND (at -11.43 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user RST (at -8.89 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user VCC (at -6.35 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P21 (at -3.81 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P20 (at -1.27 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P19 (at 1.27 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P18 (at 3.81 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P15 (at 6.35 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P14 (at 8.89 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P16 (at 11.43 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P10 (at 13.97 ${def_pos}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
      
        (fp_text user P01 (at -13.97 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P00 (at -11.43 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user GND (at -8.89 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user GND (at -6.35 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P02 (at -3.81 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P03 (at -1.27 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P04 (at 1.27 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P05 (at 3.81 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P06 (at 6.35 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P07 (at 8.89 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P08 (at 11.43 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
        (fp_text user P09 (at 13.97 ${def_neg}4.8 ${p.r + 90}) (layer F.SilkS) (effects (font (size 0.8 0.8) (thickness 0.15))))
      
        ${''/* and now the actual pins */}
        (pad 1 thru_hole rect (at -13.97 ${def_pos}7.62 ${p.r}) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.RAW})
        (pad 2 thru_hole circle (at -11.43 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.GND})
        (pad 3 thru_hole circle (at -8.89 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.RST})
        (pad 4 thru_hole circle (at -6.35 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.VCC})
        (pad 5 thru_hole circle (at -3.81 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P21})
        (pad 6 thru_hole circle (at -1.27 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P20})
        (pad 7 thru_hole circle (at 1.27 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P19})
        (pad 8 thru_hole circle (at 3.81 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P18})
        (pad 9 thru_hole circle (at 6.35 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P15})
        (pad 10 thru_hole circle (at 8.89 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P14})
        (pad 11 thru_hole circle (at 11.43 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P16})
        (pad 12 thru_hole circle (at 13.97 ${def_pos}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P10})
        
        (pad 13 thru_hole circle (at -13.97 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P1})
        (pad 14 thru_hole circle (at -11.43 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P0})
        (pad 15 thru_hole circle (at -8.89 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.GND})
        (pad 16 thru_hole circle (at -6.35 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.GND})
        (pad 17 thru_hole circle (at -3.81 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P2})
        (pad 18 thru_hole circle (at -1.27 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P3})
        (pad 19 thru_hole circle (at 1.27 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P4})
        (pad 20 thru_hole circle (at 3.81 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P5})
        (pad 21 thru_hole circle (at 6.35 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P6})
        (pad 22 thru_hole circle (at 8.89 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P7})
        (pad 23 thru_hole circle (at 11.43 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P8})
        (pad 24 thru_hole circle (at 13.97 ${def_neg}7.62 0) (size 1.7526 1.7526) (drill 1.0922) (layers *.Cu *.SilkS *.Mask) ${p.P9})
      `
	    }
	    if(p.orientation == 'down') {
	      return `
        ${standard}
        ${pins('-', '')})
        `
	    } else {
	      return `
        ${standard}
        ${pins('', '-')})
        `
	    }
	  }
	};

	var rgb = {
	    params: {
	        designator: 'LED',
	        side: 'F',
	        din: undefined,
	        dout: undefined,
	        VCC: {type: 'net', value: 'VCC'},
	        GND: {type: 'net', value: 'GND'}
	    },
	    body: p => `
    
        (module WS2812B (layer F.Cu) (tedit 53BEE615)

            ${p.at /* parametric position */}

            ${'' /* footprint reference */}
            (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
            (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))

            (fp_line (start -1.75 -1.75) (end -1.75 1.75) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start -1.75 1.75) (end 1.75 1.75) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start 1.75 1.75) (end 1.75 -1.75) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start 1.75 -1.75) (end -1.75 -1.75) (layer ${p.side}.SilkS) (width 0.15))

            (fp_line (start -2.5 -2.5) (end -2.5 2.5) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start -2.5 2.5) (end 2.5 2.5) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start 2.5 2.5) (end 2.5 -2.5) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start 2.5 -2.5) (end -2.5 -2.5) (layer ${p.side}.SilkS) (width 0.15))

            (fp_poly (pts (xy 4 2.2) (xy 4 0.375) (xy 5 1.2875)) (layer ${p.side}.SilkS) (width 0.1))

            (pad 1 smd rect (at -2.2 -0.875 ${p.r}) (size 2.6 1) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.VCC})
            (pad 2 smd rect (at -2.2 0.875 ${p.r}) (size 2.6 1) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.dout})
            (pad 3 smd rect (at 2.2 0.875 ${p.r}) (size 2.6 1) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.GND})
            (pad 4 smd rect (at 2.2 -0.875 ${p.r}) (size 2.6 1) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.din})

            (pad 11 smd rect (at -2.5 -1.6 ${p.r}) (size 2 1.2) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.VCC})
            (pad 22 smd rect (at -2.5 1.6 ${p.r}) (size 2 1.2) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.dout})
            (pad 33 smd rect (at 2.5 1.6 ${p.r}) (size 2 1.2) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.GND})
            (pad 44 smd rect (at 2.5 -1.6 ${p.r}) (size 2 1.2) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.din})
            
        )
    
    `
	};

	// EC11 rotary encoder
	//
	// Nets
	//    from: corresponds to switch pin 1 (for button presses)
	//    to: corresponds to switch pin 2 (for button presses)
	//    A: corresponds to pin 1 (for rotary)
	//    B: corresponds to pin 2 (for rotary, should be GND)
	//    C: corresponds to pin 3 (for rotary)

	var rotary = {
	    params: {
	        designator: 'ROT',
	        from: undefined,
	        to: undefined,
	        A: undefined,
	        B: undefined,
	        C: undefined
	    },
	    body: p => `
        (module rotary_encoder (layer F.Cu) (tedit 603326DE)

            ${p.at /* parametric position */}
        
            ${'' /* footprint reference */}
            (fp_text reference "${p.ref}" (at 0 0.5) (layer F.SilkS) 
                ${p.ref_hide} (effects (font (size 1 1) (thickness 0.15))))
            (fp_text value "" (at 0 8.89) (layer F.Fab)
                (effects (font (size 1 1) (thickness 0.15))))

            ${''/* component outline */}
            (fp_line (start -0.62 -0.04) (end 0.38 -0.04) (layer F.SilkS) (width 0.12))
            (fp_line (start -0.12 -0.54) (end -0.12 0.46) (layer F.SilkS) (width 0.12))
            (fp_line (start 5.98 3.26) (end 5.98 5.86) (layer F.SilkS) (width 0.12))
            (fp_line (start 5.98 -1.34) (end 5.98 1.26) (layer F.SilkS) (width 0.12))
            (fp_line (start 5.98 -5.94) (end 5.98 -3.34) (layer F.SilkS) (width 0.12))
            (fp_line (start -3.12 -0.04) (end 2.88 -0.04) (layer F.Fab) (width 0.12))
            (fp_line (start -0.12 -3.04) (end -0.12 2.96) (layer F.Fab) (width 0.12))
            (fp_line (start -7.32 -4.14) (end -7.62 -3.84) (layer F.SilkS) (width 0.12))
            (fp_line (start -7.92 -4.14) (end -7.32 -4.14) (layer F.SilkS) (width 0.12))
            (fp_line (start -7.62 -3.84) (end -7.92 -4.14) (layer F.SilkS) (width 0.12))
            (fp_line (start -6.22 -5.84) (end -6.22 5.86) (layer F.SilkS) (width 0.12))
            (fp_line (start -2.12 -5.84) (end -6.22 -5.84) (layer F.SilkS) (width 0.12))
            (fp_line (start -2.12 5.86) (end -6.22 5.86) (layer F.SilkS) (width 0.12))
            (fp_line (start 5.98 5.86) (end 1.88 5.86) (layer F.SilkS) (width 0.12))
            (fp_line (start 1.88 -5.94) (end 5.98 -5.94) (layer F.SilkS) (width 0.12))
            (fp_line (start -6.12 -4.74) (end -5.12 -5.84) (layer F.Fab) (width 0.12))
            (fp_line (start -6.12 5.76) (end -6.12 -4.74) (layer F.Fab) (width 0.12))
            (fp_line (start 5.88 5.76) (end -6.12 5.76) (layer F.Fab) (width 0.12))
            (fp_line (start 5.88 -5.84) (end 5.88 5.76) (layer F.Fab) (width 0.12))
            (fp_line (start -5.12 -5.84) (end 5.88 -5.84) (layer F.Fab) (width 0.12))
            (fp_line (start -8.87 -6.89) (end 7.88 -6.89) (layer F.CrtYd) (width 0.05))
            (fp_line (start -8.87 -6.89) (end -8.87 6.81) (layer F.CrtYd) (width 0.05))
            (fp_line (start 7.88 6.81) (end 7.88 -6.89) (layer F.CrtYd) (width 0.05))
            (fp_line (start 7.88 6.81) (end -8.87 6.81) (layer F.CrtYd) (width 0.05))
            (fp_circle (center -0.12 -0.04) (end 2.88 -0.04) (layer F.SilkS) (width 0.12))
            (fp_circle (center -0.12 -0.04) (end 2.88 -0.04) (layer F.Fab) (width 0.12))

            ${''/* pin names */}
            (pad A thru_hole rect (at -7.62 -2.54 ${p.r}) (size 2 2) (drill 1) (layers *.Cu *.Mask) ${p.A})
            (pad C thru_hole circle (at -7.62 -0.04) (size 2 2) (drill 1) (layers *.Cu *.Mask) ${p.C})
            (pad B thru_hole circle (at -7.62 2.46) (size 2 2) (drill 1) (layers *.Cu *.Mask) ${p.B})
            (pad 1 thru_hole circle (at 6.88 -2.54) (size 1.5 1.5) (drill 1) (layers *.Cu *.Mask) ${p.from})
            (pad 2 thru_hole circle (at 6.88 2.46) (size 1.5 1.5) (drill 1) (layers *.Cu *.Mask) ${p.to})

            ${''/* Legs */}
            (pad "" thru_hole rect (at -0.12 -5.64 ${p.r}) (size 3.2 2) (drill oval 2.8 1.5) (layers *.Cu *.Mask))
            (pad "" thru_hole rect (at -0.12 5.56 ${p.r})  (size 3.2 2) (drill oval 2.8 1.5) (layers *.Cu *.Mask))
        )
    `
	};

	// Panasonic EVQWGD001 horizontal rotary encoder
	//
	//   __________________
	//  (f) (t)         | |
	//  | (1)           | |
	//  | (2)           | |
	//  | (3)           | |
	//  | (4)           | |
	//  |_( )___________|_|
	//
	// Nets
	//    from: corresponds to switch pin 1 (for button presses)
	//    to: corresponds to switch pin 2 (for button presses)
	//    A: corresponds to pin 1 (for rotary)
	//    B: corresponds to pin 2 (for rotary, should be GND)
	//    C: corresponds to pin 3 (for rotary)
	//    D: corresponds to pin 4 (for rotary, unused)
	// Params
	//    reverse: default is false
	//      if true, will flip the footprint such that the pcb can be reversible


	var scrollwheel = {
	    params: {
	      designator: 'S',
			  reverse: false,
	      from: undefined,
	      to: undefined,
	      A: undefined,
	      B: undefined,
	      C: undefined,
	      D: undefined
	    },
	    body: p => {
	      const standard = `
        (module RollerEncoder_Panasonic_EVQWGD001 (layer F.Cu) (tedit 6040A10C)
        ${p.at /* parametric position */}   
        (fp_text reference REF** (at 0 0 ${p.r}) (layer F.Fab) (effects (font (size 1 1) (thickness 0.15))))
        (fp_text value RollerEncoder_Panasonic_EVQWGD001 (at -0.1 9 ${p.r}) (layer F.Fab) (effects (font (size 1 1) (thickness 0.15))))
        
        ${'' /* corner marks */}
        (fp_line (start -8.4 -6.4) (end 8.4 -6.4) (layer Dwgs.User) (width 0.12))
        (fp_line (start 8.4 -6.4) (end 8.4 7.4) (layer Dwgs.User) (width 0.12))
        (fp_line (start 8.4 7.4) (end -8.4 7.4) (layer Dwgs.User) (width 0.12))
        (fp_line (start -8.4 7.4) (end -8.4 -6.4) (layer Dwgs.User) (width 0.12))
      `;
	      function pins(def_neg, def_pos) {
	        return `
          ${'' /* edge cuts */}
          (fp_line (start ${def_pos}9.8 7.3) (end ${def_pos}9.8 -6.3) (layer Edge.Cuts) (width 0.15))
          (fp_line (start ${def_pos}7.4 -6.3) (end ${def_pos}7.4 7.3) (layer Edge.Cuts) (width 0.15))
          (fp_line (start ${def_pos}9.5 -6.6) (end ${def_pos}7.7 -6.6) (layer Edge.Cuts) (width 0.15))
          (fp_line (start ${def_pos}7.7 7.6) (end ${def_pos}9.5 7.6) (layer Edge.Cuts) (width 0.15))
          (fp_arc (start ${def_pos}7.7 7.3) (end ${def_pos}7.4 7.3) (angle ${def_neg}90) (layer Edge.Cuts) (width 0.15))
          (fp_arc (start ${def_pos}9.5 7.3) (end ${def_pos}9.5 7.6) (angle ${def_neg}90) (layer Edge.Cuts) (width 0.15))
          (fp_arc (start ${def_pos}7.7 -6.3) (end ${def_pos}7.7 -6.6) (angle ${def_neg}90) (layer Edge.Cuts) (width 0.15))
          (fp_arc (start ${def_pos}9.5 -6.3) (end ${def_pos}9.8 -6.3) (angle ${def_neg}90) (layer Edge.Cuts) (width 0.15))

          ${'' /* pins */}
          (pad S1 thru_hole circle (at ${def_neg}6.85 -6.2 ${p.r}) (size 1.6 1.6) (drill 0.9) (layers *.Cu *.Mask) ${p.from})
          (pad S2 thru_hole circle (at ${def_neg}5 -6.2 ${p.r}) (size 1.6 1.6) (drill 0.9) (layers *.Cu *.Mask) ${p.to})
          (pad A thru_hole circle (at ${def_neg}5.625 -3.81 ${p.r}) (size 1.6 1.6) (drill 0.9) (layers *.Cu *.Mask) ${p.A})
          (pad B thru_hole circle (at ${def_neg}5.625 -1.27 ${p.r}) (size 1.6 1.6) (drill 0.9) (layers *.Cu *.Mask) ${p.B})
          (pad C thru_hole circle (at ${def_neg}5.625 1.27 ${p.r}) (size 1.6 1.6) (drill 0.9) (layers *.Cu *.Mask) ${p.C})
          (pad D thru_hole circle (at ${def_neg}5.625 3.81 ${p.r}) (size 1.6 1.6) (drill 0.9) (layers *.Cu *.Mask) ${p.D})

          ${'' /* stabilizer */}
          (pad "" np_thru_hole circle (at ${def_neg}5.625 6.3 ${p.r}) (size 1.5 1.5) (drill 1.5) (layers *.Cu *.Mask))
        `
	    }
	    if(p.reverse) {
	      return `
        ${standard}
        ${pins('-', '')}
        ${pins('', '-')})
        `
	    } else {
	      return `
        ${standard}
        ${pins('-', '')})
        `
	    }
	  }
	};

	var slider = {
	    params: {
	        designator: 'T', // for Toggle
	        side: 'F',
	        from: undefined,
	        to: undefined
	    },
	    body: p => {

	        const left = p.side == 'F' ? '-' : '';
	        const right = p.side == 'F' ? '' : '-';

	        return `
        
        (module E73:SPDT_C128955 (layer F.Cu) (tstamp 5BF2CC3C)

            ${p.at /* parametric position */}

            ${'' /* footprint reference */}
            (fp_text reference "${p.ref}" (at 0 0) (layer F.SilkS) ${p.ref_hide} (effects (font (size 1.27 1.27) (thickness 0.15))))
            (fp_text value "" (at 0 0) (layer F.SilkS) hide (effects (font (size 1.27 1.27) (thickness 0.15))))
            
            ${'' /* outline */}
            (fp_line (start 1.95 -1.35) (end -1.95 -1.35) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start 0 -1.35) (end -3.3 -1.35) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start -3.3 -1.35) (end -3.3 1.5) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start -3.3 1.5) (end 3.3 1.5) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start 3.3 1.5) (end 3.3 -1.35) (layer ${p.side}.SilkS) (width 0.15))
            (fp_line (start 0 -1.35) (end 3.3 -1.35) (layer ${p.side}.SilkS) (width 0.15))
            
            ${'' /* extra indicator for the slider */}
            (fp_line (start -1.95 -3.85) (end 1.95 -3.85) (layer Dwgs.User) (width 0.15))
            (fp_line (start 1.95 -3.85) (end 1.95 -1.35) (layer Dwgs.User) (width 0.15))
            (fp_line (start -1.95 -1.35) (end -1.95 -3.85) (layer Dwgs.User) (width 0.15))
            
            ${'' /* bottom cutouts */}
            (pad "" np_thru_hole circle (at 1.5 0) (size 1 1) (drill 0.9) (layers *.Cu *.Mask))
            (pad "" np_thru_hole circle (at -1.5 0) (size 1 1) (drill 0.9) (layers *.Cu *.Mask))

            ${'' /* pins */}
            (pad 1 smd rect (at ${right}2.25 2.075 ${p.r}) (size 0.9 1.25) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.from})
            (pad 2 smd rect (at ${left}0.75 2.075 ${p.r}) (size 0.9 1.25) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask) ${p.to})
            (pad 3 smd rect (at ${left}2.25 2.075 ${p.r}) (size 0.9 1.25) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask))
            
            ${'' /* side mounts */}
            (pad "" smd rect (at 3.7 -1.1 ${p.r}) (size 0.9 0.9) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask))
            (pad "" smd rect (at 3.7 1.1 ${p.r}) (size 0.9 0.9) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask))
            (pad "" smd rect (at -3.7 1.1 ${p.r}) (size 0.9 0.9) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask))
            (pad "" smd rect (at -3.7 -1.1 ${p.r}) (size 0.9 0.9) (layers ${p.side}.Cu ${p.side}.Paste ${p.side}.Mask))
        )
        
        `
	    }
	};

	// TRRS-PJ-320A-dual
	//
	// Normal footprint:
	//     _________________
	//    |   (2)   (3) (4)|
	//    |                |
	//    | (1)            |
	//    |________________|
	// 
	// Reverse footprint:
	//     _________________
	//    |   (2)   (3) (4)|
	//    | (1)            |
	//    | (1)            |
	//    |___(2)___(3)_(4)|
	//
	// Reverse & symmetric footprint:
	//     _________________
	//    | (1|2)   (3) (4)|
	//    |                |
	//    |_(1|2)___(3)_(4)|
	//
	// Nets
	//    A: corresponds to pin 1
	//    B: corresponds to pin 2
	//    C: corresponds to pin 3
	//    D: corresponds to pin 4
	// Params
	//    reverse: default is false
	//      if true, will flip the footprint such that the pcb can be reversible
	//    symmetric: default is false
	//      if true, will only work if reverse is also true
	//      this will cause the footprint to be symmetrical on each half
	//      pins 1 and 2 must be identical if symmetric is true, as they will overlap

	var trrs = {
	  params: {
	    designator: 'TRRS',
	    reverse: false,
	    symmetric: false,
	    A: undefined,
	    B: undefined,
	    C: undefined,
	    D: undefined
	  },
	  body: p => {
	    const standard = `
      (module TRRS-PJ-320A-dual (layer F.Cu) (tedit 5970F8E5)

      ${p.at /* parametric position */}   

      ${'' /* footprint reference */}
      (fp_text reference "${p.ref}" (at 0 14.2) (layer Dwgs.User) (effects (font (size 1 1) (thickness 0.15))))
      (fp_text value TRRS-PJ-320A-dual (at 0 -5.6) (layer F.Fab) (effects (font (size 1 1) (thickness 0.15))))

      ${''/* corner marks */}
      (fp_line (start 0.5 -2) (end -5.1 -2) (layer Dwgs.User) (width 0.15))
      (fp_line (start -5.1 0) (end -5.1 -2) (layer Dwgs.User) (width 0.15))
      (fp_line (start 0.5 0) (end 0.5 -2) (layer Dwgs.User) (width 0.15))
      (fp_line (start -5.35 0) (end -5.35 12.1) (layer Dwgs.User) (width 0.15))
      (fp_line (start 0.75 0) (end 0.75 12.1) (layer Dwgs.User) (width 0.15))
      (fp_line (start 0.75 12.1) (end -5.35 12.1) (layer Dwgs.User) (width 0.15))
      (fp_line (start 0.75 0) (end -5.35 0) (layer Dwgs.User) (width 0.15))

      `;
	    function stabilizers(def_pos) {
	      return `
        (pad "" np_thru_hole circle (at ${def_pos} 8.6) (size 1.5 1.5) (drill 1.5) (layers *.Cu *.Mask))
        (pad "" np_thru_hole circle (at ${def_pos} 1.6) (size 1.5 1.5) (drill 1.5) (layers *.Cu *.Mask))
      `
	    }
	    function pins(def_neg, def_pos) {
	      return `
        (pad 1 thru_hole oval (at ${def_neg} 11.3 ${p.r}) (size 1.6 2.2) (drill oval 0.9 1.5) (layers *.Cu *.Mask) ${p.A})
        (pad 2 thru_hole oval (at ${def_pos} 10.2 ${p.r}) (size 1.6 2.2) (drill oval 0.9 1.5) (layers *.Cu *.Mask) ${p.B})
        (pad 3 thru_hole oval (at ${def_pos} 6.2 ${p.r}) (size 1.6 2.2) (drill oval 0.9 1.5) (layers *.Cu *.Mask) ${p.C})
        (pad 4 thru_hole oval (at ${def_pos} 3.2 ${p.r}) (size 1.6 2.2) (drill oval 0.9 1.5) (layers *.Cu *.Mask) ${p.D})
      `
	    }
	    if(p.reverse & p.symmetric) {
	      return `
        ${standard}
        ${stabilizers('-2.3')}
        ${pins('0', '-4.6')}
        ${pins('-4.6', '0')})
      `
	    } else if(p.reverse) {
	        return `
          ${standard}
          ${stabilizers('-2.3')}
          ${stabilizers('0')}
          ${pins('-2.3', '2.3')}
          ${pins('0', '-4.6')})
        `
	    } else {
	      return `
        ${standard}
        ${stabilizers('-2.3')}
        ${pins('-4.6', '0')})
      `
	    }
	  }
	};

	// Via
	// Nets
	//		net: the net this via should be connected to

	var via = {
	    params: {
	      net: undefined
	    },
	    body: p => `
      (module VIA-0.6mm (layer F.Cu) (tedit 591DBFB0)
      ${p.at /* parametric position */}   
      ${'' /* footprint reference */}
      (fp_text reference REF** (at 0 1.4) (layer F.SilkS) hide (effects (font (size 1 1) (thickness 0.15))))
      (fp_text value VIA-0.6mm (at 0 -1.4) (layer F.Fab) hide (effects (font (size 1 1) (thickness 0.15))))

      ${'' /* via */}
      (pad 1 thru_hole circle (at 0 0) (size 0.6 0.6) (drill 0.3) (layers *.Cu) (zone_connect 2) ${p.net})
      )
    `
	};

	var footprints = {
	    alps: alps,
	    button: button,
	    choc: choc,
	    chocmini: chocmini,
	    diode: diode,
	    jstph: jstph,
	    jumper: jumper,
	    mx: mx,
	    oled: oled,
	    omron: omron,
	    pad: pad,
	    promicro: promicro,
	    rgb: rgb,
	    rotary: rotary,
	    scrollwheel: scrollwheel,
	    slider: slider,
	    trrs: trrs,
	    via: via,
	};

	const m$3 = require$$0;

	var kicad5 = {

	    convert_outline: (model, layer) => {
	        const grs = [];
	        const xy = val => `${val[0]} ${-val[1]}`;
	        m$3.model.walk(model, {
	            onPath: wp => {
	                const p = wp.pathContext;
	                switch (p.type) {
	                    case 'line':
	                        grs.push(`(gr_line (start ${xy(p.origin)}) (end ${xy(p.end)}) (angle 90) (layer ${layer}) (width 0.15))`);
	                        break
	                    case 'arc':
	                        const arc_center = p.origin;
	                        const angle_start = p.startAngle > p.endAngle ? p.startAngle - 360 : p.startAngle;
	                        const angle_diff = Math.abs(p.endAngle - angle_start);
	                        const arc_end = m$3.point.rotate(m$3.point.add(arc_center, [p.radius, 0]), angle_start, arc_center);
	                        grs.push(`(gr_arc (start ${xy(arc_center)}) (end ${xy(arc_end)}) (angle ${-angle_diff}) (layer ${layer}) (width 0.15))`);
	                        break
	                    case 'circle':
	                        const circle_center = p.origin;
	                        const circle_end = m$3.point.add(circle_center, [p.radius, 0]);
	                        grs.push(`(gr_circle (center ${xy(circle_center)}) (end ${xy(circle_end)}) (layer ${layer}) (width 0.15))`);
	                        break
	                    default:
	                        throw new Error(`Can't convert path type "${p.type}" to kicad!`)
	                }
	            }
	        });
	        return grs.join('\n')
	    },

	    body: params => {

	        const net_text = params.nets.join('\n');
	        const netclass_text = params.nets.map(net => `(add_net "${net.name}")`).join('\n');
	        const footprint_text = params.footprints.join('\n');
	        const outline_text = Object.values(params.outlines).join('\n');
	        
	        return `

(kicad_pcb (version 20171130) (host pcbnew 5.1.6)

  (page A3)
  (title_block
    (title "${params.name}")
    (rev "${params.version}")
    (company "${params.author}")
  )

  (general
    (thickness 1.6)
  )

  (layers
    (0 F.Cu signal)
    (31 B.Cu signal)
    (32 B.Adhes user)
    (33 F.Adhes user)
    (34 B.Paste user)
    (35 F.Paste user)
    (36 B.SilkS user)
    (37 F.SilkS user)
    (38 B.Mask user)
    (39 F.Mask user)
    (40 Dwgs.User user)
    (41 Cmts.User user)
    (42 Eco1.User user)
    (43 Eco2.User user)
    (44 Edge.Cuts user)
    (45 Margin user)
    (46 B.CrtYd user)
    (47 F.CrtYd user)
    (48 B.Fab user)
    (49 F.Fab user)
  )

  (setup
    (last_trace_width 0.25)
    (trace_clearance 0.2)
    (zone_clearance 0.508)
    (zone_45_only no)
    (trace_min 0.2)
    (via_size 0.8)
    (via_drill 0.4)
    (via_min_size 0.4)
    (via_min_drill 0.3)
    (uvia_size 0.3)
    (uvia_drill 0.1)
    (uvias_allowed no)
    (uvia_min_size 0.2)
    (uvia_min_drill 0.1)
    (edge_width 0.05)
    (segment_width 0.2)
    (pcb_text_width 0.3)
    (pcb_text_size 1.5 1.5)
    (mod_edge_width 0.12)
    (mod_text_size 1 1)
    (mod_text_width 0.15)
    (pad_size 1.524 1.524)
    (pad_drill 0.762)
    (pad_to_mask_clearance 0.05)
    (aux_axis_origin 0 0)
    (visible_elements FFFFFF7F)
    (pcbplotparams
      (layerselection 0x010fc_ffffffff)
      (usegerberextensions false)
      (usegerberattributes true)
      (usegerberadvancedattributes true)
      (creategerberjobfile true)
      (excludeedgelayer true)
      (linewidth 0.100000)
      (plotframeref false)
      (viasonmask false)
      (mode 1)
      (useauxorigin false)
      (hpglpennumber 1)
      (hpglpenspeed 20)
      (hpglpendiameter 15.000000)
      (psnegative false)
      (psa4output false)
      (plotreference true)
      (plotvalue true)
      (plotinvisibletext false)
      (padsonsilk false)
      (subtractmaskfromsilk false)
      (outputformat 1)
      (mirror false)
      (drillshape 1)
      (scaleselection 1)
      (outputdirectory ""))
  )

  ${net_text}

  (net_class Default "This is the default net class."
    (clearance 0.2)
    (trace_width 0.25)
    (via_dia 0.8)
    (via_drill 0.4)
    (uvia_dia 0.3)
    (uvia_drill 0.1)
    ${netclass_text}
  )

  ${footprint_text}
  ${outline_text}

)

`

	}
	};

	const m$2 = require$$0;
	const version$1 = require$$12.version;

	var kicad8 = {

	    convert_outline: (model, layer) => {
	        const grs = [];
	        const xy = val => `${val[0]} ${-val[1]}`;
	        m$2.model.walk(model, {
	            onPath: wp => {
	                const p = wp.pathContext;
	                switch (p.type) {
	                    case 'line':
	                        grs.push(`(gr_line (start ${xy(p.origin)}) (end ${xy(p.end)}) (layer ${layer}) (stroke (width 0.15) (type default)))`);
	                        break
	                    case 'arc':
	                        const arc_center = p.origin;
	                        const angle_start = p.startAngle > p.endAngle ? p.startAngle - 360 : p.startAngle;
	                        const angle_diff = Math.abs(p.endAngle - angle_start);
	                        const arc_start = m$2.point.rotate(m$2.point.add(arc_center, [p.radius, 0]), angle_start, arc_center);
	                        const arc_mid = m$2.point.rotate(arc_start, angle_diff / 2, arc_center);
	                        const arc_end = m$2.point.rotate(arc_start, angle_diff, arc_center);
	                        grs.push(`(gr_arc (start ${xy(arc_start)}) (mid ${xy(arc_mid)}) (end ${xy(arc_end)}) (layer ${layer}) (stroke (width 0.15) (type default)))`);
	                        break
	                    case 'circle':
	                        const circle_center = p.origin;
	                        const circle_end = m$2.point.add(circle_center, [p.radius, 0]);
	                        grs.push(`(gr_circle (center ${xy(circle_center)}) (end ${xy(circle_end)}) (layer ${layer}) (stroke (width 0.15) (type default)) (fill none))`);
	                        break
	                    default:
	                        throw new Error(`Can't convert path type "${p.type}" to kicad!`)
	                }
	            }
	        });
	        return grs.join('\n')
	    },

	    body: params => {
	        const date_text = new Date().toISOString().slice(0, 10);
	        const net_text = params.nets.join('\n');
	        const footprint_text = params.footprints.join('\n');
	        const outline_text = Object.values(params.outlines).join('\n');

	        return `

(kicad_pcb
  (version 20240108)
  (generator "ergogen")
  (generator_version "${version$1}")
  (general
    (thickness 1.6)
    (legacy_teardrops no)
  )
  (paper "A3")
  (title_block
    (title "${params.name}")
    (date "${date_text}")
    (rev "${params.version}")
    (company "${params.author}")
  )

  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user "B.Adhesive")
    (33 "F.Adhes" user "F.Adhesive")
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user "B.Silkscreen")
    (37 "F.SilkS" user "F.Silkscreen")
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (40 "Dwgs.User" user "User.Drawings")
    (41 "Cmts.User" user "User.Comments")
    (42 "Eco1.User" user "User.Eco1")
    (43 "Eco2.User" user "User.Eco2")
    (44 "Edge.Cuts" user)
    (45 "Margin" user)
    (46 "B.CrtYd" user "B.Courtyard")
    (47 "F.CrtYd" user "F.Courtyard")
    (48 "B.Fab" user)
    (49 "F.Fab" user)
  )

  (setup
    (pad_to_mask_clearance 0.05)
    (allow_soldermask_bridges_in_footprints no)
    (pcbplotparams
      (layerselection 0x00010fc_ffffffff)
      (plot_on_all_layers_selection 0x0000000_00000000)
      (disableapertmacros no)
      (usegerberextensions no)
      (usegerberattributes yes)
      (usegerberadvancedattributes yes)
      (creategerberjobfile yes)
      (dashed_line_dash_ratio 12.000000)
      (dashed_line_gap_ratio 3.000000)
      (svgprecision 4)
      (plotframeref no)
      (viasonmask no)
      (mode 1)
      (useauxorigin no)
      (hpglpennumber 1)
      (hpglpenspeed 20)
      (hpglpendiameter 15.000000)
      (pdf_front_fp_property_popups yes)
      (pdf_back_fp_property_popups yes)
      (dxfpolygonmode yes)
      (dxfimperialunits yes)
      (dxfusepcbnewfont yes)
      (psnegative no)
      (psa4output no)
      (plotreference yes)
      (plotvalue yes)
      (plotfptext yes)
      (plotinvisibletext no)
      (sketchpadsonfab no)
      (subtractmaskfromsilk no)
      (outputformat 1)
      (mirror no)
      (drillshape 1)
      (scaleselection 1)
      (outputdirectory "")
    )
  )

  ${net_text}

  ${footprint_text}
  ${outline_text}

)

`

	}
	};

	var templates = {
	    kicad5: kicad5,
	    kicad8: kicad8
	};

	const listSet = new Set([
	    'fp_line',
	    'fp_arc',
	    'fp_circle',
	    'pad',
	    'property'
	]);


	var mod_parser = { parseContent: parseContent$2 };


	function parseContent$2(content) {
	    const result = {};
	    const contentObjStack = [];
	    contentObjStack.push(["root", result]);
	    let currentContent = '';
	    let curObj = result;
	    let isComment = false;

	    for (let i = 0; i < content.length; i++) {
	        const char = content[i];
	        if (isComment) {
	            currentContent += char;
	            if (char == '"') {
	                isComment = false;
	            }
	        } else {
	            if (char === '(') {
	                if (currentContent.trim()) {
	                    // console.log("currentContent: " + currentContent);
	                    const section  = parseSection(currentContent);
	                    if (section) {
	                        const {key, data} = section;
	                        contentObjStack.push([key, data]);
	                        if (listSet.has(key)) {
	                            if (!curObj.hasOwnProperty(key)) {
	                                curObj[key] = [];
	                            }
	                            curObj[key].push(data);
	                        } else {
	                            // console.log(key);
	                            // console.log(JSON.stringify(data));
	                            // console.log("cur");
	                            // console.log(JSON.stringify(curObj));
	                            curObj[key] = data;
	                        }
	                        // console.log("cur data1: " + JSON.stringify(data));
	                        curObj = data;
	                    }
	                }
	                currentContent = '';
	            } else if (char === ')') {
	                if (currentContent.trim()) {
	                    const section  = parseSection(currentContent);
	                    if (section) {
	                        let {key, data} = section;
	                        // console.log("add ");
	                        // console.log("key:" + key+ " dat:" + JSON.stringify(data, null, 2));
	                        // console.log("curObj" + JSON.stringify(curObj, null, 2));
	                        curObj[key] = data;
	                    }
	                } else {
	                    if (contentObjStack.length > 0) {
	                        let [key, data] =  contentObjStack.pop();
	                        // console.log("pop");
	                        // console.log("key:" + key+ " obj:" + JSON.stringify(data, null, 2));
	                        [key, data] = contentObjStack[contentObjStack.length - 1];
	                        // console.log("cur");
	                        // console.log("key:" + key+ " obj:" + JSON.stringify(data, null, 2));
	                        
	                        // console.log("cur data2: " + JSON.stringify(data));
	                        curObj = data;
	                    }
	                }
	                currentContent = '';
	            } else {
	                currentContent += char;
	                if (char == '"') {
	                    isComment = true;
	                }
	            }
	        }


	        // console.log("root:" + JSON.stringify(result));
	    }

	    return result;
	}


	function parseSection(section) {

	    const words = section.match(/\b[\w-./]+\b/g);
	    let data;
	    if (words && words.length >= 1) {
	        const key = words[0];
	        switch (key) {
	            case 'start':
	            case 'end':
	            case 'at':
	            case 'center':
	                data = parseCoordinates(section);
	                return { key, data};
	            case 'size':
	            case 'xyz':
	                data = parseNumList(section);
	                return {key, data};
	            case 'layer':
	            case 'layers':
	                data = parseLayers(section);
	                return { key, data};
	            case 'offset':
	            case 'effects':
	            case 'fp_line':
	            case 'fp_arc':
	            case 'fp_circle':
	            case 'scale':
	            case 'rotate':
	            case 'font':
	            case 'stroke':
	                data = {};
	                return { key, data};
	            case 'property':
	            case 'fp_text':
	                data = {};
	                data[words[1]] = data[words[2]];
	                return { key, data};
	            case 'footprint':
	                data = {};
	                data['name'] = words[1] ? words[1]: '';
	                return { key, data };
	            case 'roundrect_rratio':
	            case 'thickness':
	            case 'width':
	                data = parseFloat(words[1]);
	                return { key, data };
	            case 'version':
	            case 'hide':
	            case 'generator':
	            case 'generator_version':
	            case 'type':
	            case 'uuid':
	                data = words[1];
	                return { key, data};
	            case 'model':
	                data = {};
	                data['file'] = words[1];
	                return { key, data};
	            case 'pad':
	                data = {};
	                if (words.length == 4) {
	                    data["number"] = words[1];
	                    data["type"] = words[2];
	                    data["shape"] = words[3];
	                } else if (words.length == 3) {
	                    data["type"] = words[1];
	                    data["shape"] = words[2];
	                }
	                return {key, data};
	            default:
	                data = section.substr(key.length + 1);
	                return { key, data};
	        }
	    } else {
	        return null;
	    }
	    
	}

	function parseCoordinates(section) {
	    const matches = section.match(/-?\d+(\.\d+)?/g);
	    return {
	        x: parseFloat(matches[0]),
	        y: parseFloat(matches[1]),
	        angle: matches[2] ? parseFloat(matches[2]) : undefined
	    };
	}

	function parseNumList(section) {
	    const matches = section.match(/-?\d+(\.\d+)?/g);
	    return matches.map(Number);
	}

	function parseLayers(section) {
	     const regex = /(\*\.\w+)|"([^"]+)"/g;

	    const matches = [];
	    let match;
	    while ((match = regex.exec(section)) !== null) {
	        if (match[1]) {
	            // 匹配到 *.Cu 或 *.Mask 的情况
	            matches.push(match[1]);
	        } else if (match[2]) {
	            // 匹配到 "F.Cu"、"F.Paste"、"F.Mask" 的情况
	            matches.push(match[2]);
	        }
	    }

	    if (matches.length > 1) {
	        return matches;
	    } else {
	        return matches[0];
	    }
	    // 用空格分隔并返回结果
	}

	const axios$2 = require$$0$1;
	const { parseContent: parseContent$1 } = mod_parser;

	const cache = new Map();

	async function fetchAndCache$1(footprintName) {
	    // 尝试从缓存中获取数据
	    if (cache.has(footprintName)) {
	        console.log("get data from cache: " + footprintName);
	        return cache.get(footprintName);
	    }
	    
	    try {
	        // 如果缓存中没有数据，进行HTTP请求
	        const url = `https://raw.githubusercontent.com/shiqi-614/ErgoCai.pretty/main/${footprintName}.kicad_mod`;
	        const response = await axios$2.get(url);
	        // console.log("get from github:" + response.data);
	        const data = parseContent$1(response.data);

	        // 将数据保存到缓存中
	        cache.set(footprintName, data);
	        console.log('Fetched and cached data');
	        
	        return data;
	    } catch (error) {
	        console.error('Error fetching data:', error);
	    }
	}


	var mod_github_fetcher = { fetchAndCache: fetchAndCache$1 };

	const fs$1 = require$$0$2;
	const axios$1 = require$$0$1;

	function transfer(data) {
	    const transformedDict = {};

	    console.log("data: " + JSON.stringify(data));
	    for (const key in data) {
	        const values = data[key];
	        values.forEach(value => {
	            transformedDict[value] = key;
	        });
	    }
	    console.log("transformedDict: " + JSON.stringify(transformedDict));
	    return transformedDict;
	}

	const fetchFootprintTypes$2 = async () => {
	    try {
	        const path = require('path');
	        const modFolderPath = path.join(__dirname, './ErgoCai.pretty');
	        const filePath = path.join(modFolderPath, 'footprintTypes.json');
	        const content = fs$1.readFileSync(filePath, 'utf-8');

	        console.log("read types from local file " + content);
	        return transfer(JSON.parse(content));
	    } catch (error) {
	        console.error('Error fetching the JSON from local file:', error);
	    }
	    try {

	        const response = await axios$1.get('https://raw.githubusercontent.com/shiqi-614/ErgoCai.pretty/main/footprintTypes.json');
	        const data = response.data;
	        return transfer(data);

	    } catch (error) {
	        console.error('Error fetching the JSON from network:', error);
	        return {};
	    }
	};


	var footprint_types$2 = {
	    fetchFootprintTypes: fetchFootprintTypes$2
	};

	var shape_converter$1 = {};

	const m$1 = require$$0;

	var idx = 0;

	function getId(prefix, item) {
	    return prefix + '-' + (item.uuid || item.tstamp || ++idx);
	}

	class FpCircleStrategy {
	    convert(item) {
	        const key = getId('fpCircle', item);
	        const radius = Math.sqrt(Math.pow(item.center.x - item.end.x, 2) + Math.pow(item.center.y - item.end.y, 2));
	        var circle = new m$1.paths.Circle([item.center.x, item.center.y*-1], radius);
	        // console.log("kicad fp circle: " + JSON.stringify(item));
	        // console.log("convert to makerjs circle: "+ JSON.stringify(circle));
	        return {[key]: circle};
	    }
	}

	class CircleStrategy {
	    convert(item) {
	        const key = getId('circle', item);
	        var circle = new m$1.paths.Circle([item.at.x, item.at.y*-1], item.size[0]/2);
	        // console.log("kicad circle: " + JSON.stringify(item));
	        // console.log("convert to makerjs circle: "+ JSON.stringify(circle));
	        return {[key]: circle};
	    }
	}

	class OvalStrategy {
	    convert(item) {
	        const key = getId('oval', item);
	        var oval = new m$1.models.Oval(item.size[0], item.size[1]);
	        oval.origin = [item.at.x - item.size[0]/2, item.at.y * -1 - item.size[0]/2];
	        // console.log("kicad oval: " + JSON.stringify(item));
	        // console.log("convert to makerjs oval: "+ JSON.stringify(oval));
	        return {[key]: oval};
	    }
	}

	// 策略类 - 处理 RoundRect 类型
	class RoundRectStrategy {
	    convert(item) {
	        // console.log("convert roundrect: " + JSON.stringify(item));
	        var key = getId('roundrect', item);
	        // var roundrect = new m.models.Rectangle(
	            // item.size[0], 
	            // item.size[1]
	        // )
	        var roundrect = new m$1.models.RoundRectangle(
	            item.size[0], 
	            item.size[1], 
	            item.roundrect_rratio * Math.min(item.size[0], item.size[1])
	        );
	        roundrect.origin = [item.at.x - item.size[0]/2, item.at.y * -1 - item.size[1]/2];
	        // console.log("kicad roundrect: " + JSON.stringify(item));
	        // console.log("convert to makerjs roundrect: "+ JSON.stringify(roundrect));
	        return {[key]: roundrect};
	    }
	}


	function calculateCircleFromThreePoints(p1, p2, p3) {
	    const x1 = p1.x, y1 = p1.y;
	    const x2 = p2.x, y2 = p2.y;
	    const x3 = p3.x, y3 = p3.y;

	    const a = x1 * (y2 - y3) - y1 * (x2 - x3) + x2 * y3 - x3 * y2;
	    const b = (x1 * x1 + y1 * y1) * (y3 - y2) + (x2 * x2 + y2 * y2) * (y1 - y3) + (x3 * x3 + y3 * y3) * (y2 - y1);
	    const c = (x1 * x1 + y1 * y1) * (x2 - x3) + (x2 * x2 + y2 * y2) * (x3 - x1) + (x3 * x3 + y3 * y3) * (x1 - x2);
	    const d = (x1 * x1 + y1 * y1) * (x3 * y2 - x2 * y3) + (x2 * x2 + y2 * y2) * (x1 * y3 - x3 * y1) + (x3 * x3 + y3 * y3) * (x2 * y1 - x1 * y2);

	    const cx = -b / (2 * a);
	    const cy = -c / (2 * a);
	    const radius = Math.sqrt((b * b + c * c - 4 * a * d) / (4 * a * a));

	    return {
	        center: { x: cx, y: cy },
	        radius: radius
	    };
	}

	class ArcStrategy {
	    convert(item) {
	        const start = {x:item.start.x, y:item.start.y * -1};
	        const end = {x:item.end.x, y:item.end.y * -1};

	        // 将 mid 坐标从字符串转换为数字数组
	        const midCoords = item.mid.split(' ').map(Number);

	        const res = calculateCircleFromThreePoints(start, {x:midCoords[0], y:midCoords[1] *-1}, end);
	        // 计算弧的原点，假设弧是圆弧的部分
	        const cx = res.center.x;
	        const cy = res.center.y;
	        // console.log("res is:" + JSON.stringify(res));

	        // 计算半径
	        const radius = res.radius;

	        // 计算起始角度
	        const endAngle = Math.atan2(start.y - cy, start.x - cx) * (180 / Math.PI);

	        // 计算终止角度
	        const startAngle = Math.atan2(end.y - cy, end.x - cx) * (180 / Math.PI);

	        const arc = {
	            type: 'arc',
	            origin: [cx, cy],
	            radius: radius,
	            startAngle: startAngle,
	            endAngle: endAngle
	        };
	        var key = getId('arc', item);
	        // console.log("kicad arc: " + JSON.stringify(item));
	        // console.log("convert to makerjs arc: "+ JSON.stringify(arc));
	        return {[key]: arc};
	    }
	}

	class LineStrategy {
	    convert(item) {
	        var key = getId('line', item);
	        var line = {
	            type: 'line',
	            origin: [item.start.x, item.start.y * -1],
	            end: [item.end.x, item.end.y * -1]
	        };
	        // console.log("kicad line: " + JSON.stringify(item));
	        // console.log("convert to makerjs line: "+ JSON.stringify(line));
	        return {[key]: line};
	    }
	}

	class RectStrategy {
	    convert(item) {
	        var key = getId('rect', item);
	        var rect = new m$1.models.Rectangle(
	            item.size[0], 
	            item.size[1]
	        );
	        rect.origin = [item.at.x - item.size[0]/2, item.at.y * -1 - item.size[1]/2];
	        // console.log("kicad rect: " + JSON.stringify(item));
	        // console.log("convert to makerjs rect: "+ JSON.stringify(rect));
	        return {[key]: rect};
	    }
	}


	class ShapeConverter {
	    constructor() {
	        this.strategies = {
	            'circle': new CircleStrategy(),
	            'roundrect': new RoundRectStrategy(),
	            'line': new LineStrategy(),
	            'arc': new ArcStrategy(),
	            'rect': new RectStrategy(),
	            'fp_circle': new FpCircleStrategy(),
	            'oval': new OvalStrategy()
	        };
	    }

	    convert(item, shape) {
	        // console.log("pad: " + JSON.stringify(item));
	        const strategy = this.strategies[item.shape||shape];
	        if (!strategy) {
	            throw new Error(`Unsupported shape: ${item.shape} or ${shape}`);
	        }
	        return strategy.convert(item);
	    }
	}

	const shape_converter = new ShapeConverter();

	function layerCheck(item) {
	    return item.hasOwnProperty('layer') && 
	        (item.layer.endsWith("CrtYd") 
	            || item.layer.endsWith("Dwgs.User")
	            || item.layer.endsWith("Fab")
	        );
	}

	// 上下文类 - 负责选择策略
	shape_converter$1.convert = (footprint) => {
	    // console.log("footpritn item:" + JSON.stringify(item));
	    // const real_shape = item.shape||shape;
	    // console.log("real shape: " + real_shape);
	    
	    var allItems = {};
	    if (footprint.fp_line) {
	        const line_list = footprint.fp_line
	            .filter((item) => layerCheck(item))
	            .flatMap((item) => shape_converter.convert(item, 'line'));
	        allItems = Object.assign(allItems, ...line_list);
	    }
	    if (footprint.fp_circle) {
	        const fp_circle_list = footprint.fp_circle
	            .filter((item) => layerCheck(item))
	            .flatMap((item) => shape_converter.convert(item, 'fp_circle'));
	        allItems = Object.assign(allItems, ...fp_circle_list);
	    }
	    if (footprint.pad) {
	        const pad_list = footprint.pad
	            .flatMap((item) => shape_converter.convert(item));
	        allItems = Object.assign(allItems, ...pad_list);
	    }
	    if (footprint.fp_arc) {
	        const arc_list = footprint.fp_arc
	            .filter((item) => layerCheck(item))
	            .flatMap((item) => shape_converter.convert(item, 'arc'));
	        allItems = Object.assign(allItems, ...arc_list);
	    }
	    // const allItems = Object.assign({}, ...pad_list);

	    const pathItems = {};
	    const modelItems = {};

	    for (const key in allItems) {
	        const item = allItems[key];
	        if (!Object.keys(item).length) continue;
	        if (item.hasOwnProperty("type")) {
	            Object.assign(pathItems, {[key]: item});
	        } else {
	            Object.assign(modelItems, {[key]: item});
	        }
	    }
	    return [pathItems, modelItems];

	};

	const a$1 = assert$1;
	const anchor$1 = anchor$5.parse;
	const filter$1 = filter$3.parse;


	const footprint_types$1 = footprints;
	const template_types$1 = templates;
	const { fetchFootprintTypes: fetchFootprintTypes$1 } = footprint_types$2;

	pcbs.inject_footprint = (name, fp) => {
	    footprint_types$1[name] = fp;
	};

	pcbs.inject_template = (name, t) => {
	    template_types$1[name] = t;
	};


	pcbs.parse = async (config, points, outlines, units) => {
	            

	    const footprintTypes = await fetchFootprintTypes$1();
	    const pcbs = a$1.sane(config.pcbs || {}, 'pcbs', 'object')();
	    const results = {};

	    for (const [pcb_name, pcb_config] of Object.entries(pcbs)) {
	        results[pcb_name] = {};

	        // config sanitization
	        a$1.unexpected(pcb_config, `pcbs.${pcb_name}`, ['outlines', 'footprints', 'references', 'template', 'params']);
	        a$1.sane(pcb_config.references || false, `pcbs.${pcb_name}.references`, 'boolean')();
	        template_types$1[a$1.in(pcb_config.template || 'kicad5', `pcbs.${pcb_name}.template`, Object.keys(template_types$1))];


	        // generate footprints
	        if (a$1.type(pcb_config.footprints)() == 'array') {
	            pcb_config.footprints = {...pcb_config.footprints};
	        }

	        const footprints_config = a$1.sane(pcb_config.footprints || {}, `pcbs.${pcb_name}.footprints`, 'object')();
	        for (const [f_name, f] of Object.entries(footprints_config)) {
	            const name = `pcbs.${pcb_name}.footprints.${f_name}`;
	            console.log("footprint name: " + name);
	            a$1.sane(f, name, 'object')();
	            try {
	                const asym = a$1.asym(f.asym || 'source', `${name}.asym`);
	                const where = filter$1(f.where, `${name}.where`, points, units, asym);
	                const original_adjust = f.adjust; // need to save, so the delete's don't get rid of it below
	                const adjust = start => anchor$1(original_adjust || {}, `${name}.adjust`, points, start)(units);
	                for (const w of where) {
	                    const point = adjust(w.clone());
	                    point.meta.footprint = f.what;
	                    point.meta.name = f_name;
	                    point.side = "Front";
	                    if (f.side) {
	                        point.side = f.side;
	                    }
	                    var type = "others";
	                    if (f.what in footprintTypes) {
	                        type = footprintTypes[f.what];
	                    } 
	                    if (!results[pcb_name][type]) {
	                        results[pcb_name][type] = [];
	                    }
	                    console.log(`add point to ${pcb_name} ${type}`);
	                    results[pcb_name][type].push(point);
	                }
	            } catch (error) {
	                console.error('Error place footprint:', error);
	            }
	        }
	    }


	    return results
	};

	var pcbs_preview = {};

	const fs = require$$0$2;
	const { parseContent } = mod_parser;
	const { fetchAndCache } = mod_github_fetcher;

	const kicadMods = new Map();

	const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;

	// 递归遍历目录
	function findKicadModFilesAndParse() {
	    const path = require$$2;
	    const modFolderPath = path.join(__dirname, './ErgoCai.pretty');
	    const files = fs.readdirSync(modFolderPath);

	    files.forEach(file => {
	        const filePath = path.join(modFolderPath, file);
	        fs.statSync(filePath);

	        if (path.extname(file) === '.kicad_mod') {
	            const content = fs.readFileSync(filePath, 'utf-8');
	            const baseName = path.basename(file, path.extname(file));
	            const jsonContent = parseContent(content);
	            
	            kicadMods.set(baseName, jsonContent);
	            console.log("load data from file: " + baseName);
	            // console.log(jsonContent);
	        }
	    });
	}

	async function fetchKicadMod$1(footprint_name) {
	    if (isNode) {
	        if (kicadMods.size == 0) {
	            findKicadModFilesAndParse();
	        }
	    }
	    
	    console.log("try to get footprint: " + footprint_name);
	    if (kicadMods.has(footprint_name)) {
	        console.log("get data from file: " + footprint_name);
	        return kicadMods.get(footprint_name);
	    } else {
	        return fetchAndCache(footprint_name);
	    }

	}

	// 将解析后的JSON内容保存到 .kicad_mod 文件所在目录的 json 文件夹
	// function saveJsonContent(filePath, jsonContent) {
	    // const dirPath = path.dirname(filePath);
	    // const jsonDir = path.join(dirPath, 'json');

	    // if (!fs.existsSync(jsonDir)) {
	        // fs.mkdirSync(jsonDir); // 如果json文件夹不存在，则创建它
	    // }

	    // const fileName = path.basename(filePath, '.kicad_mod') + '.json';
	    // const jsonFilePath = path.join(jsonDir, fileName);

	    // console.log("json file: " + jsonFilePath);
	    // fs.writeFileSync(jsonFilePath, JSON.stringify(jsonContent, null, 2), 'utf-8');
	// }


	// // const kicadModFiles = findKicadModFiles("/Users/jinsongc/Documents/KiCad/8.0/footprints/ErgoCai.pretty");

	// console.log('Found .kicad_mod files:');
	// // console.log(kicadModFiles);
	// //
	// const kicadModFiles = ["/Users/jinsongc/Development/ErgoCai.pretty/LED_RGB_5050-6.kicad_mod"];

	// kicadModFiles.forEach(filePath => {
	    // try {
	        // console.log("parsing file: " + filePath);
	        // const content = fs.readFileSync(filePath, 'utf-8');
	        // const jsonContent = parseContent(content);
	        // saveJsonContent(filePath, jsonContent);
	    // } catch (e) {
	        // console.log("cannot handle file: " + filePath);
	        // console.log(e);
	    // }
	// });

	var mod_fetcher = { fetchKicadMod: fetchKicadMod$1 };

	const m = require$$0;

	const u$1 = utils;
	const a = assert$1;
	const o = operation;
	const anchor = anchor$5.parse;
	const filter = filter$3.parse;


	const footprint_types = footprints;
	const template_types = templates;

	const { fetchKicadMod } = mod_fetcher;
	const { fetchFootprintTypes } = footprint_types$2;
	const kicad_shape_converter = shape_converter$1;

	pcbs_preview.inject_footprint = (name, fp) => {
	    footprint_types[name] = fp;
	};

	pcbs_preview.inject_template = (name, t) => {
	    template_types[name] = t;
	};

	async function footprint_shape(name) {
	    console.log("draw footprint: " + name);
	    const jsonObj = await fetchKicadMod(name);

	    // console.log(JSON.stringify(jsonObj, null, 2));
	    let [pathItems, modelItems] = kicad_shape_converter.convert(jsonObj.footprint);
	    return () => {
	        const res = {
	            models: u$1.deepcopy(modelItems),
	            paths: u$1.deepcopy(pathItems)
	        };
	        // console.log("res:" + JSON.stringify(res, null, 2));
	        const bbox = m.measure.modelExtents(o);
	        return [res, bbox]
	    };
	}


	pcbs_preview.parse = async (config, points, outlines, units) => {
	            

	    const footprintTypes = await fetchFootprintTypes();
	    const pcbs = a.sane(config.pcbs || {}, 'pcbs', 'object')();
	    const results = {};

	    for (const [pcb_name, pcb_config] of Object.entries(pcbs)) {

	        // config sanitization
	        a.unexpected(pcb_config, `pcbs.${pcb_name}`, ['outlines', 'footprints', 'references', 'template', 'params']);
	        a.sane(pcb_config.references || false, `pcbs.${pcb_name}.references`, 'boolean')();
	        template_types[a.in(pcb_config.template || 'kicad5', `pcbs.${pcb_name}.template`, Object.keys(template_types))];

	        // outline conversion
	        if (a.type(pcb_config.outlines)() == 'array') {
	            pcb_config.outlines = {...pcb_config.outlines};
	        }
	        const config_outlines = a.sane(pcb_config.outlines || {}, `pcbs.${pcb_name}.outlines`, 'object')();
	        for (const [outline_name, outline] of Object.entries(config_outlines)) {

	            const ref = a.in(outline.outline, `pcbs.${pcb_name}.outlines.${outline_name}.outline`, Object.keys(outlines));
	            a.sane(outline.layer || 'Edge.Cuts', `pcbs.${pcb_name}.outlines.${outline_name}.outline`, 'string')();
	            const operation = u$1[a.in(outline.preview || 'stack', `${outline_name}.operation`, ['add', 'subtract', 'intersect', 'stack'])];
	            results[pcb_name] = operation(results[pcb_name], outlines[ref]);
	        }

	        // generate footprints
	        if (a.type(pcb_config.footprints)() == 'array') {
	            pcb_config.footprints = {...pcb_config.footprints};
	        }
	        // console.log("types");
	        // console.log(JSON.stringify(footprintTypes));

	        const footprints_config = a.sane(pcb_config.footprints || {}, `pcbs.${pcb_name}.footprints`, 'object')();
	        for (const [f_name, f] of Object.entries(footprints_config)) {
	            const name = `pcbs.${pcb_name}.footprints.${f_name}`;
	            // console.log("footprint f: " + JSON.stringify(f));
	            a.sane(f, name, 'object')();
	            try {
	                const asym = a.asym(f.asym || 'source', `${name}.asym`);
	                const where = filter(f.where, `${name}.where`, points, units, asym);
	                const original_adjust = f.adjust; // need to save, so the delete's don't get rid of it below
	                const adjust = start => anchor(original_adjust || {}, `${name}.adjust`, points, start)(units);
	                const shape_maker = await footprint_shape(f.what);
	                for (const w of where) {
	                    if (!w.meta.footprints) {
	                        w.meta.footprints = {};
	                    }
	                    if (f.what in footprintTypes) {
	                        const type = footprintTypes[f.what];
	                        w.meta.footprints[type] = f.what;
	                    }
	                    const point = adjust(w.clone());
	                    let [shape, bbox] = shape_maker(point); // point is passed for mirroring metadata only...
	                    // console.log("share: " + JSON.stringify(shape, null, 2));
	                    if (f.side == "Back") {
	                        shape.layer = "olive";
	                    } else {
	                        shape.layer = "aqua";
	                    }
	                    shape = point.position(shape); // ...actual positioning happens here
	                    const operation = u$1[a.in(f.preview || 'stack', `${f_name}.operation`, ['add', 'subtract', 'intersect', 'stack'])];
	                    results[pcb_name] = operation(results[pcb_name], shape);
	                    // console.log("preview shape: " + JSON.stringify(shape));
	                }   
	            } catch (error) {
	                console.error('Error place footprint:', error);
	            }

	            // m.model.simplify(results[pcb_name]);
	            m.model.originate(results[pcb_name]);
	            // console.log("final PCB:" + JSON.stringify(results[pcb_name]));
	        }
	    }

	    return results
	};

	const u = utils;
	const io = io$1;
	const prepare = prepare$1;
	const units_lib = units;
	const points_lib = points;
	const outlines_lib = outlines;
	const cases_lib = cases;
	const pcbs_lib = pcbs;
	const pcbs_preview_lib = pcbs_preview;
	const axios = require$$0$1;


	const version = require$$12.version;

	const process$1 = async (raw, debug=false, logger=()=>{}) => {

	    const prefix = 'Interpreting format: ';
	    let empty = true;
	    let [config, format] = io.interpret(raw, logger);
	    let suffix = format;
	    // KLE conversion warrants automaticly engaging debug mode
	    // as, usually, we're only interested in the points anyway
	    if (format == 'KLE') {
	        suffix = `${format} (Auto-debug)`;
	        debug = true;
	    }
	    logger(prefix + suffix);
	    
	    logger('Preprocessing input...');
	    config = prepare.unnest(config);
	    config = prepare.inherit(config);
	    config = prepare.parameterize(config);
	    const results = {};
	    if (debug) {
	        results.raw = raw;
	        results.canonical = u.deepcopy(config);
	    }

	    if (config.meta && config.meta.engine) {
	        logger('Checking compatibility...');
	        const engine = u.semver(config.meta.engine, 'config.meta.engine');
	        if (!u.satisfies(version, engine)) {
	            throw new Error(`Current ergogen version (${version}) doesn\'t satisfy config's engine requirement (${config.meta.engine})!`)
	        }
	    }

	    logger('Calculating variables...');
	    const units = units_lib.parse(config);
	    if (debug) {
	        results.units = units;
	    }
	    
	    logger('Parsing points...');
	    if (!config.points) {
	        throw new Error('Input does not contain a points clause!')
	    }
	    const points = points_lib.parse(config.points, units);
	    if (!Object.keys(points).length) {
	        throw new Error('Input does not contain any points!')
	    }
	    if (debug) {
	        results.points = points;
	        results.demo = io.twodee(points_lib.visualize(points, units), debug);
	    }

	    logger('Generating outlines...');
	    const outlines = outlines_lib.parse(config.outlines || {}, points, units);
	    results.outlines = {};
	    for (const [name, outline] of Object.entries(outlines)) {
	        if (!debug && name.startsWith('_')) continue
	        results.outlines[name] = io.twodee(outline, debug);
	        empty = false;
	    }

	    logger('Modeling cases...');
	    const cases = cases_lib.parse(config.cases || {}, outlines, units);
	    results.cases = {};
	    for (const [case_name, case_script] of Object.entries(cases)) {
	        if (!debug && case_name.startsWith('_')) continue
	        results.cases[case_name] = {jscad: case_script};
	        empty = false;
	    }

	    logger('Scaffolding PCBs...');
	    const pcbs = await pcbs_lib.parse(config, points, outlines, units);
	    results.pcbs = {};
	    for (const [pcb_name, pcb_text] of Object.entries(pcbs)) {
	        if (!debug && pcb_name.startsWith('_')) continue
	        results.pcbs[pcb_name] = pcb_text;
	        empty = false;
	    }

	    logger('Preview PCBs...');
	    const pcbs_preview = await pcbs_preview_lib.parse(config, points, outlines, units);
	    results.pcbs_preview = {};
	    for (const [pcb_name, pcb_text] of Object.entries(pcbs_preview)) {
	        console.log("preview: " + pcb_name);
	        // if (!debug && pcb_name.startsWith('_')) continue
	        results.pcbs_preview[pcb_name] = io.twodee(pcb_text, debug);
	        empty = false;
	    }
	    results.points = points;
	    results.demo = io.twodee(points_lib.visualize(points, units), debug);

	    if (config?.is_preview === false) {
	        logger("Creating KiCad Project...");

	        try {
	            results.kicad = {};
	            for (const [pcb_name, pcb_config] of Object.entries(config.pcbs)) {
	                const response = await axios.post('http://127.0.0.1:5001/generate', 
	                    {
	                        "points": points,
	                        "name": pcb_name,
	                    },
	                    {
	                        headers: {
	                            'Content-Type': 'application/json',
	                        },
	                        responseType: 'arraybuffer'
	                    }
	                );
	                const zipBuffer = Buffer.from(response.data, 'binary').toString('base64');
	                results.kicad[pcb_name] = zipBuffer;
	            }
	            logger("Create KiCad Project without error.");
	        } catch (error) {
	            console.error('There was a problem with the fetch operation:', error);
	        }
	    }

	    if (!debug && empty) {
	        logger('Output would be empty, rerunning in debug mode...');
	        return process$1(raw, true, () => {})
	    }
	    return results
	};

	const inject = (type, name, value) => {
	    if (value === undefined) {
	        value = name;
	        name = type;
	        type = 'footprint';
	    }
	    switch (type) {
	        case 'footprint':
	            return pcbs_lib.inject_footprint(name, value)
	        case 'template':
	            return pcbs_lib.inject_template(name, value)
	        default:
	            throw new Error(`Unknown injection type "${type}" with name "${name}" and value "${value}"!`)
	    }
	};

	var ergogen = {
	    version,
	    process: process$1,
	    inject
	};

	var ergogen$1 = /*@__PURE__*/getDefaultExportFromCjs(ergogen);

	return ergogen$1;

}));
