import * as Sentry from "@sentry/nextjs";

import { createSentryOptions } from "./sentry.config";

Sentry.init({
  ...createSentryOptions("client"),
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
