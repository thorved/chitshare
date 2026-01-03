"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
    <Dialog>
      <div className="group relative my-2 rounded-lg overflow-hidden border border-zinc-700/50 bg-[#24292e]">
        {/* Header with language and copy button */}
        <div className="flex items-center justify-between bg-zinc-800 px-3 py-1.5">
          <span className="text-zinc-400 text-[11px] font-mono">{displayLang}</span>
          <div className="flex items-center gap-2">
            <DialogTrigger asChild>
              <button
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded"
                title="Open in full screen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </DialogTrigger>
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
        </div>

        {/* Code content */}
        {html ? (
          <div
            className="code-block-content max-h-80 overflow-y-auto custom-scrollbar [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:p-3 [&>pre]:overflow-x-auto [&>pre]:text-xs [&_code]:font-mono"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is safe
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-3 overflow-x-auto text-xs m-0 font-mono text-[#e1e4e8] max-h-80 overflow-y-auto custom-scrollbar">
            <code>{code}</code>
          </pre>
        )}
      </div>

      <DialogContent className="max-w-none w-screen h-screen max-h-none flex flex-col bg-[#0d1117] border-none p-0 overflow-hidden rounded-none translate-x-0 translate-y-0 top-0 left-0 data-[state=open]:slide-in-from-bottom-0 sm:max-w-none">
        <DialogHeader className="px-4 py-3 border-b border-zinc-800 shrink-0 bg-zinc-900">
          <div className="flex items-center justify-between mr-8">
            <DialogTitle className="text-sm font-mono text-zinc-400">
              {displayLang}
            </DialogTitle>
            {/* Copy button in modal */}
            <button
              onClick={copyCode}
              className="text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-2 text-xs px-2 py-1 rounded bg-zinc-800"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          {html ? (
            <div
              className="code-block-content [&>pre]:!m-0 [&>pre]:!bg-transparent [&_code]:font-mono"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="m-0 font-mono text-[#e1e4e8]">
              <code>{code}</code>
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
