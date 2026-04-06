
import React, { useRef } from "react";
import { Box } from "../../components/core/Box.js";
import { Text } from "../../components/core/Text.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { getTreeSitter, type TreeSitterToken } from "../../utils/tree-sitter.js";
import { wasmTokenizeLine, isWasmTokenizerAvailable } from "../../core/wasm-tokenizer.js";
import { usePersonality } from "../../core/personality.js";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import type { StormColors } from "../../theme/colors.js";
import {
  EMPTY_SET,
  getLanguageDef,
  type InternalLanguageDef,
  type LanguageDef,
} from "./syntax-languages.js";
export type { LanguageDef } from "./syntax-languages.js";
export { registerLanguage, getLanguage, getSupportedLanguages } from "./syntax-languages.js";

export interface SyntaxHighlightProps {
  code: string;
  language?: string;
  width?: number;
  /** Visible height in lines. When set, wraps in ScrollView for native scrolling. */
  height?: number;
}

type TokenKind = "comment" | "string" | "keyword" | "number" | "type" | "operator" | "plain" | "tag" | "preprocessor";

interface Token {
  kind: TokenKind;
  text: string;
}

type MultilineState =
  | { type: "none" }
  | { type: "block-comment"; closer: string }          // /* */ or <!-- -->
  | { type: "multiline-string"; closer: string }       // """ or '''
  | { type: "template-literal"; braceDepth: number };  // backtick with ${} tracking

const RE_PREPROCESSOR = /^#\s*\w/;
const RE_NUMBER = /^(?:0[xXoObB])?[0-9][0-9a-fA-F_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?/;
const RE_JSX_OPEN = /^<([A-Z][A-Za-z0-9_$.]*)/;
const RE_JSX_CLOSE = /^<\/([A-Za-z][A-Za-z0-9_$.]*)/;
const RE_WORD = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const RE_OPERATOR = /^(?:=>|!==|===|!=|==|<=|>=|&&|\|\||[+\-*/%=<>!&|^~?:])/;
const RE_JSON_NUMBER = /^-?[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?/;
const RE_JSON_BOOL = /^(?:true|false|null)\b/;

interface TokenRef {
  kind: TokenKind;
  start: number;
  end: number;
}

/** Convert index-based TokenRefs into materialized Tokens. */
function materializeTokens(line: string, refs: TokenRef[]): Token[] {
  const tokens: Token[] = new Array(refs.length);
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]!;
    tokens[i] = { kind: ref.kind, text: line.slice(ref.start, ref.end) };
  }
  return tokens;
}

const CC_BACKTICK = 96;    // `
const CC_BACKSLASH = 92;   // \
const CC_DOLLAR = 36;      // $
const CC_LBRACE = 123;     // {
const CC_RBRACE = 125;     // }
const CC_DQUOTE = 34;      // "
const CC_SQUOTE = 39;      // '
const CC_HASH = 35;        // #
const CC_LT = 60;          // <
const CC_SLASH = 47;       // /
const CC_GT = 62;          // >
const CC_0 = 48;           // 0
const CC_9 = 57;           // 9
const CC_A = 65;
const CC_Z = 90;
const CC_a = 97;
const CC_z = 122;
const CC_UNDERSCORE = 95;  // _

/** Check if charCode starts an identifier. */
function isIdentStart(cc: number): boolean {
  return (cc >= CC_A && cc <= CC_Z) || (cc >= CC_a && cc <= CC_z) || cc === CC_UNDERSCORE || cc === CC_DOLLAR;
}

/** Check if charCode continues an identifier. */
function isIdentCont(cc: number): boolean {
  return isIdentStart(cc) || (cc >= CC_0 && cc <= CC_9);
}

/** Check if charCode is a digit. */
function isDigit(cc: number): boolean {
  return cc >= CC_0 && cc <= CC_9;
}

/** Fast check: does `line` at `pos` start with `prefix`? */
function startsWithAt(line: string, pos: number, prefix: string): boolean {
  if (pos + prefix.length > line.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (line.charCodeAt(pos + i) !== prefix.charCodeAt(i)) return false;
  }
  return true;
}

/** Fast word extraction: read identifier at pos, return end index (or pos if not an identifier). */
function readWord(line: string, pos: number): number {
  if (pos >= line.length) return pos;
  const cc = line.charCodeAt(pos);
  if (!isIdentStart(cc)) return pos;
  let end = pos + 1;
  while (end < line.length && isIdentCont(line.charCodeAt(end))) {
    end++;
  }
  return end;
}

