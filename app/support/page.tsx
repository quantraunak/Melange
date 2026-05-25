import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support · Melange",
  description: "Contact Melange support for help with your account.",
};

export default function SupportPage() {
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

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Support</h1>
        <p className="text-sm text-gray-500 mb-8">We typically respond within 2 business days.</p>

        <div className="text-gray-700 leading-relaxed space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">Contact us</h2>
            <p>
              For account help, reports, moderation concerns, or App Store review questions:
            </p>
            <p>
              <a href="mailto:support@melange.app" className="text-blue-700 font-semibold hover:underline">
                support@melange.app
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">In-app help</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Report a user or post from the flag icon on posts or in chat.</li>
              <li>Block someone from the conversation menu in Messages.</li>
              <li>Delete your account under Profile → Account &amp; safety.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">Legal</h2>
            <p>
              <Link href="/privacy" className="text-blue-700 hover:underline">
                Privacy Policy
              </Link>
              {" · "}
              <Link href="/terms" className="text-blue-700 hover:underline">
                Terms of Service
              </Link>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 px-4 mt-12">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <span>© {new Date().getFullYear()} Melange</span>
          <Link href="/" className="hover:text-gray-700">
            Back to app
          </Link>
        </div>
      </footer>
    </div>
  );
}
