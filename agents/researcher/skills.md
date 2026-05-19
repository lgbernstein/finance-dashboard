# Researcher — Skills

## Tools Available
- `fetch_fred(series_ids)` — FRED API wrapper, returns latest values
- `fetch_market(symbols)` — market data (indices, commodities)
- `fetch_rss(urls)` — parse RSS feeds, return structured news items
- `brave_search(query)` — Brave Search API (only when explicitly requested by Manager)
- `read_shared_memory("data_cache.json")` — check cached data before fetching

## What You Cannot Do
- Write to the database
- Invoke other agents
- Interpret or analyze data
- Make predictions
