/**
 * Input event types for keyboard and mouse.
 */

// ── Key names ───────────────────────────────────────────────────────

export type KeyName =
  | "return"
  | "escape"
  | "tab"
  | "backspace"
  | "delete"
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end"
  | "pageup"
  | "pagedown"
  | "insert"
  | "f1"
  | "f2"
  | "f3"
  | "f4"
  | "f5"
  | "f6"
  | "f7"
  | "f8"
  | "f9"
  | "f10"
  | "f11"
  | "f12"
  | "space";

export interface KeyEvent {
  /** The resolved key name, or the literal character */
  key: KeyName | string;
  /** The raw character if printable, empty otherwise */
  char: string;
  /** The raw escape sequence */
  raw: string;
  /** Modifier flags */
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

// ── Mouse events ────────────────────────────────────────────────────

export type MouseButton =
  | "left"
  | "middle"
  | "right"
  | "scroll-up"
  | "scroll-down"
  | "scroll-left"
  | "scroll-right"
  | "none";

export type MouseAction = "press" | "release" | "move";

export interface MouseEvent {
  button: MouseButton;
  action: MouseAction;
  /** 0-indexed column */
  x: number;
  /** 0-indexed row */
  y: number;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  /** The raw escape sequence */
  raw: string;
}

// ── Handlers ────────────────────────────────────────────────────────

export type KeyHandler = (event: KeyEvent) => void;
export type MouseHandler = (event: MouseEvent) => void;

// ── Paste events ────────────────────────────────────────────────────

export interface PasteEvent {
  text: string;
}

export type PasteHandler = (event: PasteEvent) => void;
