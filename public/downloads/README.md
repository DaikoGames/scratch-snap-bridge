# Scratch → Snap! Converter (standalone)

Just **two files**. No build, no server, no TypeScript.

- `index.html` — open it directly in a browser (double-click). Drop an `.sb3`, get an `.xml`.
- `converter.js` — all the conversion logic. Also runs as a Node CLI.

## Web usage

Double-click `index.html`. That's it. JSZip loads from a CDN via a `<script>` tag.

Prefer fully offline? Download
<https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js> next to
`index.html` and change the JSZip `<script src="...">` in `index.html` to
`jszip.min.js`.

## CLI usage

```
npm install jszip
node converter.js path/to/project.sb3
node converter.js path/to/project.sb3 out.xml
```

Only `.sb3` (modern Scratch) is supported. For `.sb` / `.sb2`, open the project
on <https://scratch.mit.edu> and re-download it as `.sb3` first.
