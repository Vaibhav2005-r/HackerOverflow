import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

async function load() {
  vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
  return import("./shareClient");
}

describe("edgeShareView", () => {
  it("calls the share-view function with the token and maps the response", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      name: "Riya", kind: "sos", status: "active", coercion: true, started_at: 1000,
      last: { lat: 19.2, lng: 72.85, accuracy: 8, battery: 0.5, t: 2000 }, trail: [{ lat: 19.2, lng: 72.85, accuracy: 8, t: 1500 }], clips: [],
    })));
    vi.stubGlobal("fetch", fetchMock);
    const { edgeShareView } = await load();
    const v = await edgeShareView("a".repeat(64));
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`https://x.supabase.co/functions/v1/share-view?token=${"a".repeat(64)}`);
    expect(v).toMatchObject({ name: "Riya", kind: "sos", coercion: true, startedAt: 1000, last: { lat: 19.2 } });
    expect(v!.trail).toHaveLength(1);
  });
  it("returns null for any 404 (no detail) and throws on 429 so the poller just retries", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const { edgeShareView } = await load();
    expect(await edgeShareView("b".repeat(64))).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(edgeShareView("b".repeat(64))).rejects.toThrow("rate_limited");
  });
  it("is chosen only when both env vars exist", async () => {
    const { hasSupabase } = await load();
    expect(hasSupabase).toBe(true);
    vi.resetModules(); vi.stubEnv("VITE_SUPABASE_URL", ""); vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    expect((await import("./shareClient")).hasSupabase).toBe(false);
  });
});
