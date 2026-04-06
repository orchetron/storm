export interface LanguageDef {
  /** Set of language keywords to highlight. */
  keywords: Set<string>;
  /** Set of type-level keywords (e.g. built-in types) highlighted differently. */
  typeKeywords?: Set<string>;
  /** Line comment prefix (e.g. "//"). */
  lineComment?: string;
  /** Block comment opening delimiter (e.g. "\/\*"). */
  blockCommentStart?: string;
  /** Block comment closing delimiter (e.g. "\*\/"). */
  blockCommentEnd?: string;
  /** String delimiter characters (e.g. ['"', "'"]). */
  stringDelimiters?: string[];
  /** Whether the language supports JS/TS-style template literals. */
  hasTemplateLiterals?: boolean;
  /** Multiline string delimiter (e.g. '"""'). */
  multilineStringDelimiter?: string;
  /** Preprocessor directive prefix (e.g. "#"). */
  preprocessorPrefix?: string;
}

export interface InternalLanguageDef {
  keywords: Set<string>;
  typeKeywords: Set<string>;
  lineComment: string[];       // e.g. ["//", "#"]
  blockCommentOpen: string;    // e.g. "/*"
  blockCommentClose: string;   // e.g. "*/"
  multilineStringDelims: string[];  // e.g. ['"""', "'''"]
  hasTemplateLiterals: boolean;
  hasPreprocessor: boolean;
  stringChars: string[];       // e.g. ['"', "'"]
  jsxAware: boolean;           // JSX/TSX tag detection
  /** When true, keyword lookups normalize the word to lowercase before checking the set. */
  caseInsensitiveKeywords: boolean;
}

const JS_KEYWORDS = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
  "false", "finally", "for", "from", "function", "if", "implements", "import",
  "in", "instanceof", "interface", "let", "new", "null", "of", "package",
  "private", "protected", "public", "return", "static", "super", "switch",
  "this", "throw", "true", "try", "type", "typeof", "undefined", "var",
  "void", "while", "with", "yield",
]);

const PYTHON_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
]);

const GO_KEYWORDS = new Set([
  "break", "case", "chan", "const", "continue", "default", "defer", "else",
  "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
  "map", "package", "range", "return", "select", "struct", "switch", "type",
  "var",
]);

const RUST_KEYWORDS = new Set([
  "as", "async", "await", "break", "const", "continue", "crate", "dyn",
  "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in",
  "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return",
  "self", "Self", "static", "struct", "super", "trait", "true", "type",
  "unsafe", "use", "where", "while",
]);

const SHELL_KEYWORDS = new Set([
  "case", "do", "done", "elif", "else", "esac", "fi", "for", "function",
  "if", "in", "select", "then", "until", "while", "echo", "exit", "export",
  "local", "read", "return", "set", "shift", "source", "test", "unset",
]);

const JAVA_KEYWORDS = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
  "class", "const", "continue", "default", "do", "double", "else", "enum",
  "extends", "false", "final", "finally", "float", "for", "goto", "if",
  "implements", "import", "instanceof", "int", "interface", "long", "native",
  "new", "null", "package", "private", "protected", "public", "return",
  "short", "static", "strictfp", "super", "switch", "synchronized", "this",
  "throw", "throws", "transient", "true", "try", "void", "volatile", "while",
]);

const C_KEYWORDS = new Set([
  "auto", "break", "case", "char", "const", "continue", "default", "do",
  "double", "else", "enum", "extern", "float", "for", "goto", "if",
  "inline", "int", "long", "register", "restrict", "return", "short",
  "signed", "sizeof", "static", "struct", "switch", "typedef", "union",
  "unsigned", "void", "volatile", "while",
  // C++ additions
  "alignas", "alignof", "bool", "catch", "class", "constexpr", "decltype",
  "delete", "dynamic_cast", "explicit", "export", "false", "friend",
  "mutable", "namespace", "new", "noexcept", "nullptr", "operator",
  "override", "private", "protected", "public", "reinterpret_cast",
  "static_assert", "static_cast", "template", "this", "throw", "true",
  "try", "typeid", "typename", "using", "virtual",
]);

const RUBY_KEYWORDS = new Set([
  "BEGIN", "END", "alias", "and", "begin", "break", "case", "class", "def",
  "defined?", "do", "else", "elsif", "end", "ensure", "false", "for", "if",
  "in", "module", "next", "nil", "not", "or", "redo", "rescue", "retry",
  "return", "self", "super", "then", "true", "undef", "unless", "until",
  "when", "while", "yield",
]);

const PHP_KEYWORDS = new Set([
  "abstract", "and", "array", "as", "break", "callable", "case", "catch",
  "class", "clone", "const", "continue", "declare", "default", "die", "do",
  "echo", "else", "elseif", "empty", "enddeclare", "endfor", "endforeach",
  "endif", "endswitch", "endwhile", "eval", "exit", "extends", "false",
  "final", "finally", "fn", "for", "foreach", "function", "global", "goto",
  "if", "implements", "include", "include_once", "instanceof", "insteadof",
  "interface", "isset", "list", "match", "namespace", "new", "null", "or",
  "print", "private", "protected", "public", "readonly", "require",
  "require_once", "return", "static", "switch", "throw", "trait", "true",
  "try", "unset", "use", "var", "while", "xor", "yield",
]);

const HTML_KEYWORDS = new Set([
  "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base",
  "bdi", "bdo", "blockquote", "body", "br", "button", "canvas", "caption",
  "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del",
  "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset",
  "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5",
  "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img",
  "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map",
  "mark", "meta", "meter", "nav", "noscript", "object", "ol", "optgroup",
  "option", "output", "p", "param", "picture", "pre", "progress", "q", "rp",
  "rt", "ruby", "s", "samp", "script", "section", "select", "slot", "small",
  "source", "span", "strong", "style", "sub", "summary", "sup", "table",
  "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time",
  "title", "tr", "track", "u", "ul", "var", "video", "wbr",
]);

const CSS_KEYWORDS = new Set([
  "align-content", "align-items", "align-self", "animation", "background",
  "border", "border-radius", "bottom", "box-shadow", "box-sizing", "color",
  "content", "cursor", "display", "flex", "flex-direction", "flex-wrap",
  "float", "font", "font-family", "font-size", "font-weight", "gap", "grid",
  "height", "justify-content", "left", "line-height", "margin", "max-height",
  "max-width", "min-height", "min-width", "opacity", "overflow", "padding",
  "position", "right", "text-align", "text-decoration", "top", "transform",
  "transition", "visibility", "width", "z-index",
  // At-rules and selectors
  "important", "media", "keyframes", "import", "charset", "supports",
]);

const SQL_KEYWORDS = new Set([
  "add", "all", "alter", "and", "any", "as", "asc", "between", "by",
  "case", "check", "column", "constraint", "create", "cross", "database",
  "default", "delete", "desc", "distinct", "drop", "else", "end", "exec",
  "exists", "false", "foreign", "from", "full", "group", "having", "if",
  "in", "index", "inner", "insert", "into", "is", "join", "key", "left",
  "like", "limit", "not", "null", "on", "or", "order", "outer", "primary",
  "references", "right", "rollback", "select", "set", "table", "then",
  "top", "transaction", "true", "truncate", "union", "unique", "update",
  "values", "view", "when", "where", "with",
]);

const YAML_KEYWORDS = new Set([
  "true", "false", "null", "yes", "no", "on", "off",
  "True", "False", "Null", "Yes", "No", "On", "Off",
  "TRUE", "FALSE", "NULL", "YES", "NO", "ON", "OFF",
]);

const DOCKERFILE_KEYWORDS = new Set([
  "ADD", "ARG", "CMD", "COPY", "ENTRYPOINT", "ENV", "EXPOSE", "FROM",
  "HEALTHCHECK", "LABEL", "MAINTAINER", "ONBUILD", "RUN", "SHELL",
  "STOPSIGNAL", "USER", "VOLUME", "WORKDIR",
]);

const LUA_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for",
  "function", "goto", "if", "in", "local", "nil", "not", "or", "repeat",
  "return", "then", "true", "until", "while",
]);

