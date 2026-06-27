/* ============================================================================
   THE 3-WEEK ROTATING MENU + GLOBAL SETTINGS
   ----------------------------------------------------------------------------
   Every day's breakfast / lunch / dinner is filled below. You can change any
   slot here, or do it live in the app: "+ Add to menu" on a recipe drops it
   into the next open slot, and the × on a slot removes it.
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
   WEEK 1
   -------------------------------------------------------------------------- */
set(1, "Monday",    "breakfast", "spinach-pepper-egg-muffins");
set(1, "Monday",    "lunch",     "crispy-chicken-no-egg-no-flour");
set(1, "Monday",    "dinner",    "high-protein-chicken-egg-bowl-salad");

set(1, "Tuesday",   "breakfast", "egg-stuffed-pepper-boats");
set(1, "Tuesday",   "lunch",     "airfryer-pesto-stuffed-chicken");
set(1, "Tuesday",   "dinner",    "garlic-herb-chicken-green-beans");

set(1, "Wednesday", "breakfast", "chickpea-lentil-egg-skillet");
set(1, "Wednesday", "lunch",     "panfried-chicken-tomato-cucumber-plate");
set(1, "Wednesday", "dinner",    "chicken-taco-bowl");

set(1, "Thursday",  "breakfast", "gf-protein-pancake-bowls");
set(1, "Thursday",  "lunch",     "warm-chicken-mash-greens");
set(1, "Thursday",  "dinner",    "creamy-chicken-broccoli-skillet");

set(1, "Friday",    "breakfast", "gf-fluffy-pancake-stack");
set(1, "Friday",    "lunch",     "one-pan-lemon-garlic-cod");
set(1, "Friday",    "dinner",    "coconut-chicken-curry");

set(1, "Saturday",  "breakfast", "avocado-egg-salad-over-greens");
set(1, "Saturday",  "lunch",     "high-protein-chicken-egg-bowl-salad");
set(1, "Saturday",  "dinner",    "crispy-chicken-no-egg-no-flour");

set(1, "Sunday",    "breakfast", "spinach-pepper-egg-muffins");
set(1, "Sunday",    "lunch",     "garlic-herb-chicken-green-beans");
set(1, "Sunday",    "dinner",    "airfryer-pesto-stuffed-chicken");

/* ----------------------------------------------------------------------------
   WEEK 2
   -------------------------------------------------------------------------- */
set(2, "Monday",    "breakfast", "egg-stuffed-pepper-boats");
set(2, "Monday",    "lunch",     "chicken-taco-bowl");
set(2, "Monday",    "dinner",    "panfried-chicken-tomato-cucumber-plate");

set(2, "Tuesday",   "breakfast", "chickpea-lentil-egg-skillet");
set(2, "Tuesday",   "lunch",     "creamy-chicken-broccoli-skillet");
set(2, "Tuesday",   "dinner",    "warm-chicken-mash-greens");

set(2, "Wednesday", "breakfast", "gf-protein-pancake-bowls");
set(2, "Wednesday", "lunch",     "coconut-chicken-curry");
set(2, "Wednesday", "dinner",    "one-pan-lemon-garlic-cod");

set(2, "Thursday",  "breakfast", "gf-fluffy-pancake-stack");
set(2, "Thursday",  "lunch",     "crispy-chicken-no-egg-no-flour");
set(2, "Thursday",  "dinner",    "high-protein-chicken-egg-bowl-salad");

set(2, "Friday",    "breakfast", "avocado-egg-salad-over-greens");
set(2, "Friday",    "lunch",     "airfryer-pesto-stuffed-chicken");
set(2, "Friday",    "dinner",    "garlic-herb-chicken-green-beans");

set(2, "Saturday",  "breakfast", "spinach-pepper-egg-muffins");
set(2, "Saturday",  "lunch",     "panfried-chicken-tomato-cucumber-plate");
set(2, "Saturday",  "dinner",    "high-protein-chicken-egg-bowl-salad");

