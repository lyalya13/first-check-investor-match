import { toast } from "sonner";
import { SimilarStartups } from "@/components/similar-startups";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Trash2, Copy, Download, ExternalLink, Sparkles, ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { REGIONS, filterByRegion, scoreMatch, topNiches, recentDeals, introDeals, linkedinLink, introMessage, safeUrl, detailedRegionOf, filterBusinessModel, businessModels, type RegionFilter } from "@/lib/matching";
import { findInvestors, enrichInvestor, extendInvestorSearch, draftMessage, type FounderInput, type InvestorResult } from "@/lib/cala.functions";
import { preserveArrivedResults } from "@/lib/search-state";
import { MultiLocationPicker } from "@/components/multi-location-picker";
import { IndustryPicker } from "@/components/industry-picker";
import { EXAMPLE } from "@/lib/example";
import { defaultFilter, filterInvestors, ticketFit, defaultPeopleTypes, filterPeopleTypes, classifyInvestor, PEOPLE_TYPES, BUSINESS_MODELS, STAGES, STAGE_LABELS, selectedModels, selectedRegions, type PeopleType, type BusinessModel, type InvestorFilter } from "@/lib/fundraising";

import { AmountTip, FundraisingGuide, ResultsAmountTip } from "@/components/founder-guidance";
import { OutreachStatusPill } from "@/components/outreach-status";
import { OUTREACH_STATUSES, outreachStatus, cycleOutreachStatus, outreachCounts, filterOutreachStatus, type StatusFilter, readSavedItems, writeSavedItems, personId, toggleSavedPerson, searchName, type SavedItems, type SavedPerson } from "@/lib/saved-items";

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

const EMPTY: FounderInput = { description: "", industry: "", category: "", niches: [], region: "Nordics", stage: "pre-seed", amount: 40000, website: "", secondaryIndustry: "", businessModel: "both", investorType: "All" };
const eur = (n: number | null) => (n ? new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0, notation: n >= 1e6 ? "compact" : "standard" }).format(n) : "Unknown");

type Result = Awaited<ReturnType<typeof findInvestors>>;