function tokenizeLine(
  line: string,
  langDef: InternalLanguageDef,
  state: MultilineState,
): { tokens: Token[]; state: MultilineState } {
  const refs: TokenRef[] = [];
  let pos = 0;
  const len = line.length;

  // --- Handle continuing multiline constructs from previous lines ---

  if (state.type === "block-comment") {
    const closeIdx = line.indexOf(state.closer);
    if (closeIdx === -1) {
      refs.push({ kind: "comment", start: 0, end: len });
      return { tokens: materializeTokens(line, refs), state };
    }
    const endPos = closeIdx + state.closer.length;
    refs.push({ kind: "comment", start: 0, end: endPos });
    pos = endPos;
    state = { type: "none" };
  } else if (state.type === "multiline-string") {
    const closeIdx = line.indexOf(state.closer);
    if (closeIdx === -1) {
      refs.push({ kind: "string", start: 0, end: len });
      return { tokens: materializeTokens(line, refs), state };
    }
    const endPos = closeIdx + state.closer.length;
    refs.push({ kind: "string", start: 0, end: endPos });
    pos = endPos;
    state = { type: "none" };
  } else if (state.type === "template-literal") {
    const result = tokenizeTemplateLiteralContinuation(line, pos, langDef, state.braceDepth);
    refs.push(...result.refs);
    pos = result.pos;
    state = result.state;
    if (pos >= len) {
      return { tokens: materializeTokens(line, refs), state };
    }
  }

  // --- Special handling for Markdown ---
  const isMarkdownLang = langDef === getLanguageDef("md");
  if (isMarkdownLang || (langDef.keywords === EMPTY_SET && langDef.lineComment.length === 0 && langDef.blockCommentOpen === "" && langDef.stringChars.length === 0)) {
    if (langDef.stringChars.length === 0 && langDef.lineComment.length === 0) {
      const rest = line.slice(pos);
      const mdTokens = tokenizeMarkdown(rest);
      // Markdown tokenizer returns Token[] — pass through directly
      const existingTokens = materializeTokens(line, refs);
      existingTokens.push(...mdTokens);
      return { tokens: existingTokens, state };
    }
  }

  // --- Pre-extract first charCodes for line comment prefixes ---
  const lcFirstCodes: number[] = new Array(langDef.lineComment.length);
  for (let i = 0; i < langDef.lineComment.length; i++) {
    lcFirstCodes[i] = langDef.lineComment[i]!.charCodeAt(0);
  }
  const blockOpenFirstCode = langDef.blockCommentOpen ? langDef.blockCommentOpen.charCodeAt(0) : -1;
  const stringCharCodes: number[] = new Array(langDef.stringChars.length);
  for (let i = 0; i < langDef.stringChars.length; i++) {
    stringCharCodes[i] = langDef.stringChars[i]!.charCodeAt(0);
  }
  const mlDelimFirstCodes: number[] = new Array(langDef.multilineStringDelims.length);
  for (let i = 0; i < langDef.multilineStringDelims.length; i++) {
    mlDelimFirstCodes[i] = langDef.multilineStringDelims[i]!.charCodeAt(0);
  }

  // --- Main single-line tokenization ---

  while (pos < len) {
    const cc = line.charCodeAt(pos);

    // Preprocessor directives (C/C++)
    if (langDef.hasPreprocessor && cc === CC_HASH) {
      // Only need to slice+match if first char matches
      const remaining = line.slice(pos);
      if (RE_PREPROCESSOR.test(remaining)) {
        refs.push({ kind: "preprocessor", start: pos, end: len });
        pos = len;
        break;
      }
    }

    // Block comment open — check first char fast
    if (langDef.blockCommentOpen && cc === blockOpenFirstCode && startsWithAt(line, pos, langDef.blockCommentOpen)) {
      const closeIdx = line.indexOf(langDef.blockCommentClose, pos + langDef.blockCommentOpen.length);
      if (closeIdx !== -1) {
        const endPos = closeIdx + langDef.blockCommentClose.length;
        refs.push({ kind: "comment", start: pos, end: endPos });
        pos = endPos;
        continue;
      }
      refs.push({ kind: "comment", start: pos, end: len });
      pos = len;
      state = { type: "block-comment", closer: langDef.blockCommentClose };
      break;
    }

    // Line comments — check first char fast
    let foundLineComment = false;
    for (let i = 0; i < langDef.lineComment.length; i++) {
      if (cc === lcFirstCodes[i] && startsWithAt(line, pos, langDef.lineComment[i]!)) {
        refs.push({ kind: "comment", start: pos, end: len });
        pos = len;
        foundLineComment = true;
        break;
      }
    }
    if (foundLineComment) break;

    // Multiline string delimiters (Python """ and ''')
    let foundMultilineString = false;
    for (let i = 0; i < langDef.multilineStringDelims.length; i++) {
      if (cc === mlDelimFirstCodes[i] && startsWithAt(line, pos, langDef.multilineStringDelims[i]!)) {
        const delim = langDef.multilineStringDelims[i]!;
        const closeIdx = line.indexOf(delim, pos + delim.length);
        if (closeIdx !== -1) {
          const endPos = closeIdx + delim.length;
          refs.push({ kind: "string", start: pos, end: endPos });
          pos = endPos;
        } else {
          refs.push({ kind: "string", start: pos, end: len });
          pos = len;
          state = { type: "multiline-string", closer: delim };
        }
        foundMultilineString = true;
        break;
      }
    }
    if (foundMultilineString) continue;

    // Template literals (JS/TS)
    if (langDef.hasTemplateLiterals && cc === CC_BACKTICK) {
      const result = tokenizeTemplateLiteral(line, pos, langDef);
      refs.push(...result.refs);
      pos = result.pos;
      state = result.state;
      continue;
    }

    // Regular strings — check charCode against string delimiters
    let foundString = false;
    for (let i = 0; i < langDef.stringChars.length; i++) {
      if (cc === stringCharCodes[i]) {
        const endIdx = findStringEnd(line, pos + 1, langDef.stringChars[i]!);
        refs.push({ kind: "string", start: pos, end: endIdx });
        pos = endIdx;
        foundString = true;
        break;
      }
    }
    if (foundString) continue;

    // Numbers — check first char is digit before regex
    if (isDigit(cc)) {
      const numEnd = matchNumber(line, pos);
      if (numEnd !== -1) {
        refs.push({ kind: "number", start: pos, end: numEnd });
        pos = numEnd;
        continue;
      }
    }
    // JSX tag detection (for jsx/tsx languages)
    if (langDef.jsxAware && cc === CC_LT) {
      const remaining = line.slice(pos);
      // Opening tag: <ComponentName or <div
      const jsxOpenMatch = remaining.match(RE_JSX_OPEN);
      if (jsxOpenMatch) {
        refs.push({ kind: "operator", start: pos, end: pos + 1 });
        refs.push({ kind: "tag", start: pos + 1, end: pos + jsxOpenMatch[0].length });
        pos += jsxOpenMatch[0].length;
        continue;
      }
      // Closing tag: </ComponentName> or </div>
      const jsxCloseMatch = remaining.match(RE_JSX_CLOSE);
      if (jsxCloseMatch) {
        refs.push({ kind: "operator", start: pos, end: pos + 2 });
        refs.push({ kind: "tag", start: pos + 2, end: pos + jsxCloseMatch[0].length });
        pos += jsxCloseMatch[0].length;
        continue;
      }
    }
    // Self-closing /> in JSX
    if (langDef.jsxAware && cc === CC_SLASH && pos + 1 < len && line.charCodeAt(pos + 1) === CC_GT) {
      refs.push({ kind: "operator", start: pos, end: pos + 2 });
      pos += 2;
      continue;
    }

    // Words (keywords, types, identifiers) — use fast readWord
    if (isIdentStart(cc)) {
      const wordEnd = readWord(line, pos);
      if (wordEnd > pos) {
        const word = line.slice(pos, wordEnd);
        refs.push({ kind: classifyWord(word, cc, langDef), start: pos, end: wordEnd });
        pos = wordEnd;
        continue;
      }
    }

    // Operators — only slice+regex when first char looks like an operator
    if (isOperatorChar(cc)) {
      const opEnd = matchOperator(line, pos);
      if (opEnd !== -1) {
        refs.push({ kind: "operator", start: pos, end: opEnd });
        pos = opEnd;
        continue;
      }
    }

    // Single character plain text
    refs.push({ kind: "plain", start: pos, end: pos + 1 });
    pos += 1;
  }

  return { tokens: materializeTokens(line, refs), state };
}

