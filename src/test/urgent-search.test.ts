import { describe, expect, it, vi } from "vitest";
import { CALA_SEARCH_CONCURRENCY, parallelMap, retryCala } from "@/lib/search-performance";
import { similarStartups } from "@/lib/similar-startups";
import { introMessage } from "@/lib/matching";
import { dealQueryTarget } from "@/lib/deal-query";
import { EXAMPLE } from "@/lib/example";
import { calaSearchError } from "@/lib/cala-errors";
import { toDeals } from "@/lib/cala-data";

describe("urgent search reliability", () => {
  it("distinguishes exhausted provider timeouts from invalid input", () => {
    expect(calaSearchError("CALA_TIMEOUT")).not.toBe(calaSearchError("Cala 400"));
  });
  it("limits industry queries to two at once", async () => {
    let running = 0, peak = 0;
    await parallelMap([1, 2, 3], async () => { running++; peak = Math.max(peak, running); await Promise.resolve(); running--; }, CALA_SEARCH_CONCURRENCY);
    expect(peak).toBe(2);
  });
  it("retries a timeout once and returns the recovered response", async () => {
    const call = vi.fn().mockRejectedValueOnce(new Error("The operation was aborted due to timeout")).mockResolvedValueOnce(["provider result"]);
    expect(await retryCala(call, async () => {})).toEqual(["provider result"]);
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("never retries more than once", async () => {
    const call = vi.fn().mockRejectedValue(new Error("Cala 503"));
    await expect(retryCala(call, async () => {})).rejects.toThrow("Cala 503");
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("retries a rate limit once", async () => {
    const call = vi.fn().mockRejectedValueOnce(new Error("Cala 429")).mockResolvedValueOnce("recovered");
    expect(await retryCala(call, async () => {})).toBe("recovered");
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("does not retry missing credentials or invalid queries", async () => {
    for (const message of ["MISSING_KEY", "Cala 400", "Cala 401"]) {
      const call = vi.fn().mockRejectedValue(new Error(message));
      await expect(retryCala(call, async () => {})).rejects.toThrow(message);
      expect(call).toHaveBeenCalledTimes(1);
    }
  });
  it("keeps successful query results when another exhausts its retry", async () => {
    const result = await parallelMap(["slow", "healthy"], async (industry) => {
      try { return await retryCala(async () => { if (industry === "slow") throw new Error("Cala 503"); return [industry]; }, async () => {}); }
      catch { return []; }
    }, CALA_SEARCH_CONCURRENCY);
    expect(result.flat()).toEqual(["healthy"]);
  });
  it("includes the requested niches, B2C, Finland, Europe and Pre-seed", () => {
    const input = { ...EXAMPLE, regions: ["Finland", "Europe"], businessModels: ["B2C" as const] };
    const query = dealQueryTarget(input, "Health & Wellbeing");
    expect(query).toContain("FemTech"); expect(query).toContain("B2C");
    expect(query).toContain("Finland OR Europe"); expect(query).toContain("Pre-seed funding rounds");
  });
});

describe("similar startups from existing Cala deals", () => {
  it("does not present Cala's Not disclosed placeholder as a real investor", () => {
    expect(toDeals([{ company: "YON E Health", investors: "Not disclosed", company_niches: "FemTech" }], "Health & Wellbeing")).toEqual([]);
    expect(toDeals([{ company: "PimpUp", investors: "Denis Fayolle, Not disclosed" }], "Food & Nutrition")[0]?.investors).toEqual(["Denis Fayolle"]);
  });
  const deal = { company: "Verified Company", date: "2026-01-01", investors: ["Investor A"], focusNiches: ["FemTech"] };
  it("deduplicates rounds while retaining every named investor", () => {
    expect(similarStartups([{ matchedDeals: [deal] }, { matchedDeals: [{ ...deal, investors: ["Investor B"] }] }], [{ name: "FemTech" }])).toMatchObject([{ company: "Verified Company", investors: ["Investor A", "Investor B"] }]);
  });
  it("excludes unsupported niche matches based only on query provenance", () => {
    expect(similarStartups([{ matchedDeals: [{ ...deal, focusNiches: ["Grocery inventory"], niches: ["FemTech"] }] }], [{ name: "FemTech" }])).toEqual([]);
  });
  it("shows existing similar industry deals when niches are not selected", () => {
    expect(similarStartups([{ matchedDeals: [deal] }], [])).toEqual([deal]);
  });
  it("includes company deals outside the top ten investor profiles", () => {
    expect(similarStartups([], [{ name: "FemTech" }], [deal])).toEqual([deal]);
  });
  it("drafts a short introduction request from a returned founder relationship", () => {
    const draft = introMessage("a nutrition app", "Investor A", deal.company, "Returned Founder");
    expect(draft).toContain("Hi Returned Founder"); expect(draft).toContain("Verified Company raised from Investor A");
    expect(draft).toContain("introducing me"); expect(draft.length).toBeLessThan(500);
  });
});
describe("combined Cala queries", () => {
  it("combines niches, countries, stage and B2C into one structured and one fallback query", async () => {
    const { combinedDealQueries } = await import("@/lib/deal-query");
    const q = combinedDealQueries({ ...EXAMPLE, regions: ["Finland", "Europe"], businessModels: ["B2C"] });
    expect(Object.keys(q)).toHaveLength(2);
    for (const text of [q.structured, q.fallback]) { expect(text).toContain("FemTech"); expect(text).toContain("Food Waste"); expect(text).toContain("Finland"); expect(text).toContain("Europe"); expect(text).toContain("B2C"); expect(text).toContain("Pre-seed"); }
  });
});
