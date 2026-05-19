# Alert Monitor — Memory Schema

Reads/writes `shared_memory/alert_history.json` to avoid re-escalating the same event.

## alert_history.json
```json
{
  "last_scan": "ISO datetime",
  "escalated_events": [
    {
      "id": "uuid",
      "headline": "string",
      "escalated_at": "ISO datetime",
      "resolved": false
    }
  ],
  "known_headlines": ["array of headline strings already processed — prevents re-escalation"]
}
```

Before escalating any event, check if its headline (or a very similar one) is already in `known_headlines`. If it is, skip it.
