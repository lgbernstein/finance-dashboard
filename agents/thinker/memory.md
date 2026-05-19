# Thinker — Memory Schema

The Thinker reads from and writes to `shared_memory/thinker_state.json`.

## Fields
```json
{
  "last_review_date": "ISO date",
  "approved_improvements": ["list of improvement IDs that Larry approved"],
  "rejected_improvements": ["list of improvement IDs Larry rejected, with reasons"],
  "pending_improvements": ["list of improvement IDs awaiting Larry's decision"],
  "known_working": ["list of features/agents confirmed working well"],
  "known_issues": ["list of features/agents with documented problems"],
  "strategic_notes": "Free-form notes about direction — updated each review cycle"
}
```

## Usage
- Read this at the start of every review cycle to avoid re-proposing rejected ideas.
- Write an updated version after each review cycle.
- `approved_improvements` and `rejected_improvements` are permanent — never remove entries.
