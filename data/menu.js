/* ============================================================================
   THE 4-WEEK ROTATING MENU + GLOBAL SETTINGS
   ----------------------------------------------------------------------------
   This month: lunch + supper are a @ruhamasfood rotation (her mains, spread so
   nothing repeats more than a few times, fish kept occasional). Breakfasts are
   unchanged. You can still change any slot live in the app: open a recipe and
   "Add to weekly menu", tap the swap icon on a slot, or the x to clear.
   ========================================================================== */

window.MENU_SETTINGS = {
  cycleWeeks: 4,
  servingsTarget: 5,         // 4-5 people; shopping + portions scale to this
  proteinTargetPerMeal: 30,  // grams; MAINS under this get flagged (sides exempt)
  mealOrder: ["breakfast", "lunch", "dinner"],
  dietRules: ["gluten-free", "sugar-free", "dairy-free (where possible)"],
  menuReadyThreshold: 4,
};

function emptyWeek(weekNumber) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return {
    week: weekNumber,
    days: days.map((day) => ({ day, breakfast: null, lunch: null, dinner: null })),
  };
}

window.MENU = { weeks: [emptyWeek(1), emptyWeek(2), emptyWeek(3), emptyWeek(4)] };

function set(week, day, meal, recipeId) {
  const w = window.MENU.weeks[week - 1];
  const d = w && w.days.find((x) => x.day === day);
  if (d) d[meal] = recipeId;
}

/* ----------------------------------------------------------------------------
   BREAKFASTS (unchanged) - primarily eggs, with make-ahead / quick options
   -------------------------------------------------------------------------- */
set(1, "Monday",    "breakfast", "spinach-pepper-egg-muffins");
set(1, "Tuesday",   "breakfast", "egg-stuffed-pepper-boats");
set(1, "Wednesday", "breakfast", "chickpea-lentil-egg-skillet");
set(1, "Thursday",  "breakfast", "gf-protein-pancake-bowls");
set(1, "Friday",    "breakfast", "gf-fluffy-pancake-stack");
set(1, "Saturday",  "breakfast", "avocado-egg-salad-over-greens");
set(1, "Sunday",    "breakfast", "spinach-pepper-egg-muffins");

set(2, "Monday",    "breakfast", "egg-stuffed-pepper-boats");
set(2, "Tuesday",   "breakfast", "chickpea-lentil-egg-skillet");
set(2, "Wednesday", "breakfast", "gf-protein-pancake-bowls");
set(2, "Thursday",  "breakfast", "gf-fluffy-pancake-stack");
set(2, "Friday",    "breakfast", "avocado-egg-salad-over-greens");
set(2, "Saturday",  "breakfast", "spinach-pepper-egg-muffins");
set(2, "Sunday",    "breakfast", "egg-stuffed-pepper-boats");

set(3, "Monday",    "breakfast", "chickpea-lentil-egg-skillet");
set(3, "Tuesday",   "breakfast", "gf-protein-pancake-bowls");
set(3, "Wednesday", "breakfast", "gf-fluffy-pancake-stack");
set(3, "Thursday",  "breakfast", "avocado-egg-salad-over-greens");
set(3, "Friday",    "breakfast", "spinach-pepper-egg-muffins");
set(3, "Saturday",  "breakfast", "egg-stuffed-pepper-boats");
set(3, "Sunday",    "breakfast", "chickpea-lentil-egg-skillet");

set(4, "Monday",    "breakfast", "gf-protein-pancake-bowls");
set(4, "Tuesday",   "breakfast", "spinach-pepper-egg-muffins");
set(4, "Wednesday", "breakfast", "chickpea-lentil-egg-skillet");
set(4, "Thursday",  "breakfast", "egg-stuffed-pepper-boats");
set(4, "Friday",    "breakfast", "gf-fluffy-pancake-stack");
set(4, "Saturday",  "breakfast", "avocado-egg-salad-over-greens");
set(4, "Sunday",    "breakfast", "spinach-pepper-egg-muffins");

/* ----------------------------------------------------------------------------
   LUNCH + SUPPER - @ruhamasfood rotation for the month
   Ordered so look-alike dishes (the two shawarmas, two t'beets, two turmeric
   chickens, two meatball dishes) never land on neighbouring days. Fish is
   sprinkled in at spaced slots; salmon only twice in the month.
   -------------------------------------------------------------------------- */
const LD_ORDER = [
  "ruhama-chicken-shawarma",
  "ruhama-chicken-aruk-patties",
  "ruhama-one-pan-beef-rice-peas",
  "ruhama-iraqi-tbeet",
  "ruhama-summer-lime-chicken",
  "ruhama-turmeric-chicken-cauliflower-rice",
  "ruhama-chicken-carrots-leeks",
  "ruhama-comfort-meatballs",
  "ruhama-orange-sumac-chicken",
  "ruhama-cozy-kebab-potato",
  "ruhama-shawarma-tray-bake",
  "ruhama-beef-stew-chickpeas",
  "ruhama-turmeric-chicken-potatoes",
  "ruhama-chicken-meatballs-rice-noodles",
  "ruhama-beef-tbeet",
];
// fish at spaced slot-indices (0..55); salmon limited to twice
const LD_FISH = {
  5: "ruhama-baked-lemony-halibut",
  15: "ruhama-amba-glazed-fish-snow-peas",
  24: "ruhama-one-pan-salmon-veggies",
  33: "ruhama-baked-lemony-halibut",
  42: "ruhama-amba-glazed-fish-snow-peas",
  51: "ruhama-one-pan-salmon-veggies",
};
(function fillLunchAndDinner() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  let idx = 0;
  for (let w = 1; w <= 4; w++) {
    for (const day of days) {
      for (const meal of ["lunch", "dinner"]) {
        set(w, day, meal, LD_FISH[idx] || LD_ORDER[idx % LD_ORDER.length]);
        idx++;
      }
    }
  }
})();
