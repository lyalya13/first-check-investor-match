import type { Deal } from "./aggregate";

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
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (value && typeof value === "object") return text(value.name ?? value.title ?? value.value ?? value.url);
  return undefined;
}
function names(value: any): string[] {
  if (Array.isArray(value)) return value.flatMap(names);
  if (value && typeof value === "object") return names(value.name ?? value.value ?? value.entities ?? []);
  if (typeof value === "string") return value.split(/[,;]|\s+and\s+/).map((s) => s.replace(/\s*\([^)]*\)/g, "").trim()).filter((s) => !!s && !/^(?:angel investors?|\+?\d+ others?|.*team members?|undisclosed|unknown)$/i.test(s));
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
    const lead = names(field(o, ["lead_investor", "lead_investors", "lead"])).join(", ") || undefined;
    const date = text(field(o, ["date", "announced_date", "announcement_date", "funding_date", "announced_on"]));
    const source = text(field(o, ["source", "source_url", "url", "sources"]));
    const rawAmount = field(o, ["amount", "amount_raised", "raised", "money_raised", "funding_amount"]);
    const amount = typeof rawAmount === "string" && /\$|£|DKK|SEK|NOK|USD|GBP/i.test(rawAmount) && !/€|EUR/i.test(rawAmount) ? undefined : amountValue(rawAmount);
    if (!company || (!investors.length && !lead)) return [];
    return [{ company, investors, lead, date, source, amount, niches: [niche] }];
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
    } : { ...deal });
  }
  return [...merged.values()];
}
export const MIN_NICHE_DEALS = 5;

export function investorType(name: string, profile: string): "angel" | "fund" {
  const intro = profile.slice(0, 650);
  return /capital|ventures|\bvc\b|fund|partners|invest|labs?|angels|group|holding|\bab\b|gmbh|ltd|inc/i.test(name)
    || /venture capital|private equity|investment (?:firm|arm|company)|venture (?:firm|fund)|accelerator|angel network/i.test(intro) ? "fund" : "angel";
}