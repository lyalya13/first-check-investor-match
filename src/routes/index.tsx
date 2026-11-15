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
import { EXAMPLE } from "@/lib/example";
import { guidanceTier, defaultFilter, filterInvestors, ticketFit, type InvestorFilter } from "@/lib/fundraising";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "First Check — Find active pre-seed investors" },
      { name: "description", content: "For first-time solo founders: find investors who backed startups like yours and are still backing early-stage companies." },
      { property: "og:title", content: "First Check — Find active pre-seed investors" },
      { property: "og:description", content: "Ranked, sourced investor matches for your pre-seed round." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

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
    const csv = [["name", "type", "active", "deals", "round_size", "why", "source", "message"].join(","),
      ...rows.map((i) => [i.name, i.type, i.active ? "yes" : "no", `${i.led} led of ${i.deals}`, i.typicalTicket ?? "", whyFit(i, form), i.summarySources[0]?.url ?? i.sources[0] ?? "", messages[i.name] ?? ""].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "first-check-shortlist.csv"; a.click();
  };
  const starCount = Object.values(starred).filter(Boolean).length;
  const showResults = loading || result;
  const visibleInvestors = filterInvestors(result?.investors ?? [], filter);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 border-b pb-8 sm:mb-12">
        <p className="mb-9 text-sm font-semibold">First Check</p>
        <h1 className="text-4xl font-semibold leading-tight">{showResults ? "Your investor matches" : "Find your first investors."}</h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Real pre-seed and seed deals. People who back companies like yours, and are still active today.</p>
      </header>

      {!showResults && (
        <form onSubmit={submit} className="space-y-7">
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
          <details className="border-y py-5 text-sm">
            <summary className="cursor-pointer font-medium">New to fundraising? 3 things to know</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Angels usually come before funds at pre-seed.</li>
              <li>Look for investors who still invest today, not 3 years ago.</li>
              <li>Investors who led a round are the ones to talk to first, others usually follow a lead.</li>
            </ol>
          </details>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setForm(EXAMPLE)}><Sparkles className="size-4" /> Try with an example</Button>
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
          {result && !result.ok && <div className="border-y py-8 text-muted-foreground">{result.error}</div>}
          {result?.ok && result.investors.length === 0 && (
            <div className="border-y py-8 text-muted-foreground">No matching rounds found. Try a broader industry or region.</div>
          )}
          {result?.ok && result.investors.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Investor filter">{(["All", "Angels first", "Funds"] as const).map((f) => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</Button>)}</div>
              <p className="mb-4 text-sm text-muted-foreground">{result.investors.length} investors from {result.dealCount} matching deals</p>
              {result.cached && <p className="mb-3 text-xs text-muted-foreground">Saved Cala results · {result.fetchedAt.slice(0, 10)}{result.stale ? " · Last available results" : ""}</p>}
              {result.broadened && <p className="mb-4 text-sm text-muted-foreground">Broader category matches included: fewer than 5 niche deals were found.</p>}
              {visibleInvestors.length === 0 && <p className="py-5 text-sm text-muted-foreground">No funds found in these matches.</p>}
              <h2 className="mb-2 mt-7 text-xs font-semibold text-muted-foreground">Who to ask first</h2>
              <ol className="divide-y border-y">
                {visibleInvestors.map((inv) => (
                  <InvestorCard key={inv.name} inv={inv} founder={form} query={result.queries.join("\n\n")}
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
    {tier === "small" && <>At this size, start with <strong>angels</strong>, <strong>grants and equity-free competitions</strong>, and <strong>accelerators</strong>. Funds rarely back rounds this small.</>}
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
      <div className="flex items-center gap-3 py-5 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <div className="space-y-1">{STEPS.map((s, i) => <p key={s} className="animate-pulse-soft" style={{ animationDelay: `${i * 0.4}s` }}>{s}</p>)}</div>
      </div>
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
    </div>
  );
}

function SourceLink({ url, label = "source" }: { url?: string | undefined; label?: string }) {
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-xs text-primary underline-offset-2 hover:underline">{label}<ExternalLink className="size-3" /></a>;
}

function InvestorCard({ inv, founder, query, starred, onStar, message, onMessage }: {
  inv: InvestorResult; founder: FounderInput; query?: string | undefined; starred: boolean; onStar: () => void; message?: string | undefined; onMessage: (m: string) => void;
}) {
  const draft = useServerFn(draftMessage);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
    <li className="py-2">
      <Button variant="ghost" aria-expanded={expanded} aria-label={`Show details for ${inv.name}`} onClick={() => setExpanded(!expanded)} className="h-auto min-h-24 w-full justify-start gap-4 rounded-lg px-2 py-4 text-left whitespace-normal">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-medium">{inv.name.split(/\s+/).map((n) => n[0]).slice(0, 2).join("")}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><span className="text-base font-semibold">{inv.name}</span>{inv.active && <Badge className="bg-success text-success-foreground hover:bg-success">Active</Badge>}</span>
          <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">Backed {inv.deals} early-stage startup{inv.deals === 1 ? "" : "s"} · {[...new Set(inv.matchedDeals.flatMap((d) => d.niches ?? []))].join(" / ") || founder.category}</span>
        </span>
        <ChevronDown className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </Button>
      {expanded && <div className="px-2 pb-6 sm:pl-18">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">{inv.type}</Badge>
          {!inv.active && <Badge variant="outline">Last deal {inv.latestDate?.slice(0, 7) ?? "unknown"}</Badge>}
          {fit && <Badge variant="outline">{fit === "bigger" ? "Usually backs bigger rounds" : "Similar round size"}</Badge>}
          <Button variant="ghost" size="icon" title={starred ? "Remove from shortlist" : "Add to shortlist"} aria-label={starred ? "Remove from shortlist" : "Add to shortlist"} onClick={onStar}><Star className={starred ? "fill-foreground" : ""} /></Button>
        </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-muted-foreground">Matching deals</dt><dd className="font-medium">Led {inv.led} of {inv.deals}<SourceLink url={dealSrc} /></dd></div>
        <div><dt className="text-muted-foreground">Backs rounds of</dt><dd className="font-medium">{eur(inv.typicalTicket)}<SourceLink url={dealSrc} /></dd></div>
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
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>How we found this <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button>
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      {message && (
        <div className="mt-4 rounded-lg bg-muted p-4">
          <p className="whitespace-pre-wrap text-sm">{message}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{message.length}/500</span>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="size-3" />{copied ? "Copied" : "Copy"}</Button>
          </div>
        </div>
      )}
      {open && (
        <div className="mt-4 space-y-2 rounded-lg border bg-background p-4 font-mono text-xs break-words">
          <p><span className="text-muted-foreground">Deals query: </span>{query}</p>
          <p><span className="text-muted-foreground">Profile search: </span>{inv.summaryQuery}</p>
        </div>
      )}
      </div>}
    </li>
  );
}
