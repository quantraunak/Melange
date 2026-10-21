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
    <div className="flex flex-col items-start gap-3">
      <p className="select-all whitespace-nowrap font-mono text-[clamp(1.5rem,7.5vw,3rem)] font-bold tracking-[0.08em] text-ink">
        {code}
      </p>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-md border border-ink bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper"
      >
        {state === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {state === "copied" ? "Copied" : "Copy code"}
      </button>
      {state === "failed" ? (
        <p className="text-sm text-muted-ink">Couldn&apos;t copy. Press and hold the code to copy it.</p>
      ) : null}
    </div>
  );
}