/** Classify an identifier word as keyword, type, or plain. */
function classifyWord(word: string, firstCharCode: number, langDef: InternalLanguageDef): TokenKind {
  const lookupWord = langDef.caseInsensitiveKeywords ? word.toLowerCase() : word;
  if (langDef.keywords.has(lookupWord)) {
    return "keyword";
  } else if (langDef.typeKeywords.has(lookupWord)) {
    return "type";
  } else if (firstCharCode >= CC_A && firstCharCode <= CC_Z) {
    return "type";
  }
  return "plain";
}

/** Try to match a number at `pos`. Returns end index or -1 if no match. */
function matchNumber(line: string, pos: number): number {
  const remaining = line.slice(pos);
  const numMatch = remaining.match(RE_NUMBER);
  if (numMatch) {
    const prevCC = pos > 0 ? line.charCodeAt(pos - 1) : 32; // space
    if (!isIdentCont(prevCC)) {
      return pos + numMatch[0].length;
    }
  }
  return -1;
}

/** Try to match an operator at `pos`. Returns end index or -1 if no match. */
function matchOperator(line: string, pos: number): number {
  const remaining = line.slice(pos);
  const opMatch = remaining.match(RE_OPERATOR);
  if (opMatch) {
    return pos + opMatch[0].length;
  }
  return -1;
}

