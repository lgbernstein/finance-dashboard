# Finance Dashboard — AGENTS.md

## Project Overview
AI-powered economic dashboard with a multi-agent analysis harness. Displays live economic data with AI-generated commentary panels. Agents run on Mac Mini (n8n scheduled), data stored in SQLite on Hetzner, frontend served from Hetzner.

## Server
- Host: Hetzner VPS, Hillsboro OR
- IP: 5.78.219.36
- OS: Ubuntu 24.04
- App path: /var/www/finance-dashboard
- Deploy: `ssh root@5.78.219.36`
- Process manager: systemd (`systemctl restart finance-dashboard`)

## Tech Stack
- Runtime: Node.js + Express
- Database: SQLite (better-sqlite3)
- Frontend: Vanilla JS (no framework)
- AI: Anthropic Codex API (Codex-sonnet-4-6 for subagents, Codex-opus-4-7 for Manager/Thinker)
- Scheduling: n8n on Mac Mini (100.116.70.17:5678)

## Repository
- GitHub: lgbernstein/finance-dashboard
- Local: ~/Documents/Codex/Finance

## Agent Architecture
Seven agents with strict role boundaries. Manager orchestrates; subagents return structured JSON.

| Agent | Role | Model | Trigger |
|-------|------|-------|---------|
| Thinker | Strategic planner, app improvement | Opus | Weekly or on-demand |
| Manager | Orchestrator for each analysis cycle | Opus | Daily + breaking news |
| Researcher | Data fetching (FRED, RSS, market) | Sonnet | Called by Manager |
| Analyst | AI commentary + synthesis | Sonnet | Called by Manager |
| Alert Monitor | Breaking news + threshold watch | Sonnet | Every 3 hours |
| Builder | Implements approved code changes | Sonnet | Called by Thinker |
| Designer | Dashboard layout + commentary format | Sonnet | Called by Thinker |

## Data Sources
- FRED API (free, key required): macro indicators — GDP, CPI, unemployment, yields
- Reuters RSS: https://feeds.reuters.com/reuters/businessNews
- AP RSS: https://feeds.apnews.com/rss/apf-business
- Yahoo Finance (scrape-free via open APIs): market indices, Treasury yields
- Brave Search API (judicious): breaking economic news

## Key Rules
- Agents write results to shared_memory/ as JSON — never directly update the database
- Manager is the only agent that writes to the SQLite database
- Thinker flags major architectural decisions for Larry's approval before Builder acts
- Alert Monitor never auto-publishes — always escalates to Manager
- .env is never committed — contains API keys

## Security — Non-Negotiable
NEVER run any command that prints .env file contents or key values to output.
This includes: `cat .env`, `cat -A .env`, `echo $VAR` for any secret variable, printing error output that may contain interpolated secrets, or any debug command that could expose key values.

When inspecting .env: use `grep -o '^[A-Z_]*='` to show key names only — never values.
When debugging SSH or token issues: check connection status and exit codes only — never print the credential being used.
If a command might echo a secret into output, find a different approach or ask Larry to run it locally without pasting the result.

## Directory Structure
```
/
├── server.js              — Express app, API endpoints for frontend
├── db.js                  — SQLite schema and query helpers
├── public/                — Frontend (index.html, app.js, style.css)
├── agents/                — Agent definitions (prompt, soul, memory, skills, AGENTS.md)
├── tools/                 — Data fetching modules (FRED, RSS, Brave, market)
├── shared_memory/         — Inter-agent communication (JSON files)
├── config/                — Agent registry, thresholds, permissions
└── scripts/               — CLI runners (cycle, alerts, approve)
```

## Push Block Workflow
Same as other projects: Cowork drafts PBs, CC implements in order, commit after each, return Last 5 PBs table.

## Imported Claude Cowork project instructions
