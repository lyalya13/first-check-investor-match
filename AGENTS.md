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
- Query selected niches independently with OR semantics; broaden to all selected categories when fewer than five unique deals return.
- Persist provider-produced search results in Cloud with normalized shared cache keys and 24-hour freshness; retain stale results for provider failures and a durable example snapshot so demo searches never depend on Cala availability.
- Keep cache reads public and cache writes server-owned, accepting only validated inputs and provider-produced output, so callers cannot inject stored investor data.
- Render investor summaries as expandable rows and preserve all outreach, sourcing and shortlist controls inside the expanded details, keeping the mobile list scannable.
- Keep the default and explicit dark theme on the same semantic CSS tokens and use native dark color-scheme so form controls and overlays stay readable without changing layout or search logic.
