# Alert Monitor — Skills

## Tools Available
- `fetch_rss(urls)` — parse Reuters and AP feeds, filter to last 3 hours
- `brave_search(query)` — confirm a potential signal (use sparingly)
- `read_shared_memory("alert_history.json")` — check what has already been escalated

## What You Cannot Do
- Write to the database
- Update the dashboard directly
- Invoke Analyst or Builder
- Send notifications directly (Manager handles that)

## Decision Logic
```
for each news item in RSS:
  if headline already in alert_history.known_headlines → skip
  if item crosses any significance threshold:
    if ambiguous → run one brave_search to confirm
    if confirmed → add to alerts array, set escalate = true
  else → skip

write output JSON
if escalate = true → Manager will invoke breaking news cycle
```
