# Healthy Menu — explore, rate, plan

A local app for building a healthy home menu the slow, honest way: gather lots
of candidate recipes, cook and **rate** them over ~3 months, and let the
best-rated ones graduate into a 3-week rotating menu.

**Designed around:** gluten-free · sugar-free · dairy-free (where possible) ·
~30g protein per main · 4–5 people · **no salmon** (other fish occasionally).

## How to open it
- **Double-click `index.html`**, or
- `node server.mjs` → http://localhost:4500

## The four tabs

| Tab | What it does |
|-----|--------------|
| **Explore & rate** | Every candidate recipe as a card: watch its **Instagram reel**, see the **prep flag** (minimal / some / lots) with notes, and rate it on **Healthy / Tasty / Easy** (5 stars each). Tick "Tried it" and add notes. Filter by mains / sides / menu-ready / not-yet-rated. |
| **Menu** | The 3-week grid + a **Menu-ready pool** of recipes you've rated 4+ on average. Place them on days via `data/menu.js` for now. |
| **Prep** | The week's prep-ahead tasks, with heavy-prep recipes called out at the top. |
| **Shopping list** | Everything for the week, scaled to 5 people and grouped by aisle. Tick what you **already have** (salt, onion…); it moves to "Already have" and is remembered for future weeks. "Reset I have" clears it. |

Ratings, "tried it", notes, and your pantry all **save in the browser** automatically.

## What "menu-ready" means
A recipe turns menu-ready once all three axes are rated and the average is
≥ `menuReadyThreshold` (default **4**, set in `data/menu.js`). Change the number
to make the bar tougher or softer.

## The only file you edit to add recipes
`data/recipes.js` — copy the `TEMPLATE` block, fill it in (don't forget the
`video` reel and the `prepLevel` / `prepNotes`), give it a unique `id`.
It appears in Explore immediately.

## Notes
- Reels embed from Instagram, so watching them needs an internet connection.
- The 4 starter recipes were found on Instagram and **adapted** to the diet
  rules (see each recipe's `notes`). The reel is the original.
