export type Deal = {
  businessModel?: "B2B" | "B2C" | "both";
  company: string;
  investors: string[];
  lead?: string | undefined;
  amount?: number | undefined;
  date?: string | undefined;
  source?: string | undefined;
  niches?: string[];
  focusNiches?: string[];
  stage?: string | undefined;
  location?: string | undefined;
  founders?: { name: string; linkedin?: string | undefined }[];
  companyLinkedin?: string | undefined;
  datePrecision?: "day" | "month" | "year";
};

export type InvestorAgg = {
  name: string;
  deals: number;
  led: number;
  typicalTicket: number | null;
  latestDate: string | null;
  active: boolean;
  companies: string[];
  sources: string[];
  matchedDeals: Deal[];
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const mid = s[m];
  if (mid === undefined) return null;
  return s.length % 2 ? mid : ((s[m - 1] ?? mid) + mid) / 2;
}

/** Active = latest deal within the last 12 months of `now`. */
export function isActive(latest: string | null, now = new Date()): boolean {
  if (!latest) return false;
  const d = new Date(latest);
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return d >= cutoff;
}

export function aggregateInvestors(deals: Deal[], now = new Date()): InvestorAgg[] {
  const map = new Map<string, { name: string; deals: Deal[]; led: number }>();
  for (const deal of deals) {
    const names = new Set(deal.investors.map((n) => n.trim()).filter(Boolean));
    if (deal.lead) names.add(deal.lead.trim());
    for (const name of names) {
      const key = name.toLowerCase();
      const e = map.get(key) ?? { name, deals: [], led: 0 };
      e.deals.push(deal);
      if (deal.lead && deal.lead.trim().toLowerCase() === key) e.led++;
      map.set(key, e);
    }
  }
  return [...map.values()]
    .map((e) => {
      const dates = e.deals.map((d) => d.date).filter((d): d is string => !!d && !isNaN(new Date(d).getTime()));
      dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const latest = dates[0] ?? null;
      return {
        name: e.name,
        deals: e.deals.length,
        led: e.led,
        typicalTicket: median(e.deals.map((d) => d.amount).filter((a): a is number => typeof a === "number" && a > 0)),
        latestDate: latest,
        active: isActive(latest, now),
        companies: [...new Set(e.deals.map((d) => d.company).filter(Boolean))],
        sources: [...new Set(e.deals.map((d) => d.source).filter((s): s is string => !!s))],
        matchedDeals: e.deals,
      };
    })
    .sort((a, b) => b.deals - a.deals || b.led - a.led || Number(b.active) - Number(a.active));
}
