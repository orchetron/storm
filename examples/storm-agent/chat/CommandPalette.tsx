/**
 * Storm Agent CLI -- Command palette (slash command dropdown).
 *
 * Styled with accent purple (#8C8CF9).
 */

import React, { useState, useCallback } from "react";
import { CommandDropdown, useTui } from "../../../src/index.js";
import type { CommandItem } from "../../../src/index.js";
import { filterCommands } from "../data/slash-commands.js";

// -- Theme Colors -------------------------------------------------------------

const THEME = {
  accent: "#8C8CF9",
};

export interface CommandPaletteProps {
  inputText: string;
  onSelect: (commandName: string) => void;
  onClose: () => void;
}

export function CommandPalette({
  inputText,
  onSelect,
  onClose,
}: CommandPaletteProps): React.ReactElement {
  const { flushSync } = useTui();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const partial = inputText.startsWith("/") ? inputText.slice(1) : inputText;
  const filtered = filterCommands(partial);

  const items: CommandItem[] = filtered.map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
  }));

  const handleSelect = useCallback(
    (item: CommandItem) => {
      onSelect(item.name);
    },
    [onSelect],
  );

  const handleSelectionChange = useCallback(
    (index: number) => {
      flushSync(() => setSelectedIndex(index));
    },
    [flushSync],
  );

  return (
    <CommandDropdown
      items={items}
      selectedIndex={selectedIndex}
      maxVisible={8}
      highlightColor={THEME.accent}
      isFocused={true}
      onSelect={handleSelect}
      onSelectionChange={handleSelectionChange}
      onClose={onClose}
    />
  );
}
