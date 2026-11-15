import type { FounderInput, InvestorResult } from "./cala.functions";

export type SavedSearch = { id: string; name: string; input: FounderInput };
export const OUTREACH_STATUSES = ["Not contacted", "Messaged", "Replied", "Meeting"] as const;
export type OutreachStatus = typeof OUTREACH_STATUSES[number];
export type StatusFilter = "All" | OutreachStatus;
export type SavedPerson = { status?: OutreachStatus } & (
  | { id: string; role: "investor"; investor: InvestorResult; input: FounderInput; query: string }
  | { id: string; role: "founder"; name: string; company: string; linkedin?: string; source?: string; location?: string; investor: string });
export function outreachStatus(person: { status?: unknown }): OutreachStatus {
  return OUTREACH_STATUSES.find((status) => status === person.status) ?? "Not contacted";
}
export function cycleOutreachStatus(people: SavedPerson[], id: string): SavedPerson[] {
  return people.map((person) => person.id === id ? { ...person, status: OUTREACH_STATUSES[(OUTREACH_STATUSES.indexOf(outreachStatus(person)) + 1) % OUTREACH_STATUSES.length] ?? "Not contacted" } : person);
}
export function filterOutreachStatus(people: SavedPerson[], filter: StatusFilter): SavedPerson[] {
  return filter === "All" ? people : people.filter((person) => outreachStatus(person) === filter);
}
export function outreachCounts(people: SavedPerson[]): Record<OutreachStatus, number> {
  const counts = { "Not contacted": 0, Messaged: 0, Replied: 0, Meeting: 0 };
  for (const person of people) counts[outreachStatus(person)]++;
  return counts;
}
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