const JS_TYPE_KEYWORDS = new Set([
  "keyof", "infer", "readonly", "abstract", "namespace", "declare",
  "asserts", "is", "out", "override", "satisfies",
]);

export const EMPTY_SET = new Set<string>();

const KOTLIN_KEYWORDS = new Set([
  "abstract", "actual", "annotation", "as", "break", "by", "catch", "class",
  "companion", "const", "constructor", "continue", "crossinline", "data",
  "delegate", "do", "dynamic", "else", "enum", "expect", "external", "false",
  "final", "finally", "for", "fun", "get", "if", "import", "in", "infix",
  "init", "inline", "inner", "interface", "internal", "is", "lateinit",
  "noinline", "null", "object", "open", "operator", "out", "override",
  "package", "private", "protected", "public", "reified", "return", "sealed",
  "set", "super", "suspend", "tailrec", "this", "throw", "true", "try",
  "typealias", "typeof", "val", "var", "vararg", "when", "where", "while",
]);

const SWIFT_KEYWORDS = new Set([
  "Any", "Protocol", "Self", "Type", "actor", "as", "associatedtype", "async",
  "await", "break", "case", "catch", "class", "continue", "convenience",
  "default", "defer", "deinit", "do", "dynamic", "else", "enum", "extension",
  "fallthrough", "false", "fileprivate", "final", "for", "func", "get",
  "guard", "if", "import", "in", "indirect", "infix", "init", "inout",
  "internal", "is", "lazy", "let", "mutating", "nil", "nonmutating", "open",
  "operator", "optional", "override", "postfix", "precedencegroup", "prefix",
  "private", "protocol", "public", "repeat", "required", "rethrows", "return",
  "self", "set", "some", "static", "struct", "subscript", "super", "switch",
  "throw", "throws", "true", "try", "typealias", "unowned", "var", "weak",
  "where", "while", "willSet",
]);

const SCALA_KEYWORDS = new Set([
  "abstract", "case", "catch", "class", "def", "do", "else", "extends",
  "false", "final", "finally", "for", "forSome", "given", "if", "implicit",
  "import", "lazy", "match", "new", "null", "object", "override", "package",
  "private", "protected", "return", "sealed", "super", "this", "throw",
  "trait", "true", "try", "type", "val", "var", "while", "with", "yield",
  "enum", "export", "then", "using",
]);

const HASKELL_KEYWORDS = new Set([
  "as", "case", "class", "data", "default", "deriving", "do", "else",
  "family", "forall", "foreign", "hiding", "if", "import", "in", "infix",
  "infixl", "infixr", "instance", "let", "module", "newtype", "of",
  "qualified", "then", "type", "where",
]);

const ELIXIR_KEYWORDS = new Set([
  "after", "alias", "and", "case", "catch", "cond", "def", "defcallback",
  "defdelegate", "defexception", "defguard", "defimpl", "defmacro",
  "defmacrop", "defmodule", "defoverridable", "defp", "defprotocol",
  "defstruct", "do", "else", "end", "false", "fn", "for", "if", "import",
  "in", "nil", "not", "or", "quote", "raise", "receive", "require",
  "rescue", "true", "try", "unless", "unquote", "use", "when", "with",
]);

const CLOJURE_KEYWORDS = new Set([
  "and", "case", "catch", "comment", "cond", "conj", "cons", "def", "defmacro",
  "defmethod", "defmulti", "defn", "defn-", "defonce", "defprotocol",
  "defrecord", "defstruct", "deftype", "do", "doseq", "dosync", "dotimes",
  "doto", "false", "finally", "fn", "for", "if", "import", "in", "let",
  "letfn", "loop", "map", "merge", "nil", "ns", "or", "println", "quote",
  "recur", "reduce", "refer", "require", "throw", "true", "try", "use",
  "when", "while",
]);

const R_KEYWORDS = new Set([
  "break", "else", "FALSE", "for", "function", "if", "in", "Inf", "library",
  "NA", "NaN", "next", "NULL", "repeat", "require", "return", "source",
  "TRUE", "while",
]);

const PERL_KEYWORDS = new Set([
  "BEGIN", "END", "and", "chomp", "chop", "close", "cmp", "defined", "delete",
  "die", "do", "each", "else", "elsif", "eq", "eval", "exists", "exit",
  "for", "foreach", "ge", "goto", "gt", "if", "keys", "last", "le", "local",
  "lt", "map", "my", "ne", "next", "no", "not", "open", "or", "our",
  "package", "pop", "print", "printf", "push", "redo", "require", "return",
  "reverse", "say", "shift", "sort", "splice", "split", "sub", "substr",
  "unless", "unshift", "until", "use", "values", "warn", "while",
]);

const DART_KEYWORDS = new Set([
  "abstract", "as", "assert", "async", "await", "base", "break", "case",
  "catch", "class", "const", "continue", "covariant", "default", "deferred",
  "do", "dynamic", "else", "enum", "export", "extends", "extension",
  "external", "factory", "false", "final", "finally", "for", "Function",
  "get", "hide", "if", "implements", "import", "in", "interface", "is",
  "late", "library", "mixin", "new", "null", "on", "operator", "part",
  "required", "rethrow", "return", "sealed", "set", "show", "static",
  "super", "switch", "sync", "this", "throw", "true", "try", "typedef",
  "var", "void", "when", "while", "with", "yield",
]);

const ZIG_KEYWORDS = new Set([
  "addrspace", "align", "allowzero", "and", "anyframe", "anytype", "asm",
  "async", "await", "break", "callconv", "catch", "comptime", "const",
  "continue", "defer", "else", "enum", "errdefer", "error", "export",
  "extern", "false", "fn", "for", "if", "inline", "linksection", "noalias",
  "nosuspend", "null", "opaque", "or", "orelse", "packed", "pub", "resume",
  "return", "struct", "suspend", "switch", "test", "threadlocal", "true",
  "try", "undefined", "union", "unreachable", "var", "volatile", "while",
]);

const NIM_KEYWORDS = new Set([
  "addr", "and", "as", "asm", "bind", "block", "break", "case", "cast",
  "concept", "const", "continue", "converter", "defer", "discard", "distinct",
  "div", "do", "elif", "else", "end", "enum", "except", "export", "finally",
  "for", "from", "func", "if", "import", "in", "include", "interface",
  "is", "isnot", "iterator", "let", "macro", "method", "mixin", "mod",
  "nil", "not", "notin", "object", "of", "or", "out", "proc", "ptr",
  "raise", "ref", "return", "shl", "shr", "static", "template", "try",
  "tuple", "type", "using", "var", "when", "while", "xor", "yield",
]);

const POWERSHELL_KEYWORDS = new Set([
  "begin", "break", "catch", "class", "continue", "data", "define", "do",
  "dynamicparam", "else", "elseif", "end", "enum", "exit", "filter",
  "finally", "for", "foreach", "foreach-object", "from", "function", "hidden",
  "if", "in", "inlinescript", "parallel", "param", "process", "return",
  "sequence", "switch", "throw", "trap", "try", "until", "using", "var",
  "where", "where-object", "while", "workflow",
]);

const TOML_KEYWORDS = new Set([
  "true", "false", "inf", "nan",
]);

const INI_KEYWORDS = new Set([
  "true", "false", "yes", "no", "on", "off",
]);

const XML_KEYWORDS = new Set([
  ...HTML_KEYWORDS,
  "xml", "xmlns", "xsl", "xsd", "xs", "wsdl", "soap", "rss", "atom",
  "feed", "entry", "channel", "item", "schema", "element", "attribute",
  "complexType", "simpleType", "sequence", "choice", "annotation",
]);

const GRAPHQL_KEYWORDS = new Set([
  "directive", "enum", "extend", "fragment", "implements", "input",
  "interface", "mutation", "on", "query", "scalar", "schema", "subscription",
  "type", "union", "repeatable",
]);

const PROTOBUF_KEYWORDS = new Set([
  "bool", "bytes", "double", "enum", "extend", "extensions", "false",
  "fixed32", "fixed64", "float", "group", "import", "int32", "int64",
  "map", "max", "message", "oneof", "option", "optional", "package",
  "public", "repeated", "required", "reserved", "returns", "rpc", "service",
  "sfixed32", "sfixed64", "sint32", "sint64", "stream", "string", "syntax",
  "to", "true", "uint32", "uint64", "weak",
]);

