export type TokenRecord = {
  accessToken: string;
  expiresAtMs: number;
};

export type TokenFetcher = (url: string, init: RequestInit) => Promise<Response>;

const SKEW_MS = 60_000;

export class EbayTokenCache {
  private record: TokenRecord | null = null;
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchImpl: TokenFetcher,
    private readonly now: () => number = () => Date.now(),
    private readonly tokenUrl: string,
  ) {}

  peek(): TokenRecord | null {
    return this.record;
  }

  invalidate() {
    this.record = null;
  }

  async getToken(): Promise<string> {
    const now = this.now();
    if (this.record && this.record.expiresAtMs - SKEW_MS > now) {
      return this.record.accessToken;
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.refresh();
    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }

  private async refresh(): Promise<string> {
    const basic = btoa(`${this.clientId}:${this.clientSecret}`);
    const res = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`ebay_oauth_${res.status}`);
    }
    let json: { access_token?: string; expires_in?: number };
    try {
      json = JSON.parse(text) as { access_token?: string; expires_in?: number };
    } catch {
      throw new Error("ebay_oauth_invalid_json");
    }
    const token = String(json.access_token || "");
    const expiresIn = Number(json.expires_in || 0);
    if (!token) throw new Error("ebay_oauth_missing_token");
    const ttlMs = Math.max(30, Number.isFinite(expiresIn) ? expiresIn : 7200) * 1000;
    this.record = { accessToken: token, expiresAtMs: this.now() + ttlMs };
    return token;
  }
}
