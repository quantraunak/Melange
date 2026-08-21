import * as Sentry from "@sentry/nextjs";

// No DSN -> no init -> Sentry is inert. Keeps dev, CI and preview builds quiet
// without any conditional logic in app code.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Melange has no traffic yet, so sample everything. Turn this down when
    // volume makes it expensive rather than guessing now.
    tracesSampleRate: 1,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
