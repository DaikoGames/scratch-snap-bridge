// Public entrypoint: convert a Scratch project file (.sb / .sb2 / .sb3) to
// a Snap! .xml string. Detection is by file extension, falling back to
// signature sniffing for unknown extensions.

import { parseSb2 } from "./sb2";
import { parseSb3 } from "./sb3";
import { projectToSnapXml } from "./snap-writer";
import type { IRProject } from "./types";

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

  let project: IRProject;
  let format: ConvertResult["format"];

  if (lower.endsWith(".sb3")) {
    project = await parseSb3(buf);
    format = "sb3";
  } else if (lower.endsWith(".sb2")) {
    project = await parseSb2(buf);
    format = "sb2";
  } else if (lower.endsWith(".sb")) {
    // Scratch 1.4 uses a binary Squeak Smalltalk image format that requires a
    // dedicated parser. We don't ship one — surface a clear error instead of
    // producing garbage XML.
    throw new Error(
      "Scratch 1.4 (.sb) files use a legacy binary format that this converter can't parse. " +
        "Please open the file in Scratch 2 or 3 and re-export as .sb2 or .sb3 first.",
    );
  } else {
    // Try sniffing: zip files start with PK
    const head = new Uint8Array(buf.slice(0, 2));
    if (head[0] === 0x50 && head[1] === 0x4b) {
      // Try sb3 first, then sb2
      try {
        project = await parseSb3(buf);
        format = "sb3";
      } catch {
        project = await parseSb2(buf);
        format = "sb2";
      }
    } else {
      throw new Error("Unrecognized file format. Expected .sb2 or .sb3.");
    }
  }

  const xml = projectToSnapXml(project, base);
  return { xml, filename: `${base}.xml`, warnings: project.warnings, format };
}