function Index() {
  const find = useServerFn(findInvestors);
  const enrich = useServerFn(enrichInvestor);
  const extend = useServerFn(extendInvestorSearch);
  const [form, setForm] = useState<FounderInput>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState<SavedItems>({ searches: [], people: [] });
  const [tab, setTab] = useState<"results" | "saved" | "startups">("results");
  const [saveModal, setSaveModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [savedName, setSavedName] = useState("");
  const [storageNotice, setStorageNotice] = useState("");
  const searchRun = useRef(0);
  const [typeFilter, setTypeFilter] = useState<PeopleType[]>(defaultPeopleTypes(40000));
  const [modelFilter, setModelFilter] = useState<BusinessModel[]>([]);
  useEffect(() => { try { setSaved(readSavedItems(window.localStorage)); } catch { /* Storage may be blocked. */ } }, []);
  const persist = (items: SavedItems) => {
    setSaved(items);
    try { if (!writeSavedItems(window.localStorage, items)) setStorageNotice("Saving is unavailable in this browser. Your items remain available until you close this page."); }
    catch { setStorageNotice("Saving is unavailable in this browser. Your items remain available until you close this page."); }
  };
  const togglePerson = (person: SavedPerson) => {
    const removing = saved.people.some((entry) => entry.id === person.id);
    persist({ ...saved, people: toggleSavedPerson(saved.people, person) });
    if (!removing) toast(person.role === "investor" ? "Investor saved" : "Founder saved");
  };
  const cycleStatus = (id: string) => persist({ ...saved, people: cycleOutreachStatus(saved.people, id) });
  const counts = outreachCounts(saved.people);
  const visibleSaved = filterOutreachStatus(saved.people, statusFilter);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("All");
  const [filter, setFilter] = useState<InvestorFilter>("All");

  const runSearch = async (searchInput: FounderInput) => {
    const run = ++searchRun.current;
    setTab("results"); setForm(searchInput);
    setLoading(true); setResult(null); setMessages({}); setFilter(defaultFilter(searchInput.amount)); setRegionFilter("All"); setTypeFilter(defaultPeopleTypes(searchInput.amount)); setModelFilter(selectedModels(searchInput));
    try {
      const started = performance.now();
      const input = { ...searchInput, website: searchInput.website || undefined };
      const grouped = await find({ data: input });
      if (run !== searchRun.current) return;
      setResult(grouped);
      if (grouped.ok && grouped.fallbackPending) {
        const more = await extend({ data: input }).catch(() => null);
        if (run !== searchRun.current) return;
        setResult((current) => more?.ok ? { ...more, cached: false, stale: false, fetchedAt: new Date().toISOString() } as Result
          : current?.ok && current.dealCount ? { ...current, partial: true, fallbackPending: false } : (more ?? current));
      }
      console.info("[First Check timing] search", { niches: input.niches.length, elapsedMs: Math.round(performance.now() - started), cached: grouped.ok && grouped.cached });
    }
    catch { if (run === searchRun.current) setResult((current) => preserveArrivedResults(current, { ok: false as const, error: "We couldn't reach Cala right now. Please try again.", investors: [], queries: [], dealCount: 0 })); }
    finally { if (run === searchRun.current) setLoading(false); }
  };

  const exportCsv = () => {
    const rows = saved.people.filter((p) => p.role === "investor");
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["name", "type", "active", "deals", "round_size", "why", "source", "message", "match_level", "investor_region", "top_niches", "linkedin", "intro_companies", "status"].join(","),
      ...rows.map((person) => { const i = person.investor; const input = person.input; return [i.name, i.kind ?? "Unknown", i.active ? "yes" : "no", `${i.led} led of ${i.deals}`, i.typicalTicket ?? "", whyFit(i, input), i.summarySources[0]?.url ?? i.sources[0] ?? "", messages[i.name] ?? "", scoreMatch(i, input).level, i.region, topNiches(i.matchedDeals).join("; ") || "Unknown", linkedinLink(i.name, i.linkedin).url, introDeals(i.matchedDeals, input.niches).map((d) => d.company).join("; "), outreachStatus(person)].map(esc).join(","); })].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "first-check-shortlist.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
  const starCount = saved.people.filter((p) => p.role === "investor").length;
  const showResults = loading || result;
  const visibleInvestors = filterBusinessModel(filterPeopleTypes(filterByRegion(filterInvestors(result?.investors ?? [], filter).map((i) => ({ ...i, region: detailedRegionOf(i.location) })), regionFilter), typeFilter), modelFilter).sort((a,b) => scoreMatch(b,form).score - scoreMatch(a,form).score);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-7 sm:px-8 sm:py-12">
      <header className="mb-10 pb-2 sm:mb-12">
        <p className="mb-10 text-sm font-semibold">First Check</p>
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">{showResults ? "Your investor matches" : "Find the investors who actually wrote first checks in your space."}</h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Real early-stage deals. Relevant investors. A warmer way to start.</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="People views"><Button role="tab" aria-selected={tab === "results"} variant={tab === "results" ? "secondary" : "outline"} onClick={() => setTab("results")}>Results</Button><Button role="tab" aria-selected={tab === "saved"} variant={tab === "saved" ? "secondary" : "outline"} onClick={() => setTab("saved")}><Bookmark className="size-4" />Saved ({saved.people.length + saved.searches.length})</Button><Button role="tab" aria-selected={tab === "startups"} variant={tab === "startups" ? "secondary" : "outline"} onClick={() => setTab("startups")}>Similar startups</Button></div>
      {storageNotice && <p role="status" className="mb-4 text-xs text-muted-foreground">{storageNotice}</p>}
      {tab === "startups" && (result?.ok ? <SimilarStartups investors={result.investors} founder={form} deals={result.deals} /> : <p className="py-6 text-sm text-muted-foreground">{loading ? "Finding similar startups…" : "Run a search to see similar startups and their investors."}</p>)}
      {tab === "saved" && <section>
        <h2 className="mb-2 font-semibold">Saved searches</h2>
        <p className="mb-4 text-sm text-muted-foreground">Your search choices, ready to run again. Saved investors are kept separately below.</p>
        {!saved.searches.length && <p className="mb-6 text-sm text-muted-foreground">No saved searches yet.</p>}
        <ul className="mb-8 divide-y">{saved.searches.map((search) => <li key={search.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words font-medium">{search.name}</p><p className="mt-1 text-xs text-muted-foreground">{search.input.industry} · {STAGE_LABELS[search.input.stage]}</p></div><div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" onClick={() => void runSearch(search.input)}>Run search</Button><Button size="icon" variant="ghost" aria-label={`Delete search ${search.name}`} onClick={() => persist({ ...saved, searches: saved.searches.filter((entry) => entry.id !== search.id) })}><Trash2 className="size-4" /></Button></div></li>)}</ul>
        <div className="mb-6 flex items-center justify-between gap-3"><h2 className="font-semibold">Saved investors and founders</h2><Button variant="outline" disabled={!starCount} onClick={exportCsv}><Download className="size-4" />Export shortlist ({starCount})</Button></div>
        <p className="mb-4 text-sm text-muted-foreground" aria-label="Outreach counts">{counts["Not contacted"]} not contacted · {counts.Messaged} messaged · {counts.Replied} replied · {counts.Meeting} meeting</p>
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Outreach status filter">{(["All", ...OUTREACH_STATUSES] as const).map((status) => <Button key={status} size="sm" variant={statusFilter === status ? "secondary" : "outline"} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>{status}</Button>)}</div>
        {!!saved.people.length && !visibleSaved.length && <p className="py-5 text-sm text-muted-foreground">No saved people with this status.</p>}
        {!saved.people.length && <p className="border-y py-8 text-sm text-muted-foreground">No saved people yet.</p>}
        <ol className="divide-y overflow-hidden rounded-2xl border bg-card">{visibleSaved.map((person) => person.role === "investor" ? <InvestorCard key={person.id} inv={person.investor} founder={person.input} query={person.query} starred onStar={() => togglePerson(person)} savedPeople={saved.people} onSavePerson={togglePerson} onCycleStatus={cycleStatus} message={messages[person.investor.name]} onMessage={(m) => setMessages((old) => ({ ...old, [person.investor.name]: m }))} /> : <li key={person.id} className="bg-card px-4 py-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{person.name}</p><p className="mt-1 text-xs text-muted-foreground">Founder · {person.company} · {person.location || "Unknown"}</p><p className="mt-1 text-xs text-muted-foreground">Backed by {person.investor}<SourceLink url={person.source} /></p></div><Button variant="ghost" size="icon" aria-label={`Remove saved ${person.name}`} title="Remove saved person" onClick={() => togglePerson(person)}><Bookmark className="fill-star text-star" /></Button></div><Button asChild variant="outline" size="sm" className="mt-3"><a href={linkedinLink(person.name, person.linkedin).url} target="_blank" rel="noreferrer">{linkedinLink(person.name, person.linkedin).label}<ExternalLink className="size-3" /></a></Button><div className="mt-3"><OutreachStatusPill person={person} onCycle={cycleStatus} /></div></li>)}</ol>
      </section>}
      {tab === "results" && !showResults && (
        <form onSubmit={(e) => { e.preventDefault(); if (!selectedRegions(form).length) return; void runSearch(form); }} className="space-y-7">
          <div className="space-y-3"><Label>Saved searches</Label><p className="text-xs leading-5 text-muted-foreground">Reopen a search you saved in this browser, with all your choices.</p><select aria-label="Saved searches" value="" onChange={(e) => { const search = saved.searches.find((entry) => entry.id === e.target.value); if (search) void runSearch(search.input); }} className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"><option value="">Choose a saved search</option>{saved.searches.map((search) => <option key={search.id} value={search.id}>{search.name}</option>)}</select>{saved.searches.map((search) => <div key={search.id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 break-words">{search.name}</span><Button type="button" variant="ghost" size="icon" title="Delete saved search" aria-label={`Delete search ${search.name}`} onClick={() => persist({ ...saved, searches: saved.searches.filter((item) => item.id !== search.id) })}><Trash2 className="size-4" /></Button></div>)}</div>
          <Field label="What are you building?" hint="Describe your product and who it helps in one sentence, so your outreach feels specific.">
            <Textarea aria-label="What are you building?" required rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Scheduling app for independent physiotherapists" />
          </Field>
          <div className="grid gap-6">
            <div className="sm:col-span-2"><Field label="Industries and specific areas" hint="Choose your main industry, then add up to two more if they also fit."><IndustryPicker category={form.category} secondaryIndustry={form.secondaryIndustry} thirdIndustry={form.thirdIndustry} niches={form.niches} onChange={(category, secondaryIndustry, thirdIndustry, niches) => setForm({ ...form, category, secondaryIndustry, thirdIndustry, niches, industry: [category, secondaryIndustry, thirdIndustry].filter(Boolean).join(", ") })} /></Field></div>
            <Field label="Countries or regions" hint="Choose every place where you want to find similar funded startups. You can add a country by name."><MultiLocationPicker values={selectedRegions(form)} onChange={(regions) => setForm({ ...form, regions, region: regions.join(", ") })} />{!selectedRegions(form).length && <p className="text-xs text-muted-foreground">Choose at least one country or region.</p>}</Field>
            <Field label="Who are your customers?" hint="Choose all that fit. We look for investors who backed companies serving similar customers."><div className="flex flex-wrap gap-2" role="group" aria-label="Business models">{BUSINESS_MODELS.map((model) => <Button key={model} type="button" size="sm" variant={selectedModels(form).includes(model) ? "secondary" : "outline"} aria-pressed={selectedModels(form).includes(model)} onClick={() => setForm({ ...form, businessModels: selectedModels(form).includes(model) ? selectedModels(form).filter((m) => m !== model) : [...selectedModels(form), model] })}>{model}</Button>)}</div><p className="text-xs leading-5 text-muted-foreground">B2B: businesses · B2C: consumers · B2B2C: consumers through businesses · B2G: government · C2C: people buying from each other · Other: another model. Leave blank if unsure.</p></Field>
            <Field label="Where are you in your journey?" hint="Idea: exploring a concept. Pre-seed: building or testing. Seed: gaining customers. Series A: growing a proven business.">
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map((s) => (
                  <Button key={s} type="button" variant={form.stage === s ? "secondary" : "outline"} onClick={() => setForm({ ...form, stage: s })} aria-pressed={form.stage === s}>{STAGE_LABELS[s]}</Button>
                ))}
              </div>
            </Field>
            <Field label="Amount raising (€)" hint="The total you want to raise, not the amount from one investor. This helps suggest who to approach first."><Input aria-label="Amount raising (€)" required type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="40000" /><AmountTip amount={form.amount} /></Field>
          </div>
          <Field label="Website (optional)" hint="Your startup’s website can give investors more context in your message. It’s fine to leave this blank."><Input aria-label="Website (optional)" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></Field>
          <p className="text-xs leading-5 text-muted-foreground">Save search keeps these choices in this browser. Save investor keeps a person in your shortlist.</p>
          <Button type="button" variant="outline" disabled={!form.description.trim() || !form.category || !selectedRegions(form).length || !form.amount} onClick={() => { setSavedName(searchName(form)); setSaveModal(true); }}><Bookmark className="size-4" />Save search</Button>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setForm(EXAMPLE)}><Sparkles className="size-4" /> Try with an example</Button>
            <Button type="submit" size="lg" disabled={!selectedRegions(form).length}>Find investors</Button>
          </div>
        </form>
      )}

      {tab === "results" && showResults && (
        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => { searchRun.current++; setLoading(false); setResult(null); }}><ArrowLeft className="size-4" /> Edit details</Button>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!result?.ok} onClick={() => { setSavedName(searchName(form)); setSaveModal(true); }}><Bookmark className="size-4" />Save search</Button><Button variant="outline" disabled={!starCount} onClick={exportCsv}><Download className="size-4" /> Export shortlist ({starCount})</Button></div>
          </div>
          <FundraisingGuide />
          <ResultsAmountTip amount={form.amount} onAngelsFirst={() => { setFilter("Angels first"); setTypeFilter(defaultPeopleTypes(40000)); }} />
              <h3 className="mb-1 text-sm font-medium">Investor type</h3><p className="mb-3 text-xs leading-5 text-muted-foreground">Angels usually write the first check. Choose any combination; types are estimated from Cala data and names, with Other when unclear.</p>
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Investor type filter">{PEOPLE_TYPES.map((type) => <Button key={type} size="sm" variant={typeFilter.includes(type) ? "secondary" : "outline"} aria-pressed={typeFilter.includes(type)} onClick={() => setTypeFilter(typeFilter.includes(type) ? typeFilter.filter((t) => t !== type) : [...typeFilter, type])}>{type}</Button>)}<Button size="sm" variant="ghost" onClick={() => setTypeFilter([...PEOPLE_TYPES])}>Show all types</Button></div>

          {loading && !result && <LoadingState />}
          {loading && result?.ok && <LoadingState enriching />}
          {result?.ok && result.partial && <p role="status" className="mb-4 text-xs text-muted-foreground">Some sources were slow, showing what we found.</p>}
          {result && !result.ok && <div className="border-y py-8 text-muted-foreground">{result.error}</div>}
          {result?.ok && result.investors.length === 0 && (
            <div className="border-y py-8 text-muted-foreground">No matching rounds found. Try a broader industry or region.</div>
          )}
          {result?.ok && (
            <>
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Investor filter">{(["All", "Angels first", "Funds"] as const).map((f) => <Button key={f} size="sm" variant={filter === f ? "secondary" : "outline"} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</Button>)}</div>
              <h3 className="mb-1 text-sm font-medium">Customers of companies they backed</h3><p className="mb-3 text-xs text-muted-foreground">Choose models to narrow the list, or clear them to see everyone.</p>
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Business model filter">{BUSINESS_MODELS.map((model) => <Button key={model} size="sm" variant={modelFilter.includes(model) ? "secondary" : "outline"} aria-pressed={modelFilter.includes(model)} onClick={() => setModelFilter(modelFilter.includes(model) ? modelFilter.filter((m) => m !== model) : [...modelFilter, model])}>{model}</Button>)}<Button size="sm" variant="ghost" onClick={() => setModelFilter([])}>All customer models</Button></div>
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Investor region filter">{REGIONS.map((r) => <Button key={r} size="sm" variant={regionFilter === r ? "secondary" : "outline"} aria-pressed={regionFilter === r} onClick={() => setRegionFilter(r)}>{r}</Button>)}</div>
              <p className="mb-4 text-sm text-muted-foreground">{result.investors.length} investors from {result.dealCount} matching deals</p>
              {result.cached && <p className="mb-3 text-xs text-muted-foreground">Saved Cala results · {result.fetchedAt.slice(0, 10)}{result.stale ? " · Last available results" : ""}</p>}
              {result.broadened && <p className="mb-4 text-sm text-muted-foreground">Broader category matches included: fewer than 5 niche deals were found.</p>}
              {visibleInvestors.length === 0 && <p className="py-5 text-sm text-muted-foreground">No investors found with these filters. Try “Show all types” and “All customer models” to see more.</p>}
              <h2 className="mb-2 mt-7 text-xs font-semibold text-muted-foreground">Who to ask first</h2>
              <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
                {visibleInvestors.map((inv) => (
                  <InvestorCard key={inv.name} inv={inv} founder={form} query={result.queries.join("\n\n")}
                    starred={saved.people.some((p) => p.id === personId("investor", inv.name))} onStar={() => togglePerson({ id: personId("investor", inv.name), role: "investor", investor: inv, input: form, query: result.queries.join("\n\n") })} savedPeople={saved.people} onSavePerson={togglePerson} onCycleStatus={cycleStatus}
                    message={messages[inv.name]} onMessage={(m) => setMessages((s) => ({ ...s, [inv.name]: m }))} />
                ))}
              </ol>
            </>
          )}
        </section>
      )}
      <Dialog open={saveModal} onOpenChange={setSaveModal}><DialogContent><DialogTitle>Save search</DialogTitle><DialogDescription>Save these search choices in this browser, not the investors. {form.industry} · {form.stage}</DialogDescription><form onSubmit={(e) => { e.preventDefault(); if (!savedName.trim()) return; persist({ ...saved, searches: [...saved.searches, { id: crypto.randomUUID(), name: savedName.trim(), input: { ...form, niches: form.niches.map((n) => ({ ...n })) } }] }); setSaveModal(false); toast("Search saved"); }} className="space-y-4"><Input aria-label="Search name" autoFocus required maxLength={80} value={savedName} onChange={(e) => setSavedName(e.target.value)} /><Button type="submit"><Bookmark className="size-4" />Save search</Button></form></DialogContent></Dialog>
    </main>
  );
}

