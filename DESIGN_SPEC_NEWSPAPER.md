# Design Spec: Newspaper-Style Card Rendering

Version 1.0 — Finance Dashboard

---

## Problem Summary

Every card uses the same rendering path: all content becomes `<li>` items with `→` bullets, regardless of whether the content is a short data point or a 200-word prose paragraph. The result is visually flat — no hierarchy, no lede, no sense of editorial structure.

---

## 1. Rendering Logic — bulletPanel() Rewrite

The core fix is to stop treating bullets as the universal container and instead detect content type per item.

**Detection rule:** A bullet item is "prose" if it contains more than 80 characters OR contains a period followed by a space (indicating a sentence). Everything else is a "short bullet."

**Rendering behavior:**

- **First item in a prose card** → render as `.card-lede` (see Typography below). No bullet marker. This is the opening sentence / summary.
- **Subsequent prose items** → render as `.card-body-para` paragraph elements, not `<li>` elements.
- **Short items (≤80 chars, no sentence punctuation)** → keep as `<li>` in `.bullet-list` with the `→` marker. These are data points.
- **Mixed arrays:** If the first item is short but later items are long, treat each item independently — short items stay as `<li>`, long items become `<p class="card-body-para">`.

**Implementation sketch (pseudocode, not code):**

```
function isProse(text):
  stripped = text stripped of markdown
  return stripped.length > 80 OR stripped contains ". "

function renderItem(text, index, allItems):
  if isProse(text):
    if index === 0:
      return <p class="card-lede">{md(text)}</p>
    else:
      return <p class="card-body-para">{md(text)}</p>
  else:
    return <li>{md(text) stripped of <p> tags}</li>

function bulletPanel(panel, expandId):
  group items into runs of prose vs. short
  wrap consecutive short items in <ul class="bullet-list">
  emit prose items as bare <p> elements
  append expandBtn if panel.body exists
```

---

## 2. Typography

### Lede paragraph (.card-lede)
```css
.card-lede {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);          /* #cccccc */
  line-height: 1.55;
  margin: 0 0 14px 0;
  border-left: 3px solid var(--blue);   /* accent line, color varies by card */
  padding-left: 12px;
}
```
The border-left color should match the card's `.card-label` color class. Pass it through as a data attribute on the card wrapper (see Card Design section). Default to `var(--blue)`.

### Body paragraph (.card-body-para)
```css
.card-body-para {
  font-size: 14px;
  font-weight: 400;
  color: var(--text2);         /* #a0a0a0 — one step dimmer than lede */
  line-height: 1.65;
  margin: 0 0 10px 0;
}

.card-body-para:last-child {
  margin-bottom: 0;
}
```

### Bold text within paragraphs
The current rule `strong { color: var(--text); font-weight: 700; }` is correct but apply it globally to `.card-lede strong` and `.card-body-para strong` explicitly so it reads clearly against the dimmer body text:
```css
.card-body-para strong {
  color: var(--text);          /* bump back to full brightness */
  font-weight: 700;
}
```

### Short bullet items (.bullet-list li)
Keep existing styles. Only change: increase `font-size` from whatever it currently is to `14px` and `line-height` to `1.5`. The `→` marker stays.

---

## 3. Card Visual Design

### Card header area
Add a distinct header block inside each card. Currently `.card-label` floats as an inline badge with no enclosing structure. Change to a dedicated header row:

```css
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--surface2);  /* #3c3c3c — subtle separator */
}
```

Move `.card-label` inside `.card-header`. Remove the current `margin-bottom: 14px` from `.card-label` (the header padding handles spacing now).

In index.html, wrap each card's label in `<div class="card-header"><span class="card-label ...">LABEL</span></div>`.

### Card label prominence
The label badge currently uses `font-size: 10px`. Increase to `11px`. The colored border + background + uppercase is correct and should stay. No other changes needed — the header border-bottom will give it more visual weight through separation.

### Card differentiation — accent bar
Cards carrying prose analysis should visually differ from cards carrying data bullets. Add a top accent bar per card type:

```css
.card[data-accent="blue"]   { border-top: 2px solid var(--blue); }
.card[data-accent="green"]  { border-top: 2px solid var(--green); }
.card[data-accent="amber"]  { border-top: 2px solid var(--amber); }
.card[data-accent="red"]    { border-top: 2px solid var(--red); }
.card[data-accent="purple"] { border-top: 2px solid var(--purple); }
```

Override the existing `border-top: 1px solid var(--surface3)` on `.card`. Add `data-accent` to the card `<div>` in index.html matching the card-label color. Example: the Geopolitical Threads card gets `data-accent="purple"`, Sector Spotlight gets `data-accent="green"`, Risk Watch gets `data-accent="red"`.

The `.card-lede` border-left color should match the card's `data-accent`:
```css
.card[data-accent="blue"]   .card-lede { border-left-color: var(--blue); }
.card[data-accent="green"]  .card-lede { border-left-color: var(--green); }
.card[data-accent="amber"]  .card-lede { border-left-color: var(--amber); }
.card[data-accent="red"]    .card-lede { border-left-color: var(--red); }
.card[data-accent="purple"] .card-lede { border-left-color: var(--purple); }
```

### Card padding
Keep current `padding: 18px 22px`. No change needed.

---

## 4. Color Assignments by Card

| Card | data-accent | card-label class |
|------|-------------|------------------|
| Daily Summary | blue | blue |
| Macro Overview | green | green |
| Risk Watch | red | red |
| What to Watch | amber | amber |
| Market Pulse | blue | blue |
| Geopolitical Threads | purple | purple |
| Sector Spotlight | green | green |
| Larry's Lens | amber | amber |

---

## 5. Summary of Changes Required

**style.css:**
- Add `.card-header`, `.card-lede`, `.card-body-para`, `.card-body-para strong`
- Add `.card[data-accent="*"]` border-top overrides
- Add `.card[data-accent="*"] .card-lede` border-left-color rules
- Remove `margin-bottom` from `.card-label` (now handled by `.card-header`)
- Increase `.card-label` font-size from 10px to 11px
- Increase `.bullet-list li` font-size to 14px, line-height to 1.5

**app.js — bulletPanel():**
- Add `isProse(text)` detection function
- Render first prose item as `.card-lede`, subsequent as `.card-body-para`
- Group consecutive short items in `<ul class="bullet-list">`
- Short items remain `<li>` with existing `→` rendering

**index.html:**
- Wrap each `.card-label` in `<div class="card-header">...</div>`
- Add `data-accent="[color]"` attribute to each `.card` div
