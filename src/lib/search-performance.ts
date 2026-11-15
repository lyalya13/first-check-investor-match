export const CALA_TIMEOUT_MS = 20_000;
export const CALA_CONCURRENCY = 6;

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

export async function progressiveMap<T, R>(items: T[], run: (item: T) => Promise<R>, onResult: (result: R, item: T) => void): Promise<void> {
  await Promise.all(items.map(async (item) => { onResult(await run(item), item); }));
}