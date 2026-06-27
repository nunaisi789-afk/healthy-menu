/* ============================================================================
   APP LOGIC
   - Explore: rate every recipe on Healthy / Tasty / Easy, watch its reel,
     see prep level. Ratings + notes + "tried" save in this browser.
   - Menu: 3-week grid + a pool of recipes that have passed the mark.
   - Prep / Shopping: per week. Shopping has an "I have" pass that remembers
     your pantry staples and trims them from the buy-list.
   You edit data/recipes.js and data/menu.js; you don't edit this file.
   ========================================================================== */

(function () {
  const S = window.MENU_SETTINGS;
  const BUILTIN = window.RECIPES || [];
  let RECIPES = BUILTIN.slice();
  let recipeById = {};
  function rebuildRecipes() {
    RECIPES = BUILTIN.concat(userRecipes).filter((r) => !deleted.has(r.id));
    recipeById = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
  }

  // ---- persistence (localStorage) -----------------------------------------
  const LS = {
    ratings: "hm_ratings_v1",
    pantry: "hm_pantry_v1",
    placements: "hm_placements_v4",
    got: "hm_got_v1",
    userrecipes: "hm_userrecipes_v1",
    deleted: "hm_deleted_v1",
  };
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  let ratings = load(LS.ratings, {});         // { id: {healthy,tasty,easy,notes} }
  let pantry = new Set(load(LS.pantry, []));  // lowercased item names the user has
  let userRecipes = load(LS.userrecipes, []); // recipes she added in-app from a link
  let deleted = new Set(load(LS.deleted, [])); // ids hidden from the app (built-ins she deleted)
  rebuildRecipes();

  // ---- add a recipe from a pasted link (Instagram / TikTok / YouTube) ------
  function parseVideoUrl(u) {
    u = (u || "").trim();
    if (!u) return null;
    let m;
    if ((m = u.match(/instagram\.com\/(?:reel|p|tv)\/([\w-]+)/i))) return { source: "instagram", shortcode: m[1], url: "https://www.instagram.com/reel/" + m[1] + "/" };
    if ((m = u.match(/(?:youtube\.com\/shorts\/|youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i))) return { source: "youtube", shortcode: m[1], url: u };
    if ((m = u.match(/tiktok\.com\/.+\/video\/(\d+)/i))) return { source: "tiktok", shortcode: m[1], url: u };
    if ((m = u.match(/(?:vm|vt)\.tiktok\.com\/([\w-]+)/i))) return { source: "tiktok", shortcode: m[1], url: u };
    if (/^https?:\/\//i.test(u)) return { source: "link", shortcode: "", url: u };
    return null;
  }
  function slugify(s) { return (s || "recipe").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }
  function addUserRecipe(name, url, type) {
    const v = parseVideoUrl(url);
    if (!v) { window.alert("Please paste a valid Instagram, TikTok or YouTube link."); return false; }
    const nm = (name || "").trim() || "New recipe";
    const t = type || "main";
    const r = {
      id: slugify(nm) + "-" + (v.shortcode || "link") + "-u" + Object.keys(recipeById).length,
      name: nm, type: t,
      meal: (t === "main" || t === "side") ? ["lunch", "dinner"] : (t === "main") ? ["breakfast"] : [],
      servings: S.servingsTarget, prepMin: 0, cookMin: 0, proteinPerServing: 0,
      prepLevel: "minimal", prepNotes: "", video: v, tags: ["from-my-saves"], contains: [],
      ingredients: [], steps: [], notes: "Added by you from a link. Ingredients and steps still to fill in.", custom: true,
    };
    userRecipes.push(r); save(LS.userrecipes, userRecipes); rebuildRecipes(); renderAll();
    return true;
  }
  function deleteUserRecipe(id) {
    userRecipes = userRecipes.filter((r) => r.id !== id);
    save(LS.userrecipes, userRecipes); rebuildRecipes(); renderAll();
  }
  // Delete ANY recipe. Your own uploads are removed outright; built-in recipes
  // are hidden (kept in the deleted list) so they can be restored later.
  function deleteRecipe(id) {
    const r = recipeById[id];
    if (r && r.custom) { deleteUserRecipe(id); return; }
    deleted.add(id);
    save(LS.deleted, [...deleted]);
    // also pull it out of any menu slots so the schedule stays valid
    Object.keys(placements).forEach((k) => { if (placements[k] === id) delete placements[k]; });
    savePlacements();
    rebuildRecipes(); renderAll();
  }
  function restoreDeleted() {
    deleted.clear(); save(LS.deleted, []); rebuildRecipes(); renderAll();
  }

  // ---- menu placements: { "week|day|meal": recipeId } ----------------------
  // Seeded once from the data-file MENU, then edited in-app ("Add to menu").
  function seedPlacements() {
    const m = {};
    window.MENU.weeks.forEach((w) => w.days.forEach((d) => S.mealOrder.forEach((meal) => {
      if (d[meal]) m[w.week + "|" + d.day + "|" + meal] = d[meal];
    })));
    return m;
  }
  let placements = load(LS.placements, null) || seedPlacements();
  function savePlacements() { save(LS.placements, placements); }
  function placementCount(id) { return Object.values(placements).filter((x) => x === id).length; }
  // place a recipe into the first empty slot that matches one of its meals
  function addToMenu(id) {
    const r = recipeById[id];
    if (!r) return false;
    for (let w = 1; w <= S.cycleWeeks; w++) {
      for (const d of getWeek(w).days) {
        for (const meal of S.mealOrder) {
          if (!r.meal.includes(meal)) continue;
          const key = w + "|" + d.day + "|" + meal;
          if (!placements[key]) { placements[key] = id; savePlacements(); return true; }
        }
      }
    }
    return false; // every matching slot is full
  }
  function removePlacement(key) { delete placements[key]; savePlacements(); }

  // ---- shopping ticks: { "week::item::unit": true } (tick as you shop) ----
  let got = load(LS.got, {});
  function saveGot() { save(LS.got, got); }
  function gotKey(week, item) { return week + "::" + item.toLowerCase(); }
  function resetGot(week) {
    Object.keys(got).forEach((k) => { if (k.indexOf(week + "::") === 0) delete got[k]; });
    saveGot();
  }

  function getRating(id) {
    return ratings[id] || { healthy: 0, tasty: 0, easy: 0, tried: false, notes: "" };
  }
  function setRating(id, patch) {
    ratings[id] = Object.assign(getRating(id), patch);
    save(LS.ratings, ratings);
  }
  // average across the three axes that have been rated; null if none rated
  function avgScore(id) {
    const r = getRating(id);
    const vals = [r.healthy, r.tasty, r.easy].filter((v) => v > 0);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  // Your rule: a recipe graduates to the menu when it's 5★ Healthy, 5★ Easy,
  // and at least 4★ Tasty. A perfect 5/5/5 is a "Winner".
  function isMenuReady(id) {
    const r = getRating(id);
    return r.healthy === 5 && r.easy === 5 && r.tasty >= 4;
  }
  function isWinner(id) {
    const r = getRating(id);
    return r.healthy === 5 && r.easy === 5 && r.tasty === 5;
  }

  // ---- breakfast morning plan ----------------------------------------------
  // Mornings are tight: every breakfast should be either fast to make fresh,
  // or prepped the night before. A few are weekend-only (too slow on a weekday).
  const MORNING_OVERRIDE = { "ruhama-shakshuka": "weekend", "rice-paper-veggie-tart": "weekend" };
  const MORNING_BADGE = { quick: "⚡ Quick morning", nightbefore: "🌙 Prep the night before", weekend: "🍳 Weekend cook" };
  function morningPlan(r) {
    if (!r || !(r.meal || []).includes("breakfast")) return null;
    if (MORNING_OVERRIDE[r.id]) return MORNING_OVERRIDE[r.id];
    const total = (r.prepMin || 0) + (r.cookMin || 0);
    if (total <= 12 && r.prepLevel === "minimal") return "quick";
    if ((r.prepAhead || []).length) return "nightbefore";
    return "weekend";
  }

  // ---- small helpers -------------------------------------------------------
  function scaleQty(qty, recipeServings) {
    return qty * (S.servingsTarget / (recipeServings || S.servingsTarget));
  }
  function fmt(n) {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  function totalTime(r) { return (r.prepMin || 0) + (r.cookMin || 0); }
  function isSaladRecipe(r) { return (r.tags || []).indexOf("salad") > -1 || /salad/i.test(r.name) || /salad/i.test(r.id); }
  function saladList() { return RECIPES.filter(isSaladRecipe).sort((a, b) => a.name.localeCompare(b.name)); }
  function getWeek(n) { return window.MENU.weeks.find((w) => w.week === n); }
  function recipesInWeek(n) {
    const week = getWeek(n), out = [];
    week.days.forEach((d) => S.mealOrder.forEach((meal) => {
      const id = placements[n + "|" + d.day + "|" + meal];
      if (id && recipeById[id]) out.push({ day: d.day, meal, recipe: recipeById[id] });
    }));
    return out;
  }

  // ---- state ---------------------------------------------------------------
  let activeView = "menu";
  let activeWeek = 1;
  let exploreFilter = "all"; // all | mains | sides | menu-ready | unrated
  let cookQuery = "";        // "what can I make" ingredient box
  let cookSearched = false;
  let searchQuery = "";      // free-text recipe search
  let searchFilter = "all";  // all | quick | nocook | main | side | dessert | smoothie | addition

  // ---- ingredient matching ("what can I make") ----------------------------
  const STAPLE_WORDS = ["salt", "black pepper", "olive oil", "neutral oil", "coconut oil", "water", "vinegar", "baking powder",
    "vanilla", "stock", "cinnamon", "paprika", "cumin", "turmeric", "coriander", "cardamom",
    "chili powder", "garlic powder", "onion powder", "seasoning", "oregano", "thyme",
    "parsley", "dill", "cilantro", "peppercorn", "clove", "sesame seed"];
  function wordsOf(s) {
    return (s || "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
  }
  function isStapleIng(ing) {
    if (ing.category === "herbs-spices") return true;
    const n = (ing.item || "").toLowerCase();
    return STAPLE_WORDS.some((s) => n.indexOf(s) > -1);
  }

  // =========================================================================
  // EXPLORE
  // =========================================================================
  const PREP_LABEL = { minimal: "Minimal prep", some: "Some prep", lots: "Lots of prep" };

  function prepBadge(r) {
    const lvl = r.prepLevel || "minimal";
    return `<span class="badge prep-${lvl}">${PREP_LABEL[lvl]}</span>`;
  }

  function starRow(id, axis, label) {
    const val = getRating(id)[axis] || 0;
    let stars = "";
    for (let i = 1; i <= 5; i++) {
      stars += `<span class="star ${i <= val ? "on" : ""}" data-id="${id}" data-axis="${axis}" data-val="${i}">★</span>`;
    }
    return `<div class="rate-axis"><span class="rate-label">${label}</span><div class="stars">${stars}</div></div>`;
  }

  function recipeCard(r) {
    const rt = getRating(r.id);
    const isCustom = !!r.custom;
    const isSide = r.type === "side";
    const isDessert = r.type === "dessert";
    const isAddition = r.type === "addition";
    const isSmoothie = r.type === "smoothie";
    const isExtra = isDessert || isAddition || isSmoothie;
    const low = !isSide && !isExtra && !isCustom && r.proteinPerServing < S.proteinTargetPerMeal;
    const proteinBadge = isCustom
      ? `<span class="badge custom">★ your upload</span>`
      : isDessert
      ? `<span class="badge dessert">${r.dessertCategory || "dessert"}</span>`
      : isAddition
      ? `<span class="badge addition">${r.additionCategory || "addition"}</span>`
      : isSmoothie
      ? `<span class="badge smoothie">${r.smoothieCategory || "smoothie"}</span>`
      : isSide
      ? `<span class="badge side">side · ${r.proteinPerServing}g</span>`
      : `<span class="badge protein ${low ? "low" : ""}">${r.proteinPerServing}g protein</span>`;
    const warn = (r.contains || []).length
      ? `<span class="badge warn">⚠ contains ${r.contains.join(", ")}</span>` : "";
    const mp = morningPlan(r);
    const morningBadge = mp ? `<span class="badge morning morning-${mp}">${MORNING_BADGE[mp]}</span>` : "";
    const ready = (!isExtra && isMenuReady(r.id))
      ? (isWinner(r.id) ? `<span class="badge menu-ready">🏆 Winner</span>` : `<span class="badge menu-ready">★ Menu-ready</span>`)
      : "";
    const avg = avgScore(r.id);
    const scorePill = avg != null ? `<span class="score-pill">avg ${avg.toFixed(1)}/5</span>` : `<span class="muted">not rated yet</span>`;
    const inMenu = placementCount(r.id);

    return `
    <div class="recipe-card" data-card="${r.id}">
      <div class="rc-top">
        <div>
          <h3 class="rc-title" data-open="${r.id}">${r.name}</h3>
          <div class="rc-meta">
            <span>${totalTime(r)} min</span>
            ${isExtra ? "" : `<span>serves ${S.servingsTarget}</span>`}
            ${r.video && r.video.creator ? `<span>${r.video.creator}</span>` : ""}
          </div>
          <div class="rc-badges">${proteinBadge}${prepBadge(r)}${morningBadge}${ready}${warn}</div>
        </div>
      </div>

      ${r.prepNotes ? `<p class="prep-note"><strong>Prep:</strong> ${r.prepNotes}</p>` : ""}

      <div class="rc-video">
        ${r.video && r.video.url
          ? `<a class="watch-btn" href="${r.video.url}" target="_blank" rel="noopener">▶ Watch the ${r.video.source === "youtube" ? "short" : r.video.source === "instagram" ? "reel" : "video"} ↗</a>`
          : `<span class="muted">No video yet for this recipe.</span>`}
      </div>

      <div class="rc-rate">
        ${starRow(r.id, "healthy", "Healthy")}
        ${starRow(r.id, "tasty", "Tasty")}
        ${starRow(r.id, "easy", "Easy")}
        <div class="rc-extra">
          <div class="rc-actions">
            ${scorePill}
            ${isExtra ? "" : `<button class="menu-add-btn${inMenu ? " in-menu" : ""}" data-addmenu="${r.id}">${inMenu ? `✓ In menu · ${inMenu}× &nbsp;·&nbsp; add another` : "+ Add to menu"}</button>`}
            <button class="delete-btn" data-del="${r.id}" title="Delete this recipe">🗑 Delete</button>
          </div>
          <textarea class="rc-notes" data-notes="${r.id}" placeholder="Notes (what you'd tweak, who liked it...)">${rt.notes || ""}</textarea>
        </div>
      </div>
    </div>`;
  }

  function passesFilter(r) {
    if (exploreFilter === "mains") return r.type !== "side";
    if (exploreFilter === "sides") return r.type === "side";
    if (exploreFilter === "menu-ready") return isMenuReady(r.id);
    if (exploreFilter === "unrated") return avgScore(r.id) == null;
    return true;
  }

  function renderExplore() {
    // filters
    const filters = [
      ["all", "All"], ["mains", "Mains"], ["sides", "Sides"],
      ["menu-ready", "★ Menu-ready"], ["unrated", "Not yet rated"],
    ];
    document.getElementById("exploreFilters").innerHTML = filters.map(([k, label]) =>
      `<button class="filter-btn ${exploreFilter === k ? "active" : ""}" data-filter="${k}">${label}</button>`
    ).join("");

    // stats (savory meals only; desserts and additions live in their own tabs)
    const savory = RECIPES.filter((r) => r.type !== "dessert" && r.type !== "addition" && r.type !== "smoothie");
    const readyCount = savory.filter((r) => isMenuReady(r.id)).length;
    const ratedCount = savory.filter((r) => avgScore(r.id) != null).length;
    document.getElementById("exploreStats").innerHTML =
      `${savory.length} recipes · ${ratedCount} rated · ${readyCount} menu-ready`
      + (deleted.size ? ` &nbsp;·&nbsp; <button id="restoreDeleted" class="linkish">↩ Restore ${deleted.size} deleted</button>` : "");

    // list (sorted: menu-ready first, then by avg score desc, then name)
    const list = savory.filter(passesFilter).sort((a, b) => {
      const ra = isMenuReady(a.id) ? 1 : 0, rb = isMenuReady(b.id) ? 1 : 0;
      if (ra !== rb) return rb - ra;
      const sa = avgScore(a.id) || 0, sb = avgScore(b.id) || 0;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name);
    });
    const root = document.getElementById("recipeList");
    root.innerHTML = list.length ? list.map(recipeCard).join("")
      : `<div class="panel"><p class="muted">No recipes match this filter.</p></div>`;
  }

  // =========================================================================
  // DESSERTS  (their own tab, grouped by category — not part of the menu)
  // =========================================================================
  const DESSERT_CATEGORIES = ["Chocolate", "Fruity", "Frozen", "No-bake bites", "Baked", "Other"];
  function renderDesserts() {
    const desserts = RECIPES.filter((r) => r.type === "dessert");
    const root = document.getElementById("dessertsBody");
    if (!desserts.length) {
      root.innerHTML = `<div class="panel"><h3>Desserts</h3>
        <p class="muted">Nothing here yet. Send me a dessert reel and I'll slot it into the right shelf below.</p>
        <div>${DESSERT_CATEGORIES.map((c) => `<span class="pool-item">${c}</span>`).join("")}</div></div>`;
      return;
    }
    const byCat = {};
    desserts.forEach((r) => { const c = r.dessertCategory || "Other"; (byCat[c] = byCat[c] || []).push(r); });
    let html = `<p class="muted" style="margin:0 0 14px">${desserts.length} dessert${desserts.length > 1 ? "s" : ""} · all gluten / dairy / sugar-free</p>`;
    DESSERT_CATEGORIES.forEach((cat) => {
      const g = byCat[cat];
      if (!g || !g.length) return;
      g.sort((a, b) => (avgScore(b.id) || 0) - (avgScore(a.id) || 0) || a.name.localeCompare(b.name));
      html += `<h3 class="dessert-cat">${cat}</h3>` + g.map(recipeCard).join("");
    });
    document.getElementById("dessertsBody").innerHTML = html;
  }

  // =========================================================================
  // WHAT CAN I MAKE?  (match the ingredients you have against every recipe)
  // =========================================================================
  const TYPE_LABEL = { main: "main", side: "side" };
  function typeChipLabel(r) {
    if (r.type === "dessert") return r.dessertCategory || "dessert";
    if (r.type === "addition") return r.additionCategory || "addition";
    if (r.type === "smoothie") return r.smoothieCategory || "smoothie";
    return TYPE_LABEL[r.type] || r.type;
  }

  function renderCook() {
    const root = document.getElementById("cookBody");
    if (!root) return;
    const chips = [["all", "All"], ["quick", "⚡ Quick ≤25 min"], ["nocook", "No-cook"],
      ["main", "Mains"], ["side", "Sides"], ["dessert", "Desserts"], ["smoothie", "Smoothies"], ["addition", "Additions"]];

    const searchPanel = `<div class="panel">
      <h3>Find a recipe</h3>
      <p class="muted">Your whole recipe book, searchable. Type an ingredient, name or tag (try "cabbage", "cauliflower", "tuna") or filter for quick wins. Sorted fastest first.</p>
      <input id="searchInput" class="cook-input" style="min-height:auto;height:42px" data-searchq placeholder="Search ingredient, recipe or tag…" value="${searchQuery.replace(/"/g, "&quot;")}" />
      <div class="filters" style="margin-top:10px">${chips.map((c) => `<button class="filter-btn ${searchFilter === c[0] ? "active" : ""}" data-sfilter="${c[0]}">${c[1]}</button>`).join("")}</div>
      <div id="searchResults" style="margin-top:14px"></div>
    </div>`;

    const matcherPanel = `<div class="panel">
      <h3>Or: what can I make with what I have?</h3>
      <p class="muted">List the ingredients you have and I'll match all ${RECIPES.length} recipes. Salt, oil and spices are assumed; your shopping "have" items count too.</p>
      <textarea id="cookInput" class="cook-input" data-cookq placeholder="e.g. chicken, eggs, spinach, avocado, lemon, broccoli">${cookQuery.replace(/</g, "&lt;")}</textarea>
      <div style="margin-top:10px">
        <button class="menu-add-btn" data-cook-find>Find recipes</button>
        ${cookSearched ? `<button class="linkish" data-cook-clear style="margin-left:12px">clear</button>` : ""}
      </div>
      <div id="matcherResults" style="margin-top:14px"></div>
    </div>`;

    root.innerHTML = searchPanel + matcherPanel;
    renderSearchResults();
    renderMatcherResults();
  }

  function renderSearchResults() {
    const box = document.getElementById("searchResults");
    if (!box) return;
    const q = searchQuery.toLowerCase().trim();
    const list = RECIPES.filter((r) => {
      if (q) {
        const hay = (r.name + " " + (r.tags || []).join(" ") + " " +
          (r.ingredients || []).map((i) => i.item).join(" ") + " " +
          (r.dessertCategory || "") + " " + (r.additionCategory || "") + " " + (r.smoothieCategory || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (searchFilter === "quick" && totalTime(r) > 25) return false;
      if (searchFilter === "nocook" && !((r.cookMin || 0) === 0 || (r.tags || []).indexOf("no-cook") > -1)) return false;
      if (["main", "side", "dessert", "smoothie", "addition"].indexOf(searchFilter) > -1 && r.type !== searchFilter) return false;
      return true;
    }).sort((a, b) => totalTime(a) - totalTime(b) || a.name.localeCompare(b.name));

    if (!list.length) { box.innerHTML = `<p class="muted">No recipes match. Try a different word or filter.</p>`; return; }
    box.innerHTML = `<p class="muted" style="margin:0 0 8px">${list.length} recipe${list.length > 1 ? "s" : ""}</p>` +
      list.map((r) => `<div class="cook-row"><span class="pool-item" data-open="${r.id}">${r.name}</span><span class="muted"> · ${typeChipLabel(r)} · ${totalTime(r)} min</span></div>`).join("");
  }

  function renderMatcherResults() {
    const box = document.getElementById("matcherResults");
    if (!box) return;
    if (!cookSearched) { box.innerHTML = ""; return; }
    const avail = new Set();
    cookQuery.toLowerCase().split(/[,\n;]/).forEach((part) => wordsOf(part).forEach((w) => avail.add(w)));
    [...pantry].forEach((p) => wordsOf(p).forEach((w) => avail.add(w)));
    function ingHave(ing) {
      if (isStapleIng(ing)) return true;
      const iw = wordsOf(ing.item);
      return iw.some((w1) => { for (const w2 of avail) { if (w1 === w2 || w1.indexOf(w2) === 0 || w2.indexOf(w1) === 0) return true; } return false; });
    }
    const ranked = RECIPES.map((r) => {
      const sig = (r.ingredients || []).filter((i) => !isStapleIng(i));
      const missing = sig.filter((i) => !ingHave(i)).map((i) => i.item);
      return { r, total: sig.length, missing };
    }).filter((x) => x.total > 0).sort((a, b) => a.missing.length - b.missing.length || a.r.name.localeCompare(b.r.name));
    const makeNow = ranked.filter((x) => x.missing.length === 0);
    const nearly = ranked.filter((x) => x.missing.length >= 1 && x.missing.length <= 3).slice(0, 15);
    function chip(x) {
      return `<div class="cook-row"><span class="pool-item" data-open="${x.r.id}">${x.r.name}</span>` +
        (x.missing.length ? `<span class="muted"> · need: ${x.missing.join(", ")}</span>` : `<span class="cook-ok"> · you have it all ✓</span>`) + `</div>`;
    }
    box.innerHTML = `<h4 class="cat-title" style="color:var(--green-deep)">Make now (${makeNow.length})</h4>` +
      (makeNow.length ? makeNow.map(chip).join("") : `<p class="muted">No perfect match yet.</p>`) +
      `<h4 class="cat-title" style="margin-top:14px">Nearly there · missing 1-3</h4>` +
      (nearly.length ? nearly.map(chip).join("") : `<p class="muted">Nothing close right now.</p>`);
  }

  // =========================================================================
  // ADDITIONS  (dressings, breads, pickles, ferments — own tab, not in menu)
  // =========================================================================
  const ADDITION_CATEGORIES = ["Dressings & sauces", "Breads", "Fermented & pickles (kimchi etc.)", "Other"];
  function renderAdditions() {
    const items = RECIPES.filter((r) => r.type === "addition");
    const root = document.getElementById("additionsBody");
    if (!items.length) {
      root.innerHTML = `<div class="panel"><h3>Additions</h3>
        <p class="muted">The extras that make meals sing, dressings, breads, pickles, kimchi and ferments. Nothing here yet; send me a reel and I'll shelve it under the right heading below.</p>
        <div>${ADDITION_CATEGORIES.map((c) => `<span class="pool-item">${c}</span>`).join("")}</div></div>`;
      return;
    }
    const byCat = {};
    items.forEach((r) => { const c = r.additionCategory || "Other"; (byCat[c] = byCat[c] || []).push(r); });
    let html = `<p class="muted" style="margin:0 0 14px">${items.length} addition${items.length > 1 ? "s" : ""} · all gluten / dairy / sugar-free</p>`;
    ADDITION_CATEGORIES.forEach((cat) => {
      const g = byCat[cat];
      if (!g || !g.length) return;
      g.sort((a, b) => (avgScore(b.id) || 0) - (avgScore(a.id) || 0) || a.name.localeCompare(b.name));
      html += `<h3 class="dessert-cat">${cat}</h3>` + g.map(recipeCard).join("");
    });
    root.innerHTML = html;
  }

  // =========================================================================
  // SMOOTHIES  (own tab, not part of the menu)
  // =========================================================================
  const SMOOTHIE_CATEGORIES = ["Energizer", "Immune booster", "Cleanse & detox", "Anti-inflammatory & glow", "Calm & gut", "Other"];
  function renderSmoothies() {
    const items = RECIPES.filter((r) => r.type === "smoothie");
    const root = document.getElementById("smoothiesBody");
    if (!items.length) {
      root.innerHTML = `<div class="panel"><h3>Smoothies</h3>
        <p class="muted">Blend-and-go smoothies for snacks or anytime (not breakfast). Nothing here yet; send me a reel and I'll shelve it below.</p>
        <div>${SMOOTHIE_CATEGORIES.map((c) => `<span class="pool-item">${c}</span>`).join("")}</div></div>`;
      return;
    }
    const byCat = {};
    items.forEach((r) => { const c = r.smoothieCategory || "Other"; (byCat[c] = byCat[c] || []).push(r); });
    let html = `<p class="muted" style="margin:0 0 14px">${items.length} smoothie${items.length > 1 ? "s" : ""} · all gluten / dairy / sugar-free</p>`;
    SMOOTHIE_CATEGORIES.forEach((cat) => {
      const g = byCat[cat];
      if (!g || !g.length) return;
      g.sort((a, b) => (avgScore(b.id) || 0) - (avgScore(a.id) || 0) || a.name.localeCompare(b.name));
      html += `<h3 class="dessert-cat">${cat}</h3>` + g.map(recipeCard).join("");
    });
    root.innerHTML = html;
  }

  // lazy-load a reel/short embed into its mount (Instagram or YouTube)
  function mountReel(code, source) {
    const mount = document.querySelector(`[data-mount="${code}"]`);
    if (!mount || mount.dataset.loaded) return;
    mount.dataset.loaded = "1";
    const iframe = document.createElement("iframe");
    iframe.className = "reel-frame";
    if (source === "youtube") {
      iframe.src = `https://www.youtube.com/embed/${code}`;
      iframe.setAttribute("allow", "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "true");
    } else {
      iframe.src = `https://www.instagram.com/reel/${code}/embed/`;
      iframe.setAttribute("allowtransparency", "true");
    }
    iframe.loading = "lazy";
    mount.appendChild(iframe);
  }

  // =========================================================================
  // MENU
  // =========================================================================
  function renderWeekTabs(containerId) {
    const tabs = document.getElementById(containerId);
    tabs.innerHTML = "";
    for (let i = 1; i <= S.cycleWeeks; i++) {
      const b = document.createElement("button");
      b.className = "tab" + (i === activeWeek ? " active" : "");
      b.textContent = "Week " + i;
      b.onclick = () => { activeWeek = i; renderAll(); };
      tabs.appendChild(b);
    }
  }

  function renderMenu() {
    renderWeekTabs("weekTabs");

    // menu-ready pool
    const ready = RECIPES.filter((r) => isMenuReady(r.id));
    const pool = document.getElementById("menuReadyPool");
    pool.innerHTML = `<div class="panel">
      <h3>Menu-ready pool</h3>
      <p class="muted">Your winners: rated <strong>5★ Healthy, 5★ Easy and 4★+ Tasty</strong> (a perfect 5/5/5 is a 🏆 Winner). Use "+ Add to menu" on any recipe in Explore to drop it into the next open slot; tap the × on a slot below to remove it. Aim to keep variety so each dish repeats only once or twice a month.</p>
      <div>${ready.length ? ready.map((r) => `<span class="pool-item" data-addmenu="${r.id}">${isWinner(r.id) ? "🏆 " : ""}${r.name} · ${avgScore(r.id).toFixed(1)}★ &nbsp;+ add</span>`).join("")
        : `<span class="muted">None yet. Rate recipes in Explore to fill this.</span>`}</div>
    </div>`;

    // grid
    const week = getWeek(activeWeek);
    const grid = document.getElementById("menuGrid");
    grid.innerHTML = "";
    const salads = saladList();
    week.days.forEach((d, di) => {
      const row = document.createElement("div");
      row.className = "day-row";
      row.innerHTML = `<p class="day-name">${d.day}</p>`;
      const meals = document.createElement("div");
      meals.className = "meals";
      S.mealOrder.forEach((meal) => {
        const key = activeWeek + "|" + d.day + "|" + meal;
        const id = placements[key];
        const r = id ? recipeById[id] : null;
        const slot = document.createElement("div");
        slot.className = "meal-slot" + (r ? " filled" : "");
        if (r) {
          const isSide = r.type === "side";
          const low = !isSide && r.proteinPerServing < S.proteinTargetPerMeal;
          slot.innerHTML = `<div class="meal-label">${meal}<span class="slot-actions"><span class="slot-swap" data-swap="${key}" title="Swap this meal">⇄</span><span class="slot-remove" data-remove="${key}" title="Remove from menu">×</span></span></div>
            <div class="meal-name">${r.name}</div>
            <div class="meal-meta">
              <span class="badge ${isSide ? "side" : "protein"} ${low ? "low" : ""}">${r.proteinPerServing}g</span>
              <span>${totalTime(r)} min</span>
            </div>`;
          slot.onclick = (e) => { if (e.target.dataset.remove != null || e.target.dataset.swap != null) return; openRecipe(r); };
        } else {
          slot.innerHTML = `<div class="meal-label">${meal}</div><div class="empty-slot">+ add a recipe</div>`;
        }
        meals.appendChild(slot);
      });
      row.appendChild(meals);
      if (salads.length) {
        const s = salads[((activeWeek - 1) * 7 + di) % salads.length];
        const sl = document.createElement("div");
        sl.className = "day-salad";
        sl.innerHTML = `🥗 <span class="muted">Salad to add on the side:</span> <span class="pool-item" data-open="${s.id}">${s.name}</span>`;
        row.appendChild(sl);
      }
      grid.appendChild(row);
    });
  }

  // =========================================================================
  // PREP
  // =========================================================================
  // ingredients you actually cut/prep on the board for a recipe
  function cuttablesFor(recipe) {
    return (recipe.ingredients || [])
      .filter((i) => ["vegetables", "greens", "fruit"].includes(i.category))
      .map((i) => i.item);
  }
  const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
  const MEAL_INITIAL = { breakfast: "B", lunch: "L", dinner: "D" };

  function renderPrep() {
    renderWeekTabs("weekTabsPrep");
    const week = getWeek(activeWeek);
    const placed = recipesInWeek(activeWeek);
    const root = document.getElementById("prepBody");
    if (!placed.length) {
      root.innerHTML = `<div class="panel"><p class="muted">No recipes placed in Week ${activeWeek} yet.</p></div>`;
      return;
    }

    // ---- DAILY prep: per day, what to cut/prep across the day's meals --------
    let daysHtml = "";
    week.days.forEach((d, i) => {
      const meals = S.mealOrder
        .map((meal) => { const id = placements[activeWeek + "|" + d.day + "|" + meal]; return { meal, recipe: id && recipeById[id] }; })
        .filter((m) => m.recipe);
      if (!meals.length) return;

      // tonight's nudge: get tomorrow's breakfast ready if it needs it
      const tomorrow = week.days[(i + 1) % week.days.length];
      const bId = tomorrow && placements[activeWeek + "|" + tomorrow.day + "|breakfast"];
      const bf = bId && recipeById[bId];
      let tonight = "";
      if (bf) {
        const plan = morningPlan(bf);
        if (plan === "nightbefore") {
          const step = (bf.prepAhead && bf.prepAhead[0]) || "Make it ahead tonight so the morning is grab-and-go.";
          tonight = `<div class="tonight"><span class="tonight-label">🌙 Tonight, for ${tomorrow.day}'s breakfast</span> <strong>${bf.name}</strong>: ${step}</div>`;
        } else if (plan === "weekend") {
          tonight = `<div class="tonight"><span class="tonight-label">🌙 Tonight, for ${tomorrow.day}'s breakfast</span> <strong>${bf.name}</strong> is a cook-fresh one. Fine for a slower morning; otherwise swap in a quick or make-ahead breakfast.</div>`;
        } else {
          tonight = `<div class="tonight quick"><span class="tonight-label">☀ ${tomorrow.day}'s breakfast</span> <strong>${bf.name}</strong> is quick, nothing to do tonight, just make it fresh.</div>`;
        }
      }

      // consolidated cut list for the whole day (item -> which meals use it)
      const cut = new Map();
      meals.forEach((m) => cuttablesFor(m.recipe).forEach((it) => {
        const key = it.toLowerCase();
        if (!cut.has(key)) cut.set(key, { item: it, meals: new Set() });
        cut.get(key).meals.add(MEAL_INITIAL[m.meal]);
      }));
      const cutChips = [...cut.values()].map((c) =>
        `<span class="cut-chip">${c.item}<span class="cut-for">${[...c.meals].join("·")}</span></span>`).join("");

      const mealRows = meals.map((m) => {
        const r = m.recipe;
        return `<div class="meal-prep">
          <div class="meal-prep-head"><span class="meal-tag">${MEAL_LABEL[m.meal]}</span> <strong>${r.name}</strong> ${prepBadge(r)}</div>
          ${r.prepNotes ? `<p class="prep-note">${r.prepNotes}</p>` : ""}
        </div>`;
      }).join("");

      daysHtml += `<div class="panel day-prep">
        <h3>${d.day}</h3>
        ${cutChips ? `<div class="cut-block"><span class="cut-label">🔪 To cut / prep for the day:</span><div class="cut-chips">${cutChips}</div><p class="cut-key muted">B = breakfast · L = lunch · D = dinner</p></div>` : ""}
        ${mealRows}
        ${tonight}
      </div>`;
    });

    // ---- WEEKLY make-ahead (bonus): batch jobs that ease the week ------------
    const seen = new Set(), unique = [];
    placed.forEach((p) => { if (!seen.has(p.recipe.id)) { seen.add(p.recipe.id); unique.push(p.recipe); } });
    let tasks = "";
    unique.forEach((r) => (r.prepAhead || []).forEach((t) =>
      tasks += `<li>${t} <span class="muted">· ${r.name}</span></li>`));
    const weeklyHtml = `<div class="panel">
      <h3>Weekly make-ahead <span class="muted">(optional, to ease the week)</span></h3>
      <p class="muted">Daily cutting above is the main plan. These are batch jobs you can do on a prep day if it helps.</p>
      <ul class="prep-list">${tasks || `<li class="muted">No make-ahead jobs this week.</li>`}</ul>
    </div>`;

    root.innerHTML = `<p class="muted prep-intro">Day-by-day prep for Week ${activeWeek}: what to cut and get ready for each day's breakfast, lunch and dinner.</p>` + daysHtml + weeklyHtml;
  }

  // =========================================================================
  // SHOPPING  (with the "I have" pantry pass)
  // =========================================================================
  const CATEGORY_ORDER = ["protein", "greens", "vegetables", "fruit", "fridge", "pantry", "herbs-spices", "other"];
  const CATEGORY_LABEL = {
    protein: "Protein", greens: "Greens", vegetables: "Vegetables", fruit: "Fruit",
    fridge: "Fridge", pantry: "Pantry & dry goods", "herbs-spices": "Herbs & spices", other: "Other",
  };
  // unit families for consolidating one ingredient that appears in different units
  const VOL = { tsp: 5, tbsp: 15, cup: 240, ml: 1, l: 1000, litre: 1000 };
  const MASS = { g: 1, kg: 1000 };
  const DAY_INDEX = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
  const PERISHABLE = ["lettuce", "romaine", "cos", "spinach", "arugula", "rocket", "salad leaves",
    "salad greens", "mixed greens", "mixed salad", "parsley", "dill", "cilantro", "coriander", "basil",
    "mint", "chives", "avocado", "berries", "blueberr", "raspberr", "strawberr", "cod", "fish", "sprout"];
  function isPerishable(item) {
    const n = item.toLowerCase();
    if (/dried|ground|powder|flakes|frozen|canned|paste/.test(n)) return false;
    return PERISHABLE.some((p) => n.indexOf(p) > -1);
  }
  // items to buy fresh on a mid-week top-up (eggs, fresh veg, fruit, leafy greens, fresh fish)
  const FRESH = ["lettuce", "romaine", "spinach", "arugula", "rocket", "salad leaves", "salad greens",
    "mixed greens", "mixed salad", "parsley", "dill", "cilantro", "coriander", "basil", "mint", "chives",
    "avocado", "berries", "blueberr", "raspberr", "strawberr", "fish", "cod", "sardine", "salmon", "sprout",
    "eggs", "egg whites", "tomato", "cucumber", "mushroom", "spring onion", "scallion", "banana"];
  function isFreshTopup(item) {
    const n = item.toLowerCase();
    if (/dried|ground|powder|flakes|frozen|canned|paste|passata|sauce|aminos|tamari|vinegar|stock|broth|flour|panko|gelatin/.test(n)) return false;
    return FRESH.some((p) => n.indexOf(p) > -1);
  }
  function fmtAmount(it) {
    const parts = [];
    if (it.volumeMl > 0) {
      const v = it.volumeMl;
      if (v >= 1000) parts.push((Math.round(v / 100) / 10) + " L");
      else if (v >= 100) parts.push(Math.round(v) + " ml");
      else parts.push(fmt(v / 15) + " tbsp");
    }
    if (it.massG > 0) {
      const m = it.massG;
      parts.push(m >= 1000 ? (Math.round(m / 100) / 10) + " kg" : Math.round(m) + " g");
    }
    Object.keys(it.counts).forEach((u) => parts.push(fmt(it.counts[u]) + " " + u));
    return parts.join(" + ");
  }

  function renderShopping() {
    renderWeekTabs("weekTabsShop");
    const placed = recipesInWeek(activeWeek);
    const root = document.getElementById("shoppingBody");
    if (!placed.length) {
      root.innerHTML = `<div class="panel"><p class="muted">No recipes placed in Week ${activeWeek} yet, so nothing to shop for.</p></div>`;
      return;
    }

    // consolidate by ITEM NAME (merge across units), tracking which days each is used
    const byItem = {};
    placed.forEach((p) => {
      const factor = S.servingsTarget / (p.recipe.servings || S.servingsTarget);
      const dayIdx = DAY_INDEX[p.day];
      (p.recipe.ingredients || []).forEach((ing) => {
        const key = ing.item.toLowerCase();
        if (!byItem[key]) byItem[key] = { item: ing.item, category: ing.category || "other", volumeMl: 0, massG: 0, counts: {}, days: new Set() };
        const it = byItem[key];
        if (dayIdx != null) it.days.add(dayIdx);
        const q = ing.qty * factor, u = ing.unit;
        if (VOL[u] != null) it.volumeMl += q * VOL[u];
        else if (MASS[u] != null) it.massG += q * MASS[u];
        else it.counts[u] = (it.counts[u] || 0) + q;
      });
    });
    const items = Object.values(byItem);
    const toBuy = items.filter((x) => !pantry.has(x.item.toLowerCase()));
    const have = items.filter((x) => pantry.has(x.item.toLowerCase()));
    // perishables used in the back half of the week (Thursday onward) → suggest a midweek top-up
    const topUp = toBuy.filter((x) => isPerishable(x.item) && x.days.size && Math.max(...x.days) >= 3);

    function groupHtml(rows, mode) {
      const byCat = {};
      rows.forEach((x) => (byCat[x.category] = byCat[x.category] || []).push(x));
      let html = "";
      CATEGORY_ORDER.forEach((cat) => {
        const g = byCat[cat];
        if (!g || !g.length) return;
        g.sort((a, b) => a.item.localeCompare(b.item));
        html += `<div class="cat-group"><div class="cat-title">${CATEGORY_LABEL[cat] || cat}</div>` +
          g.map((x) => {
            const fresh = isPerishable(x.item) ? ` <span class="fresh-tag" title="Perishable, best fresh">🥬</span>` : "";
            if (mode === "have") {
              return `<div class="shop-item have"><span class="shop-qty">${fmtAmount(x)}</span><span class="shop-name">${x.item}</span><button class="have-link" data-unhave="${x.item.toLowerCase()}" title="Put back on the buy list">put back</button></div>`;
            }
            const k = gotKey(activeWeek, x.item);
            const isGot = !!got[k];
            return `<div class="shop-item ${isGot ? "got" : ""}"><label class="shop-tick"><input type="checkbox" class="shop-check" data-got="${k}" ${isGot ? "checked" : ""}/><span class="shop-qty">${fmtAmount(x)}</span><span class="shop-name">${x.item}${fresh}</span></label><button class="have-link" data-have="${x.item.toLowerCase()}" title="I always have this, hide it">have</button></div>`;
          }).join("") + `</div>`;
      });
      return html;
    }

    const freshTopup = toBuy.filter((x) => isFreshTopup(x.item));
    const bigShop = toBuy.filter((x) => !isFreshTopup(x.item));
    const gotCount = toBuy.filter((x) => got[gotKey(activeWeek, x.item)]).length;

    root.innerHTML = `
      <div class="panel">
        <h3>Shopping list · Week ${activeWeek}</h3>
        <p class="muted">Two shops: a <strong>big one at the start of the week</strong>, then a quick <strong>mid-week top-up</strong> for eggs, fresh veg and fruit so nothing wilts. Each ingredient is combined into one line; tick as you go.</p>
        <div class="pantry-tools">
          <span class="muted">${gotCount} of ${toBuy.length} collected · ${have.length} you already have</span>
          ${gotCount ? `<button class="linkish" id="clearGot">reset ticks</button>` : ""}
          ${have.length ? `<button class="linkish" id="clearPantry">reset “I have”</button>` : ""}
        </div>
        <h4 class="cat-title" style="color:var(--green-deep)">🛒 Big shop · start of the week</h4>
        ${bigShop.length ? groupHtml(bigShop, "buy") : `<p class="muted">Nothing here yet.</p>`}
        <h4 class="cat-title" style="color:var(--accent);margin-top:20px">🥬 Mid-week top-up · eggs, fresh veg &amp; fruit</h4>
        ${freshTopup.length ? groupHtml(freshTopup, "buy") : `<p class="muted">Nothing perishable to top up this week.</p>`}
        ${have.length ? `<h4 class="cat-title" style="color:var(--ink-soft);margin-top:20px">✓ Already have (skipped)</h4>${groupHtml(have, "have")}` : ""}
      </div>`;
  }

  // =========================================================================
  // RECIPE MODAL
  // =========================================================================
  let modalRecipeId = null;
  // Swap a single meal slot for another recipe, leaving the rest of the week alone.
  function openSwapPicker(key) {
    const meal = key.split("|")[2];
    const currentId = placements[key];
    const cands = meal === "breakfast"
      ? RECIPES.filter((r) => (r.meal || []).includes("breakfast"))
      : RECIPES.filter((r) => { const m = r.meal || []; return m.includes("lunch") || m.includes("dinner"); });
    cands.sort((a, b) => {
      const ra = isMenuReady(a.id) ? 1 : 0, rb = isMenuReady(b.id) ? 1 : 0;
      if (ra !== rb) return rb - ra;
      const sa = avgScore(a.id) || 0, sb = avgScore(b.id) || 0;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name);
    });
    const rows = cands.map((r) => `<div class="swap-row${r.id === currentId ? " current" : ""}" data-pickkey="${key}" data-pickid="${r.id}">
        <span class="swap-name">${isWinner(r.id) ? "🏆 " : (isMenuReady(r.id) ? "★ " : "")}${r.name}</span>
        <span class="muted swap-meta">${r.proteinPerServing ? r.proteinPerServing + "g · " : ""}${totalTime(r)} min${r.id === currentId ? " · current" : ""}</span>
      </div>`).join("");
    const parts = key.split("|");
    document.getElementById("modalBody").innerHTML = `
      <h2>Swap ${parts[2]} · ${parts[1]}</h2>
      <p class="muted">Pick another recipe for this slot. Your ratings and the rest of the week stay the same.</p>
      <div class="swap-list">${rows || `<p class="muted">No alternatives for this meal yet.</p>`}</div>`;
    document.getElementById("modal").classList.remove("hidden");
    modalRecipeId = null;
  }

  function openRecipe(r) {
    modalRecipeId = r.id;
    const ing = (r.ingredients || []).map((i) =>
      `<div class="shop-item"><span class="shop-qty">${fmt(scaleQty(i.qty, r.servings))} ${i.unit}</span><span>${i.item}</span></div>`).join("");
    const steps = (r.steps || []).map((s) => `<li>${s}</li>`).join("");
    const tags = (r.tags || []).map((t) => `<span class="badge side">${t}</span>`).join(" ");
    // rating block, so you can rate straight from the recipe popup
    const isExtra = r.type === "dessert" || r.type === "addition" || r.type === "smoothie";
    const avg = avgScore(r.id);
    const scorePill = avg != null ? `<span class="score-pill">avg ${avg.toFixed(1)}/5</span>` : `<span class="muted">not rated yet</span>`;
    const ready = (!isExtra && isMenuReady(r.id))
      ? (isWinner(r.id) ? `<span class="badge menu-ready">🏆 Winner</span>` : `<span class="badge menu-ready">★ Menu-ready</span>`) : "";
    const rateBlock = `
      <div class="modal-rate">
        <h4>Rate it</h4>
        ${starRow(r.id, "healthy", "Healthy")}
        ${starRow(r.id, "tasty", "Tasty")}
        ${starRow(r.id, "easy", "Easy")}
        <div class="rc-actions" style="margin-top:8px">${scorePill}${ready}</div>
        <textarea class="rc-notes" data-notes="${r.id}" placeholder="Notes (what you'd tweak, who liked it...)">${getRating(r.id).notes || ""}</textarea>
        <div class="modal-actions">
          ${isExtra ? "" : `<button class="menu-add-btn${placementCount(r.id) ? " in-menu" : ""}" data-addmenu="${r.id}">${placementCount(r.id) ? `✓ In menu (${placementCount(r.id)}) · add again` : "+ Add to weekly menu"}</button>`}
          <button class="delete-btn" data-del="${r.id}">Dismiss</button>
        </div>
      </div>`;
    document.getElementById("modalBody").innerHTML = `
      <h2>${r.name}</h2>
      <div class="rc-meta">
        ${r.type === "dessert"
          ? `<span class="badge dessert">${r.dessertCategory || "dessert"}</span>`
          : r.type === "addition"
          ? `<span class="badge addition">${r.additionCategory || "addition"}</span>`
          : r.type === "smoothie"
          ? `<span class="badge smoothie">${r.smoothieCategory || "smoothie"}</span>`
          : `<span class="badge ${r.type === "side" ? "side" : "protein"}">${r.proteinPerServing}g protein</span>`}
        <span>${totalTime(r)} min</span>
        ${(r.type === "dessert" || r.type === "addition" || r.type === "smoothie") ? "" : `<span>serves ${S.servingsTarget}</span>`}
        ${prepBadge(r)}
      </div>
      ${r.prepNotes ? `<p class="prep-note"><strong>Prep:</strong> ${r.prepNotes}</p>` : ""}
      <div style="margin-top:10px">${tags}</div>
      ${rateBlock}
      <h4>Ingredients (for ${S.servingsTarget})</h4>${ing}
      <h4>Method</h4><ol>${steps}</ol>
      ${r.prepAhead && r.prepAhead.length ? `<h4>Prep ahead</h4><ul class="prep-list">${r.prepAhead.map((p) => `<li>${p}</li>`).join("")}</ul>` : ""}
      ${r.notes ? `<h4>Notes</h4><p class="muted">${r.notes}</p>` : ""}
      ${r.video && r.video.url ? `<h4>Video</h4><a class="reel-link" href="${r.video.url}" target="_blank" rel="noopener">Watch on ${r.video.source === "youtube" ? "YouTube" : "Instagram"} ↗ ${r.video.creator || ""}</a>` : ""}`;
    document.getElementById("modal").classList.remove("hidden");
  }

  // =========================================================================
  // RENDER + EVENTS
  // =========================================================================
  function renderAll() {
    document.getElementById("dietLine").textContent = "Designed for: " + S.dietRules.join(" · ");
    renderExplore();
    renderCook();
    renderDesserts();
    renderAdditions();
    renderSmoothies();
    renderMenu();
    renderPrep();
    renderShopping();
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-" + activeView).classList.remove("hidden");
    document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === activeView));
  }

  // event delegation on the whole document
  document.addEventListener("click", (e) => {
    const t = e.target;

    // view switch
    if (t.dataset.view) { activeView = t.dataset.view; renderAll(); return; }
    // explore filter
    if (t.dataset.filter) { exploreFilter = t.dataset.filter; renderExplore(); return; }
    // open recipe modal
    if (t.dataset.open) { const r = recipeById[t.dataset.open]; if (r) openRecipe(r); return; }
    // add a recipe to the menu rotation (next open matching slot)
    if (t.dataset.addmenu) {
      const ok = addToMenu(t.dataset.addmenu);
      const modalOpen = !document.getElementById("modal").classList.contains("hidden");
      renderAll();
      if (modalOpen && modalRecipeId && recipeById[modalRecipeId]) openRecipe(recipeById[modalRecipeId]);
      if (!ok) window.alert("Every matching slot across the 4 weeks is full. Remove one on the Menu tab (tap the ×) to add this.");
      return;
    }
    // remove a recipe from a menu slot
    if (t.dataset.remove != null) { removePlacement(t.dataset.remove); renderAll(); return; }
    // open the swap picker for a slot
    if (t.dataset.swap != null) { openSwapPicker(t.dataset.swap); return; }
    // pick a replacement recipe in the swap picker
    const pickRow = t.closest && t.closest("[data-pickid]");
    if (pickRow) {
      placements[pickRow.dataset.pickkey] = pickRow.dataset.pickid;
      savePlacements();
      document.getElementById("modal").classList.add("hidden");
      renderAll();
      return;
    }
    // star rating (works on cards and inside the recipe popup)
    if (t.classList.contains("star")) {
      setRating(t.dataset.id, { [t.dataset.axis]: Number(t.dataset.val) });
      const modalOpen = !document.getElementById("modal").classList.contains("hidden");
      renderAll();
      if (modalOpen && modalRecipeId && recipeById[modalRecipeId]) openRecipe(recipeById[modalRecipeId]);
      return;
    }
    // shopping list: mark a staple as always-have (hide it) / put it back
    if (t.dataset.have != null) {
      pantry.add(t.dataset.have); save(LS.pantry, [...pantry]);
      Object.keys(got).forEach((k) => { if (k.endsWith("::" + t.dataset.have)) delete got[k]; });
      saveGot();
      renderShopping();
      return;
    }
    if (t.dataset.unhave != null) { pantry.delete(t.dataset.unhave); save(LS.pantry, [...pantry]); renderShopping(); return; }
    // upload a new recipe from a link
    if (t.id === "uploadToggle") { document.getElementById("uploadForm").classList.toggle("hidden"); return; }
    if (t.id === "upCancel") { document.getElementById("uploadForm").classList.add("hidden"); return; }
    if (t.id === "upSubmit") {
      const link = document.getElementById("upLink").value;
      const name = document.getElementById("upName").value;
      const type = document.getElementById("upType").value;
      if (addUserRecipe(name, link, type)) {
        document.getElementById("upLink").value = "";
        document.getElementById("upName").value = "";
        document.getElementById("uploadForm").classList.add("hidden");
      }
      return;
    }
    if (t.dataset.del != null) {
      const r = recipeById[t.dataset.del];
      const nm = r ? r.name : "this recipe";
      const msg = r && r.custom
        ? `Dismiss "${nm}"? This was one of your uploads and can't be undone.`
        : `Dismiss "${nm}"? It will be removed from the app. You can bring it back any time with "Restore deleted" on the Explore tab.`;
      if (window.confirm(msg)) { deleteRecipe(t.dataset.del); document.getElementById("modal").classList.add("hidden"); }
      return;
    }
    if (t.id === "restoreDeleted") { restoreDeleted(); return; }
    // recipe search filter chips
    if (t.dataset.sfilter != null) { searchFilter = t.dataset.sfilter; renderCook(); return; }
    // "what can I make" matcher: find / clear
    if (t.dataset.cookFind != null) { const el = document.getElementById("cookInput"); if (el) cookQuery = el.value; cookSearched = true; renderMatcherResults(); return; }
    if (t.dataset.cookClear != null) { cookQuery = ""; cookSearched = false; renderCook(); return; }
    // reset shopping ticks for this week
    if (t.id === "clearGot") { resetGot(activeWeek); renderShopping(); return; }
    // reset pantry
    if (t.id === "clearPantry") { pantry.clear(); save(LS.pantry, []); renderShopping(); return; }
    // modal close
    if (t.id === "modalClose" || t.id === "modal") { document.getElementById("modal").classList.add("hidden"); return; }
  });

  // checkbox + textarea changes
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.got != null) {
      if (t.checked) got[t.dataset.got] = true; else delete got[t.dataset.got];
      saveGot();
      renderShopping();
      return;
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.dataset.notes != null) setRating(e.target.dataset.notes, { notes: e.target.value });
    if (e.target.dataset.cookq != null) cookQuery = e.target.value;
    if (e.target.dataset.searchq != null) { searchQuery = e.target.value; renderSearchResults(); }
  });

  renderAll();
})();
