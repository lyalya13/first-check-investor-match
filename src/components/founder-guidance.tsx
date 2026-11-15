import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guidanceTier } from "@/lib/fundraising";

const GUIDE_KEY = "first-check-fundraising-guide-visible-open";

export function AmountTip({ amount }: { amount: number }) {
  const tier = guidanceTier(amount);
  return <aside aria-label="Amount guidance" className="rounded-2xl bg-muted p-4 text-card-foreground">
    <h3 className="text-sm font-medium">Who to ask first</h3>
    <p className="mt-3 text-[15px] leading-6">
      {tier === "small" && <>At this size, start with <strong>angels</strong>, <strong>grants and equity-free competitions</strong>, and <strong>accelerators</strong>. Funds rarely back rounds this small.</>}
      {tier === "angels" && <>Start with <strong>angels, angel networks and syndicates</strong>, and pre-seed programs.</>}
      {tier === "preseed" && <>Start with <strong>angels and pre-seed funds</strong>. Larger VCs usually come in later.</>}
      {tier === "seed" && <><strong>Seed funds and VCs</strong> fit this size.</>}
    </p>
  </aside>;
}

export function FundraisingGuide() {
  const [open, setOpen] = useState(true);
  useEffect(() => { try { const saved = window.localStorage.getItem(GUIDE_KEY); setOpen(saved === null || saved === "true"); } catch { /* Keep first-visit guidance visible. */ } }, []);
  const toggle = () => {
    setOpen(!open);
    try { window.localStorage.setItem(GUIDE_KEY, String(!open)); } catch { /* Storage is optional. */ }
  };
  return <aside aria-label="Fundraising guide" className="mb-4 rounded-2xl bg-muted p-4 text-card-foreground">
    <Button variant="ghost" className="h-auto w-full justify-between gap-3 rounded-md px-0 py-1 text-left text-base whitespace-normal" aria-expanded={open} aria-controls="fundraising-guide-content" onClick={toggle}>New to fundraising? 3 things to know<ChevronDown className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} /></Button>
    {open && <ol id="fundraising-guide-content" className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-6">
      <li>Angels usually come before funds at pre-seed.</li>
      <li>Look for investors who still invest today, not 3 years ago.</li>
      <li>Investors who led a round are the ones to talk to first, others usually follow a lead.</li>
    </ol>}
  </aside>;
}

export function ResultsAmountTip({ amount, onAngelsFirst }: { amount: number; onAngelsFirst: () => void }) {
  const tier = guidanceTier(amount);
  const formatted = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(amount).replace("K", "k");
  return <p className="mb-6 text-[15px] leading-6">At {formatted}: {tier === "seed" ? "start with seed funds and VCs" : <><span>start with </span><Button variant="link" className="h-auto p-0 text-base whitespace-normal" onClick={onAngelsFirst}>angels{tier === "small" ? " and accelerators" : tier === "angels" ? ", angel networks and syndicates" : " and pre-seed funds"}</Button></>}</p>;
}