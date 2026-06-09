// Scratch 3 opcode -> Snap! selector mapping for simple 1:1 blocks.
// Each entry lists which Scratch input/field slots feed Snap's positional args,
// in the order Snap expects them. Anything more complex than this lives as a
// custom handler in snap-writer.ts.

export interface SimpleSpec {
  selector: string;
  // Names of Scratch input/field slots, in Snap arg order.
  slots?: string[];
}

export const simpleMap: Record<string, SimpleSpec> = {
  // Motion
  motion_movesteps: { selector: "forward", slots: ["STEPS"] },
  motion_turnright: { selector: "turn", slots: ["DEGREES"] },
  motion_turnleft: { selector: "turnLeft", slots: ["DEGREES"] },
  motion_pointindirection: { selector: "setHeading", slots: ["DIRECTION"] },
  motion_gotoxy: { selector: "gotoXY", slots: ["X", "Y"] },
  motion_glidesecstoxy: { selector: "doGlide", slots: ["SECS", "X", "Y"] },
  motion_changexby: { selector: "changeXPosition", slots: ["DX"] },
  motion_setx: { selector: "setXPosition", slots: ["X"] },
  motion_changeyby: { selector: "changeYPosition", slots: ["DY"] },
  motion_sety: { selector: "setYPosition", slots: ["Y"] },
  motion_ifonedgebounce: { selector: "bounceOffEdge" },
  motion_xposition: { selector: "xPosition" },
  motion_yposition: { selector: "yPosition" },
  motion_direction: { selector: "direction" },

  // Looks
  looks_sayforsecs: { selector: "doSayFor", slots: ["MESSAGE", "SECS"] },
  looks_say: { selector: "bubble", slots: ["MESSAGE"] },
  looks_thinkforsecs: { selector: "doThinkFor", slots: ["MESSAGE", "SECS"] },
  looks_think: { selector: "doThink", slots: ["MESSAGE"] },
  looks_show: { selector: "show" },
  looks_hide: { selector: "hide" },
  looks_switchcostumeto: { selector: "doSwitchToCostume", slots: ["COSTUME"] },
  looks_nextcostume: { selector: "doWearNextCostume" },
  looks_switchbackdropto: { selector: "doSwitchToCostume", slots: ["BACKDROP"] },
  looks_switchbackdroptoandwait: { selector: "doSwitchToCostume", slots: ["BACKDROP"] },
  looks_nextbackdrop: { selector: "doWearNextCostume" },
  looks_changesizeby: { selector: "changeScale", slots: ["CHANGE"] },
  looks_setsizeto: { selector: "setScale", slots: ["SIZE"] },
  looks_size: { selector: "getScale" },
  looks_costumenumbername: { selector: "getCostumeIdx" },
  looks_backdropnumbername: { selector: "getCostumeIdx" },

  // Sound
  sound_play: { selector: "playSound", slots: ["SOUND_MENU"] },
  sound_playuntildone: { selector: "doPlaySoundUntilDone", slots: ["SOUND_MENU"] },
  sound_stopallsounds: { selector: "doStopAllSounds" },
  sound_changevolumeby: { selector: "changeVolume", slots: ["VOLUME"] },
  sound_setvolumeto: { selector: "setVolume", slots: ["VOLUME"] },
  sound_volume: { selector: "getVolume" },
  // Sound effects (Snap! has no direct sound-effect blocks; map to comments)
  sound_changeeffectby: { selector: "doChangeTempo", slots: ["VALUE"] },
  sound_seteffectto: { selector: "doSetTempo", slots: ["VALUE"] },
  sound_cleareffects: { selector: "doStopAllSounds" },

  // Pen
  pen_clear: { selector: "clear" },
  pen_stamp: { selector: "doStamp" },
  pen_penDown: { selector: "down" },
  pen_penUp: { selector: "up" },
  pen_setPenColorToColor: { selector: "setColor", slots: ["COLOR"] },
  pen_changePenSizeBy: { selector: "changeSize", slots: ["SIZE"] },
  pen_setPenSizeTo: { selector: "setSize", slots: ["SIZE"] },

  // Events
  event_whenflagclicked: { selector: "receiveGo" },
  event_whenkeypressed: { selector: "receiveKey", slots: ["KEY_OPTION"] },
  event_whenthisspriteclicked: { selector: "receiveInteraction", slots: [] },
  event_whenstageclicked: { selector: "receiveInteraction", slots: [] },
  event_whenbroadcastreceived: { selector: "receiveMessage", slots: ["BROADCAST_OPTION"] },
  event_whenbackdropswitchesto: { selector: "receiveMessage", slots: ["BACKDROP"] },
  event_broadcast: { selector: "doBroadcast", slots: ["BROADCAST_INPUT"] },
  event_broadcastandwait: { selector: "doBroadcastAndWait", slots: ["BROADCAST_INPUT"] },

  // Control
  control_wait: { selector: "doWait", slots: ["DURATION"] },
  control_wait_until: { selector: "doWaitUntil", slots: ["CONDITION"] },
  control_stop: { selector: "doStopThis", slots: ["STOP_OPTION"] },
  control_delete_this_clone: { selector: "removeClone" },

  // Sensing
  sensing_askandwait: { selector: "doAsk", slots: ["QUESTION"] },
  sensing_answer: { selector: "getLastAnswer" },
  sensing_keypressed: { selector: "reportKeyPressed", slots: ["KEY_OPTION"] },
  sensing_mousedown: { selector: "reportMouseDown" },
  sensing_mousex: { selector: "reportMouseX" },
  sensing_mousey: { selector: "reportMouseY" },
  sensing_timer: { selector: "getTimer" },
  sensing_resettimer: { selector: "doResetTimer" },
  sensing_touchingobject: { selector: "reportTouchingObject", slots: ["TOUCHINGOBJECTMENU"] },
  sensing_touchingcolor: { selector: "reportTouchingColor", slots: ["COLOR"] },
  sensing_coloristouchingcolor: { selector: "reportColorIsTouchingColor", slots: ["COLOR", "COLOR2"] },
  sensing_distanceto: { selector: "reportDistanceTo", slots: ["DISTANCETOMENU"] },
  sensing_setdragmode: { selector: "setDraggableTo", slots: ["DRAG_MODE"] },

  // Operators
  operator_add: { selector: "reportSum", slots: ["NUM1", "NUM2"] },
  operator_subtract: { selector: "reportDifference", slots: ["NUM1", "NUM2"] },
  operator_multiply: { selector: "reportProduct", slots: ["NUM1", "NUM2"] },
  operator_divide: { selector: "reportQuotient", slots: ["NUM1", "NUM2"] },
  operator_random: { selector: "reportRandom", slots: ["FROM", "TO"] },
  operator_gt: { selector: "reportGreaterThan", slots: ["OPERAND1", "OPERAND2"] },
  operator_lt: { selector: "reportLessThan", slots: ["OPERAND1", "OPERAND2"] },
  operator_equals: { selector: "reportEquals", slots: ["OPERAND1", "OPERAND2"] },
  operator_and: { selector: "reportAnd", slots: ["OPERAND1", "OPERAND2"] },
  operator_or: { selector: "reportOr", slots: ["OPERAND1", "OPERAND2"] },
  operator_not: { selector: "reportNot", slots: ["OPERAND"] },
  operator_join: { selector: "reportJoinWords", slots: ["STRING1", "STRING2"] },
  operator_letter_of: { selector: "reportLetter", slots: ["LETTER", "STRING"] },
  operator_length: { selector: "reportStringSize", slots: ["STRING"] },
  operator_mod: { selector: "reportModulus", slots: ["NUM1", "NUM2"] },
  operator_round: { selector: "reportRound", slots: ["NUM"] },
  // operator_contains handled in snap-writer.ts (Snap has no text-contains primitive)

  // Lists (extras handled in writer for ones that need item-of-list reordering)
  data_deletealloflist: { selector: "doDeleteFromList", slots: [] },
  data_showlist: { selector: "doShowVar", slots: ["LIST"] },
  data_hidelist: { selector: "doHideVar", slots: ["LIST"] },
};
