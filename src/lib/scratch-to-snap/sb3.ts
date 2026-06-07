// Parser for Scratch 3 (.sb3) projects.
// .sb3 is a zip with project.json + asset files keyed by md5+extension.

import JSZip from "jszip";
import { sb3OpcodeMap } from "./blocks";
import type {
  IRArg,
  IRBlock,
  IRCostume,
  IRList,
  IRProject,
  IRScript,
  IRSound,
  IRTarget,
  IRVariable,
} from "./types";

interface Sb3Block {
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs: Record<string, unknown[]>;
  fields: Record<string, unknown[]>;
  topLevel?: boolean;
  x?: number;
  y?: number;
  shadow?: boolean;
}

interface Sb3Target {
  isStage: boolean;
  name: string;
  variables: Record<string, [string, string | number | boolean]>;
  lists: Record<string, [string, (string | number)[]]>;
  blocks: Record<string, Sb3Block | unknown[]>;
  costumes: Array<{
    name: string;
    md5ext: string;
    rotationCenterX?: number;
    rotationCenterY?: number;
    dataFormat: string;
  }>;
  sounds: Array<{
    name: string;
    md5ext: string;
    dataFormat: string;
  }>;
  currentCostume: number;
  x?: number;
  y?: number;
  direction?: number;
  size?: number;
  visible?: boolean;
}

const MIME_BY_EXT: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  wav: "audio/wav",
  mp3: "audio/mpeg",
};

async function fileToDataUrl(zip: JSZip, name: string): Promise<string> {
  const file = zip.file(name);
  if (!file) return "";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";
  const buf = await file.async("uint8array");
  // Base64 encode
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function parseSb3(arrayBuffer: ArrayBuffer): Promise<IRProject> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const projectFile = zip.file("project.json");
  if (!projectFile) throw new Error("Missing project.json in .sb3");
  const json = JSON.parse(await projectFile.async("string")) as { targets: Sb3Target[] };

  const warnings: string[] = [];
  const targets: IRTarget[] = [];

  for (const t of json.targets) {
    const costumes: IRCostume[] = [];
    for (const c of t.costumes) {
      costumes.push({
        name: c.name,
        dataUrl: await fileToDataUrl(zip, c.md5ext),
        rotationCenterX: c.rotationCenterX,
        rotationCenterY: c.rotationCenterY,
      });
    }
    const sounds: IRSound[] = [];
    for (const s of t.sounds) {
      sounds.push({ name: s.name, dataUrl: await fileToDataUrl(zip, s.md5ext) });
    }

    const variables: IRVariable[] = Object.values(t.variables || {}).map(([name, value]) => ({
      name,
      value,
    }));
    const lists: IRList[] = Object.values(t.lists || {}).map(([name, items]) => ({
      name,
      items,
    }));

    const scripts = parseScripts(t.blocks as Record<string, Sb3Block>, warnings);

    targets.push({
      name: t.name,
      isStage: t.isStage,
      x: t.x ?? 0,
      y: t.y ?? 0,
      direction: t.direction ?? 90,
      size: t.size ?? 100,
      visible: t.visible ?? true,
      costumes,
      currentCostume: t.currentCostume ?? 0,
      sounds,
      variables,
      lists,
      scripts,
    });
  }

  const stage = targets.find((t) => t.isStage)!;
  const sprites = targets.filter((t) => !t.isStage);
  return { stage, sprites, warnings };
}

function parseScripts(
  blocks: Record<string, Sb3Block>,
  warnings: string[],
): IRScript[] {
  const scripts: IRScript[] = [];

  for (const [id, b] of Object.entries(blocks)) {
    if (!b || Array.isArray(b)) continue;
    if (!b.topLevel) continue;
    // Skip top-level shadow / floating reporters for the MVP.
    if (b.shadow) continue;

    const stack = buildStack(id, blocks, warnings);
    scripts.push({ x: b.x ?? 0, y: b.y ?? 0, blocks: stack });
  }

  return scripts;
}

function buildStack(
  startId: string,
  blocks: Record<string, Sb3Block>,
  warnings: string[],
): IRBlock[] {
  const out: IRBlock[] = [];
  let cur: string | null = startId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const b: Sb3Block | unknown[] | undefined = blocks[cur];
    if (!b || Array.isArray(b)) break;
    out.push(buildBlock(cur, blocks, warnings));
    cur = (b as Sb3Block).next;
  }
  return out;
}

function buildBlock(
  id: string,
  blocks: Record<string, Sb3Block>,
  warnings: string[],
): IRBlock {
  const b: Sb3Block = blocks[id] as Sb3Block;
  if (!sb3OpcodeMap[b.opcode] && !KNOWN_C_OPCODES.has(b.opcode)) {
    if (!warnings.includes(b.opcode)) warnings.push(b.opcode);
  }

  const args: IRArg[] = [];
  const branches: IRBlock[][] = [];

  // sb3 inputs: { NAME: [shadowType, valueOrBlockId, ...] }
  // Substack inputs (SUBSTACK / SUBSTACK2) point to first block in nested stack.
  // Regular value inputs can be either a literal array or a block id string.
  for (const [name, raw] of Object.entries(b.inputs || {})) {
    if (name === "SUBSTACK" || name === "SUBSTACK2") {
      const blockId = extractBlockId(raw);
      if (blockId) branches.push(buildStack(blockId, blocks, warnings));
      else branches.push([]);
      continue;
    }
    const value = extractInputValue(raw, blocks, warnings);
    args.push(value);
  }

  // Fields are direct values like variable names, key choices, etc.
  for (const [, raw] of Object.entries(b.fields || {})) {
    if (Array.isArray(raw) && raw.length > 0) {
      args.push(raw[0] as string);
    }
  }

  return { opcode: b.opcode, args, branches: branches.length ? branches : undefined };
}

const KNOWN_C_OPCODES = new Set([
  "control_if",
  "control_if_else",
  "control_forever",
  "control_repeat",
  "control_repeat_until",
]);

function extractBlockId(raw: unknown): string | null {
  // [1, "blockId"] | [2, "blockId"] | [3, "blockId", [shadow]] | [1, [shadow]]
  if (!Array.isArray(raw)) return null;
  const inner = raw[1];
  if (typeof inner === "string") return inner;
  return null;
}

function extractInputValue(
  raw: unknown,
  blocks: Record<string, Sb3Block>,
  warnings: string[],
): IRArg {
  if (!Array.isArray(raw)) return "";
  const inner = raw[1];
  // Reporter block plugged in
  if (typeof inner === "string" && blocks[inner]) {
    return buildBlock(inner, blocks, warnings);
  }
  // Literal shadow: [4, "10"] or [10, "hello"] inside inner array
  if (Array.isArray(inner)) {
    // inner is like [4, "10"] or [10, "hello"] or [11, "name", "id"] for broadcasts
    return (inner[1] as string) ?? "";
  }
  return "";
}
