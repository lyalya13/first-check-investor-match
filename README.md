# First Check Investor Match

Build **First Check**: a web app that helps first-time solo founders raising a pre-seed round find the investors who actually back companies like theirs and are still active today. All investor data comes from the Cala API.

**1. Input screen.** Fields: one-line startup description, industry, country or region, stage (pre-seed / seed), amount raising (€), optional website. Add a "Try with an example" button that fills: "Fée: cycle-aware weekly meal planner for women, one shopping list, less food waste", industry: consumer health / food tech, region: Nordics / Europe, stage: pre-seed, amount: €40,000.

**2. Backend.** Create a server function that calls Cala. Base URL `https://api.cala.ai/v1`, header `X-API-KEY` from a secret named `CALA_API_KEY` (ask me for it via the secure form, never put it in frontend code). Endpoints: `POST /knowledge/query` (body `{"input": "..."}`, returns `results` + `entities`), `POST /knowledge/search` (natural-language answer with sources), `GET /entities?name=` and `GET /entities/{id}/introspection` (to discover queryable fields).
Step A: find funding rounds similar to the founder's: same industry, same region, pre-seed or seed, from 2024 onwards. Use dot-notation like `funding_rounds.industry=<industry>.location=<region>.round_type=Pre-Seed OR Seed.date>=2024.return(company, investors, lead_investor, amount, date).limit=100`. If the result is empty or the fields differ, use introspection to find the right field names and retry, and fall back to a natural-language query. Log raw Cala responses for debugging.
Step B: aggregate by investor: number of matching deals, how many they led, typical ticket, date of the latest deal. Mark "Active" if their latest deal is within the last 12 months.
Step C: for the top 10 investors, call `/knowledge/search` with "<investor name> recent investments and investment focus" to get a short sourced summary.

**3. Results screen.** Ranked investor cards: name, type (angel / fund), Active badge, "Led X of Y matching deals", typical ticket, 2 to 3 example portfolio companies, a one-line "why they fit", and a source link for every fact (use Cala's sources). A "How we found this" toggle per card shows the Cala query used.

**4. Outreach.** On each card, a "Draft message" button uses AI to write a first message under 500 characters, based on the founder's input and that investor's real deals. Copy button.

**5. Shortlist.** Star investors and export the shortlist as CSV (name, type, active, deals, ticket, why, source, message).

Clean, calm design, works on mobile. Show loading states, since Cala calls can take a few seconds.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://first-check-investor-match.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2d994e58-734c-428d-a01f-a32821dbd1c3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
