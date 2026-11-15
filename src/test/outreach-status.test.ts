import { describe, expect, it } from "vitest";
import { OUTREACH_STATUSES, outreachStatus, cycleOutreachStatus, filterOutreachStatus, outreachCounts, readSavedItems, writeSavedItems, type SavedPerson } from "@/lib/saved-items";

const founder: SavedPerson = { id: "founder:1", role: "founder", name: "Founder", company: "Company", investor: "Investor" };
describe("saved-person outreach", () => {
  it("defaults existing and invalid statuses to Not contacted", () => { expect(outreachStatus(founder)).toBe("Not contacted"); expect(outreachStatus({ status: "invalid" })).toBe("Not contacted"); });
  it("cycles through the four statuses and wraps back to Not contacted", () => {
    expect(OUTREACH_STATUSES).toEqual(["Not contacted", "Messaged", "Replied", "Meeting"]);
    let people: SavedPerson[] = [founder];
    for (const status of ["Messaged", "Replied", "Meeting", "Not contacted"]) { people = cycleOutreachStatus(people, founder.id); expect(outreachStatus(people[0] ?? {})).toBe(status); }
  });
  it("changes only the selected saved person", () => { const other = { ...founder, id: "other", status: "Meeting" as const }; expect(cycleOutreachStatus([founder, other], founder.id)[1]).toEqual(other); });
  it("counts all saved people independently of the selected filter", () => { const people = [founder, ...["Messaged", "Messaged", "Replied", "Meeting"].map((status, index) => ({ ...founder, id: String(index), status: OUTREACH_STATUSES.find((s) => s === status) ?? "Not contacted" }))]; expect(outreachCounts(people)).toEqual({ "Not contacted": 1, Messaged: 2, Replied: 1, Meeting: 1 }); expect(filterOutreachStatus(people, "Messaged")).toHaveLength(2); expect(filterOutreachStatus(people, "All")).toHaveLength(5); expect(filterOutreachStatus(people, "Not contacted")).toEqual([founder]); });
  it("preserves a changed status after a browser-storage round trip", () => { let raw = ""; const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } }; const items = { searches: [], people: cycleOutreachStatus([founder], founder.id) }; expect(writeSavedItems(storage, items)).toBe(true); expect(outreachStatus(readSavedItems(storage).people[0] ?? {})).toBe("Messaged"); });
});