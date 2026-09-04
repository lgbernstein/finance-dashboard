# Plan A — Polish Deploy

## What was changed (Cowork)

All files already modified locally. CC just needs to commit and deploy.

### Files changed
- `public/app.js` — ageDot() helper, renderMarketSnapshot() update, renderInfluencerPulseMini(), cycle health in load(), bulletPanel() empty state
- `public/index.html` — influencer-pulse-mini-card in Overview Briefing, cycle-health div in sidebar
- `public/style.css` — .age-dot variants, .card-label.teal, .inf-mini-*, .panel-empty, .cycle-health, .inner-link-btn

## What each change does

**PB-A1 — Data-age dot on tickers**
Each market snapshot card (S&P, Dow, NASDAQ, Oil, VIX, 10-Yr) now shows a 6px colored dot in the top-right corner.
- Green = data < 1h old
- Amber = 1–4h old
- Red = >4h old (may be stale)
Hover the dot for exact age label.

**PB-A2 — Influencer Pulse in Briefing tab**
The Overview → Briefing tab now has a compact Influencer Pulse card below Key Levels.
Shows the pulse summary sentence + one pill per creator with their sentiment color.
"Full view →" button jumps to the detailed Influencer Pulse tab.

**PB-A3 — Cycle health in sidebar**
Below the Run Cycle button, two lines now show:
- Last cycle: green/red dot + OK/Failed + time ago
- Next cycle: computed to next 6:02 AM (today or tomorrow)

**PB-A4 — Empty state for blank panels**
Panels with no AI content now show "No analysis yet — run a cycle to populate." instead of going blank.

## PB-A5 fix (dots on all sections)
Also added ageDot() to renderMarkets() and renderIndicators().
- Market cards: same thresholds (fresh <1h, stale <4h, old beyond)
- Indicator cards: relaxed thresholds (fresh <24h, stale <72h, old beyond) — macro data is monthly so red doesn't mean broken

## CC deploy command

```
cd ~/Documents/Claude/Finance
git add public/app.js public/index.html public/style.css
git commit -m "Plan A: data-age dots everywhere, influencer mini-card, cycle health, empty states"
git push origin main
ssh -i ~/.ssh/hetzner_deploy root@5.78.219.36 "cd /var/www/finance-dashboard && git pull origin main && systemctl restart finance-dashboard && echo done"
```
