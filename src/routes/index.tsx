import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Star, Copy, Download, ExternalLink, Loader2, Sparkles, ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { findInvestors, draftMessage, type FounderInput, type InvestorResult } from "@/lib/cala.functions";
import { IndustryPicker } from "@/components/industry-picker";
import { guidanceTier, defaultFilter, filterInvestors, ticketFit, type InvestorFilter } from "@/lib/fundraising";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "First Check — Find active pre-seed investors" },
      { name: "description", content: "For first-time solo founders: find investors who backed startups like yours and are still writing checks." },
      { property: "og:title", content: "First Check — Find active pre-seed investors" },
      { property: "og:description", content: "Ranked, sourced investor matches for your pre-seed round." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const EXAMPLE: FounderInput = {
  description: "Fée: cycle-aware weekly meal planner for women, one shopping list, less food waste",
  industry: "FemTech, Women's Health, Meal Planning, Food Waste",
  category: "Health & Wellbeing",
  niches: [{ category: "Health & Wellbeing", name: "FemTech" }, { category: "Health & Wellbeing", name: "Women's Health" }, { category: "Food & Nutrition", name: "Meal Planning" }, { category: "Food & Nutrition", name: "Food Waste" }],
  region: "Nordics / Europe",
  stage: "pre-seed",
  amount: 40000,
  website: "",
};
const EMPTY: FounderInput = { description: "", industry: "", category: "", niches: [], region: "", stage: "pre-seed", amount: 0, website: "" };
const eur = (n: number | null) => (n ? new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0, notation: n >= 1e6 ? "compact" : "standard" }).format(n) : "—");

type Result = Awaited<ReturnType<typeof findInvestors>>;

