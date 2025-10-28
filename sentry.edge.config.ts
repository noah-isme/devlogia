import * as Sentry from "@sentry/nextjs";

import { createSentryOptions } from "./sentry.config";

Sentry.init({
  ...createSentryOptions("edge"),
});
