import { dealSearchIndustries, selectedModels, selectedRegions, STAGE_LABELS, type BusinessModel } from "./fundraising";

type QueryInput = { category: string; secondaryIndustry?: string | undefined; thirdIndustry?: string | undefined; niches: { category: string; name: string }[]; region: string; regions?: string[] | undefined; businessModel?: string | undefined; businessModels?: BusinessModel[] | undefined; stage: keyof typeof STAGE_LABELS };

export function dealQueryTarget(input: Omit<QueryInput, "category"> & { category?: string }, industry: string): string {
  const niches = input.niches.filter((n) => n.category === industry).map((n) => n.name);
  return `${STAGE_LABELS[input.stage]} funding rounds announced since January 1, 2024 for ${selectedModels(input).join(" or ") || "any business model"} ${industry} startups${niches.length ? ` in any of these niches (${niches.join(" OR ")})` : ""} in any of these countries or regions: ${selectedRegions(input).join(" OR ")}`;
}

/** At most two provider queries per search: one structured, one natural-language fallback. */
export function combinedDealQueries(input: QueryInput): { structured: string; fallback: string } {
  const industries = dealSearchIndustries(input);
  const niches = [...new Set(input.niches.filter((n) => industries.includes(n.category)).map((n) => n.name))];
  const models = selectedModels(input).join(" or ") || "any business model";
  const regions = selectedRegions(input).join(" OR ");
  const stage = STAGE_LABELS[input.stage];
  const fields = "Fields: company, investors, lead_investor, amount (total round size with currency), round_type, date (preserve known precision), source (article URL), company_location, company_niches (verified specific areas), founders (name, linkedin_url), company_linkedin_url, business_model (verified customer model). Unknown fields null. Never invent facts.";
  return {
    structured: `Find ${stage} funding rounds announced since January 1, 2024 for ${models} startups in industries (${industries.join(" OR ")})${niches.length ? ` with niches (${niches.join(" OR ")})` : ""} in countries or regions (${regions}). Return up to 30 real rounds with named investors, one row per company and date. ${fields}`,
    fallback: `Which ${models} ${industries.join(", ")} startups${niches.length ? ` working on ${niches.join(", ")}` : ""} based in ${selectedRegions(input).join(", ")} raised a ${stage} or early-stage round since 2024, and who invested? Return up to 30 rounds with named investors. ${fields}`,
  };
}