/** Check if a charCode could be the start of an operator. */
function isOperatorChar(cc: number): boolean {
  // => ! = < > & | + - * / % ^ ~ ? :
  return cc === 61 /* = */ || cc === 33 /* ! */ || cc === CC_LT || cc === CC_GT ||
         cc === 38 /* & */ || cc === 124 /* | */ || cc === 43 /* + */ || cc === 45 /* - */ ||
         cc === 42 /* * */ || cc === CC_SLASH || cc === 37 /* % */ || cc === 94 /* ^ */ ||
         cc === 126 /* ~ */ || cc === 63 /* ? */ || cc === 58 /* : */;
}

/** Find end of a single-line string (handling backslash escapes). */
function findStringEnd(line: string, start: number, quote: string): number {
  let i = start;
  while (i < line.length) {
    if (line[i] === "\\") {
      i += 2; // skip escaped char
      continue;
    }
    if (line[i] === quote) {
      return i + 1;
    }
    i++;
  }
  return line.length; // unterminated string — highlight to end of line
}

/** Tokenize from inside a template literal when entering from a previous line. */
function tokenizeTemplateLiteralContinuation(
  line: string,
  startPos: number,
  langDef: InternalLanguageDef,
  braceDepth: number,
): { refs: TokenRef[]; pos: number; state: MultilineState } {
  const refs: TokenRef[] = [];
  let pos = startPos;
  const len = line.length;

  if (braceDepth > 0) {
    const result = tokenizeInterpolationRefs(line, pos, langDef, braceDepth);
    refs.push(...result.refs);
    pos = result.pos;
    if (result.stillInInterpolation) {
      return { refs, pos: len, state: { type: "template-literal", braceDepth: result.braceDepth } };
    }
  }

  let strStart = pos;

  while (pos < len) {
    const cc = line.charCodeAt(pos);

    if (cc === CC_BACKSLASH) {
      pos += 2;
      continue;
    }
    if (cc === CC_BACKTICK) {
      pos++;
      refs.push({ kind: "string", start: strStart, end: pos });
      return { refs, pos, state: { type: "none" } };
    }
    if (cc === CC_DOLLAR && pos + 1 < len && line.charCodeAt(pos + 1) === CC_LBRACE) {
      if (pos > strStart) {
        refs.push({ kind: "string", start: strStart, end: pos });
      }
      refs.push({ kind: "string", start: pos, end: pos + 2 });
      pos += 2;
      const result = tokenizeInterpolationRefs(line, pos, langDef, 1);
      refs.push(...result.refs);
      pos = result.pos;
      if (result.stillInInterpolation) {
        return { refs, pos: len, state: { type: "template-literal", braceDepth: result.braceDepth } };
      }
      strStart = pos;
      continue;
    }
    pos++;
  }

  if (pos > strStart) {
    refs.push({ kind: "string", start: strStart, end: pos });
  }
  return { refs, pos, state: { type: "template-literal", braceDepth: 0 } };
}

