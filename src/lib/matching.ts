import { selectedModels, selectedRegions, type BusinessModel } from "./fundraising";
import type { Deal } from "./aggregate";

export const REGIONS = ["All", "Nordics", "DACH", "UK & Ireland", "France & Benelux", "Southern Europe", "CEE", "North America", "Asia", "Other"] as const;
export type InvestorRegion = Exclude<typeof REGIONS[number], "All"> | "Europe" | "Unknown";
export type RegionFilter = typeof REGIONS[number] | "Europe";
export type MatchLevel = "High match" | "Medium match" | "Low match";
const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Map only provider-reported locations, never portfolio geography, to a region. */
export function regionOf(location?: string | null): InvestorRegion {
  if (!location || /^(unknown|null|n\/a|undisclosed)$/i.test(location.trim())) return "Unknown";
  if (/europe|nordics?|germany|berlin|united kingdom|\buk\b|london|bristol|france|paris|sweden|stockholm|finland|helsinki|denmark|copenhagen|norway|oslo|iceland|netherlands|amsterdam|ireland|dublin|spain|italy|switzerland|zurich|austria|belgium|poland|portugal|estonia|lithuania|latvia|czech|romania|greece|ukraine|luxembourg|hungary/i.test(location)) return "Europe";
  if (/north america|united states|\busa?\b|canada|mexico|san francisco|new york|boston|toronto|vancouver|silicon valley|los angeles|montreal|chicago|austin/i.test(location)) return "North America";
  if (/asia|singapore|china|beijing|shanghai|hong kong|india|bengaluru|bangalore|mumbai|japan|tokyo|korea|seoul|indonesia|vietnam|thailand|malaysia|taiwan|israel|tel aviv|dubai|united arab emirates|saudi|philippines|pakistan|bangladesh/i.test(location)) return "Asia";
  if (/africa|australia|sydney|melbourne|new zealand|brazil|argentina|chile|colombia|south america|oceania|kenya|nigeria|south africa/i.test(location)) return "Other";
  return "Unknown";
}

export function detailedRegionOf(location?: string | null): InvestorRegion {
  if (!location) return "Unknown";
  if (/nordics?|sweden|stockholm|finland|helsinki|denmark|copenhagen|norway|oslo|iceland|reykjavik/i.test(location)) return "Nordics";
  if (/\bdach\b|germany|berlin|munich|hamburg|switzerland|zurich|austria|vienna/i.test(location)) return "DACH";
  if (/united kingdom|\buk\b|london|bristol|ireland|dublin|edinburgh|manchester/i.test(location)) return "UK & Ireland";
  if (/france|paris|benelux|netherlands|amsterdam|belgium|brussels|luxembourg/i.test(location)) return "France & Benelux";
  if (/southern europe|spain|madrid|barcelona|italy|milan|rome|portugal|lisbon|greece|athens|malta|cyprus/i.test(location)) return "Southern Europe";
  if (/\bcee\b|poland|warsaw|estonia|tallinn|lithuania|latvia|czech|prague|romania|ukraine|hungary|budapest|bulgaria|croatia|slovenia|slovakia|serbia/i.test(location)) return "CEE";
  return regionOf(location);
}
export function businessModels(deals: Deal[]) {
  return [...new Set(deals.flatMap((d) => d.businessModel === "both" ? ["B2B", "B2C"] : d.businessModel ? [d.businessModel] : []))];
}
export function filterBusinessModel<T extends { matchedDeals: Deal[] }>(rows: T[], model: BusinessModel | "both" | BusinessModel[]) {
  const models = Array.isArray(model) ? model : model === "both" ? [] : [model];
  return !models.length ? rows : rows.filter((row) => models.some((m) => businessModels(row.matchedDeals).includes(m)));
}

export function filterByRegion<T extends { region: InvestorRegion }>(rows: T[], filter: RegionFilter): T[] {
  return filter === "All" ? rows : rows.filter((i) => i.region === filter);
}

