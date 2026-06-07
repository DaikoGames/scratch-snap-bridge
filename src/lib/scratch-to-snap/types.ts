// Intermediate representation between Scratch parser and Snap XML writer.
// Inputs are kept as a name->value map so the writer can pull specific slots
// like VALUE / VARIABLE / FRONT_BACK, which is required to emit correct Snap
// blocks (Snap argument order rarely matches Scratch input order).

export interface IRCostume {
  name: string;
  dataUrl: string;
  rotationCenterX?: number;
  rotationCenterY?: number;
}

export interface IRSound {
  name: string;
  dataUrl: string;
}

export interface IRVariable {
  name: string;
  value: string | number | boolean;
}

export interface IRList {
  name: string;
  items: (string | number)[];
}

export type IRArg = string | number | boolean | IRBlock | null;

export interface IRMutation {
  proccode: string;
  argumentIds: string[];
  argumentNames: string[];
  argumentDefaults: string[];
  warp?: boolean;
}

export interface IRBlock {
  opcode: string;
  inputs: Record<string, IRArg>;
  fields: Record<string, string>;
  branches: Record<string, IRBlock[]>;
  mutation?: IRMutation;
}

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
  warnings: string[];
}
