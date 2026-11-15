import type { Deal } from "./aggregate";
import { mergeDeals } from "./cala-data";
import { nicheOverlap, recentDeals } from "./matching";

/** Query provenance alone is not evidence that a company matches a founder's niche. */
export function similarStartups(investors: { matchedDeals: Deal[] }[], niches: { name: string }[]): Deal[] {
  const deals = mergeDeals(investors.flatMap((investor) => investor.matchedDeals));
  return recentDeals(niches.length ? deals.filter((deal) => nicheOverlap(deal, niches).length > 0) : deals);
}