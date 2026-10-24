import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function loader() {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const state = new Map<string, string>();
  const timers: (() => void)[] = []; const loaded: string[] = []; const signals: string[] = [];
  const window = { addEventListener: () => {}, dispatchEvent: (e: {type: string}) => signals.push(e.type) };
  const localStorage = { getItem: (k: string) => state.get(k), setItem: (k: string,v: string) => state.set(k,v) };
  const context = { window, localStorage, location: { pathname: "/christmas" }, Event: class { constructor(public type: string) {} }, setTimeout: (fn: () => void) => timers.push(fn), document: { head: { appendChild: (s: {src: string}) => loaded.push(s.src) }, readyState: "complete", createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore: (s: {src: string}) => loaded.push(s.src) } }] } };
  Object.assign(context, window);
  Object.assign(context, { window: context });
  for (const source of scripts.slice(0, 2)) runInNewContext(source, context);
  return { run: (source: string) => runInNewContext(source, context), timers, loaded, signals };
}
describe("Meta consent loader", () => {
  it("starts after late consent on an already loaded Christmas page", () => {
    const h = loader(); expect(h.loaded).toEqual([]);
    h.run('window.__tdgSetCookieConsent("granted")');
    for (const boot of h.timers) boot();
    expect(h.loaded).toContain("https://connect.facebook.net/en_US/fbevents.js");
  });
  it("does not load marketing scripts if consent is revoked during the delay", () => {
    const h = loader(); h.run('window.__tdgSetCookieConsent("granted"); window.__tdgSetCookieConsent("denied")');
    for (const boot of h.timers) boot();
    expect(h.loaded).toEqual([]);
  });
});
