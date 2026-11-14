import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aggregateInvestors, type Deal } from "./aggregate";

const BASE = "https://api.cala.ai/v1";

const founderSchema = z.object({
  description: z.string().min(1).max(500),
  industry: z.string().min(1).max(120),
  region: z.string().min(1).max(120),
  stage: z.enum(["pre-seed", "seed"]),
  amount: z.number().nonnegative(),
  website: z.string().max(300).optional(),
});
export type FounderInput = z.infer<typeof founderSchema>;

async function cala(path: string, init?: RequestInit): Promise<any> {
  const key = process.env["CALA_API_KEY"];
  if (!key) throw new Error("MISSING_KEY");
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "X-API-KEY": key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  console.log(`[cala] ${init?.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 2000)}`);
  if (!res.ok) throw new Error(`Cala ${res.status}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

const str = (v: any): string | undefined => {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return v.name ?? v.title ?? v.value ?? undefined;
  return undefined;
};
const arr = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(str).filter((x): x is string => !!x);
  if (typeof v === "string") return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const s = str(v); return s ? [s] : [];
};
const num = (v: any): number | undefined => {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v.replace(/[^0-9.]/g, "")); if (!isNaN(n)) return n; }
  if (v && typeof v === "object") return num(v.amount ?? v.value);
  return undefined;
};
function pick(o: any, keys: string[]) {
  for (const k of Object.keys(o ?? {})) if (keys.some((x) => k.toLowerCase().includes(x))) return o[k];
  return undefined;
}
function toDeals(data: any): Deal[] {
  const rows: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  return rows.map((r) => {
    const o = r?.properties ?? r?.fields ?? r;
    return {
      company: str(pick(o, ["company", "organization", "startup"])) ?? str(o?.name) ?? "",
      investors: arr(pick(o, ["investors", "investor"])),
      lead: str(pick(o, ["lead"])),
      amount: num(pick(o, ["amount", "raised", "money"])),
      date: str(pick(o, ["date", "announced"])),
      source: str(pick(o, ["source", "url"])),
    };
  }).filter((d) => d.company || d.investors.length);
}
function sourcesOf(data: any): { title: string; url: string }[] {
  const s = data?.sources ?? data?.citations ?? data?.references ?? [];
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
  summary: string;
  summarySources: { title: string; url: string }[];
  summaryQuery: string;
};

export const findInvestors = createServerFn({ method: "POST" })
  .inputValidator((d) => founderSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const round = data.stage === "seed" ? "Seed" : "Pre-Seed";
      const industry = (data.industry.split("/")[0] ?? "").trim();
      const region = (data.region.split("/")[0] ?? "").trim();
      const queries: string[] = [];
      let deals: Deal[] = [];
      let raw: any = null;

      const tryQuery = async (q: string) => {
        queries.push(q);
        try { raw = await cala("/knowledge/query", { method: "POST", body: JSON.stringify({ input: q }) }); deals = toDeals(raw); }
        catch (e) { if ((e as Error).message === "MISSING_KEY") throw e; deals = []; }
      };

      await tryQuery(`funding_rounds.industry=${industry}.location=${region}.round_type=Pre-Seed OR Seed.date>=2024.return(company, investors, lead_investor, amount, date).limit=100`);

      if (!deals.some((d) => d.investors.length)) {
        // discover field names via introspection
        try {
          const ents = await cala(`/entities?name=${encodeURIComponent("funding_rounds")}`);
          const list = ents?.entities ?? ents?.results ?? ents ?? [];
          const id = Array.isArray(list) ? (list[0]?.id ?? list[0]?.entity_id) : undefined;
          if (id) {
            const intro = await cala(`/entities/${encodeURIComponent(id)}/introspection`);
            const fields: string[] = (intro?.fields ?? intro?.properties ?? []).map((f: any) => typeof f === "string" ? f : f.name).filter(Boolean);
            const f = (k: string, d: string) => fields.find((x) => x.toLowerCase().includes(k)) ?? d;
            await tryQuery(`funding_rounds.${f("industr", "industry")}=${industry}.${f("locat", f("countr", "location"))}=${region}.${f("type", "round_type")}=Pre-Seed OR Seed.${f("date", "date")}>=2024.return(${f("compan", "company")}, ${f("investor", "investors")}, ${f("lead", "lead_investor")}, ${f("amount", "amount")}, ${f("date", "date")}).limit=100`);
          }
        } catch (e) { if ((e as Error).message === "MISSING_KEY") throw e; }
      }
      if (!deals.some((d) => d.investors.length)) {
        await tryQuery(`${round} and Seed funding rounds since 2024 for ${data.industry} startups in ${data.region}, with company, investors, lead investor, amount and date`);
      }

      const top = aggregateInvestors(deals).slice(0, 10);
      const investors: InvestorResult[] = await Promise.all(top.map(async (inv) => {
        const q = `${inv.name} recent investments and investment focus`;
        let summary = "", src: { title: string; url: string }[] = [];
        try { const r = await cala("/knowledge/search", { method: "POST", body: JSON.stringify({ input: q }) }); summary = answerOf(r); src = sourcesOf(r); } catch {}
        const looksFund = /capital|ventures|vc|fund|partners|invest|labs|angels|group|holding|\bab\b|gmbh|ltd|inc/i.test(inv.name);
        return { ...inv, type: looksFund ? "fund" : "angel", summary, summarySources: src, summaryQuery: q };
      }));

      return { ok: true as const, investors, queries, dealCount: deals.length };
    } catch (e) {
      const msg = (e as Error).message;
      return { ok: false as const, error: (msg === "MISSING_KEY" ? "The Cala API key hasn't been added yet." : "We couldn't reach Cala right now. Please try again.") as string, investors: [], queries: [], dealCount: 0 };
    }
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
