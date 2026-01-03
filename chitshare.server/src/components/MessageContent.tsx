"use client";

import { useMemo } from "react";
import { CodeBlock } from "./CodeBlock";

interface MessageContentProps {
  content: string;
  isOwn: boolean;
}

// Language aliases for ``` blocks
const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  yml: "yaml",
  sh: "bash",
  zsh: "bash",
  shell: "bash",
  kt: "kotlin",
  rs: "rust",
  cs: "csharp",
  md: "markdown",
};

// ============================================
// CODE DETECTION PATTERNS
// ============================================

// JavaScript/TypeScript patterns
const JS_TS_PATTERNS = [
  /\b(const|let|var)\s+\w+\s*=/,
  /\bfunction\s+\w+\s*\(/,
  /\b(async\s+)?function\s*\(/,
  /=>\s*[{(]/,
  /\bclass\s+\w+/,
  /\b(import|export)\s+(default\s+)?[{*\w]/,
  /\bconsole\.(log|error|warn|info|debug)\s*\(/,
  /\b(await|async)\b/,
  /\b(interface|type)\s+\w+\s*[={<]/,
  /:\s*(string|number|boolean|any|void|never)\b/,
  /\bnew\s+\w+\s*\(/,
  /\.(map|filter|reduce|forEach|find|some|every)\s*\(/,
  /\b(try|catch|finally)\s*[{(]/,
  /\b(if|else if|else)\s*[({]/,
  /\bthrow\s+new\s+\w*Error/,
  /\breturn\s+[^;]*;?/,
  /\bmodule\.exports\b/,
  /require\s*\(\s*['"`]/,
  /\bPromise\.(all|race|resolve|reject)\s*\(/,
  /\.then\s*\(\s*(async\s*)?\(/,
  /\bsetTimeout|setInterval|clearTimeout|clearInterval\b/,
  /document\.(getElementById|querySelector|createElement)\s*\(/,
  /window\.\w+/,
  /\bevent\.(preventDefault|stopPropagation)\s*\(/,
];

// React/JSX patterns
const REACT_PATTERNS = [
  /<[A-Z]\w*[\s/>]/,
  /className\s*=\s*[{'"]/,
  /\buseState|useEffect|useCallback|useMemo|useRef\b/,
  /\bReact\.\w+/,
  /<\/\w+>/,
  /\{[^}]*\}/,
  /onClick|onChange|onSubmit|onKeyDown/,
  /props\.\w+/,
];

// Python patterns
const PYTHON_PATTERNS = [
  /\bdef\s+\w+\s*\([^)]*\)\s*:/,
  /\bclass\s+\w+(\([^)]*\))?\s*:/,
  /\bimport\s+\w+|from\s+\w+\s+import/,
  /\bif\s+.+:\s*$/m,
  /\bfor\s+\w+\s+in\s+/,
  /\bwhile\s+.+:/,
  /\bprint\s*\(/,
  /\bself\.\w+/,
  /\b(True|False|None)\b/,
  /\blambda\s+\w+\s*:/,
  /\bwith\s+.+\s+as\s+\w+:/,
  /\b(try|except|finally|raise)\b.*:/,
  /\basync\s+def\b/,
  /\bawait\s+\w+/,
  /__\w+__/,
  /\blist|dict|tuple|set\s*\(/,
  /\[\s*\w+\s+for\s+\w+\s+in\s+/,
];

// Java/Kotlin patterns
const JAVA_KOTLIN_PATTERNS = [
  /\bpublic\s+(static\s+)?(void|class|interface)\b/,
  /\bprivate\s+(final\s+)?\w+\s+\w+/,
  /\bSystem\.(out|err)\.(print|println)\s*\(/,
  /\bString\s+\w+\s*=/,
  /\bnew\s+\w+(<[^>]+>)?\s*\(/,
  /\bpackage\s+[\w.]+;/,
  /\b(extends|implements)\s+\w+/,
  /\b@\w+(\([^)]*\))?/,
  /\bfun\s+\w+\s*\(/,
  /\bval\s+\w+\s*[:=]/,
  /\bvar\s+\w+\s*[:=]/,
  /\bdata\s+class\b/,
];

// C/C++ patterns
const C_CPP_PATTERNS = [
  /#include\s*[<"]/,
  /\bint\s+main\s*\(/,
  /\b(int|char|float|double|void|long)\s+\w+\s*[=;(]/,
  /\bstd::\w+/,
  /\bcout\s*<</,
  /\bcin\s*>>/,
  /\bprintf\s*\(/,
  /\bscanf\s*\(/,
  /\bstruct\s+\w+\s*\{/,
  /\btemplate\s*</,
  /\bclass\s+\w+\s*:\s*(public|private|protected)/,
  /\b(nullptr|NULL)\b/,
  /\bsizeof\s*\(/,
  /\*\w+\s*=|&\w+/,
  /malloc\s*\(|free\s*\(/,
];

// Go patterns
const GO_PATTERNS = [
  /\bpackage\s+\w+$/m,
  /\bfunc\s+(\([^)]+\)\s+)?\w+\s*\(/,
  /\bimport\s+\(/,
  /\bgo\s+func\s*\(/,
  /\bchan\s+\w+/,
  /\bdefer\s+\w+/,
  /\b(make|append|len|cap)\s*\(/,
  /\btype\s+\w+\s+(struct|interface)\s*\{/,
  /\brange\s+\w+/,
  /\b(select|case)\s*.*:/,
  /\bfmt\.(Print|Println|Printf|Sprintf)\s*\(/,
  /:=|err\s*!=\s*nil/,
];

// Rust patterns
const RUST_PATTERNS = [
  /\bfn\s+\w+\s*(<[^>]+>)?\s*\(/,
  /\blet\s+(mut\s+)?\w+\s*[:=]/,
  /\bimpl\s+(<[^>]+>\s+)?\w+/,
  /\bstruct\s+\w+\s*[<{]/,
  /\benum\s+\w+\s*\{/,
  /\b(pub|priv)\s+(fn|struct|enum|trait)\b/,
  /\bmatch\s+\w+\s*\{/,
  /\buse\s+(crate|super|self)?\s*::/,
  /\b(Option|Result|Vec|String|Box)\s*[<:]/,
  /->\s*\w+/,
  /\bmod\s+\w+/,
  /println!\s*\(|format!\s*\(/,
  /\bunwrap\s*\(\)|expect\s*\(/,
  /&mut\s+\w+|&\w+/,
];

// SQL patterns
const SQL_PATTERNS = [
  /\bSELECT\s+(\*|\w+)/i,
  /\bFROM\s+\w+/i,
  /\bWHERE\s+\w+/i,
  /\b(INNER|LEFT|RIGHT|FULL)\s+JOIN\b/i,
  /\bINSERT\s+INTO\s+\w+/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bDELETE\s+FROM\s+\w+/i,
  /\bCREATE\s+(TABLE|INDEX|VIEW|DATABASE)\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bGROUP\s+BY\b/i,
  /\bORDER\s+BY\b/i,
];

// CSS patterns
const CSS_PATTERNS = [
  /^\s*[.#]?\w+(-\w+)*\s*\{/m,
  /\b(margin|padding|color|background|font|border|display|position)\s*:/i,
  /\burl\s*\(/,
  /\b(px|em|rem|%|vh|vw)\b/,
  /\b(flex|grid|block|inline|none)\b/,
  /\b@media\s+/,
  /\b@keyframes\s+\w+/,
  /\brgba?\s*\(/,
  /\bvar\s*\(--\w+\)/,
];

// HTML patterns
const HTML_PATTERNS = [
  /<!DOCTYPE\s+html>/i,
  /<html[^>]*>/i,
  /<(head|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|form|input|button|script|style|link|meta)[^>]*>/i,
  /<\/\w+>/,
  /\s+(id|class|src|href|alt|title|style)\s*=/,
];

// JSON patterns
const JSON_PATTERNS = [
  /^\s*\{[\s\S]*\}\s*$/,
  /^\s*\[[\s\S]*\]\s*$/,
  /"[\w]+":\s*("[^"]*"|\d+|true|false|null|\{|\[)/,
];

// Shell/Bash patterns
const SHELL_PATTERNS = [
  /^#!/,
  /\$\(.*\)/,
  /\$\{?\w+\}?/,
  /\becho\s+/,
  /\b(cd|ls|mkdir|rm|mv|cp|cat|grep|awk|sed)\s+/,
  /\bif\s+\[\s+/,
  /\bdo\s*$/m,
  /\b(exit|export|source|alias)\s+/,
  /\|\s*\w+/,
  />\s*\w+|<\s*\w+/,
];

// YAML patterns
const YAML_PATTERNS = [
  /^\s*\w+:\s+.+$/m,
  /^\s*-\s+\w+/m,
  /^\s{2,}\w+:/m,
  /:\s*\|$/m,
  /:\s*>$/m,
];

// Patterns that indicate NOT code
const NOT_CODE_PATTERNS = [
  /^(hi|hello|hey|thanks|ok|yes|no|sure|okay|please|sorry|thank you|bye|goodbye)[\s!?.]*$/i,
  /^(what|how|why|when|where|who|can|could|would|should|is|are|do|does|did|have|has|had)[^{};=<>]*\?$/i,
  /^(I|you|we|they|he|she|it)\s+(am|is|are|was|were|will|would|can|could|should|have|has|had)\s+[^{};=<>]*$/i,
  /^[\w\s,.'!?-]{1,50}$/,
];

function matchPatterns(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) count++;
  }
  return count;
}

function detectLanguage(code: string): string {
  const scores: Record<string, number> = {
    javascript: matchPatterns(code, JS_TS_PATTERNS),
    typescript: matchPatterns(code, JS_TS_PATTERNS) + (code.includes(": string") || code.includes(": number") || code.includes("interface ") ? 3 : 0),
    tsx: matchPatterns(code, JS_TS_PATTERNS) + matchPatterns(code, REACT_PATTERNS),
    python: matchPatterns(code, PYTHON_PATTERNS),
    java: matchPatterns(code, JAVA_KOTLIN_PATTERNS),
    cpp: matchPatterns(code, C_CPP_PATTERNS),
    go: matchPatterns(code, GO_PATTERNS),
    rust: matchPatterns(code, RUST_PATTERNS),
    sql: matchPatterns(code, SQL_PATTERNS),
    css: matchPatterns(code, CSS_PATTERNS),
    html: matchPatterns(code, HTML_PATTERNS),
    json: matchPatterns(code, JSON_PATTERNS),
    bash: matchPatterns(code, SHELL_PATTERNS),
    yaml: matchPatterns(code, YAML_PATTERNS),
  };

  let maxLang = "text";
  let maxScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxLang = lang;
    }
  }
  return maxScore >= 1 ? maxLang : "text";
}

function looksLikeCode(text: string): boolean {
  if (text.length < 10) return false;
  
  for (const pattern of NOT_CODE_PATTERNS) {
    if (pattern.test(text.trim())) return false;
  }
  
  const allPatterns = [
    ...JS_TS_PATTERNS, ...REACT_PATTERNS, ...PYTHON_PATTERNS,
    ...JAVA_KOTLIN_PATTERNS, ...C_CPP_PATTERNS, ...GO_PATTERNS,
    ...RUST_PATTERNS, ...SQL_PATTERNS, ...CSS_PATTERNS,
    ...HTML_PATTERNS, ...JSON_PATTERNS, ...SHELL_PATTERNS, ...YAML_PATTERNS,
  ];
  
  let codeScore = matchPatterns(text, allPatterns);
  
  const hasMultipleLines = (text.match(/\n/g) || []).length >= 1;
  const hasIndentation = /\n\s{2,}/.test(text);
  const hasBraces = /[{}]/.test(text);
  const hasSemicolons = /;\s*(\n|$)/.test(text);
  const hasParens = /\([^)]*\)/.test(text);
  const hasOperators = /[=!<>]=|&&|\|\|/.test(text);
  
  if (hasIndentation) codeScore += 3;
  if (hasBraces && hasMultipleLines) codeScore += 2;
  if (hasSemicolons) codeScore += 1;
  if (hasOperators) codeScore += 1;
  if (hasParens && hasMultipleLines) codeScore += 1;
  
  return codeScore >= 2;
}

interface TextPart { type: "text"; content: string; }
interface CodePart { type: "code"; language: string; code: string; }
type ContentPart = TextPart | CodePart;

function parseMessage(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasExplicitBlocks = false;

  while ((match = regex.exec(content)) !== null) {
    hasExplicitBlocks = true;
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: "text", content: text });
    }
    const rawLang = match[1].toLowerCase();
    const language = LANG_ALIASES[rawLang] || rawLang || "text";
    parts.push({ type: "code", language, code: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (hasExplicitBlocks) {
    if (lastIndex < content.length) {
      const text = content.slice(lastIndex).trim();
      if (text) parts.push({ type: "text", content: text });
    }
    return parts;
  }

  if (looksLikeCode(content)) {
    const language = detectLanguage(content);
    return [{ type: "code", language, code: content }];
  }

  return [{ type: "text", content }];
}

// Export function to check if content is code (for parent styling)
export function isCodeMessage(content: string): boolean {
  const parts = parseMessage(content);
  return parts.length === 1 && parts[0].type === "code";
}

export function MessageContent({ content }: MessageContentProps) {
  const parts = useMemo(() => parseMessage(content), [content]);
  const isOnlyCode = parts.length === 1 && parts[0].type === "code";

  // If only code, render without wrapper
  if (isOnlyCode) {
    const part = parts[0] as CodePart;
    return <CodeBlock code={part.code} language={part.language} />;
  }

  const hasCode = parts.some((p) => p.type === "code");

  if (!hasCode) {
    return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className="text-sm break-words">
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <p key={i} className="whitespace-pre-wrap my-1">{part.content}</p>;
        }
        return <CodeBlock key={i} code={part.code} language={part.language} />;
      })}
    </div>
  );
}
