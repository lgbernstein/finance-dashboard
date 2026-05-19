# Designer — Memory Schema

Reads/writes `shared_memory/design_decisions.json`.

## design_decisions.json
```json
{
  "last_updated": "ISO datetime",
  "active_layout": "description of current panel layout",
  "color_system": {
    "risk": "#e53e3e",
    "watch": "#d69e2e",
    "positive": "#38a169",
    "neutral": "#4299e1",
    "ai_label": "#4ade80"
  },
  "decisions": [
    {
      "date": "ISO date",
      "decision": "string",
      "rationale": "string"
    }
  ]
}
```