function Index() {
  const find = useServerFn(findInvestors);
  const [form, setForm] = useState<FounderInput>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<InvestorFilter>("All");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setResult(null); setStarred({}); setMessages({}); setFilter(defaultFilter(form.amount));
    try { setResult(await find({ data: { ...form, website: form.website || undefined } })); }
    catch { setResult({ ok: false, error: "We couldn't reach Cala right now. Please try again.", investors: [], queries: [], dealCount: 0 }); }
    finally { setLoading(false); }
  };

  const exportCsv = () => {
    const rows = (result?.investors ?? []).filter((i) => starred[i.name]);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["name", "type", "active", "deals", "ticket", "why", "source", "message"].join(","),
      ...rows.map((i) => [i.name, i.type, i.active ? "yes" : "no", `${i.led} led of ${i.deals}`, i.typicalTicket ?? "", whyFit(i, form), i.summarySources[0]?.url ?? i.sources[0] ?? "", messages[i.name] ?? ""].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "first-check-shortlist.csv"; a.click();
  };
  const starCount = Object.values(starred).filter(Boolean).length;
  const showResults = loading || result;
  const visibleInvestors = filterInvestors(result?.investors ?? [], filter);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-10">
        <p className="text-sm font-medium tracking-wide text-primary">First Check</p>
        <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">Find the investors who back companies like yours.</h1>
        <p className="mt-3 text-muted-foreground">Real pre-seed and seed deals since 2024, ranked by fit and recent activity.</p>
      </header>

      {!showResults && (
        <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-7">
          <Field label="What are you building? (one line)">
            <Textarea required rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Scheduling app for independent physiotherapists" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Industry & niches"><IndustryPicker category={form.category} niches={form.niches} onChange={(category, niches) => setForm({ ...form, category, niches, industry: niches.length ? niches.map((n) => n.name).join(", ") : category })} /></Field></div>
            <Field label="Country or region"><Input required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Germany" /></Field>
            <Field label="Stage">
              <div className="grid grid-cols-2 gap-2">
                {(["pre-seed", "seed"] as const).map((s) => (
                  <Button key={s} type="button" variant={form.stage === s ? "default" : "outline"} onClick={() => setForm({ ...form, stage: s })} className="capitalize">{s}</Button>
                ))}
              </div>
            </Field>
            <Field label="Amount raising (€)"><Input aria-label="Amount raising (€)" required type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="40000" /><AmountTip amount={form.amount} /></Field>
          </div>
          <Field label="Website (optional)"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></Field>
          <details className="rounded-lg border bg-muted/40 p-4 text-sm">
            <summary className="cursor-pointer font-medium">New to fundraising? 3 things to know</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Angels usually come before funds at pre-seed.</li>
              <li>Look for investors who still invest today, not 3 years ago.</li>
              <li>Investors who led a round are the ones to talk to first, others usually follow a lead.</li>
            </ol>
          </details>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setForm(EXAMPLE)}><Sparkles className="size-4" /> Try with an example</Button>
            <Button type="submit" size="lg">Find investors</Button>
          </div>
        </form>
      )}

      {showResults && (
        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setResult(null)} disabled={loading}><ArrowLeft className="size-4" /> Edit details</Button>
            <Button variant="outline" disabled={!starCount} onClick={exportCsv}><Download className="size-4" /> Export shortlist ({starCount})</Button>
          </div>
          {loading && <LoadingState />}
          {result && !result.ok && <div className="rounded-2xl border bg-card p-6 text-muted-foreground">{result.error}</div>}
          {result?.ok && result.investors.length === 0 && (
            <div className="rounded-2xl border bg-card p-6 text-muted-foreground">No matching rounds found. Try a broader industry or region.</div>
          )}
          {result?.ok && result.investors.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Investor filter">{(["All", "Angels first", "Funds"] as const).map((f) => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</Button>)}</div>
              <p className="mb-4 text-sm text-muted-foreground">{result.investors.length} investors from {result.dealCount} matching deals</p>
              {result.broadened && <p className="mb-4 text-sm text-muted-foreground">Broader category matches included: fewer than 5 niche deals were found.</p>}
              {visibleInvestors.length === 0 && <p className="py-5 text-sm text-muted-foreground">No funds found in these matches.</p>}
              <ol className="space-y-4">
                {visibleInvestors.map((inv, i) => (
                  <InvestorCard key={inv.name} rank={i + 1} inv={inv} founder={form} query={result.queries.join("\n\n")}
                    starred={!!starred[inv.name]} onStar={() => setStarred((s) => ({ ...s, [inv.name]: !s[inv.name] }))}
                    message={messages[inv.name]} onMessage={(m) => setMessages((s) => ({ ...s, [inv.name]: m }))} />
                ))}
              </ol>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function whyFit(i: InvestorResult, f: FounderInput) {
  const niches = [...new Set(i.matchedDeals.flatMap((d) => d.niches ?? []))].join(", ");
  return `Backed ${i.deals} early-stage deal${i.deals > 1 ? "s" : ""} matching ${niches || f.industry} in ${f.region}${i.led ? `, leading ${i.led}` : ""}${i.active ? ", still active" : ""}.`;
}

function AmountTip({ amount }: { amount: number }) {
  const tier = guidanceTier(amount);
  return <p className="text-xs leading-relaxed text-muted-foreground">
    {tier === "small" && <>At this size, start with <strong>angels</strong>, <strong>grants and equity-free competitions</strong>, and <strong>accelerators</strong>. Funds rarely write checks this small.</>}
    {tier === "angels" && <>Start with <strong>angels, angel networks and syndicates</strong>, and pre-seed programs.</>}
    {tier === "preseed" && <>Start with <strong>angels and pre-seed funds</strong>. Larger VCs usually come in later.</>}
    {tier === "seed" && <><strong>Seed funds and VCs</strong> fit this size.</>}
  </p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

const STEPS = ["Searching funding rounds since 2024…", "Grouping deals by investor…", "Checking each investor's recent activity…"];
function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-5 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <div className="space-y-1">{STEPS.map((s, i) => <p key={s} className="animate-pulse-soft" style={{ animationDelay: `${i * 0.4}s` }}>{s}</p>)}</div>
      </div>
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
    </div>
  );
}

function SourceLink({ url, label = "source" }: { url?: string | undefined; label?: string }) {
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-xs text-primary underline-offset-2 hover:underline">{label}<ExternalLink className="size-3" /></a>;
}

function InvestorCard({ rank, inv, founder, query, starred, onStar, message, onMessage }: {
  rank: number; inv: InvestorResult; founder: FounderInput; query?: string | undefined; starred: boolean; onStar: () => void; message?: string | undefined; onMessage: (m: string) => void;
}) {
  const draft = useServerFn(draftMessage);
  const [open, setOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const dealSrc = inv.sources[0] ?? inv.summarySources[0]?.url;
  const fit = ticketFit(inv.typicalTicket, founder.amount);

  const doDraft = async () => {
    setDrafting(true); setErr("");
    try {
      const r = await draft({ data: { founder: { ...founder, website: founder.website || undefined }, investor: { name: inv.name, companies: inv.companies, summary: inv.summary.slice(0, 3000), led: inv.led, deals: inv.deals } } });
      if (r.ok) onMessage(r.text); else setErr(r.error ?? "");
    } catch { setErr("Couldn't draft a message right now."); }
    finally { setDrafting(false); }
  };

  return (
    <li className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">#{rank}</span>
            <h2 className="text-2xl">{inv.name}</h2>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">{inv.type}</Badge>
            {inv.active ? <Badge className="bg-success text-success-foreground hover:bg-success">Active</Badge> : <Badge variant="outline">Last deal {inv.latestDate?.slice(0, 7) ?? "unknown"}</Badge>}
            {fit && <Badge variant="secondary">{fit === "bigger" ? "Usually writes much bigger checks" : "Ticket fits your round"}</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label={starred ? "Remove from shortlist" : "Add to shortlist"} onClick={onStar}>
          <Star className={starred ? "size-5 fill-star text-star" : "size-5"} />
        </Button>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-muted-foreground">Matching deals</dt><dd className="font-medium">Led {inv.led} of {inv.deals}<SourceLink url={dealSrc} /></dd></div>
        <div><dt className="text-muted-foreground">Typical ticket</dt><dd className="font-medium">{eur(inv.typicalTicket)}<SourceLink url={dealSrc} /></dd></div>
      </dl>
      {inv.companies.length > 0 && (
        <p className="mt-4 text-sm"><span className="text-muted-foreground">Portfolio: </span>{inv.companies.slice(0, 3).join(", ")}<SourceLink url={dealSrc} /></p>
      )}
      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">{inv.matchedDeals.map((d) => <li key={`${d.company}|${d.date}`}><span className="font-medium text-foreground">{d.company}</span>{d.date ? ` · ${d.date}` : ""} · {d.niches?.join(" / ")}<SourceLink url={d.source} /></li>)}</ul>
      <p className="mt-3 text-sm"><span className="text-muted-foreground">Why they fit: </span>{whyFit(inv, founder)}</p>
      {inv.summary && (
        <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{inv.summary}
          {inv.summarySources.slice(0, 3).map((s, i) => <SourceLink key={s.url} url={s.url} label={`[${i + 1}]`} />)}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" onClick={doDraft} disabled={drafting}>{drafting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{message ? "Redraft" : "Draft message"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>How we found this <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button>
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      {message && (
        <div className="mt-4 rounded-xl bg-muted p-4">
          <p className="whitespace-pre-wrap text-sm">{message}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{message.length}/500</span>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="size-3" />{copied ? "Copied" : "Copy"}</Button>
          </div>
        </div>
      )}
      {open && (
        <div className="mt-4 space-y-2 rounded-xl border bg-background p-4 font-mono text-xs break-words">
          <p><span className="text-muted-foreground">Deals query: </span>{query}</p>
          <p><span className="text-muted-foreground">Profile search: </span>{inv.summaryQuery}</p>
        </div>
      )}
    </li>
  );
}