const TERRAFORM_KEYWORDS = new Set([
  "connection", "content", "count", "data", "default", "depends_on",
  "description", "dynamic", "each", "element", "false", "for", "for_each",
  "if", "in", "lifecycle", "locals", "module", "null", "output", "provider",
  "provisioner", "resource", "self", "sensitive", "source", "terraform",
  "true", "type", "value", "var", "variable", "version",
]);

const CSHARP_KEYWORDS = new Set([
  "abstract", "as", "async", "await", "base", "bool", "break", "byte", "case",
  "catch", "char", "checked", "class", "const", "continue", "decimal", "default",
  "delegate", "do", "double", "else", "enum", "event", "explicit", "extern",
  "false", "finally", "fixed", "float", "for", "foreach", "goto", "if",
  "implicit", "in", "int", "interface", "internal", "is", "lock", "long",
  "namespace", "new", "null", "object", "operator", "out", "override", "params",
  "partial", "private", "protected", "public", "readonly", "ref", "return",
  "sealed", "short", "sizeof", "stackalloc", "static", "string", "struct",
  "switch", "this", "throw", "true", "try", "typeof", "uint", "ulong",
  "unchecked", "unsafe", "ushort", "using", "var", "virtual", "void",
  "volatile", "while", "yield",
]);

const FSHARP_KEYWORDS = new Set([
  "abstract", "and", "as", "assert", "base", "begin", "class", "default",
  "delegate", "do", "done", "downcast", "downto", "elif", "else", "end",
  "exception", "extern", "false", "finally", "for", "fun", "function",
  "global", "if", "in", "inherit", "inline", "interface", "internal", "lazy",
  "let", "match", "member", "module", "mutable", "namespace", "new", "not",
  "null", "of", "open", "or", "override", "private", "public", "rec",
  "return", "static", "struct", "then", "to", "true", "try", "type",
  "upcast", "use", "val", "void", "when", "while", "with", "yield",
]);

const OCAML_KEYWORDS = new Set([
  "and", "as", "assert", "begin", "class", "constraint", "do", "done",
  "downto", "else", "end", "exception", "external", "false", "for", "fun",
  "function", "functor", "if", "in", "include", "inherit", "initializer",
  "lazy", "let", "match", "method", "mod", "module", "mutable", "new",
  "nonrec", "object", "of", "open", "or", "private", "rec", "sig", "struct",
  "then", "to", "true", "try", "type", "val", "virtual", "when", "while",
  "with",
]);

const ERLANG_KEYWORDS = new Set([
  "after", "and", "andalso", "band", "begin", "bnot", "bor", "bsl", "bsr",
  "bxor", "case", "catch", "cond", "div", "end", "export", "fun", "if",
  "import", "let", "module", "not", "of", "or", "orelse", "receive", "rem",
  "spec", "throw", "try", "type", "when", "xor",
]);

const JULIA_KEYWORDS = new Set([
  "abstract", "baremodule", "begin", "break", "catch", "const", "continue",
  "do", "else", "elseif", "end", "export", "false", "finally", "for",
  "function", "global", "if", "import", "in", "let", "local", "macro",
  "module", "mutable", "nothing", "primitive", "quote", "return", "struct",
  "true", "try", "type", "typealias", "using", "where", "while",
]);

const MATLAB_KEYWORDS = new Set([
  "break", "case", "catch", "classdef", "continue", "else", "elseif", "end",
  "enumeration", "events", "for", "function", "global", "if", "methods",
  "otherwise", "parfor", "persistent", "properties", "return", "spmd",
  "switch", "try", "while",
]);

const BASH_EXT_KEYWORDS = new Set([
  ...SHELL_KEYWORDS,
  "alias", "bg", "bind", "builtin", "caller", "command", "compgen",
  "complete", "compopt", "coproc", "declare", "dirs", "disown", "enable",
  "eval", "exec", "fg", "getopts", "hash", "help", "history", "jobs",
  "kill", "let", "logout", "mapfile", "popd", "printf", "pushd",
  "pwd", "readarray", "readonly", "suspend", "time", "times", "trap",
  "type", "typeset", "ulimit", "umask", "unalias", "wait",
]);

const FISH_KEYWORDS = new Set([
  "and", "begin", "break", "builtin", "case", "command", "continue", "count",
  "else", "emit", "end", "eval", "exec", "exit", "false", "for", "function",
  "functions", "if", "math", "not", "or", "read", "return", "set",
  "set_color", "source", "status", "string", "switch", "test", "true",
  "type", "while",
]);

const NIX_KEYWORDS = new Set([
  "assert", "builtins", "else", "false", "fetchTarball", "if", "import",
  "in", "inherit", "let", "null", "or", "rec", "then", "throw", "true",
  "with",
]);

const JSONNET_KEYWORDS = new Set([
  "assert", "else", "error", "false", "for", "function", "if", "import",
  "importstr", "in", "local", "null", "self", "super", "tailstrict", "then",
  "true",
]);

const GROOVY_KEYWORDS = new Set([
  "abstract", "as", "assert", "boolean", "break", "byte", "case", "catch",
  "char", "class", "const", "continue", "def", "default", "do", "double",
  "else", "enum", "extends", "false", "final", "finally", "float", "for",
  "goto", "if", "implements", "import", "in", "instanceof", "int",
  "interface", "long", "native", "new", "null", "package", "private",
  "protected", "public", "return", "short", "static", "strictfp", "super",
  "switch", "synchronized", "this", "throw", "throws", "trait", "transient",
  "true", "try", "void", "volatile", "while",
]);

const OBJC_KEYWORDS = new Set([
  ...C_KEYWORDS,
  "@autoreleasepool", "@catch", "@class", "@compatibility_alias", "@defs",
  "@dynamic", "@encode", "@end", "@finally", "@implementation", "@interface",
  "@optional", "@package", "@private", "@property", "@protected", "@protocol",
  "@public", "@required", "@selector", "@synchronized", "@synthesize",
  "@throw", "@try", "BOOL", "Class", "NO", "SEL", "YES", "id", "nil",
  "nonatomic", "readonly", "readwrite", "retain", "strong", "weak",
]);

const ASM_KEYWORDS = new Set([
  "adc", "add", "and", "call", "cli", "cmp", "cmpxchg", "cpuid", "dec",
  "div", "hlt", "idiv", "imul", "in", "inc", "int", "iret", "ja", "jae",
  "jb", "jbe", "je", "jg", "jge", "jl", "jle", "jmp", "jne", "jnz", "jz",
  "lea", "leave", "loop", "mov", "movsx", "movzx", "mul", "neg", "nop",
  "not", "or", "out", "pop", "popa", "popf", "push", "pusha", "pushf",
  "rcl", "rcr", "rdtsc", "rep", "ret", "rol", "ror", "sal", "sar", "sbb",
  "shl", "shr", "sti", "sub", "syscall", "test", "xchg", "xor",
  // registers
  "eax", "ebx", "ecx", "edx", "esi", "edi", "ebp", "esp",
  "rax", "rbx", "rcx", "rdx", "rsi", "rdi", "rbp", "rsp",
  // directives
  "db", "dw", "dd", "dq", "section", "global", "extern", "resb", "resw",
]);

const WAT_KEYWORDS = new Set([
  "block", "br", "br_if", "br_table", "call", "call_indirect", "data",
  "drop", "elem", "else", "end", "export", "f32", "f64", "func", "get",
  "global", "i32", "i64", "if", "import", "local", "loop", "memory",
  "module", "mut", "nop", "offset", "param", "result", "return", "select",
  "set", "start", "table", "tee", "then", "type", "unreachable",
]);

