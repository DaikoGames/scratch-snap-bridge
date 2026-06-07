// Snap! XML writer.
//
// Per-opcode handler registry. The simple cases come from blocks.ts (selector
// + ordered slot names). Anything that needs argument transformation, branch
// shuffling, or special Snap constructs (custom blocks, hat predicates) has
// its own handler.

import { simpleMap } from "./blocks";
import { el, XmlNode } from "./xml";
import type { IRBlock, IRProject, IRScript, IRTarget } from "./types";

const SNAP_APP = "Snap! 8.0, https://snap.berkeley.edu";
const SNAP_VERSION = "2";

// Procedure definitions collected per-target during a single render pass.
interface ProcDef {
  spec: string; // Snap spec, e.g. "my block %'x' %'y'"
  argNames: string[];
  argDefaults: string[];
  body: IRBlock[];
  warp: boolean;
}

interface RenderCtx {
  procDefs: ProcDef[];
  // Scope of argument names currently in effect inside a procedure body.
  // argument_reporter_string_number lookups consult this to know whether to
  // emit <block var="..."/> (proc arg) vs reportGetVar.
  procArgScope: Set<string>;
}

function newCtx(): RenderCtx {
  return { procDefs: [], procArgScope: new Set() };
}

export function projectToSnapXml(project: IRProject, projectName: string): string {
  const root = el(
    "project",
    { name: projectName, app: SNAP_APP, version: SNAP_VERSION },
    el("notes", {}, buildNotes(project)),
    el("thumbnail", {}),
    el("scenes", { select: 1 }, buildScene(project, projectName)),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${root.toString()}`;
}

function buildScene(project: IRProject, projectName: string): XmlNode {
  return el(
    "scene",
    { name: projectName, version: SNAP_VERSION },
    el("notes", {}, buildNotes(project)),
    el("hidden", {}),
    el("headers", {}),
    el("code", {}),
    el("blocks", {}),
    el("primitives", {}),
    buildStage(project),
    el("variables", {}),
  );
}

function buildNotes(project: IRProject): string {
  const lines = ["Converted from Scratch to Snap! by the Lovable converter."];
  if (project.warnings.length) {
    lines.push("Scratch opcodes encountered: " + project.warnings.join(", "));
  }
  return lines.join("\n");
}

function buildStage(project: IRProject): XmlNode {
  const ctx = newCtx();
  const stage = project.stage;
  const stageNode = el("stage", {
    name: "Stage",
    width: 480,
    height: 360,
    costume: stage.currentCostume + 1,
    color: "255,255,255,1",
    tempo: 60,
    threadsafe: false,
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
  stageNode.add(buildScripts(stage, ctx));
  stageNode.add(buildBlocksSection(ctx));

  const sprites = el("sprites", {});
  for (const [i, sprite] of project.sprites.entries()) {
    sprites.add(buildSprite(sprite, i + 2));
  }
  stageNode.add(sprites);
  return stageNode;
}

function buildSprite(sprite: IRTarget, id: number): XmlNode {
  const ctx = newCtx();
  const node = el("sprite", {
    name: sprite.name,
    idx: id,
    x: sprite.x,
    y: sprite.y,
    heading: sprite.direction - 90,
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
  node.add(buildScripts(sprite, ctx));
  node.add(buildBlocksSection(ctx));
  return node;
}

function buildCostumes(target: IRTarget): XmlNode {
  const list = el("list", { struct: "atomic", id: "" });
  const costumes = el("costumes", {}, list);
  for (const c of target.costumes) {
    list.add(
      el("costume", {
        name: c.name,
        "center-x": c.rotationCenterX ?? 0,
        "center-y": c.rotationCenterY ?? 0,
        image: c.dataUrl,
      }),
    );
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
    const listVal = el("list", {});
    for (const item of list.items) listVal.add(el("item", {}, el("l", {}, String(item))));
    listNode.add(listVal);
    node.add(listNode);
  }
  return node;
}

function buildScripts(target: IRTarget, ctx: RenderCtx): XmlNode {
  const scripts = el("scripts", {});
  for (const script of target.scripts) {
    // procedures_definition is a top-level "script" but in Snap it must
    // become a <block-definition> in the <blocks> section, not a script.
    if (script.blocks[0]?.opcode === "procedures_definition") {
      collectProcDef(script, ctx);
      continue;
    }
    scripts.add(buildScript(script, ctx));
  }
  return scripts;
}

function buildScript(script: IRScript, ctx: RenderCtx): XmlNode {
  const node = el("script", { x: script.x, y: script.y });
  for (const b of script.blocks) node.add(buildBlock(b, ctx));
  return node;
}

// ---------------------------------------------------------------------------
// Custom handlers
// ---------------------------------------------------------------------------

type Handler = (block: IRBlock, ctx: RenderCtx) => XmlNode;

const handlers: Record<string, Handler> = {
  // ---- Motion ------------------------------------------------------------
  motion_goto: (b, ctx) =>
    el("block", { s: "doGotoObject" }, argOrLiteral(b.inputs.TO, ctx, "_mouse_")),
  motion_pointtowards: (b, ctx) =>
    el("block", { s: "doFaceTowards" }, argOrLiteral(b.inputs.TOWARDS, ctx, "_mouse_")),
  motion_setrotationstyle: (b) =>
    el("block", { s: "setRotationStyle" }, el("l", {}, mapRotationStyle(b.fields.STYLE))),

  // ---- Looks -------------------------------------------------------------
  looks_changeeffectby: (b, ctx) =>
    el(
      "block",
      { s: "changeEffect" },
      el("l", {}, mapEffect(b.fields.EFFECT)),
      argOrLiteral(b.inputs.CHANGE, ctx, "25"),
    ),
  looks_seteffectto: (b, ctx) =>
    el(
      "block",
      { s: "setEffect" },
      el("l", {}, mapEffect(b.fields.EFFECT)),
      argOrLiteral(b.inputs.VALUE, ctx, "0"),
    ),
  looks_cleargraphiceffects: () => el("block", { s: "clearEffects" }),
  looks_gotofrontback: (b) => {
    // FRONT_BACK = "front" | "back". Snap: comeToFront / goBack(n).
    if ((b.fields.FRONT_BACK ?? "front") === "front") {
      return el("block", { s: "comeToFront" });
    }
    return el("block", { s: "goBack" }, el("l", {}, "9999"));
  },
  looks_goforwardbackwardlayers: (b, ctx) => {
    // FORWARD_BACKWARD = "forward" | "backward". Snap: goBack(n); for forward, negate.
    const num = argOrLiteral(b.inputs.NUM, ctx, "1");
    if ((b.fields.FORWARD_BACKWARD ?? "backward") === "forward") {
      // goBack(-n)
      return el(
        "block",
        { s: "goBack" },
        el("block", { s: "reportDifference" }, el("l", {}, "0"), num),
      );
    }
    return el("block", { s: "goBack" }, num);
  },

  // ---- Sound -------------------------------------------------------------
  // (volume/play already handled by simpleMap)

  // ---- Events ------------------------------------------------------------
  event_whengreaterthan: (b, ctx) => {
    // Hat: "when [LOUDNESS|TIMER] > VALUE". Snap: receiveCondition with predicate.
    const which = (b.fields.WHENGREATERTHANMENU ?? "TIMER").toUpperCase();
    const left =
      which === "TIMER"
        ? el("block", { s: "getTimer" })
        : el("block", { s: "reportAudio" }, el("l", {}, "volume"));
    const right = argOrLiteral(b.inputs.VALUE, ctx, "10");
    return el(
      "block",
      { s: "receiveCondition" },
      el("block", { s: "reportGreaterThan" }, left, right),
    );
  },

  // ---- Control -----------------------------------------------------------
  control_repeat: (b, ctx) =>
    el(
      "block",
      { s: "doRepeat" },
      argOrLiteral(b.inputs.TIMES, ctx, "10"),
      branch(b.branches.SUBSTACK, ctx),
    ),
  control_forever: (b, ctx) =>
    el("block", { s: "doForever" }, branch(b.branches.SUBSTACK, ctx)),
  control_if: (b, ctx) =>
    el(
      "block",
      { s: "doIf" },
      argOrLiteral(b.inputs.CONDITION, ctx, "false"),
      branch(b.branches.SUBSTACK, ctx),
    ),
  control_if_else: (b, ctx) =>
    el(
      "block",
      { s: "doIfElse" },
      argOrLiteral(b.inputs.CONDITION, ctx, "false"),
      branch(b.branches.SUBSTACK, ctx),
      branch(b.branches.SUBSTACK2, ctx),
    ),
  control_repeat_until: (b, ctx) =>
    el(
      "block",
      { s: "doUntil" },
      argOrLiteral(b.inputs.CONDITION, ctx, "false"),
      branch(b.branches.SUBSTACK, ctx),
    ),
  control_create_clone_of: (b, ctx) =>
    el("block", { s: "createClone" }, argOrLiteral(b.inputs.CLONE_OPTION, ctx, "_myself_")),
  control_start_as_clone: () => el("block", { s: "receiveOnClone" }),

  // ---- Sensing -----------------------------------------------------------
  sensing_of: (b, ctx) => {
    // PROPERTY field + OBJECT input (menu). Snap selector: reportAttributeOf
    return el(
      "block",
      { s: "reportAttributeOf" },
      el("l", {}, mapSensingOfProperty(b.fields.PROPERTY)),
      argOrLiteral(b.inputs.OBJECT, ctx, "Stage"),
    );
  },
  sensing_current: (b) => {
    // CURRENTMENU field: YEAR|MONTH|DATE|DAYOFWEEK|HOUR|MINUTE|SECOND
    const which = (b.fields.CURRENTMENU ?? "YEAR").toLowerCase();
    return el("block", { s: "reportDate" }, el("l", {}, which));
  },
  sensing_dayssince2000: () => {
    // No direct equivalent. Compute: (now - Date(2000,0,1)) / 86400000
    // Easiest in Snap: use reportJSFunction or reportMonadic. We emit a
    // placeholder reporter (literal 0) labeled in notes — pragmatic fallback.
    return el(
      "block",
      { s: "reportRound" },
      el(
        "block",
        { s: "reportQuotient" },
        el(
          "block",
          { s: "reportDifference" },
          el("block", { s: "reportDate" }, el("l", {}, "time in milliseconds")),
          el("l", {}, "946684800000"),
        ),
        el("l", {}, "86400000"),
      ),
    );
  },
  sensing_username: () => el("block", { s: "reportUserName" }),
  sensing_loudness: () => el("block", { s: "reportAudio" }, el("l", {}, "volume")),

  // ---- Variables (slot order is reversed from sb3) -----------------------
  data_setvariableto: (b, ctx) =>
    el(
      "block",
      { s: "doSetVar" },
      el("l", {}, b.fields.VARIABLE ?? ""),
      argOrLiteral(b.inputs.VALUE, ctx, "0"),
    ),
  data_changevariableby: (b, ctx) =>
    el(
      "block",
      { s: "doChangeVar" },
      el("l", {}, b.fields.VARIABLE ?? ""),
      argOrLiteral(b.inputs.VALUE, ctx, "1"),
    ),
  data_showvariable: (b) =>
    el("block", { s: "doShowVar" }, el("l", {}, b.fields.VARIABLE ?? "")),
  data_hidevariable: (b) =>
    el("block", { s: "doHideVar" }, el("l", {}, b.fields.VARIABLE ?? "")),
  data_variable: (b) => el("block", { s: "reportGetVar" }, el("l", {}, b.fields.VARIABLE ?? "")),

  // ---- Lists --------------------------------------------------------------
  data_listcontents: (b) => el("block", { s: "reportGetVar" }, el("l", {}, b.fields.LIST ?? "")),
  data_addtolist: (b, ctx) =>
    el(
      "block",
      { s: "doAddToList" },
      argOrLiteral(b.inputs.ITEM, ctx, ""),
      el("block", { s: "reportGetVar" }, el("l", {}, b.fields.LIST ?? "")),
    ),
  data_deleteoflist: (b, ctx) =>
    el(
      "block",
      { s: "doDeleteFromList" },
      argOrLiteral(b.inputs.INDEX, ctx, "1"),
      el("block", { s: "reportGetVar" }, el("l", {}, b.fields.LIST ?? "")),
    ),
  data_insertatlist: (b, ctx) =>
    el(
      "block",
      { s: "doInsertInList" },
      argOrLiteral(b.inputs.ITEM, ctx, ""),
      argOrLiteral(b.inputs.INDEX, ctx, "1"),
      el("block", { s: "reportGetVar" }, el("l", {}, b.fields.LIST ?? "")),
    ),
  data_replaceitemoflist: (b, ctx) =>
    el(
      "block",
      { s: "doReplaceInList" },
      argOrLiteral(b.inputs.INDEX, ctx, "1"),
      el("block", { s: "reportGetVar" }, el("l", {}, b.fields.LIST ?? "")),
      argOrLiteral(b.inputs.ITEM, ctx, ""),
    ),
  data_itemoflist: (b, ctx) =>
    el(
      "block",
      { s: "reportListItem" },
      argOrLiteral(b.inputs.INDEX, ctx, "1"),
      el("block", { s: "reportGetVar" }, el("l", {}, b.fields.LIST ?? "")),
    ),
  data_lengthoflist: (b) =>
    el(
      "block",
      { s: "reportListLength" },
      el("block", { s: "reportGetVar" }, el("l", {}, b.fields.LIST ?? "")),
    ),
  data_listcontainsitem: (b, ctx) =>
    el(
      "block",
      { s: "reportListContainsItem" },
      el("block", { s: "reportGetVar" }, el("l", {}, b.fields.LIST ?? "")),
      argOrLiteral(b.inputs.ITEM, ctx, ""),
    ),

  // ---- Operators ---------------------------------------------------------
  operator_mathop: (b, ctx) =>
    el(
      "block",
      { s: "reportMonadic" },
      el("l", {}, b.fields.OPERATOR ?? "sqrt"),
      argOrLiteral(b.inputs.NUM, ctx, "0"),
    ),

  // ---- Custom blocks (procedures) ---------------------------------------
  procedures_call: (b, ctx) => {
    const proccode = b.mutation?.proccode ?? "unknown";
    const ids = b.mutation?.argumentIds ?? [];
    const names = parseProcArgNamesFromCode(proccode);
    const node = el("block", { s: snapSpecFromProccode(proccode, names) });
    // Tag as a custom block call. Snap uses <custom-block s="..."> for these.
    node.tag = "custom-block";
    for (const id of ids) {
      node.add(argOrLiteral(b.inputs[id], ctx, ""));
    }
    return node;
  },
  argument_reporter_string_number: (b, ctx) => {
    const name = b.fields.VALUE ?? "";
    if (ctx.procArgScope.has(name)) {
      return el("block", { var: name });
    }
    return el("block", { s: "reportGetVar" }, el("l", {}, name));
  },
  argument_reporter_boolean: (b, ctx) => {
    const name = b.fields.VALUE ?? "";
    if (ctx.procArgScope.has(name)) {
      return el("block", { var: name });
    }
    return el("block", { s: "reportGetVar" }, el("l", {}, name));
  },
};

// ---------------------------------------------------------------------------
// Block dispatcher
// ---------------------------------------------------------------------------

function buildBlock(block: IRBlock, ctx: RenderCtx): XmlNode {
  const handler = handlers[block.opcode];
  if (handler) return handler(block, ctx);

  const spec = simpleMap[block.opcode];
  if (spec) {
    const node = el("block", { s: spec.selector });
    for (const slot of spec.slots ?? []) {
      const v = block.inputs[slot];
      if (v !== undefined) node.add(buildArg(v, ctx));
      else if (block.fields[slot] !== undefined) node.add(el("l", {}, block.fields[slot]));
      else node.add(el("l", {}, ""));
    }
    return node;
  }

  // Unknown opcode: emit a labeled placeholder reporter so the project still loads.
  return el(
    "block",
    { s: "reportJoinWords" },
    el("l", {}, `[unconverted: ${block.opcode}]`),
    el("l", {}, ""),
  );
}

function buildArg(arg: IRBlock["inputs"][string], ctx: RenderCtx): XmlNode {
  if (arg === null || arg === undefined) return el("l", {}, "");
  if (typeof arg === "object") return buildBlock(arg, ctx);
  return el("l", {}, String(arg));
}

function argOrLiteral(
  arg: IRBlock["inputs"][string] | undefined,
  ctx: RenderCtx,
  fallback: string,
): XmlNode {
  if (arg === undefined || arg === null || arg === "") return el("l", {}, fallback);
  return buildArg(arg, ctx);
}

function branch(stack: IRBlock[] | undefined, ctx: RenderCtx): XmlNode {
  const node = el("script", {});
  for (const b of stack ?? []) node.add(buildBlock(b, ctx));
  return node;
}

// ---------------------------------------------------------------------------
// Procedure definitions
// ---------------------------------------------------------------------------

function collectProcDef(script: IRScript, ctx: RenderCtx): void {
  const def = script.blocks[0];
  if (!def) return;
  // procedures_definition has input "custom_block" pointing to a procedures_prototype.
  const proto = def.inputs.custom_block;
  if (!proto || typeof proto !== "object") return;
  const m = proto.mutation;
  if (!m) return;
  const argNames = m.argumentNames;
  const argDefaults = m.argumentDefaults;

  // Body = next blocks after the definition in the same script.
  const body = script.blocks.slice(1);

  ctx.procDefs.push({
    spec: snapSpecFromProccode(m.proccode, argNames),
    argNames,
    argDefaults,
    body,
    warp: !!m.warp,
  });
}

function buildBlocksSection(ctx: RenderCtx): XmlNode {
  const node = el("blocks", {});
  for (const def of ctx.procDefs) {
    ctx.procArgScope = new Set(def.argNames);
    const bd = el("block-definition", {
      s: def.spec,
      type: "command",
      category: "other",
    });
    bd.add(el("header", {}));
    bd.add(el("code", {}));
    bd.add(el("translations", {}));
    if (def.argNames.length) {
      const inputs = el("inputs", {});
      for (let i = 0; i < def.argNames.length; i++) {
        inputs.add(
          el("input", { type: "%s" }, def.argDefaults[i] ?? ""),
        );
      }
      bd.add(inputs);
    }
    const bodyScript = el("script", {});
    for (const b of def.body) bodyScript.add(buildBlock(b, ctx));
    bd.add(bodyScript);
    node.add(bd);
    ctx.procArgScope = new Set();
  }
  return node;
}

// proccode example: "my block %s %s %b"
// argNames example: ["x", "y", "z"]
// Snap spec: "my block %'x' %'y' %'z'"
function snapSpecFromProccode(proccode: string, argNames: string[]): string {
  let i = 0;
  return proccode.replace(/%[sb]/g, () => {
    const name = argNames[i++] ?? `arg${i}`;
    return `%'${name}'`;
  });
}

function parseProcArgNamesFromCode(_proccode: string): string[] {
  // We don't have argumentnames at call sites except via mutation. Fall back
  // to numeric names; only used as a fallback for the spec string when the
  // definition was never found.
  return [];
}

// ---------------------------------------------------------------------------
// Field value translations
// ---------------------------------------------------------------------------

function mapRotationStyle(style: string | undefined): string {
  switch (style) {
    case "left-right":
      return "left-right";
    case "don't rotate":
      return "don't rotate";
    case "all around":
    default:
      return "full";
  }
}

function mapEffect(name: string | undefined): string {
  // Scratch uppercase enum -> Snap lowercase label.
  const key = (name ?? "").toLowerCase();
  const known = ["color", "fisheye", "whirl", "pixelate", "mosaic", "brightness", "ghost"];
  return known.includes(key) ? key : "ghost";
}

function mapSensingOfProperty(p: string | undefined): string {
  // Most names line up directly when lowercased. Snap also accepts variable names.
  return (p ?? "").toLowerCase();
}
