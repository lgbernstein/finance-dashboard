# Multi-Agent System Design: Production Harness for Finance

## Architecture Overview

Your seven-agent system (Thinker, Manager, Researcher, Analyst, Alert Monitor, Builder, Designer) should follow Anthropic's **orchestrator-subagent hierarchy** with validated handoffs and structured outputs.

### Recommended Pattern
- **Manager** = Lead Orchestrator (Claude Sonnet 4 or Opus 4)
- **Thinker, Researcher, Analyst, Alert Monitor, Builder, Designer** = Specialized Subagents (Sonnet 4)

Performance: Opus as orchestrator with Sonnet subagents outperforms single-Opus by 90%+.

---

## 1. Orchestrator/Subagent Architecture

**Manager (Orchestrator) Role:**
- Decomposes incoming tasks into subtasks
- Saves decomposition plan to shared memory
- Routes to appropriate subagents with structured payloads
- Validates handoff targets via allowlist (cannot arbitrarily invoke unknown agents)
- Aggregates results and decides if human checkpoint needed

**Subagent Pattern:**
Each subagent receives:
- Task objective (1-2 sentences)
- Relevant context from Manager (previous findings, constraints)
- Tool boundaries (what tools it can access)
- Output format requirements (JSON schema)
- Success criteria (when task is complete)

**Memory Structure:**
```
/shared_memory/
  ├── decomposition_plan.json
  ├── task_history.jsonl
  ├── agent_observations.json
  └── context_window_tracker.json
```

---

## 2. System Prompts by Role

### Manager (Orchestrator)
```
You are the orchestration controller for a financial analysis system. Your role is to:
1. Break down incoming requests into discrete subtasks
2. Route to appropriate subagents (Thinker, Researcher, Analyst, Alert Monitor, Builder, Designer)
3. Validate all handoffs against the allowed agent registry
4. Aggregate subagent outputs and synthesize insights
5. Flag for human review when risk > threshold or confidence < threshold

For each handoff, provide:
- task_objective (string)
- required_context (object)
- output_schema (JSON schema the subagent must follow)
- success_criteria (array of testable conditions)
```

### Thinker (Strategic Planner)
```
You are a strategic financial planning agent. Given market conditions, portfolio data, and constraints:
1. Synthesize strategic options (3-5 alternatives)
2. Evaluate tradeoffs using explicit criteria
3. Output a structured recommendation with confidence scores
4. Flag assumptions that need validation by Researcher
```

### Researcher (Data Gatherer)
```
You are a financial research agent with access to market data APIs and document retrieval.
1. Execute precise queries against available data sources
2. Validate data freshness and source reliability
3. Return findings in structured JSON with provenance
4. Flag gaps where data is missing or stale
```

### Analyst (Deep Examiner)
```
You are a quantitative analyst. Given datasets from Researcher:
1. Perform statistical analysis (correlation, regression, anomaly detection)
2. Validate Thinker's assumptions against data
3. Output detailed analysis with confidence intervals
4. Highlight surprising findings or contradictions
```

### Alert Monitor (Risk Watch)
```
You are a risk monitoring agent. Continuously evaluate:
1. Portfolio risk metrics against thresholds
2. Market anomalies using defined rules
3. Breach events requiring immediate escalation
Output: alerts array with severity, reasoning, recommended action
```

### Builder (Execution Agent)
```
You are responsible for implementing approved decisions:
1. Execute trades/orders when authorized
2. Validate execution against approval criteria
3. Log all actions with timestamps and confirmations
4. Report execution status with settlement info
```

### Designer (Interface Agent)
```
You are responsible for human-facing outputs:
1. Synthesize findings into executive summaries
2. Create visualizations and dashboards
3. Ensure compliance with display/audit requirements
4. Format outputs for specific stakeholder audiences
```

---

## 3. Agent-to-Agent Handoffs (Structured)

