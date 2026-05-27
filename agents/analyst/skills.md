# Analyst — Skills

## Tools Available
- `read_shared_memory("analyst_baseline.json")` — compare current data to previous cycle
- `read_shared_memory("data_cache.json")` — access the research data
- `read_shared_memory("influencer_content.json")` — read influencer feed items fetched by Researcher

## Writing influencer_sentiment.json
After producing the `influencer_pulse` section of your output, write it to `shared_memory/influencer_sentiment.json` in this exact shape:

```json
{
  "generated_at": "ISO datetime",
  "creators": [
    {
      "id": "kenneth_suna",
      "name": "Kenneth Suna",
      "sentiment": "bullish | bearish | neutral | mixed | no_recent_content",
      "key_theme": "short phrase",
      "notable": "one specific claim, or null"
    }
  ],
  "shared_themes": ["theme one", "theme two"],
  "pulse_summary": "2-3 plain sentences."
}
```

The dashboard reads this file directly. Write it every cycle, even if content is unchanged.

## What You Cannot Do
- Fetch data directly (that is Researcher's job)
- Write to the database (that is Manager's job)
- Invoke other agents

## Analysis Approach
1. Compare current values to baseline to identify changes
2. Cross-reference FRED data with news signals
3. Identify the 1-2 most significant developments
4. Write commentary grounded in specific data points
5. Flag if confidence on any panel falls below 0.70
