"use client";

import { useEffect } from "react";
import { reportError } from "./lib/monitoring";

/**
 * Last-resort boundary. Before this existed, a render-time crash left a blank
 * white page and produced no signal anywhere.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest, boundary: "global" });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Something broke on our end
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            This wasn&apos;t your fault, and we&apos;ve been notified. Try again
            — if it keeps happening, email support@melange.app.
          </p>
          <button
            onClick={reset}
            className="melange-btn-primary mt-7 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
