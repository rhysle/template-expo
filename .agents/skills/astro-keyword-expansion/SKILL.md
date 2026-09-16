---
name: astro-keyword-expansion
description: Add Astro MCP keyword suggestions for one or more iOS apps across their highest-rating and required base storefronts. Use when the user wants to expand tracked Astro keywords by app URL or App Store ID; default to the top 20 rating storefronts plus any missing base storefronts.
---

# Astro Keyword Expansion

Expand tracked keywords for one or more iOS apps using Astro MCP. Keep every app and storefront independent, and mutate only the apps the user supplied.

## Inputs and defaults

- Accept one or more App Store URLs, numeric App Store IDs, or unambiguous tracked app names.
- Default to the **top 20 rating storefronts per app**. Use a different positive count when the user requests one. This count controls only the rating-ranked portion; required base storefronts are appended afterward and can make the final total larger.
- Rank storefronts by current rating count descending. Break ties by average rating descending, then storefront code ascending.
- Always include this required base storefront set, using the exact Astro codes shown: United States (`us`), United Kingdom (`gb`), Australia (`au`), Germany (`de`), France (`fr`), Canada (`ca`), Portugal (`pt`), Spain (`es`), Brazil (`br`), Italy (`it`), Japan (`jp`), South Korea (`kr`), China (`cn`), Taiwan (`tw`), Saudi Arabia (`sa`), Vietnam (`vn`), Switzerland (`ch`), Netherlands (`nl`), Sweden (`se`), Turkey (`tr`), and India (`in`).
- Request all Astro suggestions with `highPopularity: false`.
- Keep only suggestions whose numeric `popularity` is strictly greater than `5`. Ignore missing, non-numeric, or `<= 5` popularity values.
- Preserve each keyword's exact language, script, spelling, and storefront. Trim surrounding whitespace and deduplicate exact keyword text within the same app/storefront only.

## Workflow

1. Use `list_apps` to resolve the supplied apps and record their initial keyword counts. If an app is absent, verify the supplied ID with `search_app_store`, then use `add_app` before continuing.
2. Call `get_app_ratings` with `includeHistory: false` for every app. Sort each app's storefronts using the ordering above and select the requested top count.
3. Build the final storefront list in this order: selected rating storefronts first, then append only the required base storefront codes not already present. Deduplicate by storefront code while preserving that order. Do not count appended base storefronts against the requested top count.
4. Call `get_keyword_suggestions` once for every storefront in the final list with the exact app ID, storefront code, and `highPopularity: false`.
5. If Astro explicitly rejects a rating-selected storefront as unsupported, remove it and try the next storefront in that app's rating order until the requested number of supported rating storefronts has been evaluated or no rated storefronts remain. Append any newly selected replacement before the missing base storefronts, and keep the list deduplicated. If Astro rejects a required base storefront, report it as unsupported but do not substitute another storefront for that base entry. An empty successful suggestion list still counts as evaluated and must not be replaced.
6. Filter the returned suggestions to `popularity > 5`, then call `add_keywords` for each non-empty app/storefront set. Split sets larger than 100 into chunks of at most 100. Never move a suggestion to another storefront.
7. Verify the result with `get_app_keywords` for each app. Confirm every eligible returned keyword exists under the intended storefront. Prefer this keyword-level result over the aggregate count from `list_apps`.

## Reliability

- Astro MCP is limited to 60 requests per minute. Pace large multi-app runs and use modest concurrency; four concurrent requests is a reasonable ceiling.
- `add_keywords` is idempotent for already-tracked keywords. Record `added`, `skipped`, and `failed` separately.
- Retry a read-only transient transport error or rate-limit response at most twice with backoff.
- An add request can succeed even when its response is lost. After a transient add failure, call `get_app_keywords` for that app/storefront and retry only the still-missing keywords, at most twice.
- Do not retry invalid parameters or an unsupported storefront. Apply the storefront-replacement rule instead.
- Keep the user informed during long MCP batches; do not launch overlapping add batches for the same app/storefront.

## Completeness boundary

Astro's MCP suggestion result may differ from the Suggestions window in the Astro app, even with `highPopularity: false`. Complete this workflow against every eligible keyword actually returned by MCP, but do not claim parity with the desktop UI. If the user supplies UI-only suggestions, report the mismatch and add those exact keywords only when the user asks.

## Handoff

Report, per app:

- selected storefront count and any unsupported storefront substitutions;
- requested top-rating count, base storefronts appended because they were missing, and total unique storefronts evaluated;
- suggestions returned, suggestions excluded because popularity was `<= 5` or invalid, newly added, already tracked, and failed;
- storefronts that returned no eligible suggestions;
- final verified keyword and storefront counts;
- unresolved MCP/UI mismatches or exhausted retries.

State clearly that completion covers MCP-returned suggestions after the strict `popularity > 5` filter.