const MAKEFILE_KEYWORDS = new Set([
  ".DEFAULT", ".DELETE_ON_ERROR", ".EXPORT_ALL_VARIABLES", ".IGNORE",
  ".INTERMEDIATE", ".NOTPARALLEL", ".ONESHELL", ".PHONY", ".POSIX",
  ".PRECIOUS", ".SECONDARY", ".SECONDEXPANSION", ".SILENT",
  ".SUFFIXES", "addprefix", "addsuffix", "all", "basename", "clean",
  "define", "dir", "dist", "endef", "endif", "export", "filter",
  "filter-out", "findstring", "firstword", "foreach", "ifdef", "ifeq",
  "ifndef", "ifneq", "include", "install", "join", "notdir", "override",
  "patsubst", "shell", "sort", "strip", "subst", "test", "unexport",
  "uninstall", "vpath", "warning", "wildcard", "word", "words",
]);

const CMAKE_KEYWORDS = new Set([
  "add_compile_definitions", "add_compile_options", "add_custom_command",
  "add_custom_target", "add_definitions", "add_dependencies",
  "add_executable", "add_library", "add_subdirectory", "add_test",
  "cmake_minimum_required", "configure_file", "else", "elseif", "enable_testing",
  "endif", "endforeach", "endfunction", "endmacro", "endwhile",
  "execute_process", "file", "find_package", "foreach", "function",
  "get_filename_component", "if", "include", "include_directories",
  "install", "list", "macro", "mark_as_advanced", "message", "option",
  "project", "return", "set", "set_property", "set_target_properties",
  "string", "target_compile_definitions", "target_compile_options",
  "target_include_directories", "target_link_libraries",
  "target_sources", "while",
]);

const GLSL_KEYWORDS = new Set([
  "attribute", "bool", "break", "bvec2", "bvec3", "bvec4", "case", "centroid",
  "const", "continue", "default", "discard", "do", "double", "dvec2", "dvec3",
  "dvec4", "else", "flat", "float", "for", "highp", "if", "in", "inout",
  "int", "invariant", "ivec2", "ivec3", "ivec4", "layout", "lowp", "mat2",
  "mat3", "mat4", "mediump", "noperspective", "out", "patch", "precision",
  "return", "sample", "sampler1D", "sampler2D", "sampler3D", "samplerCube",
  "smooth", "struct", "subroutine", "switch", "uniform", "uint", "uvec2",
  "uvec3", "uvec4", "varying", "vec2", "vec3", "vec4", "void", "while",
]);

const SOLIDITY_KEYWORDS = new Set([
  "abstract", "address", "anonymous", "as", "assembly", "bool", "break",
  "bytes", "calldata", "case", "catch", "constant", "constructor", "continue",
  "contract", "default", "delete", "do", "else", "emit", "enum", "error",
  "event", "external", "fallback", "false", "for", "function", "if",
  "immutable", "import", "indexed", "interface", "internal", "is", "library",
  "mapping", "memory", "modifier", "new", "override", "payable", "pragma",
  "private", "public", "pure", "receive", "require", "return", "returns",
  "revert", "storage", "string", "struct", "true", "try", "type", "uint",
  "uint256", "unchecked", "using", "view", "virtual", "while",
]);

const VERILOG_KEYWORDS = new Set([
  "always", "always_comb", "always_ff", "always_latch", "and", "assign",
  "automatic", "begin", "buf", "case", "casex", "casez", "class", "clocking",
  "default", "defparam", "disable", "edge", "else", "end", "endcase",
  "endclass", "endclocking", "endfunction", "endgenerate", "endmodule",
  "endpackage", "endprimitive", "endprogram", "endproperty", "endsequence",
  "endspecify", "endtable", "endtask", "enum", "event", "for", "force",
  "forever", "fork", "function", "generate", "genvar", "if", "initial",
  "inout", "input", "integer", "interface", "join", "localparam", "logic",
  "module", "nand", "negedge", "nor", "not", "or", "output", "parameter",
  "posedge", "primitive", "priority", "real", "reg", "repeat", "return",
  "signed", "specify", "struct", "task", "time", "typedef", "unique",
  "unsigned", "wait", "while", "wire", "xnor", "xor",
]);

const VHDL_KEYWORDS = new Set([
  "abs", "access", "after", "alias", "all", "and", "architecture", "array",
  "assert", "attribute", "begin", "block", "body", "buffer", "bus", "case",
  "component", "configuration", "constant", "disconnect", "downto", "else",
  "elsif", "end", "entity", "exit", "file", "for", "function", "generate",
  "generic", "group", "guarded", "if", "impure", "in", "inertial", "inout",
  "is", "label", "library", "linkage", "literal", "loop", "map", "mod",
  "nand", "new", "next", "nor", "not", "null", "of", "on", "open", "or",
  "others", "out", "package", "port", "postponed", "procedure", "process",
  "pure", "range", "record", "register", "reject", "rem", "report", "return",
  "rol", "ror", "select", "severity", "signal", "shared", "sla", "sll",
  "sra", "srl", "subtype", "then", "to", "transport", "type", "unaffected",
  "units", "until", "use", "variable", "wait", "when", "while", "with",
  "xnor", "xor",
]);

const TCL_KEYWORDS = new Set([
  "after", "append", "apply", "array", "binary", "break", "catch", "cd",
  "chan", "clock", "close", "concat", "continue", "coroutine", "dict", "else",
  "elseif", "encoding", "eof", "error", "eval", "exec", "exit", "expr",
  "fblocked", "fconfigure", "fcopy", "file", "fileevent", "flush", "for",
  "foreach", "format", "gets", "glob", "global", "history", "if", "incr",
  "info", "interp", "join", "lappend", "lassign", "lindex", "linsert",
  "list", "llength", "lmap", "load", "lrange", "lrepeat", "lreplace",
  "lreverse", "lsearch", "lset", "lsort", "namespace", "open", "package",
  "pid", "proc", "puts", "pwd", "read", "regexp", "regsub", "rename",
  "return", "scan", "seek", "set", "socket", "source", "split", "string",
  "subst", "switch", "tailcall", "tell", "throw", "time", "trace", "try",
  "unset", "update", "uplevel", "upvar", "variable", "vwait", "while",
  "yield", "yieldto",
]);

const FORTRAN_KEYWORDS = new Set([
  "allocatable", "allocate", "assign", "associate", "block", "call", "case",
  "character", "class", "close", "common", "complex", "contains", "continue",
  "cycle", "data", "deallocate", "dimension", "do", "double", "else",
  "elseif", "elsewhere", "end", "enddo", "endif", "entry", "equivalence",
  "exit", "external", "forall", "format", "function", "go", "goto", "if",
  "implicit", "import", "include", "inquire", "integer", "intent",
  "interface", "intrinsic", "kind", "logical", "module", "namelist", "none",
  "nullify", "only", "open", "operator", "optional", "parameter", "pointer",
  "precision", "print", "private", "procedure", "program", "protected",
  "public", "pure", "read", "real", "recursive", "result", "return",
  "rewind", "save", "select", "sequence", "stop", "subroutine", "target",
  "then", "to", "type", "use", "value", "where", "while", "write",
]);

const COBOL_KEYWORDS = new Set([
  "ACCEPT", "ADD", "ADVANCING", "AFTER", "ALL", "ALPHABETIC", "ALSO",
  "ALTER", "AND", "ARE", "ASCENDING", "AT", "BEFORE", "BLANK", "BY", "CALL",
  "CLOSE", "COMP", "COMPUTATIONAL", "COMPUTE", "CONFIGURATION", "CONTINUE",
  "COPY", "CORRESPONDING", "DATA", "DISPLAY", "DIVIDE", "DIVISION", "ELSE",
  "END", "END-IF", "END-PERFORM", "END-READ", "ENVIRONMENT", "EVALUATE",
  "EXIT", "FD", "FILE", "FILLER", "FROM", "GIVING", "GO", "GOBACK",
  "IDENTIFICATION", "IF", "IN", "INPUT", "INPUT-OUTPUT", "INSPECT", "INTO",
  "IS", "JUST", "JUSTIFIED", "LABEL", "LINE", "MOVE", "MULTIPLY", "NEXT",
  "NOT", "OCCURS", "OF", "ON", "OPEN", "OR", "OUTPUT", "PARAGRAPH",
  "PERFORM", "PIC", "PICTURE", "PROCEDURE", "PROGRAM-ID", "READ", "RECORD",
  "REDEFINES", "REPLACING", "RETURN", "RETURNING", "REWRITE", "SECTION",
  "SELECT", "SENTENCE", "SET", "SIZE", "SPACE", "SPACES", "STOP", "STRING",
  "SUBTRACT", "THEN", "THRU", "TO", "UNTIL", "UPON", "USING", "VALUE",
  "VARYING", "WHEN", "WITH", "WORKING-STORAGE", "WRITE", "ZERO", "ZEROS",
]);

