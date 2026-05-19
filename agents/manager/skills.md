# Manager — Skills

## Tools Available
- `invoke_agent(name, payload)` — call a subagent with a structured handoff payload
- `read_shared_memory(path)` — read any file in shared_memory/
- `write_db(table, data)` — write validated output to SQLite
- `flag_for_approval(task_id, reason)` — escalate to pending_approvals/

## Validation Rules
- Researcher output must include: `fred_data`, `market_data`, `news_items`, `fetch_timestamp`
- Analyst output must include: `panels` array with at least 2 entries, each having `title`, `body`, `confidence`
- Any panel with `confidence < 0.70` triggers a review flag

## Deduplication
Before invoking Researcher, check `last_cycle.json`. If `data_freshness.fred` is less than 4 hours old, skip that fetch and use cached data.
