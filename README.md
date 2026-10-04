# Triply

Explainable, situation-first destination recommendations for domestic travel in Bangladesh.

## Run

From this folder, serve the files over HTTP (ES modules do not load from `file://`):

```bash
python -m http.server 8000
```

Or:

```bash
npx serve
```

Then open the URL the server prints (for Python, [http://localhost:8000](http://localhost:8000)). If `python` is the Windows Store alias and does not start, use `npx serve`.

## Folder map

```
triply/
  index.html              Page shell
  package.json            ES modules; npm test runs node --test
  css/
    tokens.css            Color, type, space, radius; light and dark
    base.css              Document defaults
    components.css        Header, nav, language toggle, footer
  js/
    main.js               Starts the page
    state.js              Observable store
    engine/               Pure recommendation functions
    ui/                   Interface modules
    i18n/                 English and Bangla catalogues
    utils/                Distance and number formatting
  data/destinations.json  Destination records (empty for now)
  tests/                  node --test
```
