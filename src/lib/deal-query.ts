import { selectedModels, selectedRegions, STAGE_LABELS, type BusinessModel } from "./fundraising";

export function dealQueryTarget(input: { niches: { category: string; name: string }[]; region: string; regions?: string[]; businessModel?: string; businessModels?: BusinessModel[]; stage: keyof typeof STAGE_LABELS }, industry: string): string {
  const niches = input.niches.filter((n) => n.category === industry).map((n) => n.name);
  return `${STAGE_LABELS[input.stage]} funding rounds announced since January 1, 2024 for ${selectedModels(input).join(" or ") || "any business model"} ${industry} startups${niches.length ? ` in any of these niches (${niches.join(" OR ")})` : ""} in any of these countries or regions: ${selectedRegions(input).join(" OR ")}`;
}