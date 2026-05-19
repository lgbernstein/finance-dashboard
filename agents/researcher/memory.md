# Researcher — Memory Schema

Reads `shared_memory/data_cache.json` to check if data is still fresh before fetching.

## data_cache.json
```json
{
  "fred": {
    "last_fetch": "ISO datetime",
    "series": { "DGS10": {...}, "UNRATE": {...} }
  },
  "market": {
    "last_fetch": "ISO datetime",
    "data": { "SP500": {...}, "VIX": {...} }
  },
  "rss": {
    "last_fetch": "ISO datetime",
    "items": [...]
  }
}
```

If `last_fetch` for a source is less than 4 hours old, return cached data and note it in the output.
