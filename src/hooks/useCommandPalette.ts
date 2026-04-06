import { useRef } from "react";
import { useInput } from "./useInput.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface CommandDef {
  name: string;
  description: string;
  category?: string;
}

export interface UseCommandPaletteOptions {
  commands: CommandDef[];
  trigger?: string;
  isActive?: boolean;
  onExecute: (command: CommandDef) => void;
}

export interface UseCommandPaletteResult {
  isOpen: boolean;
  query: string;
  filtered: CommandDef[];
  activeIndex: number;
  open: () => void;
  close: () => void;
}

export function useCommandPalette(options: UseCommandPaletteOptions): UseCommandPaletteResult {
  const { commands, trigger = "/", isActive = true, onExecute } = options;
  const forceUpdate = useForceUpdate();

  const isOpenRef = useRef(false);
  const queryRef = useRef("");
  const activeIndexRef = useRef(0);
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const getFiltered = (): CommandDef[] => {
    const q = queryRef.current.toLowerCase();
    if (q === "") return commandsRef.current;
    return commandsRef.current.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        (cmd.category && cmd.category.toLowerCase().includes(q)),
    );
  };

  const open = () => {
    isOpenRef.current = true;
    queryRef.current = "";
    activeIndexRef.current = 0;
    forceUpdate();
  };

  const close = () => {
    isOpenRef.current = false;
    queryRef.current = "";
    activeIndexRef.current = 0;
    forceUpdate();
  };

  useInput(
    (event) => {
      if (!isOpenRef.current) {
        if (event.char === trigger && !event.ctrl && !event.meta) {
          open();
          return;
        }
        return;
      }

      // Palette is open — handle navigation

      // Escape — close
      if (event.key === "escape") {
        close();
        return;
      }

      // Enter — execute selected command
      if (event.key === "return") {
        const filtered = getFiltered();
        if (filtered.length > 0 && activeIndexRef.current < filtered.length) {
          const cmd = filtered[activeIndexRef.current]!;
          close();
          onExecuteRef.current(cmd);
        }
        return;
      }

      // Up — move selection up
      if (event.key === "up" && !event.ctrl && !event.meta) {
        const filtered = getFiltered();
        if (filtered.length > 0) {
          activeIndexRef.current = (activeIndexRef.current - 1 + filtered.length) % filtered.length;
          forceUpdate();
        }
        return;
      }

      // Down — move selection down
      if (event.key === "down" && !event.ctrl && !event.meta) {
        const filtered = getFiltered();
        if (filtered.length > 0) {
          activeIndexRef.current = (activeIndexRef.current + 1) % filtered.length;
          forceUpdate();
        }
        return;
      }

      // Backspace — remove last character or close if empty
      if (event.key === "backspace") {
        if (queryRef.current.length === 0) {
          close();
        } else {
          queryRef.current = queryRef.current.slice(0, -1);
          activeIndexRef.current = 0;
          forceUpdate();
        }
        return;
      }

      // Printable character — append to query
      if (event.char && !event.ctrl && !event.meta && event.char.length === 1) {
        queryRef.current += event.char;
        activeIndexRef.current = 0;
        forceUpdate();
      }
    },
    { isActive },
  );

  const filtered = getFiltered();

  // Clamp active index
  if (activeIndexRef.current >= filtered.length && filtered.length > 0) {
    activeIndexRef.current = filtered.length - 1;
  }

  return {
    isOpen: isOpenRef.current,
    query: queryRef.current,
    filtered,
    activeIndex: activeIndexRef.current,
    open,
    close,
  };
}
