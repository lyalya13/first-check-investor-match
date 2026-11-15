import type { Deal } from "./aggregate";
import { BUSINESS_MODELS } from "./fundraising";
import { safeUrl } from "./matching";

type Row = Record<string, any>;
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function field(row: Row, names: string[]) {
  for (const name of names) {
    const key = Object.keys(row).find((k) => normalized(k) === normalized(name));
    if (key) return row[key];
  }
  return undefined;
}
function text(value: any): string | undefined {
  if (typeof value === "string") return /^(unknown|null|n\/a|undisclosed)$/i.test(value.trim()) ? undefined : value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (value && typeof value === "object") return text(value.name ?? value.title ?? value.value ?? value.url);
  return undefined;
}
function names(value: any): string[] {
  if (Array.isArray(value)) return value.flatMap(names);
  if (value && typeof value === "object") return names(value.name ?? value.value ?? value.entities ?? []);
  if (typeof value === "string") return value.replace(/angel investors? including\s*/gi, "").split(/[,;]|\s+and\s+/).map((s) => s.replace(/\s*\([^)]*\)/g, "").trim()).filter((s) => !!s && !/^(?:angel investors?|\+?\d+ others?|.*team members?|undisclosed|unknown|null)$/i.test(s));
  return [];
}
export function amountValue(value: any): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (value && typeof value === "object") return amountValue(value.amount ?? value.value);
  if (typeof value !== "string") return undefined;
  const s = value.replace(/,/g, "");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(billion|million|thousand|bn|[bmk])?/i);
  if (!m) return undefined;
  const unit = m[2]?.toLowerCase();
  return Number(m[1]) * (unit === "billion" || unit === "bn" || unit === "b" ? 1e9 : unit === "million" || unit === "m" ? 1e6 : unit === "thousand" || unit === "k" ? 1e3 : 1);
}
export function responseRows(data: any): Row[] {
  const value = data?.results ?? data?.data?.results ?? data?.data ?? data?.result ?? data;
  return Array.isArray(value) ? value.filter((r) => r && typeof r === "object") : [];
}
export function toDeals(data: any, niche: string): Deal[] {
  return responseRows(data).flatMap((r) => {
    const o = { ...r, ...(r['properties'] ?? r['fields'] ?? r['attributes'] ?? {}) };
    const company = text(field(o, ["company", "company_name", "startup", "organization", "name"])) ?? "";
    const investors = names(field(o, ["investors", "investor", "participating_investors", "investor_names"]));
    const lead = names(field(o, ["lead_investor", "lead_investors", "lead"]))[0];
    const rawDate = text(field(o, ["date", "announced_date", "announcement_date", "funding_date", "announced_on"]));
    const date = rawDate && !Number.isNaN(Date.parse(rawDate)) ? new Date(rawDate).toISOString().slice(0,10) : undefined;
    const datePrecision = rawDate && /^\d{4}$/.test(rawDate) ? "year" as const : rawDate && (/^[A-Za-z]+\s+\d{4}$/.test(rawDate) || /^\d{4}-\d{2}$/.test(rawDate)) ? "month" as const : "day" as const;
    const source = safeUrl(text(field(o, ["source", "source_url", "url", "sources"])));
    const rawAmount = field(o, ["amount", "amount_raised", "raised", "money_raised", "funding_amount"]);
    const euro = typeof rawAmount === "string" ? rawAmount.match(/(?:€|EUR)\s*(\d[\d,.]*\s*(?:billion|million|thousand|bn|[bmk])?)/i) : null;
    const amount = euro ? amountValue(euro[1]) : typeof rawAmount === "string" && /\$|£|DKK|SEK|NOK|USD|GBP/i.test(rawAmount) ? undefined : amountValue(rawAmount);
    const stageRaw = text(field(o,["round_type","stage","round","series"]));
    const stage = stageRaw && /pre[\s-]?seed/i.test(stageRaw) ? "pre-seed" : stageRaw && /^seed$/i.test(stageRaw) ? "seed" : stageRaw && /series[ -]?a/i.test(stageRaw) ? "series-a" : stageRaw && /idea|pre[ -]?funding/i.test(stageRaw) ? "idea" : stageRaw;
    const location = text(field(o,["company_location","location","headquarters"]));
    const focusNiches = names(field(o,["company_niches","sub_niches","niches","industry_niches"]));
    const founderRaw = field(o,["founders","founder_names","founder"]);
    const founderUrls = field(o,["founder_linkedin_urls"]);
    const founders = Array.isArray(founderRaw) && founderRaw.some((f) => f && typeof f === "object")
      ? founderRaw.flatMap((f) => { const name = text(f?.name); return name ? [{ name, linkedin: safeUrl(text(f.linkedin_url ?? f.linkedin)) }] : []; })
      : names(founderRaw).map((name) => ({ name, linkedin: founderUrls && typeof founderUrls === "object" && !Array.isArray(founderUrls) ? safeUrl(text(founderUrls[name])) : undefined }));
    const modelRaw = text(field(o, ["business_model", "businessModel", "customer_type"]));
    const businessModel = modelRaw?.toLowerCase() === "both" || (modelRaw && /\bb2b\b/i.test(modelRaw) && /\bb2c\b/i.test(modelRaw)) ? "both" as const : BUSINESS_MODELS.find((model) => modelRaw && new RegExp(`\\b${model}\\b`, "i").test(modelRaw));
    const companyLinkedin = safeUrl(text(field(o,["company_linkedin_url","company_linkedin"])));
    if (!company || (!investors.length && !lead)) return [];
    return [{ company, investors, lead, date, datePrecision, source, amount, niches: [niche], stage, location, focusNiches, founders, companyLinkedin, businessModel }];
  });
}
export function mergeDeals(deals: Deal[]): Deal[] {
  const merged = new Map<string, Deal>();
  for (const deal of deals) {
    const date = deal.date && !Number.isNaN(Date.parse(deal.date)) ? new Date(deal.date).toISOString().slice(0, 10) : deal.date ?? "";
    const key = `${deal.company.trim().toLowerCase()}|${date}`;
    const existing = merged.get(key);
    merged.set(key, existing ? {
      ...existing,
      investors: [...new Set([...existing.investors, ...deal.investors])],
      lead: existing.lead ?? deal.lead,
      amount: existing.amount ?? deal.amount,
      source: existing.source ?? deal.source,
      niches: [...new Set([...(existing.niches ?? []), ...(deal.niches ?? [])])],
      focusNiches: [...new Set([...(existing.focusNiches ?? []), ...(deal.focusNiches ?? [])])],
      businessModel: existing.businessModel ?? deal.businessModel,
      stage: existing.stage ?? deal.stage,
      location: existing.location ?? deal.location,
      founders: [...new Map([...(existing.founders ?? []), ...(deal.founders ?? [])].map((f) => [f.name.toLowerCase(), f])).values()],
      companyLinkedin: existing.companyLinkedin ?? deal.companyLinkedin,
    } : { ...deal });
  }
  return [...merged.values()];
}
export const MIN_NICHE_DEALS = 5;

export function investorProfile(data: any, name: string) {
  const row = responseRows(data).map((r) => ({ ...r, ...(r["properties"] ?? r["fields"] ?? r["attributes"] ?? {}) })).find((r) => normalized(text(field(r,["name","investor","investor_name"])) ?? "") === normalized(name));
  if (!row) return { kind: undefined, location: undefined, linkedin: undefined, source: undefined };
  return { kind: text(field(row,["investor_type","type","investor_kind"])), location: text(field(row,["headquarters_location","registered_address","location","based_in"])), linkedin: safeUrl(text(field(row,["linkedin_url","linkedin"]))), source: safeUrl(text(field(row,["source","source_url"]))) };
}

export function investorType(name: string, profile: string): "angel" | "fund" {
  const intro = profile.slice(0, 650);
  return /capital|ventures|\bvc\b|fund|partners|invest|labs?|angels|group|holding|\bab\b|gmbh|ltd|inc/i.test(name)
    || /venture capital|private equity|investment (?:firm|arm|company)|venture (?:firm|fund)|accelerator|angel network/i.test(intro) ? "fund" : "angel";
}