export function safeUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  const match = value.match(/https?:\/\/[^\s<>";]+/i);
  if (!match) return undefined;
  try { const url = new URL(match[0].replace(/[),.]+$/, "")); return ["http:", "https:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export function linkedinLink(name: string, value?: string | null) {
  const url = safeUrl(value);
  if (url) {
    const parsed = new URL(url);
    if ((parsed.hostname === "linkedin.com" || parsed.hostname.endsWith(".linkedin.com")) && /^\/(in|company)\/[^/]+/.test(parsed.pathname)) return { url, label: "LinkedIn" };
  }
  return { url: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`, label: "Find on LinkedIn" };
}

export function nicheOverlap(deal: Deal, selected: { name: string }[]) {
  const wanted = new Set(selected.map((n) => normalize(n.name)));
  // Search provenance is not proof of company focus. Only Cala's explicit company niches qualify.
  return (deal.focusNiches ?? []).filter((n) => wanted.has(normalize(n)));
}
export function topNiches(deals: Deal[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const d of deals) for (const name of new Set(d.focusNiches ?? [])) {
    const key = normalize(name); const old = counts.get(key);
    counts.set(key, { name: old?.name ?? name, count: (old?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a,b) => b.count-a.count || a.name.localeCompare(b.name)).slice(0,3).map((n) => n.name);
}
export function scoreMatch(investor: { matchedDeals: Deal[]; region: InvestorRegion; active: boolean; led: number; kind?: string }, founder: { niches: { name: string }[]; stage: string; amount: number; region: string; businessModel?: string | undefined; businessModels?: BusinessModel[] | undefined; regions?: string[] | undefined; investorType?: string | undefined }) {
  const reasons: string[] = []; let score = 0;
  const overlapping = investor.matchedDeals.filter((d) => nicheOverlap(d, founder.niches).length);
  if (overlapping.length) { score += 35; reasons.push(`Backed ${overlapping.length} deal${overlapping.length === 1 ? "" : "s"} in your selected niches`); }
  if (investor.matchedDeals.some((d) => d.stage === founder.stage)) { score += 15; reasons.push(`Backed ${founder.stage} rounds`); }
  if (founder.amount > 0 && investor.matchedDeals.some((d) => d.amount !== undefined && d.amount >= founder.amount / 5 && d.amount <= founder.amount * 5)) { score += 15; reasons.push("Backed rounds within 5× of your raise"); }
  const region = selectedRegions(founder).map((r) => r === "Europe" ? "Europe" : detailedRegionOf(r)).find((r) => r !== "Unknown" && (investor.region === r || (r === "Europe" && regionOf(investor.region) === "Europe"))) ?? "Unknown";
  if (region !== "Unknown" && (investor.region === region || (region === "Europe" && regionOf(investor.region) === "Europe"))) { score += 10; reasons.push(`Based in ${region}, your target region`); }
  if (investor.active) { score += 15; reasons.push("A deal within the last 12 months"); }
  if (investor.led > 0) { score += 10; reasons.push(`Led ${investor.led} matching deal${investor.led === 1 ? "" : "s"}`); }
  const models = selectedModels(founder).filter((m) => businessModels(investor.matchedDeals).includes(m));
  if (models.length) { score += 10; reasons.push(`Backed ${models.join(" / ")} companies — similar customers to yours`); }
  const desiredKind = founder.investorType === "Angels" ? "Angel" : founder.investorType === "VCs" ? "VC" : founder.investorType === "Corporate VCs" ? "Corporate VC" : undefined;
  if (desiredKind && investor.kind === desiredKind) { score += 10; reasons.push(`Investor type: ${desiredKind}`); }
  const level: MatchLevel = overlapping.length && score >= 70 ? "High match" : score >= 35 ? "Medium match" : "Low match";
  return { level, score, reasons };
}
export function recentDeals(deals: Deal[]) {
  return [...deals].sort((a,b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0));
}
export function introDeals(deals: Deal[], selected: { name: string }[]) {
  const sorted = recentDeals(deals).sort((a,b) => nicheOverlap(b, selected).length - nicheOverlap(a, selected).length);
  const seen = new Set<string>();
  return sorted.filter((d) => { const key = normalize(d.company); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0,3);
}
export function introMessage(description: string, investor: string, company: string, founder?: string) {
  return `Hi ${founder || "there"}, I’m a solo founder building ${description.trim().slice(0, 220)}. I saw that ${company} raised from ${investor}. If you feel it’s a fit, would you be comfortable introducing me? No worries if not — thank you!`.slice(0,499);
}