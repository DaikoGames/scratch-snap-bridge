// Public entrypoint: convert a Scratch project file (.sb / .sb2 / .sb3) to
// a Snap! .xml string.
//
// Strategy (matches https://github.com/DaikoGames/Scratch-Format-converter):
//   1. .sb and .sb2 are upconverted to .sb3 using scratch-vm in the browser.
//   2. The resulting .sb3 is parsed into our IR.
//   3. The IR is rendered as Snap! BYOB XML.
//
// scratch-vm is heavy (~MBs); it is imported dynamically so the initial page
// load stays fast and so SSR doesn't try to evaluate Node-flavored modules.

import { parseSb3 } from "./sb3";
import { projectToSnapXml } from "./snap-writer";

export interface ConvertResult {
  xml: string;
  filename: string;
  warnings: string[];
  format: "sb3" | "sb2" | "sb";
}

export async function convertScratchFile(file: File): Promise<ConvertResult> {
  const name = file.name;
  const lower = name.toLowerCase();
  const base = name.replace(/\.(sb3?|sb2|sb)$/i, "") || "project";
  const buf = await file.arrayBuffer();

  let format: ConvertResult["format"];
  let sb3Buffer: ArrayBuffer;

  if (lower.endsWith(".sb3")) {
    format = "sb3";
    sb3Buffer = buf;
  } else if (lower.endsWith(".sb2")) {
    format = "sb2";
    sb3Buffer = await upconvertWithScratchVm(buf);
  } else if (lower.endsWith(".sb")) {
    format = "sb";
    sb3Buffer = await upconvertWithScratchVm(buf);
  } else {
    // Sniff: zip (PK) → assume sb3, else try sb
    const head = new Uint8Array(buf.slice(0, 2));
    if (head[0] === 0x50 && head[1] === 0x4b) {
      format = "sb3";
      sb3Buffer = buf;
    } else {
      format = "sb";
      sb3Buffer = await upconvertWithScratchVm(buf);
    }
  }

  const project = await parseSb3(sb3Buffer);
  const xml = projectToSnapXml(project, base);
  return { xml, filename: `${base}.xml`, warnings: project.warnings, format };
}

// Use scratch-vm to load any Scratch format and re-export as sb3.
// scratch-vm's saveProjectSb3() returns a Blob (a JSZip blob).
async function upconvertWithScratchVm(buf: ArrayBuffer): Promise<ArrayBuffer> {
  // Dynamic import so this large dependency loads only when needed.
  const vmModule = await import("scratch-vm");
  const VirtualMachine =
    (vmModule as { default?: unknown }).default ?? (vmModule as unknown);
  const storageModule = await import("scratch-storage");
  const ScratchStorage =
    (storageModule as { ScratchStorage?: unknown; default?: unknown })
      .ScratchStorage ??
    (storageModule as { default?: unknown }).default ??
    storageModule;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vm = new (VirtualMachine as any)();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storage = new (ScratchStorage as any)();
  vm.attachStorage(storage);

  await vm.loadProject(buf);
  const blob = await vm.saveProjectSb3();
  return await blob.arrayBuffer();
}
