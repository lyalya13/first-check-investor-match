import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aggregateInvestors, isActive, type Deal } from "./aggregate";
import { CATEGORIES, dealSearchIndustries, classifyInvestor, BUSINESS_MODELS, STAGES, type InvestorKind } from "./fundraising";
import { toDeals, mergeDeals, responseRows, investorType, investorProfile } from "./cala-data";
import { detailedRegionOf, type InvestorRegion } from "./matching";
import { searchCacheKey, resolveCachedSearch } from "./search-cache";
import { EXAMPLE } from "./example";
import { CALA_TIMEOUT_MS, retryCala, consolidateProfiles } from "./search-performance";
import { combinedDealQueries } from "./deal-query";
import { calaSearchError } from "./cala-errors";

const BASE = "https://api.cala.ai/v1";

const founderSchema = z.object({
  description: z.string().min(1).max(500),
  industry: z.string().min(1).max(1000),
  category: z.string().refine((s) => s in CATEGORIES),
  secondaryIndustry: z.string().refine((s) => !s || s in CATEGORIES).optional(),
  thirdIndustry: z.string().refine((s) => !s || s in CATEGORIES).optional(),
  businessModels: z.array(z.enum(BUSINESS_MODELS)).max(6).optional(),
  regions: z.array(z.string().trim().min(1).max(120)).min(1).max(30).optional(),
  businessModel: z.enum(["B2B", "B2C", "both"]).optional(),
  investorType: z.enum(["All", "Angels", "VCs", "Corporate VCs"]).optional(),
  niches: z.array(z.object({ category: z.string().refine((s) => s in CATEGORIES), name: z.string().trim().min(1).max(120) })).max(20),
  region: z.string().min(1).max(4000),
  stage: z.enum(STAGES),
  amount: z.number().nonnegative(),
  website: z.string().max(300).optional(),
});
export type FounderInput = z.infer<typeof founderSchema>;

