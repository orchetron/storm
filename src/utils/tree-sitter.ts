export interface TreeSitterTokenizer {
  tokenize(code: string, language: string): TreeSitterToken[];
  isLanguageAvailable(language: string): boolean;
  loadLanguage(language: string): Promise<boolean>;
}

export interface TreeSitterToken {
  type:
    | "keyword"
    | "string"
    | "comment"
    | "number"
    | "operator"
    | "function"
    | "type"
    | "variable"
    | "tag"
    | "attribute"
    | "punctuation"
    | "plain";
  text: string;
  startIndex: number;
  endIndex: number;
}

let treeSitterInstance: TreeSitterTokenizer | null = null;

/**
 * Return the active tree-sitter tokenizer, or `null` if tree-sitter
 * has not been enabled (or failed to load).
 */
export function getTreeSitter(): TreeSitterTokenizer | null {
  return treeSitterInstance;
}

/**
 * Attempt to load tree-sitter at runtime.
 *
 * If `web-tree-sitter` is not installed this is a safe no-op — the
 * regex tokenizer remains in use.
 */
export async function enableTreeSitter(): Promise<void> {
  if (treeSitterInstance) return; // already loaded

  try {
    // Dynamic import — only resolved when the user calls this function.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // @ts-ignore -- web-tree-sitter is an optional peer dependency
    const ParserModule = await import("web-tree-sitter");
    // web-tree-sitter exports either { default: Parser } or Parser directly
    // depending on bundler/CJS vs ESM.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    // Dynamic import boundary — web-tree-sitter has no stable type export
    const Parser: { init: () => Promise<void> } =
      (ParserModule as unknown as { default?: { init: () => Promise<void> } }).default ?? (ParserModule as { init: () => Promise<void> });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await Parser.init();
    treeSitterInstance = createTreeSitterTokenizer(Parser);
  } catch {
    // tree-sitter not available — fall back to regex tokenizer.
    // This is expected and not an error.
  }
}

const languageMap: Record<string, string> = {
  javascript: "javascript",
  js: "javascript",
  jsx: "javascript",
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  python: "python",
  py: "python",
  rust: "rust",
  rs: "rust",
  go: "go",
  golang: "go",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  java: "java",
  ruby: "ruby",
  rb: "ruby",
  html: "html",
  css: "css",
  json: "json",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  lua: "lua",
  kotlin: "kotlin",
  kt: "kotlin",
  swift: "swift",
  scala: "scala",
  haskell: "haskell",
  hs: "haskell",
  elixir: "elixir",
  ex: "elixir",
  php: "php",
  r: "r",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  zig: "zig",
  dart: "dart",
  ocaml: "ocaml",
  ml: "ocaml",
};

/** Keywords recognised from tree-sitter AST node types. */
const KEYWORD_NODE_TYPES = new Set([
  "if",
  "else",
  "for",
  "while",
  "return",
  "function",
  "class",
  "const",
  "let",
  "var",
  "import",
  "export",
  "from",
  "async",
  "await",
  "try",
  "catch",
  "throw",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "in",
  "of",
  "switch",
  "case",
  "break",
  "continue",
  "default",
  "do",
  "yield",
  "with",
  "debugger",
  "void",
  "enum",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "super",
  "this",
  "true",
  "false",
  "null",
  "undefined",
  "def",
  "elif",
  "except",
  "finally",
  "lambda",
  "pass",
  "raise",
  "fn",
  "impl",
  "mod",
  "pub",
  "use",
  "mut",
  "ref",
  "struct",
  "trait",
  "match",
  "loop",
  "move",
  "where",
  "type",
  "as",
]);

const OPERATOR_LITERALS = new Set([
  "+", "-", "*", "/", "%",
  "=", "==", "===", "!=", "!==",
  "<", ">", "<=", ">=",
  "&&", "||", "!",
  "&", "|", "^", "~",
  "<<", ">>", ">>>",
  "?", ":", "=>", "->",
  "...", "..",
  "+=", "-=", "*=", "/=", "%=",
]);