/** Tokenize a template literal starting at the backtick. */
function tokenizeTemplateLiteral(
  line: string,
  startPos: number,
  langDef: InternalLanguageDef,
): { refs: TokenRef[]; pos: number; state: MultilineState } {
  const refs: TokenRef[] = [];
  let pos = startPos + 1; // skip opening backtick
  let strStart = startPos;
  const len = line.length;

  while (pos < len) {
    const cc = line.charCodeAt(pos);

    if (cc === CC_BACKSLASH) {
      pos += 2;
      continue;
    }
    if (cc === CC_BACKTICK) {
      pos++;
      refs.push({ kind: "string", start: strStart, end: pos });
      return { refs, pos, state: { type: "none" } };
    }
    if (cc === CC_DOLLAR && pos + 1 < len && line.charCodeAt(pos + 1) === CC_LBRACE) {
      refs.push({ kind: "string", start: strStart, end: pos });
      refs.push({ kind: "string", start: pos, end: pos + 2 });
      pos += 2;
      const result = tokenizeInterpolationRefs(line, pos, langDef, 1);
      refs.push(...result.refs);
      pos = result.pos;
      if (result.stillInInterpolation) {
        return { refs, pos: len, state: { type: "template-literal", braceDepth: result.braceDepth } };
      }
      strStart = pos;
      continue;
    }
    pos++;
  }

  if (strStart < len) {
    refs.push({ kind: "string", start: strStart, end: len });
  }
  return { refs, pos, state: { type: "template-literal", braceDepth: 0 } };
}

/** Tokenize inside a ${...} interpolation. Returns index-based TokenRefs. */
function tokenizeInterpolationRefs(
  line: string,
  startPos: number,
  langDef: InternalLanguageDef,
  initialDepth: number,
): { refs: TokenRef[]; pos: number; stillInInterpolation: boolean; braceDepth: number } {
  const refs: TokenRef[] = [];
  let pos = startPos;
  let depth = initialDepth;
  const len = line.length;

  while (pos < len) {
    const cc = line.charCodeAt(pos);

    if (cc === CC_LBRACE) {
      depth++;
      refs.push({ kind: "plain", start: pos, end: pos + 1 });
      pos++;
      continue;
    }
    if (cc === CC_RBRACE) {
      depth--;
      if (depth === 0) {
        refs.push({ kind: "string", start: pos, end: pos + 1 });
        pos++;
        return { refs, pos, stillInInterpolation: false, braceDepth: 0 };
      }
      refs.push({ kind: "plain", start: pos, end: pos + 1 });
      pos++;
      continue;
    }

    // Strings inside interpolation
    if (cc === CC_DQUOTE || cc === CC_SQUOTE) {
      const ch = line[pos]!;
      const endIdx = findStringEnd(line, pos + 1, ch);
      refs.push({ kind: "string", start: pos, end: endIdx });
      pos = endIdx;
      continue;
    }

    // Numbers — fast charCode check first
    if (isDigit(cc)) {
      const numEnd = matchNumber(line, pos);
      if (numEnd !== -1) {
        refs.push({ kind: "number", start: pos, end: numEnd });
        pos = numEnd;
        continue;
      }
    }

    // Words — fast charCode check
    if (isIdentStart(cc)) {
      const wordEnd = readWord(line, pos);
      if (wordEnd > pos) {
        const word = line.slice(pos, wordEnd);
        refs.push({ kind: classifyWord(word, cc, langDef), start: pos, end: wordEnd });
        pos = wordEnd;
        continue;
      }
    }

    // Operators — fast charCode check
    if (isOperatorChar(cc)) {
      const opEnd = matchOperator(line, pos);
      if (opEnd !== -1) {
        refs.push({ kind: "operator", start: pos, end: opEnd });
        pos = opEnd;
        continue;
      }
    }

    refs.push({ kind: "plain", start: pos, end: pos + 1 });
    pos++;
  }

  return { refs, pos, stillInInterpolation: true, braceDepth: depth };
}

