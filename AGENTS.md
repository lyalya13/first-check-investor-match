<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Keep category selections and fundraising thresholds in a client-safe shared module so the UI and tests use identical rules.
- Parse Cala responses in a pure adapter and merge deals by normalized company plus date, preserving every query's niche provenance.
- Query each selected industry once (up to three) with its niches, all selected locations, customer models and stage in the query; merge deals to bound outbound calls while honoring founder selections.
- Persist provider-produced search results in Cloud with normalized shared cache keys and 24-hour freshness; retain stale results for provider failures and a durable example snapshot so demo searches never depend on Cala availability.
- Keep cache reads public and cache writes server-owned, accepting only validated inputs and provider-produced output, so callers cannot inject stored investor data.
- Render investor summaries as expandable rows and preserve all outreach, sourcing and shortlist controls inside the expanded details, keeping the mobile list scannable.
- Keep the default and explicit theme on the same semantic CSS tokens and use native light color-scheme so form controls and overlays stay readable without changing layout or search logic.
- Compute matches, region filtering and LinkedIn fallbacks in a pure shared module; score explicit Cala deal niches rather than query provenance to avoid unsupported matches.
- Version cache keys when the provider result shape changes so the durable example and live results share the same enrichment fields.
- Keep founder-intro drafts deterministic and editable using only returned portfolio relationships; never ask AI to supply missing founder facts.
- Return cached provider-produced grouped deals before enrichment; enrich each investor in its own parallel invocation and consolidate server-owned profile cache rows, so progressive updates never accept caller-supplied facts.
- Limit each Cala attempt to 20 seconds, run at most two industry searches or profile invocations concurrently, and retry transient failures once; smaller provider result limits and partial results keep searches usable during slow responses.
- Build Similar startups from deduplicated cached investor deals and explicit niche overlap, with deterministic editable founder drafts; this view must never add provider calls or invent relationships.

- Store named searches and full investor/founder snapshots in versioned browser storage with guarded reads/writes; saved views and CSV must not depend on the current results.
- Parse customer models only from provider evidence; estimate investor categories from explicit Cala classifications then distinctive name cues, with Other as the fallback to avoid asserting unsupported classifications.

- Keep outreach status normalization, cycling, counts and filtering in the saved-items module; resolve missing legacy statuses to Not contacted without changing existing storage keys.
- Keep fundraising guidance in shared presentation components; persist the results guide’s open state through guarded browser storage without touching search/cache behavior.
- Keep provider failure messaging in a client-safe pure adapter so rate-limit behavior is independently testable while stale-cache resolution remains server-owned.

- Normalize multi-select search dimensions in versioned cache keys and reuse only the existing durable provider example for preset compatibility, so new selections never share unrelated cached results.
- Keep provider query target generation in a client-safe pure module used by the server and tests, so niches, stage, models and locations cannot silently diverge.
