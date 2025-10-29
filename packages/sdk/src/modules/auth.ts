import { HttpClient } from "../client";

export type AuthExchangeRequest = {
  apiKey: string;
  tenantId?: string;
};

export type AuthExchangeResponse = {
  token: string;
  expiresAt: string;
};

export class AuthModule {
  constructor(private readonly client: HttpClient) {}

  exchange(input: AuthExchangeRequest) {
    return this.client.request<AuthExchangeResponse>("/api/auth/sdk-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
}
