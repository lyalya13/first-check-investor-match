export const CALA_TIMEOUT_MS = 25_000;
export const CALA_CONCURRENCY = 6;
export const CALA_SEARCH_CONCURRENCY = 2;

/** One retry for transient provider failures only, never invalid input or missing credentials. */
export async function retryCala<T>(run: () => Promise<T>, pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 1000))): Promise<T> {
  try { return await run(); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/MISSING_KEY|Cala 4(?!29)\d\d/.test(message)) throw error;
    await pause();
    return run();
  }
}

/** Start each call's timeout only when it has an outbound connection slot. */
export async function parallelMap<T, R>(items: T[], run: (item: T) => Promise<R>, concurrency = CALA_CONCURRENCY): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item !== undefined) results[index] = await run(item);
    }
  }));
  return results;
}

export async function progressiveMap<T, R>(items: T[], run: (item: T) => Promise<R>, onResult: (result: R, item: T) => void, isCurrent: () => boolean = () => true): Promise<void> {
  await parallelMap(items, async (item) => {
    if (!isCurrent()) return;
    const result = await run(item);
    if (isCurrent()) onResult(result, item);
  }, CALA_SEARCH_CONCURRENCY);
}

/** A missing or failed profile-cache read keeps that investor's grouped deal facts. */
export async function consolidateProfiles<T>(investors: T[], read: (investor: T) => Promise<{ investor: T; partial?: boolean } | null>) {
  let partial = false;
  const rows = await parallelMap(investors, async (investor) => {
    try {
      const profile = await read(investor);
      if (!profile) { partial = true; return investor; }
      partial = partial || !!profile.partial;
      return profile.investor;
    } catch { partial = true; return investor; }
  });
  return { investors: rows, partial };
}