/** Tokenize a line as Markdown. */
function tokenizeMarkdown(line: string): Token[] {
  const tokens: Token[] = [];

  // Heading
  const headingMatch = line.match(/^(#{1,6}\s+)(.*)/);
  if (headingMatch) {
    tokens.push({ kind: "keyword", text: headingMatch[1]! });
    tokens.push({ kind: "plain", text: headingMatch[2]! });
    return tokens;
  }

  let pos = 0;
  while (pos < line.length) {
    const remaining = line.slice(pos);

    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push({ kind: "string", text: codeMatch[0] });
      pos += codeMatch[0].length;
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/) ?? remaining.match(/^__([^_]+)__/);
    if (boldMatch) {
      tokens.push({ kind: "keyword", text: boldMatch[0] });
      pos += boldMatch[0].length;
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/) ?? remaining.match(/^_([^_]+)_/);
    if (italicMatch) {
      tokens.push({ kind: "type", text: italicMatch[0] });
      pos += italicMatch[0].length;
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push({ kind: "string", text: linkMatch[0] });
      pos += linkMatch[0].length;
      continue;
    }

    tokens.push({ kind: "plain", text: line[pos]! });
    pos++;
  }

  return tokens;
}

/** Tokenize JSON specifically — keys vs values. */
function tokenizeJSON(line: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < line.length) {
    const remaining = line.slice(pos);

    // String (could be key or value)
    if (remaining[0] === '"') {
      const endIdx = findStringEnd(line, pos + 1, '"');
      const text = line.slice(pos, endIdx);
      // Check if followed by `:` (after whitespace) — that makes it a key
      const afterStr = line.slice(endIdx).trimStart();
      if (afterStr.startsWith(":")) {
        tokens.push({ kind: "keyword", text });
      } else {
        tokens.push({ kind: "string", text });
      }
      pos = endIdx;
      continue;
    }

    // Numbers
    const numMatch = remaining.match(RE_JSON_NUMBER);
    if (numMatch) {
      tokens.push({ kind: "number", text: numMatch[0] });
      pos += numMatch[0].length;
      continue;
    }

    // Booleans/null
    const boolMatch = remaining.match(RE_JSON_BOOL);
    if (boolMatch) {
      tokens.push({ kind: "keyword", text: boolMatch[0] });
      pos += boolMatch[0].length;
      continue;
    }

    // Structural chars
    if ("{}[]:,".includes(remaining[0]!)) {
      tokens.push({ kind: "operator", text: remaining[0]! });
      pos++;
      continue;
    }

    tokens.push({ kind: "plain", text: remaining[0]! });
    pos++;
  }

  return tokens;
}

function mapTreeSitterType(tsType: TreeSitterToken["type"]): TokenKind {
  switch (tsType) {
    case "keyword": return "keyword";
    case "string": return "string";
    case "comment": return "comment";
    case "number": return "number";
    case "operator": return "operator";
    case "function": return "type"; // rendered with type color (function color lives in colors.syntax.function but TokenKind has no "function")
    case "type": return "type";
    case "variable": return "plain";
    case "tag": return "tag";
    case "attribute": return "keyword";
    case "punctuation": return "operator";
    case "plain": return "plain";
    default: return "plain";
  }
}

/**
 * Attempt tokenization via tree-sitter. Returns null if tree-sitter is
 * not available or doesn't support the requested language, signalling
 * the caller to fall back to the regex tokenizer.
 */
function tokenizeWithTreeSitter(code: string, language: string): Token[] | null {
  const ts = getTreeSitter();
  if (!ts) return null;

  const lang = language.toLowerCase();
  if (!ts.isLanguageAvailable(lang)) return null;

  const tsTokens = ts.tokenize(code, lang);
  // tree-sitter returns empty array when language WASM hasn't been loaded yet
  if (tsTokens.length === 0) return null;

  const tokens: Token[] = [];
  let lastEnd = 0;

  for (const t of tsTokens) {
    // Fill gaps (whitespace not covered by AST leaves)
    if (t.startIndex > lastEnd) {
      tokens.push({ kind: "plain", text: code.slice(lastEnd, t.startIndex) });
    }
    tokens.push({ kind: mapTreeSitterType(t.type), text: t.text });
    lastEnd = t.endIndex;
  }

  // Trailing text after last token
  if (lastEnd < code.length) {
    tokens.push({ kind: "plain", text: code.slice(lastEnd) });
  }

  return tokens;
}

