import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Session replay is deliberately not enabled. It only captured replays for
// errors, yet its integration shipped in the shared bundle on every route for
// every visitor. The supported lazy path loads the integration from Sentry's
// CDN, which this app's script-src does not allow. Error reporting and tracing
// are unaffected.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
  tracesSampleRate: 0.1,
});
