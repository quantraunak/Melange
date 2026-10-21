"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** The invite code, big, with a copy button that says when it worked. */
export default function CopyCode({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Clipboard can be blocked (http, old browsers). The code is selectable.
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="select-all break-all font-mono text-4xl font-bold tracking-[0.12em] text-slate-900 sm:text-5xl">
        {code}
      </p>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-900 transition hover:bg-indigo-50"
      >
        {state === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {state === "copied" ? "Copied" : "Copy code"}
      </button>
      {state === "failed" ? (
        <p className="text-sm text-slate-500">Couldn&apos;t copy. Press and hold the code to copy it.</p>
      ) : null}
    </div>
  );
}
