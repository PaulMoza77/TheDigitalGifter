// Local-only runner for the actual deployed Edge implementations.
const port = Number(Deno.args[0]);
const target = Deno.args[1];
if (!Number.isInteger(port) || port < 1024 || !target) throw new Error("port and function module required");
if (Deno.env.get("TDG_ISOLATED_TEST") !== "1") throw new Error("Isolated test marker required");
const db = new URL(Deno.env.get("SUPABASE_URL") || "");
if (db.hostname !== "127.0.0.1") throw new Error("Only a loopback Supabase is permitted");
const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
if (!key.startsWith("sk_test_")) throw new Error("Only Stripe TEST credentials are permitted");
const nativeFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "api.resend.com") {
    // Execute real email rendering/persistence, capture transport locally.
    return nativeFetch("http://127.0.0.1:58421/test-email-sink", init);
  }
  if (url.hostname !== "127.0.0.1" && url.hostname !== "api.stripe.com") {
    throw new Error(`Isolated test blocked outbound provider: ${url.hostname}`);
  }
  if (url.hostname === "api.stripe.com") {
    if (Deno.env.get("TDG_OFFLINE_TEST") === "1") throw new Error("Stripe network disabled in fixture mode");
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.get("authorization")?.startsWith("Bearer sk_test_")) throw new Error("Non-TEST Stripe request blocked");
  }
  return nativeFetch(input, init);
}) as typeof fetch;
const serve = Deno.serve;
Deno.serve = ((handler: Deno.ServeHandler) => serve({ hostname: "127.0.0.1", port }, handler)) as typeof Deno.serve;
await import(new URL(target, `file://${Deno.cwd()}/`).href);
