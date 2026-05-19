# Analyst — Memory Schema

Reads `shared_memory/analyst_baseline.json` to track changes since last cycle.

## analyst_baseline.json
```json
{
  "last_updated": "ISO datetime",
  "key_levels": {
    "DGS10": 4.59,
    "DGS30": 5.12,
    "SP500": 5234.18,
    "CPI_yoy": 3.8,
    "UNRATE": 4.1
  },
  "dominant_narrative": "string — the main economic story as of last cycle",
  "active_risks": ["list of risks flagged in last cycle"],
  "prediction_log": [
    {
      "date": "ISO date",
      "prediction": "string",
      "confidence": 0.75,
      "outcome": "pending | correct | incorrect",
      "outcome_date": null
    }
  ]
}
```

Compare current data against `key_levels` to identify what has changed meaningfully. Update this file at the end of each cycle.