**Handoff Schema:**
```json
{
  "from_agent": "Manager",
  "to_agent": "Researcher",
  "task_id": "uuid",
  "objective": "Fetch latest S&P 500 constituent data",
  "context": {
    "time_range": "last 30 days",
    "priority_tickers": ["NVDA", "TSLA", "META"],
    "previous_findings": {}
  },
  "constraints": {
    "max_age_hours": 4,
    "sources": ["alpha_vantage", "fred_api"],
    "forbidden_sources": []
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "data": { "type": "array" },
      "metadata": { "type": "object" },
      "gaps": { "type": "array" }
    }
  },
  "success_criteria": [
    "All required_tickers have data",
    "Data freshness < max_age_hours",
    "Schema validation passes"
  ]
}
```

**Implementation:**
- Manager stores all handoff payloads in `shared_memory/handoffs/{task_id}.json`
- Subagent reads payload, executes task, validates against output_schema
- Subagent returns structured result with schema confirmation
- Manager runs JSON schema validation before aggregating

---

## 4. Human-in-the-Loop Checkpoints

**Trigger Events:**
- Portfolio risk exceeds 2-sigma threshold
- Trade size > approval limit (e.g., $100K)
- Alert severity = CRITICAL
- Confidence on recommendation < 70%
- Conflicting advice from multiple agents

**Checkpoint Flow:**
```
Agent produces decision
  ↓
Manager evaluates checkpoint criteria
  ↓
IF (should_escalate) → Store in /pending_approvals/{task_id}.json
  ↓
Human reviews via dashboard or email
  ↓
Human approves/rejects via API or CLI
  ↓
Manager resumes with decision
```

**Approval Schema:**
```json
{
  "task_id": "uuid",
  "agent": "Builder",
  "action": "Execute NVDA sale 1000 shares @ $145",
  "risk_level": "HIGH",
  "confidence": 0.65,
  "requires_human_approval": true,
  "approval_deadline": "2026-05-19T14:00:00Z"
}
```

---

## 5. Memory & Context Management

**Shared Memory (Persistent):**
- `/shared_memory/task_history.jsonl` - all completed tasks + results
- `/shared_memory/observations.json` - agent findings indexed by date
- `/shared_memory/context_window_tracker.json` - token usage per agent

**Per-Agent Context:**
- Each subagent gets relevant context injected at handoff
- Use `context_window_tracker` to estimate remaining tokens
- If remaining < 10K tokens, summarize context and archive old findings
- Store full context archive in S3 or database for post-task review

**Memory Retention:**
```
Active (in context): Last 7 days of observations
Warm (ready to load): Last 30 days in searchable index
Cold (archived): Everything older in S3/database
```

**Compaction Strategy:**
When context > 80% full, Manager summarizes findings into `daily_digest.json`:
```json
{
  "date": "2026-05-19",
  "key_findings": [...],
  "portfolio_state": {...},
  "pending_approvals": [...],
  "alerts": [...]
}
```

---

## 6. Tool Use Patterns

**Manager Tools:**
- `invoke_subagent(agent_name, handoff_payload)` — validated routing
- `read_shared_memory(path)` — access observations
- `flag_for_approval(decision, risk_level)` — escalation
- `synthesize_results(subagent_outputs)` — aggregation

**Researcher Tools:**
- `fetch_market_data(ticker, fields, time_range)` — Alpha Vantage, FRED
- `search_documents(query, sources)` — SEC filings, research reports
- `validate_data_freshness(source, last_update)` — confirm recency

**Analyst Tools:**
- `compute_statistics(data, metrics)` — correlation, regression, VaR
- `run_anomaly_detection(data, method)` — isolation forest, z-score
- `compare_vs_baseline(data, baseline)` — performance attribution

**Alert Monitor Tools:**
- `check_threshold(metric, value, limit)` — real-time breach detection
- `evaluate_rule(rule_id, data)` — rule engine
- `publish_alert(severity, message, recipients)` — escalation

