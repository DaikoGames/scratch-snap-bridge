// Writes the Snap! BYOB XML for an IRProject.
// Snap! project XML reference: https://snap.berkeley.edu/
// Top-level structure:
//   <project name="..." app="Snap! ..." version="2">
//     <stage ...> ... <sprites><sprite ...>...</sprite></sprites> </stage>
//     <hidden></hidden>
//     <headers></headers> <code></code> <blocks></blocks>
//   </project>

import { lookupSb3 } from "./blocks";
import { el, XmlNode } from "./xml";
import type { IRBlock, IRProject, IRScript, IRTarget } from "./types";

const SNAP_APP = "Snap! 8.0, https://snap.berkeley.edu";
const SNAP_VERSION = "2";

export function projectToSnapXml(project: IRProject, projectName: string): string {
  const stage = buildStage(project, projectName);

  const root = el(
    "project",
    { name: projectName, app: SNAP_APP, version: SNAP_VERSION },
    el("notes", {}, buildNotes(project)),
    stage,
    el("hidden", {}),
    el("headers", {}),
    el("code", {}),
    el("blocks", {}),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n${root.toString()}`;
}

function buildNotes(project: IRProject): string {
  const lines = ["Converted from Scratch to Snap! by the Lovable converter."];
  if (project.warnings.length) {
    lines.push("Unconverted blocks: " + project.warnings.join(", "));
  }
  return lines.join("\n");
}

function buildStage(project: IRProject, projectName: string): XmlNode {
  const stage = project.stage;
  const stageNode = el("stage", {
    name: "Stage",
    width: 480,
    height: 360,
    costume: stage.currentCostume + 1,
    color: "255,255,255,1",
    tempo: 60,
    threadsafe: false,
    penlog: false,
    volume: 100,
    pan: 0,
    lines: "round",
    ternary: false,
    hyperops: true,
    codify: false,
    inheritance: true,
    sublistIDs: false,
    scheduled: true,
    id: "1",
  });

  stageNode.add(buildCostumes(stage));
  stageNode.add(buildSounds(stage));
  stageNode.add(buildVariables(stage));
  stageNode.add(buildScripts(stage));

  const sprites = el("sprites", {});
  for (const [i, sprite] of project.sprites.entries()) {
    sprites.add(buildSprite(sprite, i + 2));
  }
  stageNode.add(sprites);

  // Suppress unused warning
  void projectName;
  return stageNode;
}

function buildSprite(sprite: IRTarget, id: number): XmlNode {
  const node = el("sprite", {
    name: sprite.name,
    idx: id,
    x: sprite.x,
    y: sprite.y,
    heading: sprite.direction - 90, // Snap heading: 0 = up; Scratch: 90 = right
    scale: sprite.size / 100,
    rotation: 1,
    draggable: true,
    costume: sprite.currentCostume + 1,
    color: "80,80,80,1",
    pen: "tip",
    id: String(id),
  });
  if (!sprite.visible) node.attrs.hidden = true;

  node.add(buildCostumes(sprite));
  node.add(buildSounds(sprite));
  node.add(buildVariables(sprite));
  node.add(buildScripts(sprite));
  return node;
}

function buildCostumes(target: IRTarget): XmlNode {
  const list = el("list", { struct: "atomic", id: "" });
  const costumes = el("costumes", {}, list);
  for (const c of target.costumes) {
    const item = el("costume", {
      name: c.name,
      "center-x": c.rotationCenterX ?? 0,
      "center-y": c.rotationCenterY ?? 0,
      image: c.dataUrl,
    });
    list.add(item);
  }
  return costumes;
}

function buildSounds(target: IRTarget): XmlNode {
  const list = el("list", { struct: "atomic", id: "" });
  const sounds = el("sounds", {}, list);
  for (const s of target.sounds) {
    list.add(el("sound", { name: s.name, sound: s.dataUrl }));
  }
  return sounds;
}

function buildVariables(target: IRTarget): XmlNode {
  const node = el("variables", {});
  for (const v of target.variables) {
    node.add(el("variable", { name: v.name }, el("l", {}, String(v.value))));
  }
  for (const list of target.lists) {
    const listNode = el("variable", { name: list.name });
    const listVal = el("list", { struct: "atomic" });
    for (const item of list.items) {
      listVal.add(el("item", {}, String(item)));
    }
    listNode.add(listVal);
  }
  return node;
}

function buildScripts(target: IRTarget): XmlNode {
  const scripts = el("scripts", {});
  for (const script of target.scripts) {
    scripts.add(buildScript(script));
  }
  return scripts;
}

function buildScript(script: IRScript): XmlNode {
  const node = el("script", { x: script.x, y: script.y });
  for (const b of script.blocks) {
    node.add(buildBlock(b));
  }
  return node;
}

function buildBlock(block: IRBlock): XmlNode {
  const spec = lookupSb3(block.opcode);
  if (!spec) {
    // Render unknown block as a comment-like noop label.
    return el(
      "block",
      { s: "doSetVar" },
      el("l", {}, `[unconverted: ${block.opcode}]`),
      el("l", {}, "0"),
    );
  }

  const node = el("block", { s: spec.selector });

  // Args
  for (const arg of block.args) {
    node.add(buildArg(arg));
  }

  // Branches as <script> children inside the block
  if (block.branches) {
    for (const branch of block.branches) {
      const scr = el("script", {});
      for (const b of branch) scr.add(buildBlock(b));
      node.add(scr);
    }
  }

  return node;
}

function buildArg(arg: IRBlock["args"][number]): XmlNode {
  if (arg === null || arg === undefined) return el("l", {}, "");
  if (typeof arg === "object") {
    // Reporter
    return buildBlock(arg);
  }
  return el("l", {}, String(arg));
}
