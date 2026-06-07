// Parser for Scratch 3 (.sb3) projects.
// Normalizes the flat blocks dictionary into a per-script tree with named
// inputs, named fields, and mutation data for custom blocks.

import JSZip from "jszip";
import type {
  IRArg,
  IRBlock,
  IRCostume,
  IRList,
  IRMutation,
  IRProject,
  IRScript,
  IRSound,
  IRTarget,
  IRVariable,
} from "./types";

interface Sb3Mutation {
  proccode?: string;
  argumentids?: string;
  argumentnames?: string;
  argumentdefaults?: string;
  warp?: string | boolean;
}
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
  mutation?: Sb3Mutation;
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
  sounds: Array<{ name: string; md5ext: string; dataFormat: string }>;
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
  const json = JSON.parse(await projectFile.async("string")) as {
    targets: Sb3Target[];
  };

  const warnings = new Set<string>();
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
    const variables: IRVariable[] = Object.values(t.variables || {}).map(
      ([name, value]) => ({ name, value }),
    );
    const lists: IRList[] = Object.values(t.lists || {}).map(([name, items]) => ({
      name,
      items,
    }));

    const blocks = t.blocks as Record<string, Sb3Block>;
    const scripts = parseScripts(blocks, warnings);

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
  return { stage, sprites, warnings: [...warnings] };
}

function parseScripts(
  blocks: Record<string, Sb3Block>,
  warnings: Set<string>,
): IRScript[] {
  const scripts: IRScript[] = [];
  for (const [id, b] of Object.entries(blocks)) {
    if (!b || Array.isArray(b)) continue;
    if (!b.topLevel) continue;
    if (b.shadow) continue;
    const stack = buildStack(id, blocks, warnings);
    scripts.push({ x: b.x ?? 0, y: b.y ?? 0, blocks: stack });
  }
  return scripts;
}

function buildStack(
  startId: string,
  blocks: Record<string, Sb3Block>,
  warnings: Set<string>,
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
  warnings: Set<string>,
): IRBlock {
  const b = blocks[id] as Sb3Block;
  warnings.add(b.opcode);

  const inputs: Record<string, IRArg> = {};
  const branches: Record<string, IRBlock[]> = {};
  for (const [name, raw] of Object.entries(b.inputs || {})) {
    if (name === "SUBSTACK" || name === "SUBSTACK2") {
      const blockId = extractBlockId(raw);
      branches[name] = blockId ? buildStack(blockId, blocks, warnings) : [];
      continue;
    }
    inputs[name] = extractInputValue(raw, blocks, warnings);
  }

  const fields: Record<string, string> = {};
  for (const [name, raw] of Object.entries(b.fields || {})) {
    if (Array.isArray(raw) && raw.length > 0) {
      fields[name] = String(raw[0] ?? "");
    }
  }

  let mutation: IRMutation | undefined;
  if (b.mutation) {
    const m = b.mutation;
    mutation = {
      proccode: m.proccode ?? "",
      argumentIds: safeJsonArray(m.argumentids),
      argumentNames: safeJsonArray(m.argumentnames),
      argumentDefaults: safeJsonArray(m.argumentdefaults),
      warp: m.warp === true || m.warp === "true",
    };
  }

  return { opcode: b.opcode, inputs, fields, branches, mutation };
}

function safeJsonArray(s: string | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function extractBlockId(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const inner = raw[1];
  return typeof inner === "string" ? inner : null;
}

function extractInputValue(
  raw: unknown,
  blocks: Record<string, Sb3Block>,
  warnings: Set<string>,
): IRArg {
  if (!Array.isArray(raw)) return "";
  const inner = raw[1];
  if (typeof inner === "string" && blocks[inner]) {
    const child = blocks[inner] as Sb3Block;
    // Menus (looks_costume, sound_sounds_menu, etc.) are shadow reporters
    // whose only meaningful payload is a single field value. Inline that
    // value instead of producing a reporter block.
    if (child.shadow && isMenuOpcode(child.opcode)) {
      const fieldVals = Object.values(child.fields || {});
      if (fieldVals.length && Array.isArray(fieldVals[0])) {
        return String((fieldVals[0] as unknown[])[0] ?? "");
      }
    }
    return buildBlock(inner, blocks, warnings);
  }
  if (Array.isArray(inner)) {
    // Literal shadow: [type, value, ...]
    return (inner[1] as string) ?? "";
  }
  return "";
}

function isMenuOpcode(op: string): boolean {
  return op.endsWith("_menu") || op === "looks_costume" || op === "looks_backdrops" || op === "sound_sounds_menu";
}
