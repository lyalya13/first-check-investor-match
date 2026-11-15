import type { FounderInput, InvestorResult } from "./cala.functions";

export type SavedSearch = { id: string; name: string; input: FounderInput };
export type SavedPerson =
  | { id: string; role: "investor"; investor: InvestorResult; input: FounderInput; query: string }
  | { id: string; role: "founder"; name: string; company: string; linkedin?: string; source?: string; location?: string; investor: string };
export type SavedItems = { searches: SavedSearch[]; people: SavedPerson[] };
export const SAVED_KEY = "first-check-saved-v1";
export function personId(role: "investor" | "founder", name: string, company = "") {
  return `${role}:${name.normalize("NFKC").trim().toLowerCase()}:${company.normalize("NFKC").trim().toLowerCase()}`;
}
export function toggleSavedPerson(people: SavedPerson[], person: SavedPerson) {
  return people.some((p) => p.id === person.id) ? people.filter((p) => p.id !== person.id) : [...people, person];
}
export function readSavedItems(storage: Pick<Storage, "getItem">): SavedItems {
  try {
    const raw: unknown = JSON.parse(storage.getItem(SAVED_KEY) ?? "null");
    if (!raw || typeof raw !== "object" || !("searches" in raw) || !("people" in raw)) return { searches: [], people: [] };
    const searches = Array.isArray(raw.searches) ? raw.searches.filter((s) => s && typeof s.id === "string" && typeof s.name === "string" && s.input && typeof s.input.category === "string" && typeof s.input.description === "string" && Array.isArray(s.input.niches)) : [];
    const people = Array.isArray(raw.people) ? raw.people.filter((p) => p && typeof p.id === "string" && (p.role === "investor" ? p.investor && Array.isArray(p.investor.matchedDeals) && p.input && Array.isArray(p.input.niches) : p.role === "founder" && typeof p.name === "string" && typeof p.company === "string")) : [];
    return { searches, people };
  } catch { return { searches: [], people: [] }; }
}
export function writeSavedItems(storage: Pick<Storage, "setItem">, items: SavedItems): boolean {
  try { storage.setItem(SAVED_KEY, JSON.stringify(items)); return true; } catch { return false; }
}
export function searchName(input: { category: string; secondaryIndustry?: string | undefined; stage: string }) {
  const short = (name: string) => name.split(" & ")[0];
  return `${[input.category, input.secondaryIndustry].filter((s): s is string => !!s).map(short).join(", ")} · ${input.stage === "pre-seed" ? "Pre-Seed" : "Seed"}`;
}