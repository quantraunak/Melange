import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports (internal)",
  robots: { index: false, follow: false },
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_kind: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

export default async function InternalReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const adminKey = process.env.ADMIN_REPORTS_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminKey || params.key !== adminKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-gray-600">Unauthorized. Set ADMIN_REPORTS_KEY and open /internal/reports?key=...</p>
      </div>
    );
  }

  if (!url || !serviceKey) {
    return (
      <div className="min-h-screen p-8 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-red-700">Missing env</h1>
        <p className="text-sm text-gray-600 mt-2">
          Add SUPABASE_SERVICE_ROLE_KEY to Vercel / .env.local (server only, never expose to client).
        </p>
      </div>
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: reports, error } = await admin
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Moderation queue</h1>
        <p className="text-sm text-gray-500 mb-6">Pending user reports — respond within 24h per App Store guidelines.</p>

        {error ? (
          <p className="text-red-600 text-sm">{error.message}</p>
        ) : !reports?.length ? (
          <p className="text-gray-500 text-sm">No reports yet.</p>
        ) : (
          <div className="space-y-3">
            {(reports as ReportRow[]).map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
                <div className="flex justify-between gap-2 mb-2">
                  <span className="font-semibold text-gray-900 capitalize">{r.status}</span>
                  <span className="text-gray-400 text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p>
                  <span className="text-gray-500">Kind:</span> {r.target_kind}{" "}
                  <span className="text-gray-400 font-mono text-xs">{r.target_id}</span>
                </p>
                <p>
                  <span className="text-gray-500">Reason:</span> {r.reason}
                </p>
                {r.details ? (
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{r.details}</p>
                ) : null}
                <p className="mt-2 text-xs text-gray-400">Reporter: {r.reporter_id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
