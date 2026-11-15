import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { InvestorResult } from "./cala.functions";

export type SearchResult = { ok: true; investors: InvestorResult[]; deals?: import("./aggregate").Deal[]; queries: string[]; dealCount: number; diagnostics: { niche: string; fields: string[]; rows: number; parsed: number }[]; broadened: boolean; partial?: boolean; enrichmentPending?: boolean };

export async function readSearchCache(key: string) {
  const url = process.env["SUPABASE_URL"];
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishable) return null;
  const client = createClient<Database>(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (publishable.startsWith("sb_") && headers.get("Authorization") === `Bearer ${publishable}`) headers.delete("Authorization");
      headers.set("apikey", publishable);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.from("cala_search_cache").select("result, fetched_at, is_example").eq("search_key", key).maybeSingle();
  if (error) { console.error("[cache] Read failed", error.code); return null; }
  if (!data) return null;
  const result = data.result as unknown as SearchResult;
  if (!result?.ok || !Array.isArray(result.investors)) return null;
  return { result, fetchedAt: data.fetched_at, example: data.is_example };
}

/** Server-owned cache writes accept only validated, provider-produced results, never caller payloads. */
export async function storeSearchCache(key: string, result: SearchResult, example: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("cala_search_cache").upsert({ search_key: key, result: JSON.parse(JSON.stringify(result)), fetched_at: new Date().toISOString(), is_example: example });
  if (error) throw new Error("Cache write failed");
}