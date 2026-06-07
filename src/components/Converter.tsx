import { useCallback, useRef, useState } from "react";
import { convertScratchFile, type ConvertResult } from "@/lib/scratch-to-snap";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "working"; filename: string }
  | { kind: "done"; result: ConvertResult; sizeKb: number }
  | { kind: "error"; message: string };

export function Converter() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setStatus({ kind: "working", filename: file.name });
    try {
      const result = await convertScratchFile(file);
      setStatus({ kind: "done", result, sizeKb: Math.round(result.xml.length / 1024) });
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
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const onDownload = () => {
    if (status.kind !== "done") return;
    const blob = new Blob([status.result.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = status.result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="inline-block size-2 rounded-full bg-primary" />
          Browser-only · No upload
        </div>
        <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          Scratch <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">→</span> Snap!
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground">
          Drop a <code className="rounded bg-muted px-1.5 py-0.5 text-sm">.sb2</code> or{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">.sb3</code> project and get a Snap!
          BYOB <code className="rounded bg-muted px-1.5 py-0.5 text-sm">.xml</code> back. Sprites,
          costumes, sounds, variables, and common blocks are converted.
        </p>
      </header>

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group relative rounded-3xl border-2 border-dashed bg-card p-10 text-center shadow-[var(--shadow-card)] transition-all ${
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".sb,.sb2,.sb3"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[image:var(--gradient-hero)] text-2xl shadow-[var(--shadow-pop)]">
          🐱
        </div>
        <p className="text-lg font-semibold">Drop your Scratch project here</p>
        <p className="mt-1 text-sm text-muted-foreground">or click to pick a file</p>
        <Button
          onClick={() => inputRef.current?.click()}
          className="mt-6 h-11 rounded-full bg-primary px-6 text-primary-foreground shadow-[var(--shadow-pop)] hover:bg-primary/90"
        >
          Choose file
        </Button>
      </section>

      <StatusPanel status={status} onDownload={onDownload} />

      <footer className="text-center text-xs text-muted-foreground">
        Conversion runs entirely in your browser. Nothing is uploaded.
      </footer>
    </main>
  );
}

function StatusPanel({ status, onDownload }: { status: Status; onDownload: () => void }) {
  if (status.kind === "idle") return null;

  if (status.kind === "working") {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>
            Converting <span className="font-semibold">{status.filename}</span>…
          </span>
        </div>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive shadow-[var(--shadow-card)]">
        <p className="font-semibold">Couldn't convert that file</p>
        <p className="mt-1 text-destructive/80">{status.message}</p>
      </div>
    );
  }

  const { result, sizeKb } = status;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Converted from <span className="font-mono uppercase">{result.format}</span> ·{" "}
            {sizeKb} KB XML
          </p>
          <p className="mt-1 text-lg font-semibold">{result.filename}</p>
        </div>
        <Button
          onClick={onDownload}
          className="h-11 rounded-full bg-secondary px-6 text-secondary-foreground hover:bg-secondary/90"
        >
          Download .xml
        </Button>
      </div>
      {result.warnings.length > 0 && (
        <details className="mt-5 rounded-xl bg-muted/60 p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            {result.warnings.length} unconverted block type
            {result.warnings.length === 1 ? "" : "s"}
          </summary>
          <p className="mt-2 text-muted-foreground">
            These blocks appear as labeled placeholders in the Snap! output so the rest of the
            project still loads:
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {result.warnings.map((w) => (
              <li
                key={w}
                className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-xs"
              >
                {w}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
