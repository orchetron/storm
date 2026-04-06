import type { KeyEvent } from "../../input/types.js";

export interface CellEditState {
  row: number;
  col: number;
  value: string;
  cursor: number;
}

/**
 * Process a key event while in inline cell editing mode.
 *
 * Mutates `editState` in place and calls `onCommit` when the user presses Enter,
 * `onCancel` when Escape is pressed, and `onUpdate` after any change that
 * requires a re-render (cursor movement, character insertion, etc.).
 *
 * Returns `true` if the event was handled by the editor.
 */
export function handleCellEdit(
  event: KeyEvent,
  editState: CellEditState,
  onCommit: (row: number, col: number, value: string) => void,
  onCancel: () => void,
  onUpdate: () => void,
): boolean {
  if (event.key === "escape") {
    onCancel();
    return true;
  }
  if (event.key === "return") {
    onCommit(editState.row, editState.col, editState.value);
    return true;
  }
  if (event.key === "backspace") {
    if (editState.cursor > 0) {
      editState.value = editState.value.slice(0, editState.cursor - 1) + editState.value.slice(editState.cursor);
      editState.cursor -= 1;
      onUpdate();
    }
    return true;
  }
  if (event.key === "delete") {
    if (editState.cursor < editState.value.length) {
      editState.value = editState.value.slice(0, editState.cursor) + editState.value.slice(editState.cursor + 1);
      onUpdate();
    }
    return true;
  }
  if (event.key === "left") {
    if (editState.cursor > 0) { editState.cursor -= 1; onUpdate(); }
    return true;
  }
  if (event.key === "right") {
    if (editState.cursor < editState.value.length) { editState.cursor += 1; onUpdate(); }
    return true;
  }
  if (event.key === "home") {
    editState.cursor = 0;
    onUpdate();
    return true;
  }
  if (event.key === "end") {
    editState.cursor = editState.value.length;
    onUpdate();
    return true;
  }
  // Printable character
  if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
    editState.value = editState.value.slice(0, editState.cursor) + event.char + editState.value.slice(editState.cursor);
    editState.cursor += 1;
    onUpdate();
    return true;
  }
  return false;
}