function whyFit(i: InvestorResult, f: FounderInput) {
  return scoreMatch(i,f).reasons.join(" · ") || "Unknown";
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-xs font-normal text-muted-foreground">{label}</Label>{children}{hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}</div>;
}

const STEPS = ["Searching funding rounds since 2024…", "Grouping deals by investor…", "Checking each investor's recent activity…"];
function LoadingState({ enriching = false }: { enriching?: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => { const timer = setInterval(() => setStep((current) => (current + 1) % STEPS.length), 3500); return () => clearInterval(timer); }, []);
  return <div role="status" className="mb-6 space-y-3 py-4"><div aria-hidden="true" className="h-px overflow-hidden bg-border"><div className="progress-slide h-full w-1/3 bg-primary" /></div><p className="text-sm text-muted-foreground">{enriching ? "Checking each investor's recent activity…" : STEPS[step]}</p></div>;
}

function SourceLink({ url, label = "source" }: { url?: string | undefined; label?: string }) {
  const verified = safeUrl(url);
  if (!verified) return <span className="ml-1 text-xs text-muted-foreground">{label}: Unknown</span>;
  return <a href={verified} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-xs text-primary underline-offset-2 hover:underline">{label}<ExternalLink className="size-3" /></a>;
}

function InvestorCard({ inv: rawInv, founder, query, starred, onStar, message, onMessage, savedPeople, onSavePerson, onCycleStatus }: {
  onCycleStatus: (id: string) => void;
  savedPeople: SavedPerson[]; onSavePerson: (person: SavedPerson) => void;
  inv: InvestorResult; founder: FounderInput; query?: string | undefined; starred: boolean; onStar: () => void; message?: string | undefined; onMessage: (m: string) => void;
}) {
  const [profileState] = [null];
  void profileState;
  const savedInvestor = savedPeople.find((person) => person.id === personId("investor", rawInv.name));
  const draft = useServerFn(draftMessage);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const enrich = useServerFn(enrichInvestor);
  const [profile, setProfile] = useState<InvestorResult | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const toggleExpanded = () => {
    setExpanded(!expanded);
    // Profile details are fetched only on first expand, never upfront for all investors.
    if (!expanded && !profile && !inv.summary && !profileLoading) {
      setProfileLoading(true);
      enrich({ data: { founder: { ...founder, website: founder.website || undefined }, name: rawInv.name } })
        .then((r) => { if (r.ok) setProfile({ ...r.investor, active: rawInv.active }); })
        .catch(() => {}).finally(() => setProfileLoading(false));
    }
  };
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("Draft message");
  const [draftText, setDraftText] = useState("");
  const match = scoreMatch(inv, founder);
  const niches = topNiches(inv.matchedDeals);
  const linkedin = linkedinLink(inv.name, inv.linkedin);
  const [copied, setCopied] = useState(false);
  const dealSrc = inv.sources[0] ?? inv.summarySources[0]?.url;
  const fit = ticketFit(inv.typicalTicket, founder.amount);

  const doDraft = async () => {
    setDrafting(true); setErr("");
    try {
      const r = await draft({ data: { founder: { ...founder, website: founder.website || undefined }, investor: { name: inv.name, companies: inv.companies, summary: inv.summary.slice(0, 3000), led: inv.led, deals: inv.deals } } });
      if (r.ok) { onMessage(r.text); setDraftText(r.text); setModalTitle(`Message to ${inv.name}`); setModal(true); } else setErr(r.error ?? "");
    } catch { setErr("Couldn't draft a message right now."); }
    finally { setDrafting(false); }
  };

  return (
    <li className="bg-card py-1">
      <div className="flex items-center"><Button variant="ghost" aria-expanded={expanded} aria-label={`Show details for ${inv.name}`} onClick={() => setExpanded(!expanded)} className="h-auto min-h-20 w-full justify-start gap-3 rounded-xl px-3 py-3 text-left whitespace-normal">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">{inv.name.split(/\s+/).map((n) => n[0]).slice(0, 2).join("")}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><span className="text-[15px] font-semibold">{inv.name}</span><span className="text-xs font-normal text-muted-foreground">{classifyInvestor(inv.name, inv.kind && inv.kind !== "Unknown" ? inv.kind : inv.summary)}</span>{inv.active && <Badge variant="secondary">Active</Badge>}</span>
          <span className="mt-1 block truncate text-xs font-normal leading-5 text-muted-foreground">Led {inv.led} of {inv.deals} deals · {niches.join(", ") || "Unknown"}</span>
        </span>
        <ChevronDown className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </Button>
      <Button variant="ghost" size="icon" className="mr-2 shrink-0" title={starred ? "Remove saved investor" : "Save investor"} aria-label={starred ? `Remove saved ${inv.name}` : `Save ${inv.name}`} onClick={onStar}><Bookmark className={starred ? "fill-star text-star" : ""} /></Button></div>
      {savedInvestor && <div className="px-4 pb-3 sm:pl-18"><OutreachStatusPill person={savedInvestor} onCycle={onCycleStatus} /></div>}
      {expanded && <div className="px-2 pb-6 sm:pl-18">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{match.level}</Badge>
          {!inv.active && <span className="text-xs text-muted-foreground">Last deal {inv.latestDate?.slice(0, 7) ?? "Unknown"}</span>}
          {fit && <Badge variant="outline">{fit === "bigger" ? "Usually backs bigger rounds" : "Similar round size"}</Badge>}

        </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-muted-foreground">Matching deals</dt><dd className="font-medium">Led {inv.led} of {inv.deals}<SourceLink url={dealSrc} /></dd></div>
        <div><dt className="text-muted-foreground">Typical ticket</dt><dd className="font-medium">{eur(inv.typicalTicket)}<SourceLink url={dealSrc} /><span className="mt-1 block text-xs font-normal text-muted-foreground">based on round size</span></dd></div>
      </dl>
      {inv.companies.length > 0 && (
        <p className="mt-4 text-sm"><span className="text-muted-foreground">Portfolio: </span>{inv.companies.slice(0, 3).join(", ")}<SourceLink url={dealSrc} /></p>
      )}
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Business model</dt><dd>{businessModels(inv.matchedDeals).join(" / ") || "Unknown"}</dd></div>
        <div><dt className="text-muted-foreground">Investor location</dt><dd>{inv.location || "Unknown"}<SourceLink url={inv.profileSource} /></dd></div>
        <div><dt className="text-muted-foreground">Invests mostly in</dt><dd>{niches.join(" / ") || "Unknown"}</dd></div>
      </dl>
      <h3 className="mt-5 text-xs font-semibold text-muted-foreground">Why they fit</h3>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{match.reasons.length ? match.reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>Unknown</li>}</ul>
      <h3 className="mt-5 text-xs font-semibold text-muted-foreground">Recent investments</h3>
      <ul className="mt-3 space-y-3 text-xs text-muted-foreground">{recentDeals(inv.matchedDeals).map((d) => <li key={`${d.company}|${d.date}`}><span className="font-medium text-foreground">{d.company}</span> · {d.stage || "Unknown"} · {d.date ? d.datePrecision === "month" ? d.date.slice(0,7) : d.datePrecision === "year" ? d.date.slice(0,4) : d.date : "Unknown"}<SourceLink url={d.source} /><span className="mt-1 block">{d.focusNiches?.join(" / ") || "Unknown"} · {d.location || "Unknown"}</span><span className="mt-1 block">Found through: {d.niches?.join(" / ") || "Unknown"}</span></li>)}</ul>
      <h3 className="mt-6 text-xs font-semibold text-muted-foreground">Get a warm intro</h3>
      <p className="mt-2 text-xs text-muted-foreground">Founders they backed often give the warmest intros.</p>
      <ul className="mt-3 space-y-4">{introDeals(inv.matchedDeals, founder.niches).map((d) => <li key={d.company} className="border-b pb-4 text-sm"><p className="font-medium">{d.company}<SourceLink url={d.source} /></p>{(d.founders?.length ? d.founders : [{ name: "Unknown" }]).map((person) => <div key={person.name} className="mt-2 flex flex-wrap items-center gap-2"><span className="text-muted-foreground">{person.name}</span><Button asChild variant="outline" size="sm"><a href={linkedinLink(person.name === "Unknown" ? d.company : person.name, person.linkedin).url} target="_blank" rel="noreferrer">Find on LinkedIn<ExternalLink className="size-3" /></a></Button><Button size="sm" variant="outline" onClick={() => { setDraftText(introMessage(founder.description, inv.name, d.company, person.name === "Unknown" ? undefined : person.name)); setModalTitle(`Ask for intro · ${person.name === "Unknown" ? d.company : person.name}`); setCopied(false); setModal(true); }}>Ask for intro</Button>{person.name !== "Unknown" && <Button size="sm" variant="outline" aria-label={`Save founder ${person.name}`} aria-pressed={savedPeople.some((p) => p.id === personId("founder", person.name, d.company))} onClick={() => onSavePerson({ id: personId("founder", person.name, d.company), role: "founder", name: person.name, company: d.company, ...(person.linkedin ? { linkedin: person.linkedin } : {}), ...(d.source ? { source: d.source } : {}), ...(d.location ? { location: d.location } : {}), investor: inv.name })}><Bookmark className={savedPeople.some((p) => p.id === personId("founder", person.name, d.company)) ? "size-3 fill-star text-star" : "size-3"} />{savedPeople.some((p) => p.id === personId("founder", person.name, d.company)) ? "Saved" : "Save"}</Button>}{savedPeople.filter((p) => p.id === personId("founder", person.name, d.company)).map((p) => <OutreachStatusPill key={p.id} person={p} onCycle={onCycleStatus} />)}</div>)}</li>)}</ul>
      {inv.summary && (
        <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{inv.summary}
          {inv.summarySources.slice(0, 3).map((s, i) => <SourceLink key={s.url} url={s.url} label={`[${i + 1}]`} />)}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><a href={linkedin.url} target="_blank" rel="noreferrer">{linkedin.label}<ExternalLink className="size-3" /></a></Button>
        <Button size="sm" onClick={doDraft} disabled={drafting}>{drafting ? <span className="text-xs">…</span> : <Sparkles className="size-4" />}{message ? "Redraft" : "Draft message"}</Button>
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
      <Dialog open={modal} onOpenChange={setModal}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto shadow-none"><DialogTitle className="pr-6">{modalTitle}</DialogTitle><DialogDescription>{inv.name}</DialogDescription><Textarea aria-label="Draft message text" rows={7} maxLength={499} value={draftText} onChange={(e) => { setDraftText(e.target.value); setCopied(false); }} /><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{draftText.length}/500</span><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(draftText); setCopied(true); } catch { setErr("Couldn’t copy. Please select the message and copy it."); } }}><Copy className="size-3" />{copied ? "Copied" : "Copy"}</Button></div></DialogContent></Dialog>
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
