// Mapping from Scratch (sb2 op names and sb3 opcodes) to Snap! block selectors.
// Snap! uses XML <block s="selector"> with child nodes for inputs.
//
// This is an MVP mapping covering common Motion / Looks / Sound / Events /
// Control / Sensing / Operators / Variables blocks. Unknown blocks become
// a Snap comment-style placeholder so the project still loads.

export interface SnapBlockSpec {
  // Snap selector (the s="..." attribute) or special tag like "reporter:..."
  selector: string;
  // How to map ordered Scratch arguments to Snap inputs.
  // Each entry references an arg index from the Scratch block.
  // If omitted, args are passed positionally in order.
  argOrder?: number[];
}

// sb3 opcode -> snap selector. The sb2 op name is the same word after the
// category prefix in most cases; we keep a second table below.
export const sb3OpcodeMap: Record<string, SnapBlockSpec> = {
  // Motion
  motion_movesteps: { selector: "forward" },
  motion_turnright: { selector: "turn" },
  motion_turnleft: { selector: "turnLeft" },
  motion_pointindirection: { selector: "setHeading" },
  motion_gotoxy: { selector: "gotoXY" },
  motion_glidesecstoxy: { selector: "doGlide" },
  motion_changexby: { selector: "changeXPosition" },
  motion_setx: { selector: "setXPosition" },
  motion_changeyby: { selector: "changeYPosition" },
  motion_sety: { selector: "setYPosition" },
  motion_ifonedgebounce: { selector: "bounceOffEdge" },
  motion_xposition: { selector: "xPosition" },
  motion_yposition: { selector: "yPosition" },
  motion_direction: { selector: "direction" },

  // Looks
  looks_sayforsecs: { selector: "doSayFor" },
  looks_say: { selector: "bubble" },
  looks_thinkforsecs: { selector: "doThinkFor" },
  looks_think: { selector: "doThink" },
  looks_show: { selector: "show" },
  looks_hide: { selector: "hide" },
  looks_switchcostumeto: { selector: "doSwitchToCostume" },
  looks_nextcostume: { selector: "doWearNextCostume" },
  looks_changesizeby: { selector: "changeScale" },
  looks_setsizeto: { selector: "setScale" },
  looks_size: { selector: "getScale" },
  looks_costumenumbername: { selector: "getCostumeIdx" },

  // Sound
  sound_play: { selector: "playSound" },
  sound_playuntildone: { selector: "doPlaySoundUntilDone" },
  sound_stopallsounds: { selector: "doStopAllSounds" },

  // Pen (Snap has these in the "pen" category)
  pen_clear: { selector: "clear" },
  pen_stamp: { selector: "doStamp" },
  pen_penDown: { selector: "down" },
  pen_penUp: { selector: "up" },
  pen_setPenColorToColor: { selector: "setColor" },
  pen_changePenSizeBy: { selector: "changeSize" },
  pen_setPenSizeTo: { selector: "setSize" },

  // Events / hats
  event_whenflagclicked: { selector: "receiveGo" },
  event_whenkeypressed: { selector: "receiveKey" },
  event_whenthisspriteclicked: { selector: "receiveInteraction" },
  event_whenbroadcastreceived: { selector: "receiveMessage" },
  event_broadcast: { selector: "doBroadcast" },
  event_broadcastandwait: { selector: "doBroadcastAndWait" },

  // Control
  control_wait: { selector: "doWait" },
  control_repeat: { selector: "doRepeat" },
  control_forever: { selector: "doForever" },
  control_if: { selector: "doIf" },
  control_if_else: { selector: "doIfElse" },
  control_wait_until: { selector: "doWaitUntil" },
  control_repeat_until: { selector: "doUntil" },
  control_stop: { selector: "doStopThis" },
  control_create_clone_of: { selector: "createClone" },
  control_delete_this_clone: { selector: "removeClone" },

  // Sensing
  sensing_askandwait: { selector: "doAsk" },
  sensing_answer: { selector: "getLastAnswer" },
  sensing_keypressed: { selector: "reportKeyPressed" },
  sensing_mousedown: { selector: "reportMouseDown" },
  sensing_mousex: { selector: "reportMouseX" },
  sensing_mousey: { selector: "reportMouseY" },
  sensing_timer: { selector: "getTimer" },
  sensing_resettimer: { selector: "doResetTimer" },

  // Operators
  operator_add: { selector: "reportSum" },
  operator_subtract: { selector: "reportDifference" },
  operator_multiply: { selector: "reportProduct" },
  operator_divide: { selector: "reportQuotient" },
  operator_random: { selector: "reportRandom" },
  operator_gt: { selector: "reportGreaterThan" },
  operator_lt: { selector: "reportLessThan" },
  operator_equals: { selector: "reportEquals" },
  operator_and: { selector: "reportAnd" },
  operator_or: { selector: "reportOr" },
  operator_not: { selector: "reportNot" },
  operator_join: { selector: "reportJoinWords" },
  operator_letter_of: { selector: "reportLetter" },
  operator_length: { selector: "reportStringSize" },
  operator_mod: { selector: "reportModulus" },
  operator_round: { selector: "reportRound" },
  operator_mathop: { selector: "reportMonadic" },

  // Data / variables
  data_setvariableto: { selector: "doSetVar" },
  data_changevariableby: { selector: "doChangeVar" },
  data_showvariable: { selector: "doShowVar" },
  data_hidevariable: { selector: "doHideVar" },
  data_variable: { selector: "reportGetVar" },

  // Lists
  data_addtolist: { selector: "doAddToList" },
  data_deleteoflist: { selector: "doDeleteFromList" },
  data_insertatlist: { selector: "doInsertInList" },
  data_replaceitemoflist: { selector: "doReplaceInList" },
  data_itemoflist: { selector: "reportListItem" },
  data_lengthoflist: { selector: "reportListLength" },
  data_listcontainsitem: { selector: "reportListContainsItem" },
};