const DIFF_KEYWORDS = new Set<string>([]);

const V_KEYWORDS = new Set([
  "as", "assert", "atomic", "break", "const", "continue", "defer", "else",
  "enum", "false", "fn", "for", "go", "goto", "if", "import", "in",
  "interface", "is", "lock", "match", "module", "mut", "none", "or",
  "pub", "return", "rlock", "select", "shared", "static", "struct",
  "true", "type", "typeof", "union", "unsafe", "volatile",
]);

const CRYSTAL_KEYWORDS = new Set([
  "abstract", "alias", "annotation", "as", "begin", "break", "case",
  "class", "def", "do", "else", "elsif", "end", "ensure", "enum",
  "extend", "false", "for", "fun", "if", "in", "include", "instance_sizeof",
  "lib", "macro", "module", "next", "nil", "of", "out", "pointerof",
  "private", "protected", "require", "rescue", "return", "select", "self",
  "sizeof", "struct", "super", "then", "true", "typeof", "uninitialized",
  "union", "unless", "until", "when", "while", "with", "yield",
]);

const GLEAM_KEYWORDS = new Set([
  "as", "assert", "case", "const", "external", "fn", "if", "import",
  "let", "opaque", "pub", "todo", "try", "type", "use",
]);

const MOJO_KEYWORDS = new Set([
  "alias", "and", "as", "async", "await", "borrowed", "break", "class",
  "continue", "def", "del", "elif", "else", "except", "false", "finally",
  "fn", "for", "from", "if", "import", "in", "inout", "is", "lambda",
  "let", "not", "or", "owned", "pass", "raise", "raises", "return",
  "self", "struct", "trait", "true", "try", "var", "while", "with", "yield",
]);

const ODIN_KEYWORDS = new Set([
  "auto_cast", "bit_set", "break", "case", "cast", "context", "continue",
  "defer", "distinct", "do", "dynamic", "else", "enum", "fallthrough",
  "for", "foreign", "if", "import", "in", "map", "matrix", "not_in",
  "or_else", "or_return", "package", "proc", "return", "struct", "switch",
  "transmute", "typeid", "union", "using", "when", "where",
]);

const ROC_KEYWORDS = new Set([
  "app", "as", "crash", "dbg", "else", "expect", "exposes", "generates",
  "hosts", "if", "implements", "import", "imports", "is", "packages",
  "platform", "provides", "requires", "then", "to", "when", "where",
  "with",
]);

const UNISON_KEYWORDS = new Set([
  "ability", "do", "else", "forall", "handle", "handler", "if", "let",
  "match", "namespace", "structural", "cases", "then", "true", "false",
  "type", "unique", "use", "where", "with",
]);

const LEAN_KEYWORDS = new Set([
  "abbrev", "axiom", "by", "class", "constant", "def", "deriving",
  "do", "else", "example", "extends", "for", "fun", "if", "import",
  "in", "inductive", "instance", "lemma", "let", "macro", "match",
  "mutual", "namespace", "noncomputable", "notation", "open", "opaque",
  "partial", "private", "protected", "return", "section", "set_option",
  "structure", "syntax", "tactic", "then", "theorem", "universe",
  "variable", "where", "with",
]);

const IDRIS_KEYWORDS = new Set([
  "auto", "case", "class", "codata", "constructor", "covering", "data",
  "default", "do", "else", "export", "forall", "if", "implementation",
  "implicit", "import", "impossible", "in", "infix", "infixl", "infixr",
  "interface", "let", "module", "mutual", "namespace", "of", "open",
  "partial", "prefix", "private", "proof", "public", "record", "rewrite",
  "then", "total", "using", "where", "with",
]);

const AGDA_KEYWORDS = new Set([
  "abstract", "codata", "coinductive", "constructor", "data", "do",
  "eta-equality", "field", "forall", "hiding", "import", "in", "inductive",
  "infix", "infixl", "infixr", "instance", "interleaved", "let", "macro",
  "module", "mutual", "no-eta-equality", "open", "overlap", "pattern",
  "postulate", "primitive", "private", "public", "quote", "quoteContext",
  "record", "renaming", "rewrite", "syntax", "tactic", "to", "unquote",
  "using", "variable", "where", "with",
]);

const COQ_KEYWORDS = new Set([
  "Admitted", "Arguments", "Axiom", "Check", "Coercion", "CoFixpoint",
  "CoInductive", "Compute", "Conjecture", "Corollary", "Defined",
  "Definition", "End", "Eval", "Example", "Existential", "Fact",
  "Fixpoint", "Function", "Goal", "Hypothesis", "Inductive", "Lemma",
  "Let", "Ltac", "Module", "Notation", "Obligation", "Parameter", "Proof",
  "Proposition", "Qed", "Record", "Remark", "Require", "Section",
  "Theorem", "Type", "Variable",
  "as", "else", "end", "exists", "fix", "forall", "fun", "if", "in",
  "let", "match", "return", "then", "with",
]);

const PROLOG_KEYWORDS = new Set([
  "abolish", "arg", "assert", "asserta", "assertz", "atom", "atom_chars",
  "atom_length", "call", "catch", "char_code", "clause", "copy_term",
  "cut", "fail", "false", "findall", "float", "functor", "halt", "integer",
  "is", "length", "member", "nl", "not", "number", "read", "repeat",
  "retract", "succ", "throw", "true", "var", "write", "writeln",
]);

const SMALLTALK_KEYWORDS = new Set([
  "false", "nil", "self", "super", "thisContext", "true",
  "Transcript", "Array", "Boolean", "Character", "Class", "Collection",
  "Dictionary", "Float", "Integer", "Number", "Object", "OrderedCollection",
  "Set", "SmallInteger", "String", "Symbol",
]);

const RACKET_KEYWORDS = new Set([
  "and", "begin", "case", "cond", "define", "define-syntax", "define-values",
  "do", "else", "for", "for/list", "for/fold", "hash", "if", "lambda",
  "let", "let*", "let-values", "letrec", "list", "match", "module",
  "or", "provide", "quote", "quasiquote", "require", "set!", "struct",
  "syntax-case", "unless", "unquote", "values", "when", "with-handlers",
]);

const COMMON_LISP_KEYWORDS = new Set([
  "and", "block", "case", "catch", "cond", "declaim", "declare", "defclass",
  "defconstant", "defgeneric", "defmacro", "defmethod", "defpackage",
  "defparameter", "defstruct", "deftype", "defun", "defvar", "do",
  "dolist", "dotimes", "ecase", "eval-when", "flet", "funcall", "function",
  "go", "handler-bind", "handler-case", "if", "in-package", "labels",
  "lambda", "let", "let*", "loop", "make-instance", "multiple-value-bind",
  "nil", "or", "progn", "quote", "return", "setf", "setq", "t",
  "tagbody", "the", "throw", "typecase", "unless", "unwind-protect",
  "values", "when", "with-open-file",
]);

const SCHEME_KEYWORDS = new Set([
  "and", "begin", "call-with-current-continuation", "call-with-values",
  "call/cc", "case", "cond", "define", "define-record-type",
  "define-syntax", "define-values", "delay", "do", "dynamic-wind",
  "else", "guard", "if", "import", "include", "lambda", "let", "let*",
  "let-values", "letrec", "letrec*", "or", "parameterize", "quasiquote",
  "quote", "raise", "set!", "syntax-rules", "unless", "unquote",
  "values", "when", "with-exception-handler",
]);

const FENNEL_KEYWORDS = new Set([
  "accumulate", "band", "bnot", "bor", "bxor", "case", "collect", "comment",
  "do", "doto", "each", "eval-compiler", "fn", "for", "global", "hashfn",
  "icollect", "if", "import-macros", "include", "lambda", "length", "let",
  "local", "lshift", "lua", "macro", "macros", "match", "not", "or",
  "partial", "pick-args", "pick-values", "require", "require-macros",
  "rshift", "set", "tset", "values", "var", "when", "while", "with-open",
]);

