/**
 * Digits — large styled number and letter display using 3x5 block characters.
 *
 * Renders digits, colons, periods, dashes, spaces, and uppercase letters
 * (A-Z) as 3-char-wide, 5-row-tall glyphs using Unicode block characters
 * (█, ▄, ▀, space).
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import type { StormTextStyleProps } from "../styles/styleProps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface DigitsProps extends StormTextStyleProps {
  /** String of digits, colons, periods, dashes, spaces, or letters to display */
  value: string;
}

// Each glyph is 5 rows of 3-character strings
const FONT: Record<string, [string, string, string, string, string]> = {
  "0": ["███", "█ █", "█ █", "█ █", "███"],
  "1": [" █ ", "██ ", " █ ", " █ ", "███"],
  "2": ["███", "  █", "███", "█  ", "███"],
  "3": ["███", "  █", "███", "  █", "███"],
  "4": ["█ █", "█ █", "███", "  █", "  █"],
  "5": ["███", "█  ", "███", "  █", "███"],
  "6": ["███", "█  ", "███", "█ █", "███"],
  "7": ["███", "  █", "  █", "  █", "  █"],
  "8": ["███", "█ █", "███", "█ █", "███"],
  "9": ["███", "█ █", "███", "  █", "███"],
  ":": ["   ", " ▄ ", "   ", " ▄ ", "   "],
  ".": ["   ", "   ", "   ", "   ", " ▄ "],
  "-": ["   ", "   ", "███", "   ", "   "],
  " ": ["   ", "   ", "   ", "   ", "   "],
  "!": [" █ ", " █ ", " █ ", "   ", " █ "],
  "?": ["███", "  █", " ██", "   ", " █ "],

  // A-Z uppercase letters (3x5 block font)
  "A": ["███", "█ █", "███", "█ █", "█ █"],
  "B": ["██ ", "█ █", "██ ", "█ █", "██ "],
  "C": ["███", "█  ", "█  ", "█  ", "███"],
  "D": ["██ ", "█ █", "█ █", "█ █", "██ "],
  "E": ["███", "█  ", "██ ", "█  ", "███"],
  "F": ["███", "█  ", "██ ", "█  ", "█  "],
  "G": ["███", "█  ", "█ █", "█ █", "███"],
  "H": ["█ █", "█ █", "███", "█ █", "█ █"],
  "I": ["███", " █ ", " █ ", " █ ", "███"],
  "J": ["███", "  █", "  █", "█ █", "███"],
  "K": ["█ █", "█ █", "██ ", "█ █", "█ █"],
  "L": ["█  ", "█  ", "█  ", "█  ", "███"],
  "M": ["█ █", "███", "███", "█ █", "█ █"],
  "N": ["█ █", "███", "███", "█ █", "█ █"],
  "O": ["███", "█ █", "█ █", "█ █", "███"],
  "P": ["███", "█ █", "███", "█  ", "█  "],
  "Q": ["███", "█ █", "█ █", "███", "  █"],
  "R": ["███", "█ █", "██ ", "█ █", "█ █"],
  "S": ["███", "█  ", "███", "  █", "███"],
  "T": ["███", " █ ", " █ ", " █ ", " █ "],
  "U": ["█ █", "█ █", "█ █", "█ █", "███"],
  "V": ["█ █", "█ █", "█ █", "█ █", " █ "],
  "W": ["█ █", "█ █", "███", "███", "█ █"],
  "X": ["█ █", "█ █", " █ ", "█ █", "█ █"],
  "Y": ["█ █", "█ █", " █ ", " █ ", " █ "],
  "Z": ["███", "  █", " █ ", "█  ", "███"],
};

export const Digits = React.memo(function Digits(rawProps: DigitsProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Digits", rawProps as unknown as Record<string, unknown>) as unknown as DigitsProps;
  const { value, color = colors.brand.primary, bold: boldProp, dim } = props;

  // Normalize to uppercase for letter lookup
  const chars = value.toUpperCase().split("");
  const rows: React.ReactElement[] = [];

  for (let row = 0; row < 5; row++) {
    let line = "";
    for (let i = 0; i < chars.length; i++) {
      const glyph = FONT[chars[i]!];
      if (glyph) {
        if (i > 0) line += " ";
        line += glyph[row];
      }
    }
    rows.push(
      React.createElement("tui-text", { key: `row-${row}`, color, ...(boldProp !== undefined ? { bold: boldProp } : {}), ...(dim !== undefined ? { dim } : {}) }, line),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    ...rows,
  );
});
