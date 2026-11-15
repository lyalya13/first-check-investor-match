export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type SearchInput = { niches: { name: string; category: string }[]; category: string; secondaryIndustry?: string | undefined; businessModel?: string | undefined; investorType?: string | undefined; region: string; stage: string; amount: number };
const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

export function searchCacheKey(input: SearchInput): string {
  return JSON.stringify({
    version: 3,
    niches: [...new Set(input.niches.map((n) => normalize(n.name)))].sort(),
    categories: [...new Set([input.category, ...(input.secondaryIndustry ? [input.secondaryIndustry] : [])].map(normalize))].sort(),
    businessModel: input.businessModel ?? "both", investorType: input.investorType ?? "All",
    region: normalize(input.region), stage: normalize(input.stage), amount: input.amount,
  });
}

export function cacheIsFresh(fetchedAt: string, now = Date.now()): boolean {
  const age = now - Date.parse(fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS;
}

export async function resolveCachedSearch<T>(options: {
  cached: { result: T; fetchedAt: string; example?: boolean } | null;
  fetchLive: () => Promise<T>;
  save: (result: T) => Promise<void>;
  now?: number;
}): Promise<{ result: T; cached: boolean; stale: boolean; fetchedAt: string }> {
  const now = options.now ?? Date.now();
  const entry = options.cached;
  const fresh = entry ? cacheIsFresh(entry.fetchedAt, now) : false;
  // The precomputed example is a durable snapshot: no provider request on the demo path.
  if (entry && (fresh || entry.example)) return { result: entry.result, cached: true, stale: !fresh, fetchedAt: entry.fetchedAt };
  try {
    const result = await options.fetchLive();
    try { await options.save(result); } catch { /* A cache outage must not discard a live result. */ }
    return { result, cached: false, stale: false, fetchedAt: new Date(now).toISOString() };
  } catch (error) {
    if (entry) return { result: entry.result, cached: true, stale: true, fetchedAt: entry.fetchedAt };
    throw error;
  }
}