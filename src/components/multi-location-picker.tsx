import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { REGIONS } from "@/lib/matching";

export function MultiLocationPicker({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const [country, setCountry] = useState("");
  const toggle = (value: string) => onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  const add = () => { const value = country.trim(); if (value && !values.some((v) => v.toLowerCase() === value.toLowerCase())) onChange([...values, value]); setCountry(""); };
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Countries or regions">{[...new Set([...REGIONS.filter((r) => r !== "All"), ...values])].map((value) => <Button key={value} type="button" size="sm" variant={values.includes(value) ? "secondary" : "outline"} aria-pressed={values.includes(value)} onClick={() => toggle(value)}>{value}</Button>)}</div>
    <div className="flex gap-2"><Input aria-label="Add a country or region" placeholder="Add a country, e.g. Sweden" maxLength={120} value={country} onChange={(e) => setCountry(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /><Button type="button" variant="outline" size="icon" aria-label="Add country or region" disabled={!country.trim() || values.length >= 30} onClick={add}><Plus className="size-4" /></Button></div>
  </div>;
}