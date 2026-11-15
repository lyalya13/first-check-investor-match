import { describe, it, expect } from "vitest";
import { preserveArrivedResults } from "@/lib/search-state";
import { consolidateProfiles, progressiveMap } from "@/lib/search-performance";

describe("search failure consistency", () => {
  it("preserves arrived deals and investors after a later failure", () => {
    const arrived = { ok: true, investors: ["Cala investor"], deals: ["Cala deal"], enrichmentPending: true };
    expect(preserveArrivedResults(arrived, { ok: false })).toEqual({ ...arrived, partial: true, enrichmentPending: false });
  });
  it("returns the search error when nothing arrived", () => {
    const failure = { ok: false, error: "CALA_TIMEOUT" };
    expect(preserveArrivedResults(null, failure)).toBe(failure);
  });
  it("does not start queued profiles or deliver obsolete results after cancellation", async () => {
    let active = true;
    const started: number[] = [], delivered: number[] = [];
    await progressiveMap([1, 2, 3, 4, 5], async (item) => { started.push(item); active = false; return item; }, (item) => delivered.push(item), () => active);
    expect(started).toEqual([1]); expect(delivered).toEqual([]);
  });
  it("retains a failed profile's grouped facts while consolidating successful profiles", async () => {
    const rows = [{ name: "A", summary: "" }, { name: "B", summary: "" }];
    const result = await consolidateProfiles(rows, async (row) => {
      if (row.name === "A") throw new Error("cache unavailable");
      return { investor: { ...row, summary: "Cala summary" } };
    });
    expect(result).toEqual({ investors: [rows[0], { name: "B", summary: "Cala summary" }], partial: true });
  });
});