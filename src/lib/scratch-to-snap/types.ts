// Intermediate representation between Scratch parsers and the Snap XML writer.
// Both sb2 and sb3 parsers produce this shape; the writer consumes it.

export interface IRCostume {
  name: string;
  // data URL (image/png, image/svg+xml, etc.)
  dataUrl: string;
  // pixels from top-left in Scratch's coordinate system
  rotationCenterX?: number;
  rotationCenterY?: number;
}

export interface IRSound {
  name: string;
  dataUrl: string; // audio/wav etc.
}

export interface IRVariable {
  name: string;
  value: string | number | boolean;
}

export interface IRList {
  name: string;
  items: (string | number)[];
}

// A Scratch block is normalized to a uniform shape regardless of source format.
export interface IRBlock {
  // The sb3 opcode (sb2 ops are translated to sb3 opcodes before this stage).
  opcode: string;
  // Ordered argument values. Each can be a literal (string/number) or another IRBlock (reporter).
  args: (IRArg)[];
  // For C-shape blocks (if / forever / repeat) - one or two nested stacks.
  branches?: IRBlock[][];
}

export type IRArg = string | number | boolean | IRBlock | null;

export interface IRScript {
  x: number;
  y: number;
  blocks: IRBlock[];
}

export interface IRTarget {
  name: string;
  isStage: boolean;
  x: number;
  y: number;
  direction: number;
  size: number;
  visible: boolean;
  costumes: IRCostume[];
  currentCostume: number;
  sounds: IRSound[];
  variables: IRVariable[];
  lists: IRList[];
  scripts: IRScript[];
}

export interface IRProject {
  stage: IRTarget;
  sprites: IRTarget[];
  // Optional notes from the parser surfaced to the UI.
  warnings: string[];
}
