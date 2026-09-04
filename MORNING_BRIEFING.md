# Morning Briefing — 2026-05-27

## Status: Ready to finish

---

## What got done last night

### Influencer Feed Integration (PBs 1-5)
- `config/influencers.js` — Kenneth Suna, Jessica Inskip, Tyler Gardner, Alexis & Dean registered with YouTube RSS + podcast RSS
- `tools/influencerFeed.js` — fetches all feeds, normalizes, filters to 7 days
- Researcher agent updated to fetch influencer content each cycle
- Analyst agent updated to produce per-creator sentiment + shared themes
- "Influencer Pulse" tab added to Overview in the dashboard

### Manual Run Cycle Button (PBs 6-7)
- POST `/api/run-cycle` endpoint added to server.js
- GET `/api/cycle-status` for polling
- "Run Cycle" button in sidebar with spinner + auto-reload when done

### Deploy Script (PB-8)
- `scripts/deploy.sh` created — reads credentials from .env, pushes to GitHub, SSHs to Hetzner, restarts server
- Fixed: server uses systemd, not pm2

### Security
- All exposed keys rotated: SSH key, GitHub token, Brave API, FRED API
- Keys updated in Finance/.env, WellBase/dashboard/.env, and Hetzner server .env
- Server restarted with new keys
- Security guardrails added to Finance/CLAUDE.md and persistent memory
- CLAUDE.md corrected: systemd not pm2

---

## What CC needs to do first thing

### 1. Git commit and push (sandbox couldn't do it — lock file issue)
```
cd ~/Documents/Claude/Finance
rm -f .git/HEAD.lock .git/index.lock
git add CLAUDE.md scripts/deploy.sh public/app.js public/index.html server.js db.js agents/analyst/prompt.md agents/analyst/skills.md agents/researcher/prompt.md config/influencers.js tools/influencerFeed.js
git commit -m "Influencer feeds, run cycle button, deploy script, security fixes"
git push origin main
ssh root@5.78.219.36 "cd /var/www/finance-dashboard && git pull origin main && systemctl restart finance-dashboard"
```

### 2. Add security guardrails to all project CLAUDE.md files
The block to add to each file (after the last section):

```markdown
## Security — Non-Negotiable
NEVER run any command that prints .env file contents or key values to output.
This includes: `cat .env`, `cat -A .env`, `echo $VAR` for any secret variable, printing error output that may contain interpolated secrets, or any debug command that could expose key values.

When inspecting .env: use `grep -o '^[A-Z_]*='` to show key names only — never values.
When debugging SSH or token issues: check connection status and exit codes only — never print the credential being used.
If a command might echo a secret into output, find a different approach or ask Larry to run it locally without pasting the result.
```

Files to update:
- `/Users/larrybernstein/Documents/Claude/Tracker/CLAUDE.md`
- `/Users/larrybernstein/Documents/Claude/Prep/CLAUDE.md`
- `/Users/larrybernstein/Documents/Claude/Hub/CLAUDE.md`
- `/Users/larrybernstein/Documents/Claude/Listings/CLAUDE.md`
- `/Users/larrybernstein/Documents/Claude/Magyar_Master/CLAUDE.md`
- `/Users/larrybernstein/Documents/Claude/WellBase/CLAUDE.md`
- `/Users/larrybernstein/Documents/Claude/Archive/Lang/CLAUDE.md`
- `/Users/larrybernstein/Documents/Claude/CLAUDE.md`

### 3. Test deploy script
```
bash ~/Documents/Claude/Finance/scripts/deploy.sh
```
Should push to GitHub and restart Hetzner server cleanly.

### 4. Run a cycle
Trigger from the dashboard Run Cycle button or:
```
ssh -i ~/.ssh/hetzner_deploy root@5.78.219.36 "cd /var/www/finance-dashboard && node scripts/run_cycle.js"
```
Verify `shared_memory/influencer_sentiment.json` gets written.

---

## Still on the list (after above)
- Set up 1Password Shell Plugins for GitHub and SSH — permanent fix so keys never need to live in .env
- Then GITHUB_TOKEN and HETZNER_SSH_KEY can be removed from .env entirely
