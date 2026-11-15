import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, INDUSTRIES, type Category, type NicheSelection } from "@/lib/fundraising";

export function IndustryPicker({ category, secondaryIndustry, niches, onChange }: {
  category: string; secondaryIndustry?: string | undefined; niches: { category: string; name: string }[];
  onChange: (category: string, secondaryIndustry: string, niches: NicheSelection[]) => void;
}) {
  const [custom, setCustom] = useState<Record<string, string>>({});
  const selected = niches as NicheSelection[];
  const choose = (primary: string, secondary: string) => onChange(primary, secondary, selected.filter((n) => n.category === primary || n.category === secondary));
  const toggle = (c: Category, name: string) => onChange(category, secondaryIndustry ?? "", selected.some((n) => n.category === c && n.name === name) ? selected.filter((n) => !(n.category === c && n.name === name)) : selected.length < 20 ? [...selected, { category: c, name }] : selected);
  const selectClass = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><p className="text-xs text-muted-foreground">Primary industry</p><select aria-label="Primary industry" required value={category} onChange={(e) => choose(e.target.value, e.target.value === secondaryIndustry ? "" : secondaryIndustry ?? "")} className={selectClass}><option value="" disabled>Choose an industry</option>{INDUSTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="space-y-2"><p className="text-xs text-muted-foreground">Secondary industry (optional)</p><select aria-label="Secondary industry" value={secondaryIndustry ?? ""} onChange={(e) => choose(category, e.target.value)} className={selectClass}><option value="">None</option>{INDUSTRIES.filter((c) => c !== category).map((c) => <option key={c}>{c}</option>)}</select></div>
    </div>
    {category && <><p className="text-xs leading-5 text-muted-foreground">Optional. Pick niches to rank the closest investors first.</p>{[category, secondaryIndustry].filter((c): c is Category => !!c && c in CATEGORIES).map((c) => <div key={c} className="space-y-3">
      <p className="text-xs font-medium">{c}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${c} niches`}>{[...new Set([...CATEGORIES[c], ...selected.filter((n) => n.category === c).map((n) => n.name)])].map((name) => { const active = selected.some((n) => n.category === c && n.name === name); return <Button key={name} type="button" size="sm" variant={active ? "secondary" : "outline"} aria-pressed={active} onClick={() => toggle(c, name)} className="h-auto min-h-9 whitespace-normal text-left">{active && <Check className="size-3 shrink-0" />}{name}</Button>; })}</div>
      <div className="flex gap-2"><Input aria-label={`Other niche for ${c}`} placeholder="Other niche" maxLength={120} value={custom[c] ?? ""} onChange={(e) => setCustom({ ...custom, [c]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (custom[c]?.trim()) { toggle(c, custom[c].trim()); setCustom({ ...custom, [c]: "" }); } } }} /><Button type="button" variant="outline" size="icon" aria-label={`Add other niche for ${c}`} disabled={!custom[c]?.trim()} onClick={() => { const name = custom[c]?.trim(); if (name) { toggle(c, name); setCustom({ ...custom, [c]: "" }); } }}><Plus className="size-4" /></Button></div>
    </div>)}</>}
  </div>;
}