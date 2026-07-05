import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "working"; filename: string }
  | { kind: "done"; filename: string; sizeKb: number; warnings: string[] }
  | { kind: "error"; message: string };

// Load a <script> tag once and cache the promise.
const scriptCache = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const cached = scriptCache.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
  scriptCache.set(src, p);
  return p;
}

interface ScratchToSnapAPI {
  convert: (buf: ArrayBuffer) => Promise<{ xml: string; warnings: string[] }>;
}

async function getConverter(): Promise<ScratchToSnapAPI> {
  await loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
  await loadScript("/converter.js");
  const api = (window as unknown as { ScratchToSnap?: ScratchToSnapAPI }).ScratchToSnap;
  if (!api) throw new Error("Converter script failed to initialize.");
  return api;
}

export function Converter() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Warm the converter script early so first click feels instant.
  useEffect(() => {
    getConverter().catch(() => {});
  }, []);

  const triggerDownload = (xml: string, filename: string) => {
    const blob = new Blob([xml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFile = useCallback(async (file: File) => {
    setStatus({ kind: "working", filename: file.name });
    try {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".sb3")) {
        throw new Error(
          "Only .sb3 files are supported. Open your project on scratch.mit.edu and re-download it (or use the CLI on the .sb2/.sb file).",
        );
      }
      const api = await getConverter();
      const buf = await file.arrayBuffer();
      const { xml, warnings } = await api.convert(buf);
      const outName = file.name.replace(/\.sb3$/i, "") + ".xml";
      triggerDownload(xml, outName);
      setStatus({
        kind: "done",
        filename: outName,
        sizeKb: Math.round(xml.length / 1024),
        warnings,
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Conversion failed.",
      });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="inline-block size-2 rounded-full bg-primary"></span>
          Browser-only · No upload · Single JS file
        </div>
        <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          Scratch <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">→</span> Snap!
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground">
          Drop a <code className="rounded bg-muted px-1.5 py-0.5 text-sm">.sb3</code> project and get a
          Snap! BYOB <code className="rounded bg-muted px-1.5 py-0.5 text-sm">.xml</code> back. The whole
          converter is one plain JavaScript file — usable in the browser or on the command line.
        </p>
      </header>

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`group relative cursor-pointer rounded-3xl border-2 border-dashed bg-card p-10 text-center shadow-[var(--shadow-card)] transition-all ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".sb3"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[image:var(--gradient-hero)] text-2xl shadow-[var(--shadow-pop)]">
          🐱
        </div>
        <p className="text-lg font-semibold">Drop your .sb3 file here</p>
        <p className="mt-1 text-sm text-muted-foreground">or click to pick a file</p>
        <Button className="mt-6 h-11 rounded-full px-6">Choose file</Button>

        {status.kind === "working" && (
          <p className="mt-6 text-sm text-muted-foreground">Converting {status.filename}…</p>
        )}
        {status.kind === "done" && (
          <div className="mt-6 text-sm">
            <p className="font-medium text-primary">
              ✓ Downloaded {status.filename} ({status.sizeKb} KB)
            </p>
            {status.warnings.length > 0 && (
              <ul className="mx-auto mt-2 max-w-md list-disc text-left text-xs text-muted-foreground">
                {status.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {status.kind === "error" && (
          <p className="mt-6 text-sm text-destructive">{status.message}</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Use it locally</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download the standalone files. No build step, no TypeScript — just one HTML file and one JS
          file. Run it from the command line with Node:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`node converter.cjs my-project.sb3 my-project.xml`}
        </pre>
        <p className="mt-3 text-sm text-muted-foreground">
          Just two files. Double-click <code className="rounded bg-muted px-1 py-0.5">index.html</code>
          to use it in the browser — no server, no build. The <code className="rounded bg-muted px-1 py-0.5">.cjs</code>
          extension lets Node run the same file from the command line.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/downloads/index.html" download>
            <Button variant="secondary" size="sm">index.html</Button>
          </a>
          <a href="/downloads/converter.cjs" download>
            <Button variant="secondary" size="sm">converter.cjs</Button>
          </a>
        </div>
      </section>

      <footer className="text-center text-xs text-muted-foreground">
        Conversion runs entirely in your browser. Nothing is uploaded.
      </footer>
    </main>
  );
}