**Builder Tools:**
- `execute_trade(ticker, quantity, price, order_type)` — order execution
- `validate_order(order)` — compliance check
- `confirm_settlement(order_id)` — post-trade confirmation

**Designer Tools:**
- `render_dashboard(config)` — HTML/React
- `export_summary(format)` — PDF, email, JSON
- `audit_output(compliance_rules)` — ensure compliance

---

## 7. Preventing Redundant/Conflicting Work

**Conflict Prevention:**
1. **Single Owner per Task:** Each subtask assigned to exactly one agent via Manager
2. **Dependency Mapping:** Manager tracks task DAG; no parallel conflicting execution
3. **Result Deduplication:** Check `/shared_memory/task_history.jsonl` before re-running
4. **Cache Key Schema:**
   ```
   {task_type}#{input_hash}#{timestamp}
   e.g., "fetch_data#sha256(S&P500,30d)#2026-05-19"
   ```
5. **Validation Rules:**
   - Researcher doesn't make decisions (output data only)
   - Analyst doesn't execute (output insights only)
   - Builder only executes when Analyst+Thinker both approve
   - Alert Monitor doesn't approve trades (escalates to Manager)

---

## 8. File Structure & Configuration

**Directory Layout:**
```
/your-project/
├── CLAUDE.md                          # Project instructions
├── agents/
│   ├── manager.md                     # Orchestrator system prompt + tools
│   ├── thinker.md                     # Strategic planning
│   ├── researcher.md                  # Data gathering
│   ├── analyst.md                     # Analysis
│   ├── alert_monitor.md               # Risk monitoring
│   ├── builder.md                     # Execution
│   └── designer.md                    # Presentation
├── shared_memory/
│   ├── schema.json                    # Memory object structure
│   ├── task_history.jsonl             # Append-only task log
│   ├── observations.json              # Indexed findings
│   └── context_window_tracker.json    # Token usage
├── tools/
│   ├── market_data.ts                 # Data API wrappers
│   ├── trade_execution.ts             # Order management
│   ├── risk_rules.ts                  # Alert thresholds
│   └── output_formatters.ts           # Dashboard generators
├── config/
│   ├── agent_registry.json            # Allowed handoff targets
│   ├── approval_thresholds.json       # Checkpoint triggers
│   └── tool_permissions.json          # Per-agent tool access
└── tests/
    ├── handoff_validation.ts          # Payload schema tests
    ├── conflict_detection.ts          # Redundancy checks
    └── memory_compaction.ts           # Archival tests
```

**Config File: agent_registry.json**
```json
{
  "agents": {
    "Manager": {
      "model": "claude-opus-4-20250514",
      "tools": ["invoke_subagent", "flag_for_approval"],
      "max_context_tokens": 200000
    },
    "Researcher": {
      "model": "claude-sonnet-4-20250514",
      "tools": ["fetch_market_data", "search_documents"],
      "max_context_tokens": 100000
    }
  },
  "allowed_handoffs": {
    "Manager": ["Thinker", "Researcher", "Analyst", "Alert Monitor", "Builder", "Designer"],
    "Researcher": ["Manager"],
    "Analyst": ["Manager"],
    "Thinker": ["Manager"]
  }
}
```

---

## Summary: Key Takeaways

1. **Orchestrator Pattern:** Manager as lead, 6 specialized subagents
2. **Structured Handoffs:** JSON schema validation prevents drift
3. **Memory Layers:** Shared journal + per-agent context window management
4. **Checkpoints:** Escalate decisions > risk threshold or low confidence
5. **Tool Scope:** Each agent has only tools it needs; no arbitrary capabilities
6. **Conflict Prevention:** Single owner per task, dependency DAG, cache deduplication
7. **File Structure:** Agents in separate .md files, shared memory in JSON, config-driven allowlists

**Next Steps:** Implement Manager orchestrator first, then wire up Researcher + Analyst before building the feedback loop with Thinker and approval gates.