const JANET_KEYWORDS = new Set([
  "break", "buffer", "case", "cond", "coro", "def", "default", "defer",
  "defmacro", "defn", "do", "each", "eachk", "eachp", "edefer", "else",
  "ev/spawn", "false", "fiber", "fn", "for", "forever", "generate",
  "if", "import", "label", "let", "loop", "match", "nil", "or",
  "prompt", "propagate", "protect", "repeat", "resume", "return",
  "seq", "set", "splice", "true", "try", "upscope", "use", "var",
  "when", "while", "with", "yield",
]);

const HY_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue",
  "defclass", "defmacro", "defn", "del", "do", "doto", "elif", "else",
  "except", "export", "finally", "fn", "for", "get", "global", "if",
  "import", "in", "is", "let", "lfor", "nonlocal", "not", "or", "pass",
  "quasiquote", "quote", "raise", "require", "return", "setv", "sfor",
  "try", "unquote", "unquote-splice", "when", "while", "with", "yield",
]);

const RESCRIPT_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "catch", "constraint", "else",
  "exception", "external", "false", "for", "if", "in", "include", "lazy",
  "let", "mod", "module", "mutable", "of", "open", "or", "private",
  "rec", "ref", "switch", "to", "true", "try", "type", "when", "while",
  "with",
]);

const REASON_KEYWORDS = new Set([
  "and", "as", "assert", "class", "constraint", "do", "done", "downto",
  "else", "exception", "external", "false", "for", "fun", "function",
  "functor", "if", "in", "include", "inherit", "initializer", "lazy",
  "let", "method", "mod", "module", "mutable", "new", "nonrec", "object",
  "of", "open", "or", "private", "pub", "rec", "sig", "struct", "switch",
  "then", "to", "true", "try", "type", "val", "virtual", "when", "while",
  "with",
]);

const ELM_KEYWORDS = new Set([
  "alias", "as", "case", "else", "exposing", "if", "import", "in",
  "let", "module", "of", "port", "then", "type",
]);

const PURESCRIPT_KEYWORDS = new Set([
  "ado", "as", "case", "class", "data", "derive", "do", "else",
  "false", "forall", "foreign", "hiding", "if", "import", "in",
  "infix", "infixl", "infixr", "instance", "let", "module", "newtype",
  "of", "then", "true", "type", "where",
]);

const COFFEESCRIPT_KEYWORDS = new Set([
  "and", "break", "by", "case", "catch", "class", "continue", "debugger",
  "default", "delete", "do", "else", "extends", "false", "finally",
  "for", "if", "in", "instanceof", "is", "isnt", "loop", "new", "no",
  "not", "null", "of", "off", "on", "or", "own", "return", "super",
  "switch", "then", "this", "throw", "true", "try", "typeof", "undefined",
  "unless", "until", "when", "while", "yes", "yield",
]);

const LIVESCRIPT_KEYWORDS = new Set([
  "and", "break", "by", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "extends", "fallthrough",
  "false", "finally", "for", "function", "if", "implements", "import",
  "in", "instanceof", "is", "isnt", "let", "loop", "new", "no", "not",
  "null", "of", "off", "on", "or", "otherwise", "own", "return", "super",
  "switch", "then", "this", "throw", "true", "try", "typeof", "undefined",
  "unless", "until", "var", "void", "when", "while", "with", "yes", "yield",
]);

const TYPESPEC_KEYWORDS = new Set([
  "alias", "aug", "const", "dec", "directive", "enum", "error", "extern",
  "extends", "import", "interface", "intrinsic", "is", "model", "namespace",
  "never", "op", "scalar", "union", "unknown", "using", "valueof", "void",
]);

const BICEP_KEYWORDS = new Set([
  "existing", "for", "func", "if", "import", "in", "metadata", "module",
  "output", "param", "resource", "scope", "targetScope", "type", "var",
]);

const PUPPET_KEYWORDS = new Set([
  "and", "application", "attr", "case", "class", "component", "consumes",
  "contain", "default", "define", "each", "else", "elsif", "environment",
  "exec", "export", "fail", "false", "file", "function", "group", "if",
  "import", "in", "include", "inherits", "node", "notice", "notify",
  "or", "package", "present", "produces", "realize", "require", "service",
  "site", "tag", "true", "undef", "unless", "user",
]);

const ANSIBLE_KEYWORDS = new Set([
  "action", "any_errors_fatal", "async", "become", "become_method",
  "become_user", "block", "changed_when", "check_mode", "collections",
  "connection", "debug", "delegate_to", "environment", "failed_when",
  "gather_facts", "handlers", "hosts", "ignore_errors", "import_role",
  "import_tasks", "include_role", "include_tasks", "items", "listen",
  "loop", "name", "no_log", "notify", "poll", "post_tasks", "pre_tasks",
  "register", "rescue", "retries", "roles", "run_once", "serial", "tags",
  "tasks", "timeout", "until", "vars", "vars_files", "when", "with_items",
]);

const HELM_KEYWORDS = new Set([
  ...YAML_KEYWORDS,
  "define", "else", "end", "if", "include", "range", "template", "with",
  "block", "required", "toYaml", "toJson", "indent", "nindent", "trim",
  "quote", "default", "empty", "fail", "print", "printf", "println",
  "list", "dict", "set", "unset", "hasKey", "pluck", "keys", "values",
]);

const SVELTE_KEYWORDS = new Set([
  ...JS_KEYWORDS,
  "animate", "await", "bind", "catch", "component", "each", "else",
  "html", "if", "key", "on", "script", "slot", "style", "then",
  "transition",
]);

const VUE_KEYWORDS = new Set([
  ...JS_KEYWORDS,
  "computed", "defineEmits", "defineExpose", "defineProps", "directive",
  "emits", "methods", "onBeforeMount", "onBeforeUnmount", "onMounted",
  "onUnmounted", "onUpdated", "props", "reactive", "readonly", "ref",
  "script", "setup", "shallowReactive", "shallowRef", "style", "template",
  "toRaw", "toRef", "toRefs", "triggerRef", "unref", "watch", "watchEffect",
]);

const ASTRO_KEYWORDS = new Set([
  ...JS_KEYWORDS,
  "Astro", "Fragment", "client", "define", "frontmatter", "is", "load",
  "only", "slot", "transition", "visible",
]);

const MDX_KEYWORDS = new Set([
  ...JS_KEYWORDS,
]);

const PRISMA_KEYWORDS = new Set([
  "datasource", "default", "enum", "env", "false", "generator", "id",
  "ignore", "index", "map", "model", "now", "provider", "relation",
  "true", "type", "unique", "updatedAt", "url", "uuid",
]);

const EDGEQL_KEYWORDS = new Set([
  "abstract", "alias", "alter", "annotation", "as", "by", "commit",
  "configure", "constraint", "create", "database", "declare", "delete",
  "describe", "detached", "distinct", "drop", "else", "exists", "extending",
  "false", "filter", "for", "function", "group", "if", "ilike", "in",
  "index", "insert", "introspect", "is", "like", "limit", "link",
  "migration", "module", "not", "offset", "on", "optional", "or",
  "order", "property", "required", "reset", "rollback", "scalar",
  "select", "set", "start", "true", "type", "update", "using", "with",
]);

const CYPHER_KEYWORDS = new Set([
  "ALL", "AND", "AS", "ASC", "ASCENDING", "BY", "CALL", "CASE", "COLLECT",
  "CONTAINS", "COUNT", "CREATE", "DELETE", "DESC", "DESCENDING", "DETACH",
  "DISTINCT", "ELSE", "END", "ENDS", "EXISTS", "FIELDTERMINATOR", "FOREACH",
  "IN", "IS", "LIMIT", "MATCH", "MERGE", "NOT", "NULL", "ON", "OPTIONAL",
  "OR", "ORDER", "REMOVE", "RETURN", "SET", "SKIP", "STARTS", "THEN",
  "UNION", "UNIQUE", "UNWIND", "WHEN", "WHERE", "WITH", "XOR", "YIELD",
  // lowercase variants
  "all", "and", "as", "asc", "ascending", "by", "call", "case", "collect",
  "contains", "count", "create", "delete", "desc", "descending", "detach",
  "distinct", "else", "end", "ends", "exists", "foreach", "in", "is",
  "limit", "match", "merge", "not", "null", "on", "optional", "or",
  "order", "remove", "return", "set", "skip", "starts", "then", "union",
  "unique", "unwind", "when", "where", "with", "xor", "yield",
]);