function tokenize(code: string, language: string): Token[] {
  // Try tree-sitter first — transparent upgrade when available
  const tsResult = tokenizeWithTreeSitter(code, language);
  if (tsResult) return tsResult;

  // Try WASM tokenizer — fast DFA-based, falls back silently
  if (isWasmTokenizerAvailable()) {
    const lang = language.toLowerCase();
    const lines = code.split("\n");
    const allTokens: Token[] = [];
    let allWasm = true;
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) allTokens.push({ kind: "plain", text: "\n" });
      const wasmResult = wasmTokenizeLine(lines[i]!, lang);
      if (wasmResult) {
        allTokens.push(...wasmResult);
      } else {
        allWasm = false;
        break;
      }
    }
    if (allWasm) return allTokens;
  }

  const lang = language.toLowerCase();
  const lines = code.split("\n");
  const allTokens: Token[] = [];

  // Special handling for JSON and Markdown — they don't use the standard
  // langDef pipeline but their state doesn't carry across lines in meaningful ways.
  const isJSON = lang === "json" || lang === "jsonc";
  const isMarkdown = lang === "markdown" || lang === "md";

  if (isJSON) {
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) allTokens.push({ kind: "plain", text: "\n" });
      const lineTokens = tokenizeJSON(lines[i]!);
      allTokens.push(...lineTokens);
    }
    return allTokens;
  }

  if (isMarkdown) {
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) allTokens.push({ kind: "plain", text: "\n" });
      const lineTokens = tokenizeMarkdown(lines[i]!);
      allTokens.push(...lineTokens);
    }
    return allTokens;
  }

  const langDef = getLanguageDef(lang);
  let state: MultilineState = { type: "none" };

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      allTokens.push({ kind: "plain", text: "\n" });
    }
    const result = tokenizeLine(lines[i]!, langDef, state);
    allTokens.push(...result.tokens);
    state = result.state;
  }

  return allTokens;
}

const TOKEN_STYLES: Record<TokenKind, { color?: (s: StormColors["syntax"]) => string; bold?: boolean; dim?: boolean }> = {
  comment:      { color: (s) => s.comment, dim: true },
  string:       { color: (s) => s.string },
  keyword:      { color: (s) => s.keyword, bold: true },
  number:       { color: (s) => s.number },
  type:         { color: (s) => s.type },
  operator:     { color: (s) => s.operator },
  preprocessor: { color: (s) => s.keyword, bold: true },
  tag:          { color: (s) => s.keyword },
  plain:        {},
};

function renderToken(token: Token, idx: number, colors: StormColors): React.ReactElement {
  const style = TOKEN_STYLES[token.kind];
  const props: Record<string, unknown> = { key: idx };
  if (style.color) props.color = style.color(colors.syntax);
  if (style.bold) props.bold = true;
  if (style.dim) props.dim = true;
  return React.createElement(Text, props, token.text);
}

function renderLine(lineTokens: Token[], lineIdx: number, colors: StormColors): React.ReactElement {
  const children = lineTokens.map((t, i) => renderToken(t, i, colors));
  return React.createElement(Text, { key: lineIdx }, ...children);
}

export const SyntaxHighlight = React.memo(function SyntaxHighlight(rawProps: SyntaxHighlightProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("SyntaxHighlight", rawProps);
  const { code, language = "js", width, height: visibleHeight } = props;

  const tokenCacheRef = useRef<{ code: string; lang: string; tokens: Token[] } | null>(null);
  let tokens: Token[];
  if (tokenCacheRef.current?.code === code && tokenCacheRef.current?.lang === language) {
    tokens = tokenCacheRef.current.tokens;
  } else {
    tokens = tokenize(code, language);
    tokenCacheRef.current = { code, lang: language, tokens };
  }

  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push([]);
      }
      const text = parts[i];
      if (text !== undefined && text.length > 0) {
        const current = lines[lines.length - 1];
        if (current) {
          current.push({ kind: token.kind, text });
        }
      }
    }
  }

  const lineElements = lines.map((lt, i) =>
    lt.length > 0 ? renderLine(lt, i, colors) : React.createElement(Text, { key: i }, " "),
  );

  const boxProps: Record<string, unknown> = { flexDirection: "column" as const };
  if (width !== undefined) boxProps["width"] = width;

  const content = React.createElement(Box, boxProps, ...lineElements);

  // When height is set, wrap in ScrollView for native scrolling
  if (visibleHeight !== undefined) {
    return React.createElement(ScrollView, { height: visibleHeight }, content);
  }

  return content;
});
