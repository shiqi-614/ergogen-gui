## Ergogen GUI 
This is a web interface for [Ergogen](https://github.com/mrzealot/ergogen) by @MrZealot.  

This adds some additional features like
- Live preview reloading
- VSCode editor (Monaco)
- Live 3D model previews
- Auto regenerate outlines, 3D models and PCBs.

See the live demo at [https://mveerd.github.io/ergogen-gui/](https://mveerd.github.io/ergogen-gui/)

### Running locally
#### `yarn install` - installs dependencies
#### `yarn start` - starts a development server at [http://localhost:3000](http://localhost:3000)
#### `yarn build` - type-checks and builds the site into `build/` (with [Vite](https://vite.dev))
#### `yarn test` - runs the unit tests (with [Vitest](https://vitest.dev))
#### `yarn e2e` - runs the end-to-end tests in a headless Chrome for Testing (`yarn e2e pcb` runs those whose name has "pcb"); set `CHROME_PATH` to use another Chrome, `E2E_URL` to test an app that already runs. A failing test leaves a screenshot in `e2e/failures`.


### Using an Ergogen branch on github
To use this GUI with any github branch you can do the following; 

Clone this repository to your local machine; 
```shell
git clone https://github.com/MvEerd/ergogen-gui.git
```

Modify the following line in `package.json` 
```json
"ergogen": "^3.*",
```
to use a branch on github refer to it like so `<username>/<repo>#<branch>`
```json
"ergogen": "mveerd/ergogen#mveerd",
```

Then run `yarn install && yarn start` to start Ergogen GUI locally with the specified branch.  
It will be available at http://localhost:3000/