const MERMAID_KEYWORDS = new Set([
  "actor", "alt", "and", "as", "class", "classDef", "classDiagram", "click",
  "critical", "direction", "else", "end", "erDiagram", "flowchart",
  "gantt", "graph", "journey", "linkStyle", "loop", "note", "opt",
  "over", "par", "participant", "pie", "rect", "sequenceDiagram",
  "state", "stateDiagram", "style", "subgraph", "title",
]);

const PLANTUML_KEYWORDS = new Set([
  "abstract", "actor", "agent", "annotation", "archimate", "artifact",
  "boundary", "card", "circle", "class", "cloud", "collections",
  "component", "control", "database", "diamond", "else", "elseif",
  "end", "endif", "endwhile", "entity", "enum", "file", "folder",
  "footer", "frame", "header", "hexagon", "if", "interface", "label",
  "legend", "map", "node", "note", "object", "package", "participant",
  "queue", "rectangle", "repeat", "stack", "state", "storage", "title",
  "together", "usecase", "while",
]);

const LATEX_KEYWORDS = new Set([
  "begin", "end", "usepackage", "documentclass", "section", "subsection",
  "subsubsection", "paragraph", "chapter", "part", "title", "author",
  "date", "maketitle", "tableofcontents", "newcommand", "renewcommand",
  "newenvironment", "label", "ref", "cite", "bibliography", "bibliographystyle",
  "textbf", "textit", "texttt", "emph", "underline", "footnote", "input",
  "include", "includegraphics", "caption", "centering", "hfill", "vfill",
  "hspace", "vspace", "item", "enumerate", "itemize", "figure", "table",
  "tabular", "equation", "align", "frac", "sqrt", "sum", "int", "infty",
]);

/** Internal registry: alias -> InternalLanguageDef */
const LANGUAGE_REGISTRY = new Map<string, InternalLanguageDef>();

/** Tracks canonical names (first name in aliases) for getSupportedLanguages. */
const CANONICAL_NAMES = new Set<string>();

/** Convert public LanguageDef to InternalLanguageDef. */
function toInternal(def: LanguageDef): InternalLanguageDef {
  const lineComment: string[] = [];
  if (def.lineComment !== undefined) {
    lineComment.push(def.lineComment);
  }
  return {
    keywords: def.keywords,
    typeKeywords: def.typeKeywords ?? EMPTY_SET,
    lineComment,
    blockCommentOpen: def.blockCommentStart ?? "",
    blockCommentClose: def.blockCommentEnd ?? "",
    multilineStringDelims: def.multilineStringDelimiter !== undefined ? [def.multilineStringDelimiter] : [],
    hasTemplateLiterals: def.hasTemplateLiterals ?? false,
    hasPreprocessor: def.preprocessorPrefix !== undefined && def.preprocessorPrefix.length > 0,
    stringChars: def.stringDelimiters ?? ['"', "'"],
    jsxAware: false,
    caseInsensitiveKeywords: false,
  };
}

/**
 * Register a custom language definition.
 *
 * @param name - Canonical name for the language.
 * @param aliases - Additional aliases (e.g. ["js", "jsx"] for JavaScript).
 * @param def - Language definition.
 */
export function registerLanguage(name: string, aliases: string[], def: LanguageDef): void {
  const internal = toInternal(def);
  const lowerName = name.toLowerCase();
  LANGUAGE_REGISTRY.set(lowerName, internal);
  CANONICAL_NAMES.add(lowerName);
  for (const alias of aliases) {
    LANGUAGE_REGISTRY.set(alias.toLowerCase(), internal);
  }
}

export function getLanguage(name: string): LanguageDef | undefined {
  const internal = LANGUAGE_REGISTRY.get(name.toLowerCase());
  if (!internal) return undefined;
  return toPublic(internal);
}

function toPublic(def: InternalLanguageDef): LanguageDef {
  const result: LanguageDef = { keywords: def.keywords };
  if (def.typeKeywords.size > 0) result.typeKeywords = def.typeKeywords;
  if (def.lineComment.length > 0) result.lineComment = def.lineComment[0]!;
  if (def.blockCommentOpen) result.blockCommentStart = def.blockCommentOpen;
  if (def.blockCommentClose) result.blockCommentEnd = def.blockCommentClose;
  if (def.stringChars.length > 0) result.stringDelimiters = def.stringChars;
  if (def.hasTemplateLiterals) result.hasTemplateLiterals = true;
  if (def.multilineStringDelims.length > 0) result.multilineStringDelimiter = def.multilineStringDelims[0]!;
  if (def.hasPreprocessor) result.preprocessorPrefix = "#";
  return result;
}

export function getSupportedLanguages(): string[] {
  return Array.from(CANONICAL_NAMES).sort();
}

/** Register a language directly with internal format (used for built-ins). */
function registerInternal(name: string, aliases: string[], def: Omit<InternalLanguageDef, "jsxAware" | "caseInsensitiveKeywords"> & { jsxAware?: boolean; caseInsensitiveKeywords?: boolean }): void {
  const fullDef: InternalLanguageDef = { ...def, jsxAware: def.jsxAware ?? false, caseInsensitiveKeywords: def.caseInsensitiveKeywords ?? false };
  const lowerName = name.toLowerCase();
  LANGUAGE_REGISTRY.set(lowerName, fullDef);
  CANONICAL_NAMES.add(lowerName);
  for (const alias of aliases) {
    LANGUAGE_REGISTRY.set(alias.toLowerCase(), fullDef);
  }
}

registerInternal("javascript", ["js", "ts", "typescript"], {
  keywords: JS_KEYWORDS, typeKeywords: JS_TYPE_KEYWORDS,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: true, hasPreprocessor: false,
  stringChars: ['"', "'"], jsxAware: false,
});

registerInternal("jsx", ["tsx", "typescriptreact", "javascriptreact"], {
  keywords: JS_KEYWORDS, typeKeywords: JS_TYPE_KEYWORDS,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: true, hasPreprocessor: false,
  stringChars: ['"', "'"], jsxAware: true,
});

