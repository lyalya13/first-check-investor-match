import { describe, expect, it } from "vitest";
import { BUSINESS_MODELS, STAGES, classifyInvestor, defaultPeopleTypes, dealSearchIndustries, filterPeopleTypes } from "@/lib/fundraising";
import { dealQueryTarget } from "@/lib/deal-query";
import { EXAMPLE } from "@/lib/example";
import { searchCacheKey } from "@/lib/search-cache";
import { scoreMatch, filterBusinessModel } from "@/lib/matching";
import { toDeals, mergeDeals } from "@/lib/cala-data";

describe("founder-friendly search rules", () => {
  it("includes the third industry without duplicate calls", () => {
    expect(dealSearchIndustries({ ...EXAMPLE, thirdIndustry: "AI" })).toEqual(["Health & Wellbeing", "Food & Nutrition", "AI"]);
    expect(dealSearchIndustries({ ...EXAMPLE, thirdIndustry: EXAMPLE.category })).toHaveLength(2);
  });
  it("queries each industry's selected niches without leaking another industry's niches", () => {
    const query = dealQueryTarget(EXAMPLE, "Health & Wellbeing");
    expect(query).toContain("FemTech OR Cycle tracking");
    expect(query).not.toContain("Food Waste");
    expect(query).toContain("B2C");
  });
  it("offers and includes every selected customer model in queries", () => {
    expect(BUSINESS_MODELS).toEqual(["B2B", "B2C", "B2B2C", "B2G", "C2C", "Other"]);
    const query = dealQueryTarget({ ...EXAMPLE, businessModels: [...BUSINESS_MODELS] }, EXAMPLE.category);
    for (const model of BUSINESS_MODELS) expect(query).toContain(model);
  });
  it("includes all selected countries and regions with OR semantics", () => {
    expect(dealQueryTarget({ ...EXAMPLE, regions: ["Sweden", "DACH", "Canada"] }, EXAMPLE.category)).toContain("Sweden OR DACH OR Canada");
  });
  it.each([["idea", "Idea"], ["pre-seed", "Pre-seed"], ["seed", "Seed"], ["series-a", "Series A"]] as const)("uses stage %s in the provider query", (stage, label) => {
    expect(STAGES).toContain(stage);
    expect(dealQueryTarget({ ...EXAMPLE, stage }, EXAMPLE.category)).toContain(`${label} funding rounds`);
  });
  it("defaults to Angel, Accelerator and Syndicate / Network through 150K", () => {
    expect(defaultPeopleTypes(40000)).toEqual(["Angel", "Accelerator", "Syndicate / Network"]);
    expect(defaultPeopleTypes(150000)).toEqual(["Angel", "Accelerator", "Syndicate / Network"]);
    expect(defaultPeopleTypes(150001)).toHaveLength(7);
  });
  it("uses provider evidence before name cues and falls back to Other", () => {
    expect(classifyInvestor("Example Ventures", "Corporate VC")).toBe("CVC");
    expect(classifyInvestor("Example Angels")).toBe("Syndicate / Network");
    expect(classifyInvestor("Example Accelerator")).toBe("Accelerator");
    expect(classifyInvestor("Example Family Office")).toBe("Family office");
    expect(classifyInvestor("Unknown Person")).toBe("Other");
  });
  it("allows independent type selections, including no selections", () => {
    const rows = [{ name: "A", kind: "Angel" }, { name: "B", kind: "VC" }, { name: "C", kind: "Accelerator" }];
    expect(filterPeopleTypes(rows, ["Angel", "Accelerator"])).toEqual([rows[0], rows[2]]);
    expect(filterPeopleTypes(rows, [])).toEqual([]);
  });
  it("parses all provider customer models without guessing", () => {
    for (const model of BUSINESS_MODELS) expect(toDeals([{ company: "A", investors: "X", business_model: model }], "AI")[0]?.businessModel).toBe(model);
    expect(toDeals([{ company: "A", investors: "X", business_model: "unknown" }], "AI")[0]?.businessModel).toBeUndefined();
  });
  it("mentions supported customer models in why they fit and filters multiple models", () => {
    const rows = [{ region: "Unknown" as const, active: false, led: 0, matchedDeals: [{ company: "A", investors: [], businessModel: "B2G" as const }] }];
    const investor = rows[0];
    if (!investor) throw new Error("Missing test investor");
    expect(scoreMatch(investor, { ...EXAMPLE, businessModels: ["B2G", "C2C"] }).reasons).toContain("Backed B2G companies — similar customers to yours");
    expect(filterBusinessModel(rows, ["B2G", "C2C"])).toEqual(rows);
    expect(filterBusinessModel(rows, ["B2B2C"])).toEqual([]);
  });
  it("normalizes multi-select order and separates changed dimensions", () => {
    const input = { ...EXAMPLE, regions: ["Sweden", "Canada"], businessModels: ["B2C", "B2G"] as const };
    const key = searchCacheKey({ ...input, businessModels: [...input.businessModels] });
    expect(searchCacheKey({ ...input, regions: [" CANADA ", "sweden"], businessModels: ["B2G", "B2C"] })).toBe(key);
    for (const change of [{ thirdIndustry: "AI" }, { regions: ["DACH"] }, { businessModels: ["C2C"] as (typeof BUSINESS_MODELS)[number][] }]) expect(searchCacheKey({ ...input, businessModels: [...input.businessModels], ...change })).not.toBe(key);
  });
  it("keeps the preset values with B2C and no third industry", () => {
    expect(EXAMPLE.businessModel).toBe("B2C");
    expect(dealSearchIndustries(EXAMPLE)).toHaveLength(2);
    expect(EXAMPLE.region).toBe("Nordics"); expect(EXAMPLE.amount).toBe(40000);
  });
  it("merges duplicate rounds across industries and regions", () => {
    expect(mergeDeals([{ company: "A", date: "2026-01-01", investors: ["X"], niches: ["FemTech"] }, { company: "a", date: "2026-01-01", investors: ["Y"], niches: ["Food Waste"] }])).toMatchObject([{ investors: ["X", "Y"], niches: ["FemTech", "Food Waste"] }]);
  });
});