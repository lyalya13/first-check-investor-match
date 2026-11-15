import { describe, it, expect, vi } from "vitest";
import { CACHE_TTL_MS, searchCacheKey, cacheIsFresh, resolveCachedSearch } from "@/lib/search-cache";
import { EXAMPLE } from "@/lib/example";

describe("24-hour Cala cache", () => {
  const now = Date.parse("2026-11-15T03:20:00Z");
  it("normalizes niche order, duplicates, case and whitespace", () => {
    expect(searchCacheKey({ ...EXAMPLE, region: "  NORDICS / EUROPE ", niches: [...EXAMPLE.niches].reverse().concat(EXAMPLE.niches).map((n) => ({ ...n, name: ` ${n.name.toUpperCase()} ` })) })).toBe(searchCacheKey(EXAMPLE));
  });
  it("separates changes in niches, region, stage and amount", () => {
    for (const change of [{ niches: [] }, { region: "Germany" }, { stage: "seed" }, { amount: 50000 }]) expect(searchCacheKey({ ...EXAMPLE, ...change })).not.toBe(searchCacheKey(EXAMPLE));
  });
  it("expires at exactly 24 hours", () => {
    expect(CACHE_TTL_MS).toBe(86400000);
    expect(cacheIsFresh(new Date(now - 86400000 + 1).toISOString(), now)).toBe(true);
    expect(cacheIsFresh(new Date(now - 86400000).toISOString(), now)).toBe(false);
  });
  it("returns fresh results without calling Cala", async () => {
    const fetchLive = vi.fn();
    const result = await resolveCachedSearch({ cached: { result: "saved", fetchedAt: new Date(now - 1000).toISOString() }, fetchLive, save: vi.fn(), now });
    expect(result.result).toBe("saved"); expect(fetchLive).not.toHaveBeenCalled();
  });
  it("serves the precomputed example instantly even after expiry", async () => {
    const fetchLive = vi.fn();
    const result = await resolveCachedSearch({ cached: { result: "example", fetchedAt: "2026-11-01T00:00:00Z", example: true }, fetchLive, save: vi.fn(), now });
    expect(result.result).toBe("example"); expect(result.stale).toBe(true); expect(fetchLive).not.toHaveBeenCalled();
  });
  it("falls back to stale results when Cala fails", async () => {
    const result = await resolveCachedSearch({ cached: { result: "saved", fetchedAt: "2026-11-01T00:00:00Z" }, fetchLive: async () => { throw new Error("Cala 429"); }, save: vi.fn(), now });
    expect(result.result).toBe("saved"); expect(result.stale).toBe(true);
  });
  it("stores refreshed successful results", async () => {
    const save = vi.fn(async () => undefined);
    const result = await resolveCachedSearch({ cached: null, fetchLive: async () => "live", save, now });
    expect(save).toHaveBeenCalledWith("live"); expect(result.cached).toBe(false);
  });
  it("does not hide errors when no cached result exists", async () => {
    await expect(resolveCachedSearch({ cached: null, fetchLive: async () => { throw new Error("Cala 429"); }, save: vi.fn(), now })).rejects.toThrow("Cala 429");
  });
});