registerInternal("python", ["py"], {
  keywords: PYTHON_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: ['"""', "'''"], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("go", ["golang"], {
  keywords: GO_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'", "`"],
});

registerInternal("rust", ["rs"], {
  keywords: RUST_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("shell", ["bash", "sh", "zsh"], {
  keywords: SHELL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("java", [], {
  keywords: JAVA_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("c", ["cpp", "c++", "h", "hpp"], {
  keywords: C_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: true,
  stringChars: ['"', "'"],
});

registerInternal("ruby", ["rb"], {
  keywords: RUBY_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "=begin", blockCommentClose: "=end",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("php", [], {
  keywords: PHP_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//", "#"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("html", ["htm", "svg"], {
  keywords: HTML_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "<!--", blockCommentClose: "-->",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("css", ["scss", "less"], {
  keywords: CSS_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("sql", [], {
  keywords: SQL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ["'"], caseInsensitiveKeywords: true,
});

registerInternal("yaml", ["yml"], {
  keywords: YAML_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("json", ["jsonc"], {
  keywords: EMPTY_SET, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("markdown", ["md"], {
  keywords: EMPTY_SET, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: [],
});

registerInternal("dockerfile", ["docker"], {
  keywords: DOCKERFILE_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("lua", [], {
  keywords: LUA_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "--[[", blockCommentClose: "]]",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("kotlin", ["kt", "kts"], {
  keywords: KOTLIN_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("swift", [], {
  keywords: SWIFT_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("scala", [], {
  keywords: SCALA_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("haskell", ["hs"], {
  keywords: HASKELL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "{-", blockCommentClose: "-}",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("elixir", ["ex", "exs"], {
  keywords: ELIXIR_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("clojure", ["clj", "cljs", "cljc", "edn"], {
  keywords: CLOJURE_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [";;"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("r", ["rscript"], {
  keywords: R_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("perl", ["pl", "pm"], {
  keywords: PERL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("dart", [], {
  keywords: DART_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: ['"""', "'''"], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("zig", [], {
  keywords: ZIG_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("nim", ["nimble"], {
  keywords: NIM_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "#[", blockCommentClose: "]#",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("powershell", ["ps1", "psm1", "psd1"], {
  keywords: POWERSHELL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "<#", blockCommentClose: "#>",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"], caseInsensitiveKeywords: true,
});

registerInternal("toml", [], {
  keywords: TOML_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: ['"""', "'''"], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("ini", ["cfg", "conf"], {
  keywords: INI_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#", ";"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("xml", ["xsl", "xsd", "xhtml", "wsdl"], {
  keywords: XML_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "<!--", blockCommentClose: "-->",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("graphql", ["gql"], {
  keywords: GRAPHQL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("protobuf", ["proto"], {
  keywords: PROTOBUF_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("terraform", ["hcl", "tf"], {
  keywords: TERRAFORM_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#", "//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("csharp", ["cs", "c#"], {
  keywords: CSHARP_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: true,
  stringChars: ['"', "'"],
});

registerInternal("fsharp", ["fs", "f#"], {
  keywords: FSHARP_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "(*", blockCommentClose: "*)",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("ocaml", ["ml", "mli"], {
  keywords: OCAML_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "(*", blockCommentClose: "*)",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("erlang", ["erl", "hrl"], {
  keywords: ERLANG_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["%"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("julia", ["jl"], {
  keywords: JULIA_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "#=", blockCommentClose: "=#",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("matlab", ["octave"], {
  keywords: MATLAB_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["%"], blockCommentOpen: "%{", blockCommentClose: "%}",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("bash-extended", [], {
  keywords: BASH_EXT_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("fish", [], {
  keywords: FISH_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("nix", [], {
  keywords: NIX_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: ["''"], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("jsonnet", ["libsonnet"], {
  keywords: JSONNET_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("groovy", ["gradle"], {
  keywords: GROOVY_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: ['"""', "'''"], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("objective-c", ["objc", "mm"], {
  keywords: OBJC_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: true,
  stringChars: ['"', "'"],
});

registerInternal("assembly", ["asm", "x86", "arm", "nasm"], {
  keywords: ASM_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [";"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("wat", ["wasm", "wast"], {
  keywords: WAT_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [";;"], blockCommentOpen: "(;", blockCommentClose: ";)",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("makefile", ["make"], {
  keywords: MAKEFILE_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("cmake", [], {
  keywords: CMAKE_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "#[[", blockCommentClose: "]]",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("regex", ["regexp"], {
  keywords: EMPTY_SET, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: [],
});

registerInternal("glsl", ["hlsl", "shader"], {
  keywords: GLSL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: true,
  stringChars: ['"'],
});

registerInternal("solidity", ["sol"], {
  keywords: SOLIDITY_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("verilog", ["v", "sv", "systemverilog"], {
  keywords: VERILOG_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("vhdl", ["vhd"], {
  keywords: VHDL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("tcl", ["tk"], {
  keywords: TCL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("fortran", ["f90", "f95", "f03", "f08"], {
  keywords: FORTRAN_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["!"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("cobol", ["cob", "cbl"], {
  keywords: COBOL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["*>"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("diff", ["patch"], {
  keywords: DIFF_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: [],
});

registerInternal("vlang", ["v-lang"], {
  keywords: V_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("crystal", ["cr"], {
  keywords: CRYSTAL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("gleam", [], {
  keywords: GLEAM_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("mojo", ["\u{1F525}"], {
  keywords: MOJO_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: ['"""', "'''"], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("odin", [], {
  keywords: ODIN_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("roc", [], {
  keywords: ROC_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("unison", ["ucm"], {
  keywords: UNISON_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "{-", blockCommentClose: "-}",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("lean", ["lean4"], {
  keywords: LEAN_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "/-", blockCommentClose: "-/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("idris", ["idr"], {
  keywords: IDRIS_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "{-", blockCommentClose: "-}",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("agda", [], {
  keywords: AGDA_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "{-", blockCommentClose: "-}",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("coq", ["gallina"], {
  keywords: COQ_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: "(*", blockCommentClose: "*)",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("prolog", ["pl-prolog"], {
  keywords: PROLOG_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["%"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("smalltalk", ["st", "squeak"], {
  keywords: SMALLTALK_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [], blockCommentOpen: '"', blockCommentClose: '"',
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ["'"],
});

registerInternal("racket", ["rkt"], {
  keywords: RACKET_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [";;", ";"], blockCommentOpen: "#|", blockCommentClose: "|#",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("common-lisp", ["cl", "lisp"], {
  keywords: COMMON_LISP_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [";;", ";"], blockCommentOpen: "#|", blockCommentClose: "|#",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("scheme", ["scm"], {
  keywords: SCHEME_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [";;", ";"], blockCommentOpen: "#|", blockCommentClose: "|#",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("fennel", ["fnl"], {
  keywords: FENNEL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [";;", ";"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("janet", ["jpm"], {
  keywords: JANET_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("hy", [], {
  keywords: HY_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: [";;", ";"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("rescript", ["res"], {
  keywords: RESCRIPT_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("reason", ["re"], {
  keywords: REASON_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("elm", [], {
  keywords: ELM_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "{-", blockCommentClose: "-}",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("purescript", ["purs"], {
  keywords: PURESCRIPT_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["--"], blockCommentOpen: "{-", blockCommentClose: "-}",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("coffeescript", ["coffee"], {
  keywords: COFFEESCRIPT_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "###", blockCommentClose: "###",
  multilineStringDelims: ['"""', "'''"], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("livescript", ["ls"], {
  keywords: LIVESCRIPT_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: ['"""', "'''"], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("typespec", ["tsp"], {
  keywords: TYPESPEC_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: ['"""'], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("bicep", [], {
  keywords: BICEP_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ["'"],
});

registerInternal("puppet", ["pp"], {
  keywords: PUPPET_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("ansible", ["ansible-yaml"], {
  keywords: ANSIBLE_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("helm", ["helm-template"], {
  keywords: HELM_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("svelte", ["svx"], {
  keywords: SVELTE_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: true, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("vue", [], {
  keywords: VUE_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: true, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("astro", [], {
  keywords: ASTRO_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: true, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("mdx", [], {
  keywords: MDX_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "{/*", blockCommentClose: "*/}",
  multilineStringDelims: [], hasTemplateLiterals: true, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("prisma", [], {
  keywords: PRISMA_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("edgeql", [], {
  keywords: EDGEQL_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["#"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("cypher", ["neo4j"], {
  keywords: CYPHER_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"', "'"],
});

registerInternal("mermaid", ["mmd"], {
  keywords: MERMAID_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["%%"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("plantuml", ["puml"], {
  keywords: PLANTUML_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["'"], blockCommentOpen: "/'", blockCommentClose: "'/",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: ['"'],
});

registerInternal("latex", ["tex"], {
  keywords: LATEX_KEYWORDS, typeKeywords: EMPTY_SET,
  lineComment: ["%"], blockCommentOpen: "", blockCommentClose: "",
  multilineStringDelims: [], hasTemplateLiterals: false, hasPreprocessor: false,
  stringChars: [],
});

const DEFAULT_LANG_DEF: InternalLanguageDef = {
  keywords: JS_KEYWORDS, typeKeywords: JS_TYPE_KEYWORDS,
  lineComment: ["//"], blockCommentOpen: "/*", blockCommentClose: "*/",
  multilineStringDelims: [], hasTemplateLiterals: true, hasPreprocessor: false,
  stringChars: ['"', "'"], jsxAware: false, caseInsensitiveKeywords: false,
};

export function getLanguageDef(lang: string): InternalLanguageDef {
  return LANGUAGE_REGISTRY.get(lang) ?? DEFAULT_LANG_DEF;
}