set(2, "Sunday",    "breakfast", "egg-stuffed-pepper-boats");
set(2, "Sunday",    "lunch",     "warm-chicken-mash-greens");
set(2, "Sunday",    "dinner",    "creamy-chicken-broccoli-skillet");

/* ----------------------------------------------------------------------------
   WEEK 3
   -------------------------------------------------------------------------- */
set(3, "Monday",    "breakfast", "chickpea-lentil-egg-skillet");
set(3, "Monday",    "lunch",     "one-pan-lemon-garlic-cod");
set(3, "Monday",    "dinner",    "coconut-chicken-curry");

set(3, "Tuesday",   "breakfast", "gf-protein-pancake-bowls");
set(3, "Tuesday",   "lunch",     "high-protein-chicken-egg-bowl-salad");
set(3, "Tuesday",   "dinner",    "crispy-chicken-no-egg-no-flour");

set(3, "Wednesday", "breakfast", "gf-fluffy-pancake-stack");
set(3, "Wednesday", "lunch",     "garlic-herb-chicken-green-beans");
set(3, "Wednesday", "dinner",    "airfryer-pesto-stuffed-chicken");

set(3, "Thursday",  "breakfast", "avocado-egg-salad-over-greens");
set(3, "Thursday",  "lunch",     "chicken-taco-bowl");
set(3, "Thursday",  "dinner",    "panfried-chicken-tomato-cucumber-plate");

set(3, "Friday",    "breakfast", "spinach-pepper-egg-muffins");
set(3, "Friday",    "lunch",     "creamy-chicken-broccoli-skillet");
set(3, "Friday",    "dinner",    "warm-chicken-mash-greens");

set(3, "Saturday",  "breakfast", "egg-stuffed-pepper-boats");
set(3, "Saturday",  "lunch",     "coconut-chicken-curry");
set(3, "Saturday",  "dinner",    "one-pan-lemon-garlic-cod");

set(3, "Sunday",    "breakfast", "chickpea-lentil-egg-skillet");
set(3, "Sunday",    "lunch",     "crispy-chicken-no-egg-no-flour");
set(3, "Sunday",    "dinner",    "high-protein-chicken-egg-bowl-salad");

/* ----------------------------------------------------------------------------
   WEEK 4  (features the newest recipes: tuna wraps, airy meatballs, asado)
   -------------------------------------------------------------------------- */
set(4, "Monday",    "breakfast", "gf-protein-pancake-bowls");
set(4, "Monday",    "lunch",     "tuna-lettuce-wraps");
set(4, "Monday",    "dinner",    "airy-chicken-meatballs");

set(4, "Tuesday",   "breakfast", "spinach-pepper-egg-muffins");
set(4, "Tuesday",   "lunch",     "chicken-taco-bowl");
set(4, "Tuesday",   "dinner",    "coconut-chicken-curry");

set(4, "Wednesday", "breakfast", "chickpea-lentil-egg-skillet");
set(4, "Wednesday", "lunch",     "creamy-chicken-broccoli-skillet");
set(4, "Wednesday", "dinner",    "one-pan-lemon-garlic-cod");

set(4, "Thursday",  "breakfast", "egg-stuffed-pepper-boats");
set(4, "Thursday",  "lunch",     "high-protein-chicken-egg-bowl-salad");
set(4, "Thursday",  "dinner",    "panfried-chicken-tomato-cucumber-plate");

set(4, "Friday",    "breakfast", "gf-fluffy-pancake-stack");
set(4, "Friday",    "lunch",     "garlic-herb-chicken-green-beans");
set(4, "Friday",    "dinner",    "crispy-chicken-no-egg-no-flour");

set(4, "Saturday",  "breakfast", "avocado-egg-salad-over-greens");
set(4, "Saturday",  "lunch",     "tuna-lettuce-wraps");
set(4, "Saturday",  "dinner",    "oven-asado-slow-roast");

set(4, "Sunday",    "breakfast", "spinach-pepper-egg-muffins");
set(4, "Sunday",    "lunch",     "airy-chicken-meatballs");
set(4, "Sunday",    "dinner",    "warm-chicken-mash-greens");
