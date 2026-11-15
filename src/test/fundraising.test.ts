import { describe, expect, it } from "vitest";
import { defaultFilter, guidanceTier, ticketFit, filterInvestors, CATEGORIES } from "@/lib/fundraising";
import { mergeDeals, toDeals, amountValue, MIN_NICHE_DEALS } from "@/lib/cala-data";

describe("fundraising amount rules", () => {
  it("starts with angels, grants and accelerators up to 50K", () => { expect(guidanceTier(50000)).toBe("small"); expect(guidanceTier(50001)).toBe("angels"); });
  it("starts with angel networks up to 150K", () => { expect(guidanceTier(150000)).toBe("angels"); expect(guidanceTier(150001)).toBe("preseed"); });
  it("starts with angels and pre-seed funds up to 1M", () => { expect(guidanceTier(1000000)).toBe("preseed"); expect(guidanceTier(1000001)).toBe("seed"); });
  it("defaults to angels first through 150K", () => { expect(defaultFilter(40000)).toBe("Angels first"); expect(defaultFilter(150000)).toBe("Angels first"); expect(defaultFilter(150001)).toBe("All"); });
  it("flags only tickets strictly above five times the raise", () => { expect(ticketFit(200001, 40000)).toBe("bigger"); expect(ticketFit(200000, 40000)).toBe("fits"); });
  it("shows nothing for an unknown ticket or zero raise", () => { expect(ticketFit(null, 40000)).toBeNull(); expect(ticketFit(100, 0)).toBeNull(); });
  it("orders angels first and filters funds", () => { const rows = [{type: "fund" as const}, {type: "angel" as const}]; expect(filterInvestors(rows, "Angels first")[0]?.type).toBe("angel"); expect(filterInvestors(rows, "Funds")).toEqual([rows[0]]); });
});
describe("niche queries", () => {
  it("supports the requested cross-category example", () => { expect(CATEGORIES["Health & Wellbeing"]).toContain("FemTech"); expect(CATEGORIES["Health & Wellbeing"]).toContain("Women's Health"); expect(CATEGORIES["Food & Nutrition"]).toContain("Meal Planning"); expect(CATEGORIES["Food & Nutrition"]).toContain("Food Waste"); });
  it("merges company plus date and retains both niches", () => { const rows = mergeDeals([{company:"Fée",date:"2026-01-01",investors:["A"],niches:["FemTech"]},{company:"fée",date:"2026-01-01",investors:["B"],niches:["Meal Planning"]},{company:"Fée",date:"2025-01-01",investors:["A"]}]); expect(rows).toHaveLength(2); expect(rows[0]?.niches).toEqual(["FemTech","Meal Planning"]); expect(rows[0]?.investors).toEqual(["A","B"]); });
  it("broadens only below five unique deals", () => { expect(MIN_NICHE_DEALS).toBe(5); });
  it("parses field aliases and retains provenance", () => { const rows = toDeals({results:[{company_name:"Fée",investor_names:[{name:"Fund X"}],lead_investor:"Fund X",amount_raised:"€1.5 million",announcement_date:"2026-01-01",source_url:"https://example.org/round"}]},"FemTech"); expect(rows[0]).toMatchObject({company:"Fée", investors:["Fund X"], lead:"Fund X",amount:1500000,date:"2026-01-01",niches:["FemTech"]}); });
  it("parses magnitude strings instead of treating millions as units", () => { expect(amountValue("over 100M")).toBe(100000000); });
});