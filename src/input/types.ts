/**
 * Input event types for keyboard and mouse.
 */

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
  /**
   * Set to true by a prioritized handler to indicate the event was consumed.
   * When no prioritized handler consumes the event, it propagates to normal handlers.
   * This allows focus-trap handlers (e.g. Modal) to selectively capture only the
   * keys they care about (Escape, Tab) while letting other keys pass through to
   * child components (ScrollView, TextInput, Select, etc.).
   */
  consumed?: boolean;
}

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

export type KeyHandler = (event: KeyEvent) => void;
export type MouseHandler = (event: MouseEvent) => void;

export interface PasteEvent {
  text: string;
}

export type PasteHandler = (event: PasteEvent) => void;
