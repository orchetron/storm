import type { KeyEvent } from "../input/types.js";

export interface KeySpec {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export function matchKeySpec(event: KeyEvent, spec: KeySpec): boolean {
  if (event.key !== spec.key) return false;
  if ((spec.ctrl ?? false) !== event.ctrl) return false;
  if ((spec.shift ?? false) !== event.shift) return false;
  if ((spec.meta ?? false) !== event.meta) return false;
  return true;
}
