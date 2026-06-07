// Parser for Scratch 2 (.sb2) projects.
// .sb2 is a zip; project.json uses a sprite/script array shape rather than
// the flat-blocks dictionary of sb3.

import JSZip from "jszip";
import { sb2OpToSb3, sb3OpcodeMap } from "./blocks";
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

interface Sb2Costume {
  costumeName: string;
  baseLayerID: number;
  baseLayerMD5?: string;
  rotationCenterX?: number;
  rotationCenterY?: number;
}
interface Sb2Sound {
  soundName: string;
  soundID: number;
  md5?: string;
}
interface Sb2Target {
  objName: string;
  scripts?: unknown[][];
  variables?: { name: string; value: string | number | boolean }[];
  lists?: { listName: string; contents: (string | number)[] }[];
  costumes?: Sb2Costume[];
  sounds?: Sb2Sound[];
  currentCostumeIndex?: number;
  scratchX?: number;
  scratchY?: number;
  direction?: number;
  scale?: number;
  visible?: boolean;
  children?: Sb2Target[];
}

const MIME_BY_EXT: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
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

export async function parseSb2(arrayBuffer: ArrayBuffer): Promise<IRProject> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const projectFile = zip.file("project.json");
  if (!projectFile) throw new Error("Missing project.json in .sb2");
  const stageData = JSON.parse(await projectFile.async("string")) as Sb2Target;

  const warnings: string[] = [];
  const stage = await buildTarget(stageData, zip, true, warnings);
  const sprites: IRTarget[] = [];
  for (const child of stageData.children || []) {
    // Children may include monitors/lists without scripts; skip if no objName
    if (!child.objName) continue;
    sprites.push(await buildTarget(child, zip, false, warnings));
  }

  return { stage, sprites, warnings };
}

async function buildTarget(
  t: Sb2Target,
  zip: JSZip,
  isStage: boolean,
  warnings: string[],
): Promise<IRTarget> {
  const costumes: IRCostume[] = [];
  for (const c of t.costumes || []) {
    // sb2 assets named by baseLayerID + extension inferred from MD5
    const ext = (c.baseLayerMD5 || "").split(".").pop() || "png";
    const filename = `${c.baseLayerID}.${ext}`;
    costumes.push({
      name: c.costumeName,
      dataUrl: await fileToDataUrl(zip, filename),
      rotationCenterX: c.rotationCenterX,
      rotationCenterY: c.rotationCenterY,
    });
  }
  const sounds: IRSound[] = [];
  for (const s of t.sounds || []) {
    const ext = (s.md5 || "").split(".").pop() || "wav";
    sounds.push({
      name: s.soundName,
      dataUrl: await fileToDataUrl(zip, `${s.soundID}.${ext}`),
    });
  }

  const variables: IRVariable[] =
    (t.variables || []).map((v) => ({ name: v.name, value: v.value })) || [];
  const lists: IRList[] =
    (t.lists || []).map((l) => ({ name: l.listName, items: l.contents })) || [];

  const scripts: IRScript[] = [];
  for (const raw of t.scripts || []) {
    // raw is [x, y, blockArray]
    if (!Array.isArray(raw) || raw.length < 3) continue;
    const [x, y, blockArr] = raw as [number, number, unknown[]];
    if (!Array.isArray(blockArr)) continue;
    const stack = blockArr
      .map((b) => convertSb2Block(b, warnings))
      .filter((b): b is IRBlock => b !== null);
    scripts.push({ x, y, blocks: stack });
  }

  return {
    name: t.objName,
    isStage,
    x: t.scratchX ?? 0,
    y: t.scratchY ?? 0,
    direction: t.direction ?? 90,
    size: t.scale != null ? t.scale * 100 : 100,
    visible: t.visible ?? true,
    costumes,
    currentCostume: t.currentCostumeIndex ?? 0,
    sounds,
    variables,
    lists,
    scripts,
  };
}

function convertSb2Block(raw: unknown, warnings: string[]): IRBlock | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const op = raw[0] as string;
  const opcode = sb2OpToSb3[op] || op;
  if (!sb3OpcodeMap[opcode] && !op.startsWith("doIf") && !op.startsWith("doRepeat") && !op.startsWith("doForever")) {
    if (!warnings.includes(op)) warnings.push(op);
  }

  const args: IRArg[] = [];
  const branches: IRBlock[][] = [];
  for (let i = 1; i < raw.length; i++) {
    const v = raw[i];
    if (Array.isArray(v) && v.length > 0 && Array.isArray(v[0])) {
      // Substack - array of blocks
      branches.push(
        v.map((b) => convertSb2Block(b, warnings)).filter((b): b is IRBlock => b !== null),
      );
    } else if (Array.isArray(v) && typeof v[0] === "string") {
      // Reporter block
      const inner = convertSb2Block(v, warnings);
      if (inner) args.push(inner);
      else args.push("");
    } else {
      args.push(v as IRArg);
    }
  }

  return { opcode, args, branches: branches.length ? branches : undefined };
}
