import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Set a new password for your Melange account.",
};

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-blue-900 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-bold italic"
            style={{ WebkitTextStroke: "1px #A78BFA", paintOrder: "stroke fill" }}
          >
            Melange
          </Link>
          <Link href="/" className="text-sm text-blue-200 hover:text-white">
            Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-12">
        <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
