import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { similarStartups } from "@/lib/similar-startups";
import { introMessage, nicheOverlap, safeUrl } from "@/lib/matching";
import type { FounderInput, InvestorResult } from "@/lib/cala.functions";
import { toast } from "sonner";

export function SimilarStartups({ investors, founder }: { investors: InvestorResult[]; founder: FounderInput }) {
  const companies = similarStartups(investors, founder.niches);
  const [draft, setDraft] = useState<{ company: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  return <section>
    <h2 className="mb-2 font-semibold">Similar startups</h2>
    <p className="mb-6 text-sm leading-6 text-muted-foreground">{founder.niches.length ? "Companies with verified areas matching your choices." : "Companies found in your selected industries."}</p>
    {!companies.length && <p className="py-6 text-sm text-muted-foreground">No verified companies match your specific areas yet. Try another area or a broader search.</p>}
    <ul className="divide-y">{companies.map((deal) => {
      const url = safeUrl(deal.source);
      const investors = [...new Set([...deal.investors, ...(deal.lead ? [deal.lead] : [])])];
      const date = deal.date ? deal.datePrecision === "month" ? deal.date.slice(0, 7) : deal.datePrecision === "year" ? deal.date.slice(0, 4) : deal.date : "Unknown";
      const round = deal.amount ? new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(deal.amount) : "Unknown";
      return <li key={`${deal.company}|${deal.date ?? ""}`} className="space-y-3 py-5">
        <h3 className="font-semibold">{deal.company}</h3>
        <p className="text-sm text-muted-foreground">{(founder.niches.length ? nicheOverlap(deal, founder.niches) : deal.focusNiches ?? []).join(" · ") || "Unknown"}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Round</dt><dd>{deal.stage || "Unknown"} · {round}</dd></div><div><dt className="text-muted-foreground">Date</dt><dd>{date}</dd></div></dl>
        <p className="text-sm"><span className="text-muted-foreground">Investors: </span>{investors.join(", ") || "Unknown"}</p>
        <p className="text-sm"><span className="text-muted-foreground">Founder: </span>{deal.founders?.map((person) => person.name).join(", ") || "Unknown"}</p>
        <div className="flex flex-wrap gap-2">
          {url ? <Button asChild size="sm" variant="outline"><a href={url} target="_blank" rel="noreferrer">Source<ExternalLink className="size-3" /></a></Button> : <span className="text-xs text-muted-foreground">Source: Unknown</span>}
          <Button size="sm" variant="outline" disabled={!investors.length} onClick={() => { setCopied(false); setDraft({ company: deal.company, text: introMessage(founder.description, investors.join(", "), deal.company, deal.founders?.[0]?.name) }); }}>Ask for a warm intro</Button>
        </div>
      </li>;
    })}</ul>
    <Dialog open={!!draft} onOpenChange={(open) => { if (!open) setDraft(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle className="pr-6">Ask for a warm intro</DialogTitle><DialogDescription>Message to a founder of {draft?.company}</DialogDescription><Textarea aria-label="Warm intro message" rows={7} maxLength={499} value={draft?.text ?? ""} onChange={(event) => { if (draft) setDraft({ ...draft, text: event.target.value }); setCopied(false); }} /><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{draft?.text.length ?? 0}/500</span><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(draft?.text ?? ""); setCopied(true); } catch { toast.error("Couldn’t copy. Please select the message and copy it."); } }}><Copy className="size-3" />{copied ? "Copied" : "Copy"}</Button></div></DialogContent></Dialog>
  </section>;
}