// sb2 maps the same kind of names, slightly different. We translate sb2 ops
// to a synthetic sb3 opcode and reuse the table above.
export const sb2OpToSb3: Record<string, string> = {
  forward: "motion_movesteps",
  "turnRight:": "motion_turnright",
  "turnLeft:": "motion_turnleft",
  "heading:": "motion_pointindirection",
  "gotoX:y:": "motion_gotoxy",
  "glideSecs:toX:y:elapsed:from:": "motion_glidesecstoxy",
  "changeXposBy:": "motion_changexby",
  "xpos:": "motion_setx",
  "changeYposBy:": "motion_changeyby",
  "ypos:": "motion_sety",
  bounceOffEdge: "motion_ifonedgebounce",
  xpos: "motion_xposition",
  ypos: "motion_yposition",
  heading: "motion_direction",

  "say:duration:elapsed:from:": "looks_sayforsecs",
  "say:": "looks_say",
  "think:duration:elapsed:from:": "looks_thinkforsecs",
  "think:": "looks_think",
  show: "looks_show",
  hide: "looks_hide",
  "lookLike:": "looks_switchcostumeto",
  nextCostume: "looks_nextcostume",
  "changeSizeBy:": "looks_changesizeby",
  "setSizeTo:": "looks_setsizeto",
  scale: "looks_size",

  "playSound:": "sound_play",
  "doPlaySoundAndWait": "sound_playuntildone",
  stopAllSounds: "sound_stopallsounds",

  clearPenTrails: "pen_clear",
  stampCostume: "pen_stamp",
  putPenDown: "pen_penDown",
  putPenUp: "pen_penUp",
  "penColor:": "pen_setPenColorToColor",
  "changePenSizeBy:": "pen_changePenSizeBy",
  "penSize:": "pen_setPenSizeTo",

  whenGreenFlag: "event_whenflagclicked",
  whenKeyPressed: "event_whenkeypressed",
  whenClicked: "event_whenthisspriteclicked",
  whenIReceive: "event_whenbroadcastreceived",
  "broadcast:": "event_broadcast",
  doBroadcastAndWait: "event_broadcastandwait",

  "wait:elapsed:from:": "control_wait",
  doRepeat: "control_repeat",
  doForever: "control_forever",
  doIf: "control_if",
  doIfElse: "control_if_else",
  doWaitUntil: "control_wait_until",
  doUntil: "control_repeat_until",
  stopScripts: "control_stop",
  createCloneOf: "control_create_clone_of",
  deleteClone: "control_delete_this_clone",

  "doAsk": "sensing_askandwait",
  answer: "sensing_answer",
  "keyPressed:": "sensing_keypressed",
  mousePressed: "sensing_mousedown",
  mouseX: "sensing_mousex",
  mouseY: "sensing_mousey",
  timer: "sensing_timer",
  timerReset: "sensing_resettimer",

  "+": "operator_add",
  "-": "operator_subtract",
  "*": "operator_multiply",
  "/": "operator_divide",
  "randomFrom:to:": "operator_random",
  ">": "operator_gt",
  "<": "operator_lt",
  "=": "operator_equals",
  "&": "operator_and",
  "|": "operator_or",
  "not": "operator_not",
  "concatenate:with:": "operator_join",
  "letter:of:": "operator_letter_of",
  "stringLength:": "operator_length",
  "%": "operator_mod",
  "rounded": "operator_round",
  "computeFunction:of:": "operator_mathop",

  "setVar:to:": "data_setvariableto",
  "changeVar:by:": "data_changevariableby",
  "showVariable:": "data_showvariable",
  "hideVariable:": "data_hidevariable",
  readVariable: "data_variable",

  "append:toList:": "data_addtolist",
  "deleteLine:ofList:": "data_deleteoflist",
  "insert:at:ofList:": "data_insertatlist",
  "setLine:ofList:to:": "data_replaceitemoflist",
  "getLine:ofList:": "data_itemoflist",
  "lineCountOfList:": "data_lengthoflist",
  "list:contains:": "data_listcontainsitem",
};

export function lookupSb3(opcode: string): SnapBlockSpec | undefined {
  return sb3OpcodeMap[opcode];
}
