import { describe, expect, it, vi } from "vitest";
import { calaSearchError } from "@/lib/cala-errors";
import { resolveCachedSearch } from "@/lib/search-cache";

describe("calm rate-limit fallback", () => {
  it("reports a calm message without cache", () => { expect(calaSearchError("CALA_RATE_LIMIT")).toBe("Cala is busy, try again in a minute"); expect(calaSearchError("Cala 429")).toBe("Cala is busy, try again in a minute"); });
  it("retains cached Cala output when rate-limited", async () => { const saved = { investors: ["provider-produced result"] }; const result = await resolveCachedSearch({ cached: { result: saved, fetchedAt: "2026-01-01T00:00:00Z" }, now: Date.parse("2026-11-15T05:15:00Z"), fetchLive: async () => { throw new Error("CALA_RATE_LIMIT"); }, save: vi.fn() }); expect(result.result).toBe(saved); expect(result.cached).toBe(true); expect(result.stale).toBe(true); });
});