# Beanie — Project Notes for Claude

## Architecture

| Layer | Tech | Host |
|-------|------|------|
| Marketing site | Static HTML/CSS | Netlify (`www.playbeanie.com`) |
| Game client | React PWA (Vite) | Built into `server/public/` |
| Game server | Node / Socket.io | Railway (`play.playbeanie.com`) |
| State | Upstash Redis (REST) | — |

## Client Source Structure

Key shared modules under `client/src/` — always import from these rather than re-defining locally:

- **`constants.js`** — `PLAYER_COLOURS`, `BEANIE_RANKS`, `RANK_ORDER`, `SUIT_ORDER`, `pSuit(name)`, `pSuitColor(name)`
- **`audio.js`** — all Web Audio synthesis: `playThwack`, `playShimmer`, `playTick`, `playDraw`, `playFanfare`, `playWhoosh`, `isMuted`. Single shared `_actx` AudioContext.
- **`gameHelpers.js`** — client-side game logic: `buildRunOptions`, `computeGapLabel`, `canStealBeanie`, `sortedRunCards`, `canAddCardsToSet`, `computeAddBeanieOptions`

These modules were centralised in a refactor; do not re-introduce inline duplicates in any screen component.

## Critical Rules — Never Break These

- **NO emoji anywhere** — SVG line icons only, project-wide
- **Never remove Ko-fi links** from `www/index.html` or `www/how-to-play.html` — guarded with `<!-- ⚠️ KO-FI LINK — DO NOT REMOVE -->`
- **`promo-animation.html`** lives at `beanie/promo-animation.html` — never deploy it into `www/`
- **`client/dist/assets/` is gitignored** — always deploy the game client by running `npm run build` in `client/`, then `cp -r dist/* ../server/public/`

## Deployment Commands

```bash
# Game client (Railway) — always rebuild first
cd client && npm run build
cp -r dist/* ../server/public/
cd ..
git add server/public/
git commit -m "..."
git push

# Marketing site (Netlify) — push www/ changes
git add www/
git commit -m "..."
git push
```

## Card Fan — DO NOT CHANGE (HomeScreen hero)

The card fan (K / Beanie★ / A) on the HomeScreen took multiple iterations to fix. The final working solution is in `client/src/index.css`. **Do not alter these rules without careful testing:**

```css
.card-fan {
  position: relative;
  width: 200px; height: 160px;
  /* NO overflow:hidden — it clips the rotated top corners of the side cards */
}

.side-card {
  position: absolute; bottom: 20px;
  overflow: hidden; /* needed so the ::after fade clips to border-radius */
  box-shadow: 0 2px 6px rgba(0,0,0,0.45); /* kept small — large shadows bleed below container */
}

/* THIS FADE IS THE FIX — do not remove */
.side-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 44px;
  background: linear-gradient(to bottom, transparent, #0D1F1A); /* must match --bg */
  pointer-events: none;
  z-index: 2;
}

.side-card-left  { left: 4px;  transform-origin: bottom center; transform: rotate(-16deg); }
.side-card-right { right: 4px; transform-origin: bottom center; transform: rotate(16deg); }
```

**Why it works:** `transform-origin: bottom center` causes the rotated cards' top corners to extend outside the container left/right (normal — no visible boundary there) and their bottom corners to drop slightly. A large box-shadow was the original source of visual overflow. The `::after` gradient fades the inverted rank/suit at each card's bottom into the dark background (`#0D1F1A`) so it disappears cleanly. If `--bg` ever changes colour, update the gradient stop to match.

**What NOT to do:**
- Don't add `overflow: hidden` to `.card-fan` — clips the rotated side card tops
- Don't increase `box-shadow` blur beyond ~8px total — shadow bleeds below container
- Don't remove `.side-card::after` — the inverted A/K will reappear at the bottom

## Favicon

`client/public/favicon.svg` (and copies in `www/` and `server/public/`) — gold rounded-square with a dark 5-pointed star. Matches the Beanie card ★ motif. Do not revert to the purple lightning bolt.

## Colour Skin — Midnight Ocean: Steel Blue (current)

Applied to `client/src/index.css` `:root` and both `www/` HTML files:
```css
--bg:     #080F1A;
--surf:   #0F1D2E;
--surf2:  #192C42;
--tbl-bg: #040A12;
--acc:    #5B8FD6;
--accl:   #89B3E8;
```
Also update the hardcoded `--bg` colour in `.side-card::after` gradient (line ~210 of index.css) if `--bg` changes again.
Skin mockup PNGs saved in `www/skin-options/` for future reference.

## Game Rules — Engine Notes

- **No win on first turn** — `firstTurnDone` flag in `server/src/game/engine.js`. The win check runs BEFORE `firstTurnDone` is set to `true`. Do not reorder these.
- First-turn restriction is documented in the in-game How to Play screen.
