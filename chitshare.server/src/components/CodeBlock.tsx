"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      try {
        const { codeToHtml } = await import("shiki");
        const result = await codeToHtml(code, {
          lang: language || "text",
          theme: "github-dark",
        });
        if (!cancelled) {
          setHtml(result);
        }
      } catch (err) {
        console.error("Shiki highlight error:", err);
        // Try with text fallback
        try {
          const { codeToHtml } = await import("shiki");
          const result = await codeToHtml(code, {
            lang: "text",
            theme: "github-dark",
          });
          if (!cancelled) {
            setHtml(result);
          }
        } catch {
          // Ultimate fallback - just show plain code
          if (!cancelled) {
            setHtml("");
          }
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const displayLang = language || "code";

  return (
    <div className="group relative my-2 rounded-lg overflow-hidden border border-zinc-700/50 bg-[#24292e]">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between bg-zinc-800 px-3 py-1.5">
        <span className="text-zinc-400 text-[11px] font-mono">{displayLang}</span>
        <button
          onClick={copyCode}
          className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded"
          title="Copy code"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Code content */}
      {html ? (
        <div
          className="code-block-content [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:p-3 [&>pre]:overflow-x-auto [&>pre]:text-xs [&_code]:font-mono"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is safe
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="p-3 overflow-x-auto text-xs m-0 font-mono text-[#e1e4e8]">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
