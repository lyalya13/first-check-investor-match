import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, type Category, type NicheSelection } from "@/lib/fundraising";

export function IndustryPicker({ category, niches, onChange }: {
  category: string; niches: { category: string; name: string }[];
  onChange: (category: Category, niches: NicheSelection[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const selected = niches as NicheSelection[];
  const options = CATEGORIES[category as Category] ?? [];
  const toggle = (name: string) => {
    const c = category as Category;
    onChange(c, selected.some((n) => n.category === c && n.name === name)
      ? selected.filter((n) => !(n.category === c && n.name === name))
      : [...selected, { category: c, name }]);
  };
  return <div className="space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Pick all that fit your startup. More precise niches give better matches.</p>
    <select aria-label="Industry category" required value={category} onChange={(e) => onChange(e.target.value as Category, selected)} className="h-10 w-full rounded-md border-[1.5px] border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
      <option value="" disabled>Choose a broad category</option>
      {Object.keys(CATEGORIES).map((c) => <option key={c}>{c}</option>)}
    </select>
    {category && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${category} niches`}>
        {options.map((name) => {
          const active = selected.some((n) => n.category === category && n.name === name);
          return <Button type="button" size="sm" key={name} variant={active ? "secondary" : "outline"} aria-pressed={active} onClick={() => toggle(name)} className="h-auto min-h-9 whitespace-normal text-left">{active && <Check className="size-3 shrink-0" />}{name}</Button>;
        })}
      </div>
      <div className="flex gap-2">
        <Input aria-label="Other niche" placeholder="Other niche" maxLength={120} value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (custom.trim()) { toggle(custom.trim()); setCustom(""); } } }} />
        <Button type="button" variant="outline" size="icon" aria-label="Add other niche" disabled={!custom.trim()} onClick={() => { toggle(custom.trim()); setCustom(""); }}><Plus className="size-4" /></Button>
      </div>
    </>}
    {selected.length > 0 && <div className="space-y-2 border-t pt-3">
      {[...new Set(selected.map((n) => n.category))].map((c) => <div key={c}>
        <p className="mb-1 text-xs text-muted-foreground">{c}</p>
        <div className="flex flex-wrap gap-1.5">{selected.filter((n) => n.category === c).map((n) => <Button key={n.name} type="button" variant="secondary" size="sm" aria-label={`Remove ${n.name} from ${c}`} className="h-auto min-h-8 whitespace-normal text-left" onClick={() => onChange(category as Category, selected.filter((x) => x !== n))}>{n.name}<X className="size-3 shrink-0" /></Button>)}</div>
      </div>)}
    </div>}
  </div>;
}