async function cala(path: string, init?: RequestInit): Promise<any> {
  const key = process.env["CALA_API_KEY"];
  if (!key) throw new Error("MISSING_KEY");
  return retryCala(async () => {
  const res = await fetch(BASE + path, {
    signal: AbortSignal.timeout(CALA_TIMEOUT_MS),
    ...init,
    headers: { "X-API-KEY": key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  console.log(`[cala] ${init?.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 6000)}`);
  if (!res.ok) throw new Error(`Cala ${res.status}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
  });
}

function sourcesOf(data: any): { title: string; url: string }[] {
  const s = data?.sources ?? data?.citations ?? data?.references ?? data?.context?.flatMap((fact: any) => (fact.origins ?? []).map((origin: any) => ({ title: origin.document?.title ?? origin.source?.name, url: origin.document?.url ?? origin.document?.uri ?? origin.source?.url }))) ?? [];
  if (!Array.isArray(s)) return [];
  return s.map((x: any) => typeof x === "string" ? { title: x, url: x } : { title: x.title ?? x.name ?? x.url ?? "Source", url: x.url ?? x.link ?? x.href ?? "" })
    .filter((x: any) => x.url).slice(0, 5);
}
function answerOf(data: any): string {
  const a = data?.answer ?? data?.content ?? data?.summary ?? data?.result ?? data?.raw ?? "";
  return typeof a === "string" ? a : JSON.stringify(a).slice(0, 600);
}

export type InvestorResult = ReturnType<typeof aggregateInvestors>[number] & {
  type: "angel" | "fund";
  kind?: InvestorKind;
  summary: string;
  summarySources: { title: string; url: string }[];
  summaryQuery: string;
  location?: string | undefined;
  region: InvestorRegion;
  linkedin?: string | undefined;
  profileSource?: string | undefined;
};

function toInvestors(deals: Deal[], previous: InvestorResult[] = []): InvestorResult[] {
  return aggregateInvestors(deals).slice(0, 10).map((inv) => {
    const old = previous.find((p) => p.name === inv.name);
    return { ...inv, type: old?.type ?? investorType(inv.name, ""), kind: old?.kind ?? classifyInvestor(inv.name), summary: old?.summary ?? "", summarySources: old?.summarySources ?? [],
      summaryQuery: `${inv.name} recent investments and investment focus`, region: old?.region ?? "Unknown", location: old?.location, linkedin: old?.linkedin, profileSource: old?.profileSource };
  });
}

export const findInvestors = createServerFn({ method: "POST" })
  .inputValidator((d) => founderSchema.parse(d))
  .handler(async ({ data }) => {
    const searchStarted = performance.now();
    try {
      const { readSearchCache, storeSearchCache } = await import("./cala-cache.server");
      const started = performance.now();
      const key = searchCacheKey(data);
      let cached = await readSearchCache(key).catch(() => null);
       // Reuse only the durable provider-produced preset; never invent or accept caller facts.
       if (!cached && key === searchCacheKey(EXAMPLE)) {
         const legacyKey = JSON.stringify({ version: 3, niches: [...new Set(EXAMPLE.niches.map((n) => n.name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")))].sort(), categories: [EXAMPLE.category.toLowerCase(), EXAMPLE.secondaryIndustry.toLowerCase()].sort(), businessModel: "both", investorType: "All", region: "nordics", stage: "pre-seed", amount: 40000 });
         const snapshot = await readSearchCache(legacyKey).catch(() => null);
         if (snapshot?.example) {
           cached = snapshot;
           await storeSearchCache(key, snapshot.result, true).catch(() => {});
         }
       }
      const resolved = await resolveCachedSearch({ cached, save: (result) => storeSearchCache(key, result, key === searchCacheKey(EXAMPLE)), fetchLive: async () => {
      const queries: string[] = [];
      let deals: Deal[] = [];
      let successfulQueries = 0;
      let rateLimited = false;
      let timedOut = false;
      let partial = false;
      const diagnostics: { niche: string; fields: string[]; rows: number; parsed: number }[] = [];
      const industries = dealSearchIndustries(data);
      const label = industries.join(" + ");
      const q = combinedDealQueries(data).structured;
      queries.push(q);
      try {
        const raw = await cala("/knowledge/query", { method: "POST", body: JSON.stringify({ input: q }) });
        successfulQueries++;
        const parsed = toDeals(raw, label);
        const rows = responseRows(raw);
        diagnostics.push({ niche: label, fields: [...new Set(rows.flatMap((r) => Object.keys(r['properties'] ?? r['fields'] ?? r)))], rows: rows.length, parsed: parsed.length });
        deals = mergeDeals(parsed);
      } catch (e) {
        console.error("[cala] Structured query failed", (e as Error).message);
        if ((e as Error).message === "MISSING_KEY") throw e;
        // Prefer an older cached result over an empty one when the provider fails.
        if (cached) throw new Error(/timeout|aborted/i.test((e as Error).message) ? "CALA_TIMEOUT" : (e as Error).message === "Cala 429" ? "CALA_RATE_LIMIT" : "CALA_UNAVAILABLE");
        if ((e as Error).message === "Cala 429") rateLimited = true;
        if (/timeout|aborted/i.test((e as Error).message)) timedOut = true;
        partial = true;
      }
      const broadened = false;
      // The fallback query can still deliver deals, so a failed structured query is not fatal yet.
      void rateLimited; void timedOut; void successfulQueries;
      console.log("[cala] Parsed search", JSON.stringify({ diagnostics, dealCount: deals.length }));

      const investors: InvestorResult[] = toInvestors(deals);
      return { ok: true as const, investors, deals, queries, dealCount: deals.length, diagnostics, broadened, partial, enrichmentPending: false, fallbackPending: true };
      } });
      console.log("[cala timing] grouped search", JSON.stringify({ niches: data.niches.length, elapsedMs: Math.round(performance.now() - started), cached: resolved.cached, deals: resolved.result.dealCount }));
      return { ...resolved.result, investors: resolved.result.investors.map((inv) => ({ ...inv, active: isActive(inv.latestDate) })), cached: resolved.cached, stale: resolved.stale, fetchedAt: resolved.fetchedAt };
    } catch (e) {
      console.log("[cala timing] failed search", JSON.stringify({ niches: data.niches.length, elapsedMs: Math.round(performance.now() - searchStarted) }));
      const msg = (e as Error).message;
      return { ok: false as const, error: calaSearchError(msg), investors: [], queries: [], dealCount: 0 };
    }
  });

/** Runs the natural-language fallback once and merges its deals into the server-cached search. */
export const extendInvestorSearch = createServerFn({ method: "POST" })
  .inputValidator((d) => founderSchema.parse(d))
  .handler(async ({ data }) => {
    const { readSearchCache, storeSearchCache } = await import("./cala-cache.server");
    const key = searchCacheKey(data);
    const cached = await readSearchCache(key).catch(() => null);
    if (cached && !cached.result.fallbackPending) return { ...cached.result, ok: true as const, investors: cached.result.investors.map((inv) => ({ ...inv, active: isActive(inv.latestDate) })) };
    const q = combinedDealQueries(data).fallback;
    let found: Deal[] = [];
    let failed = "";
    try { found = toDeals(await cala("/knowledge/query", { method: "POST", body: JSON.stringify({ input: q }) }), dealSearchIndustries(data).join(" + ")); }
    catch (e) { failed = (e as Error).message; console.error("[cala] Fallback query failed", failed); }
    const base = cached?.result;
    const deals = mergeDeals([...(base?.deals ?? []), ...found]);
    if (!deals.length) {
      const error = failed === "Cala 429" ? "CALA_RATE_LIMIT" : /timeout|aborted/i.test(failed) ? "CALA_TIMEOUT" : failed === "MISSING_KEY" ? failed : "CALA_UNAVAILABLE";
      return { ok: false as const, error: calaSearchError(error), investors: [], queries: [], dealCount: 0 };
    }
    const result = { ok: true as const, investors: toInvestors(deals, base?.investors), deals, queries: [...(base?.queries ?? []), q], dealCount: deals.length, diagnostics: base?.diagnostics ?? [], broadened: false, partial: (base?.partial ?? false) && !found.length || !!failed, enrichmentPending: false, fallbackPending: false };
    await storeSearchCache(key, result, false).catch(() => {});
    return { ...result, investors: result.investors.map((inv) => ({ ...inv, active: isActive(inv.latestDate) })) };
  });

/** Enrich only server-cached provider rows; the caller cannot submit investor facts. */
export const enrichInvestor = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ founder: founderSchema, name: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { readSearchCache, storeSearchCache } = await import("./cala-cache.server");
    const key = searchCacheKey(data.founder);
    const cached = await readSearchCache(key);
    const inv = cached?.result.investors.find((row) => row.name === data.name);
    if (!cached || !inv) return { ok: false as const };
    const profileKey = JSON.stringify({ search: key, investor: inv.name, enrichment: 1 });
    const saved = await readSearchCache(profileKey);
    if (saved && !saved.result.enrichmentPending && (await import("./search-cache")).cacheIsFresh(saved.fetchedAt)) {
      return { ok: true as const, investor: saved.result.investors[0] ?? inv, partial: saved.result.partial ?? false };
    }
    let partial = false;
    const [profile, summary] = await Promise.all([
      cala("/knowledge/query", { method: "POST", body: JSON.stringify({ input: `Find the investor named exactly "${inv.name}". Return name, investor_type (Angel, VC, Corporate VC, Accelerator, Family office, Syndicate / Network, Other, or null; verified classification only), headquarters_location (where this investor is based, NOT portfolio locations), linkedin_url, source. Only verified Cala data; null for missing fields. Do not include emails. Limit 1.` }) })
        .then((raw) => investorProfile(raw, inv.name)).catch(() => { partial = true; return { kind: undefined, location: undefined, linkedin: undefined, source: undefined }; }),
      cala("/knowledge/search", { method: "POST", body: JSON.stringify({ input: inv.summaryQuery }) })
        .then((raw) => ({ text: answerOf(raw), sources: sourcesOf(raw) })).catch(() => { partial = true; return { text: "", sources: [] }; }),
    ]);
    const previous = saved?.result.investors[0] ?? inv;
    const text = summary.text || previous.summary;
    const location = profile.location || previous.location;
    const investor: InvestorResult = { ...inv, type: investorType(inv.name, text), kind: classifyInvestor(inv.name, profile.kind ?? (previous.kind && previous.kind !== "Unknown" ? previous.kind : text)), summary: text, summarySources: summary.sources.length ? summary.sources : previous.summarySources, location, region: detailedRegionOf(location), linkedin: profile.linkedin || previous.linkedin, profileSource: profile.source || previous.profileSource };
    await storeSearchCache(profileKey, { ...cached.result, investors: [investor], enrichmentPending: false, partial }, false).catch(() => {});
    return { ok: true as const, investor, partial };
  });

export const finishInvestorSearch = createServerFn({ method: "POST" })
  .inputValidator((d) => founderSchema.parse(d))
  .handler(async ({ data }) => {
    const { readSearchCache, storeSearchCache } = await import("./cala-cache.server");
    const key = searchCacheKey(data);
    const cached = await readSearchCache(key);
    if (!cached || !cached.result.enrichmentPending) return { ok: true as const };
    let partial = cached.result.partial ?? false;
    const consolidated = await consolidateProfiles(cached.result.investors, async (inv) => {
      const enriched = await readSearchCache(JSON.stringify({ search: key, investor: inv.name, enrichment: 1 }));
      const investor = enriched?.result.investors[0];
      return investor ? { investor, partial: !!enriched?.result.partial } : null;
    });
    const investors = consolidated.investors;
    partial = partial || consolidated.partial;
    await storeSearchCache(key, { ...cached.result, investors, partial, enrichmentPending: false }, cached.example);
    return { ok: true as const };
  });

export const draftMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    founder: founderSchema,
    investor: z.object({ name: z.string(), companies: z.array(z.string()), summary: z.string().max(3000), led: z.number(), deals: z.number() }),
  }).parse(d))
  .handler(async ({ data }) => {
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const { founder: f, investor: i } = data;
    try {
      const res: any = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: "You write short, warm, specific cold outreach messages from a first-time solo founder to an investor. Plain text, no subject line, no placeholders in brackets, no hype. Hard limit: 450 characters.",
        input: `Founder startup: ${f.description}\nIndustry: ${f.industry}\nRegion: ${f.region}\nStage: ${f.stage}, raising €${f.amount}${f.website ? `\nWebsite: ${f.website}` : ""}\n\nInvestor: ${i.name}\nMatching deals: ${i.deals} (led ${i.led})\nPortfolio examples: ${i.companies.slice(0, 3).join(", ")}\nFocus: ${i.summary.slice(0, 800)}\n\nWrite the first message, referencing one of their real deals.`,
      });
      let text: string = res.output_text ?? "";
      if (!text) for (const o of res.output ?? []) for (const c of o.content ?? []) if (c.type === "output_text") text += c.text;
      text = text.trim();
      if (text.length > 499) text = text.slice(0, 496).replace(/\s+\S*$/, "") + "…";
      return { ok: true as const, text };
    } catch (e) {
      console.error("[draft]", e);
      return { ok: false as const, text: "", error: "Couldn't draft a message right now. Try again in a moment." };
    }
  });
