# Manager — Memory Schema

Reads/writes `shared_memory/last_cycle.json` and appends to `shared_memory/task_history.jsonl`.

## last_cycle.json
```json
{
  "timestamp": "ISO datetime",
  "cycle_type": "daily | breaking_news",
  "status": "success | partial | failed",
  "agents_invoked": ["Researcher", "Analyst"],
  "data_freshness": {
    "fred": "ISO datetime of last successful fetch",
    "market": "ISO datetime",
    "rss": "ISO datetime"
  },
  "gaps": ["list of data that was unavailable"],
  "errors": ["list of errors encountered"]
}
```

## task_history.jsonl (append only)
One JSON object per line:
```json
{"timestamp": "", "cycle_type": "", "status": "", "summary": ""}
```
