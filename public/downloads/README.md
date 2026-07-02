# Scratch → Snap! Converter (standalone)

Three files, zero build step:

- `index.html` — drop-a-file web UI. Open it directly (double-click) or serve it.
- `converter.js` — all conversion logic. Readable, plain JavaScript, works in both browser and Node.
- `cli.js` — Node CLI wrapper.

## Web usage

Just open `index.html`. JSZip loads from a CDN via `<script>`.
If you want fully offline: download `jszip.min.js` from
`https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js` next to `index.html`
and change the script tag's `src` to `jszip.min.js`.

## CLI usage

```
npm install jszip
node cli.js path/to/project.sb3
node cli.js path/to/project.sb3 out.xml
```

## Supported input

Only `.sb3` (modern Scratch). `.sb` / `.sb2` would need scratch-vm to
upconvert, which is intentionally not bundled here to keep this tool tiny
and readable. Upconvert them at https://scratch.mit.edu first.
