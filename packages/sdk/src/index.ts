import { HttpClient, type DevlogiaSDKOptions } from "./client";
import { AuthModule } from "./modules/auth";
import { FederationModule } from "./modules/federation";
import { FeedModule } from "./modules/feed";
import { InsightsModule } from "./modules/insights";

export class DevlogiaSDK {
  readonly feed: FeedModule;
  readonly insights: InsightsModule;
  readonly federation: FederationModule;
  readonly auth: AuthModule;

  constructor(options: DevlogiaSDKOptions = {}) {
    const client = new HttpClient(options);
    this.feed = new FeedModule(client);
    this.insights = new InsightsModule(client);
    this.federation = new FederationModule(client);
    this.auth = new AuthModule(client);
  }
}

export type { DevlogiaSDKOptions } from "./client";
export type { FeedItem } from "./modules/feed";
export type { InsightSummary } from "./modules/insights";
export type { FederationRequest, FederationResponse } from "./modules/federation";
export type { AuthExchangeRequest, AuthExchangeResponse } from "./modules/auth";