const PUNCTUATION_LITERALS = new Set([
  "{", "}", "(", ")", "[", "]", ";", ",", ".",
]);

function classifyNode(node: any): TreeSitterToken["type"] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const type: string = node.type;

  // Comments
  if (type === "comment" || type === "line_comment" || type === "block_comment") {
    return "comment";
  }

  // Strings
  if (
    type === "string" ||
    type === "string_literal" ||
    type === "template_string" ||
    type === "raw_string_literal" ||
    type === "string_content" ||
    type === "escape_sequence"
  ) {
    return "string";
  }

  // Numbers
  if (
    type === "number" ||
    type === "integer" ||
    type === "float" ||
    type === "integer_literal" ||
    type === "float_literal"
  ) {
    return "number";
  }

  // Keywords — both explicit keyword node types and keyword literals
  if (type.includes("keyword") || KEYWORD_NODE_TYPES.has(type)) {
    return "keyword";
  }

  // Type identifiers
  if (type === "type_identifier" || type === "predefined_type" || type === "builtin_type") {
    return "type";
  }

  // Identifiers — classify based on parent context
  if (type === "identifier" && node.parent) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const parentType: string = node.parent.type;
    if (
      parentType === "function_declaration" ||
      parentType === "function_definition" ||
      parentType === "method_definition" ||
      parentType === "call_expression" ||
      parentType === "method_declaration"
    ) {
      return "function";
    }
    if (
      parentType === "type_identifier" ||
      parentType === "type_annotation" ||
      parentType === "type_alias_declaration" ||
      parentType === "interface_declaration" ||
      parentType === "class_declaration"
    ) {
      return "type";
    }
  }

  // Property / field identifiers
  if (type === "property_identifier" || type === "field_identifier") {
    return "variable";
  }

  // JSX / HTML tags
  if (type === "tag_name" || type === "jsx_opening_element" || type === "jsx_closing_element") {
    return "tag";
  }

  // HTML attributes
  if (type === "attribute_name") {
    return "attribute";
  }

  // Operators
  if (OPERATOR_LITERALS.has(type)) {
    return "operator";
  }

  // Punctuation
  if (PUNCTUATION_LITERALS.has(type)) {
    return "punctuation";
  }

  return "plain";
}

function createTreeSitterTokenizer(Parser: any): TreeSitterTokenizer { // WASM boundary — web-tree-sitter has no stable type export
  const loadedParsers = new Map<string, any>(); // WASM boundary — parser instances from web-tree-sitter

  return {
    isLanguageAvailable(language: string): boolean {
      const mapped = languageMap[language.toLowerCase()];
      return mapped !== undefined;
    },

    async loadLanguage(language: string): Promise<boolean> {
      const mapped = languageMap[language.toLowerCase()];
      if (!mapped) return false;
      if (loadedParsers.has(mapped)) return true;

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const parser = new Parser();
        // Attempt to resolve the language WASM from the tree-sitter-<lang> package.
        // Use createRequire for ESM compatibility.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createRequire } = await import("module");
        const req = createRequire(import.meta.url);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const langWasm = await Parser.Language.load(
          req.resolve(`tree-sitter-${mapped}/tree-sitter-${mapped}.wasm`),
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        parser.setLanguage(langWasm);
        loadedParsers.set(mapped, parser);
        return true;
      } catch {
        return false;
      }
    },

    tokenize(code: string, language: string): TreeSitterToken[] {
      const mapped = languageMap[language.toLowerCase()];
      if (!mapped) return [];
      const parser = loadedParsers.get(mapped);
      if (!parser) return [];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const tree = parser.parse(code);
      const tokens: TreeSitterToken[] = [];

      function walk(node: any): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (node.childCount === 0) {
          // Leaf node — classify its type
          const tokenType = classifyNode(node);
          tokens.push({
            type: tokenType,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            text: node.text,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            startIndex: node.startIndex,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            endIndex: node.endIndex,
          });
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          for (let i = 0; i < node.childCount; i++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            walk(node.child(i));
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      walk(tree.rootNode);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      tree.delete();
      return tokens;
    },
  };
}
