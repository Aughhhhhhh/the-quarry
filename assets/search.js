const find = document.querySelector("#find");
const search = document.querySelector("#search");
const searchSection = document.querySelector("#search-section");
const searchResults = document.querySelector("#search-results");
const searchCount = document.querySelector("#search-count");
const searchMore = document.querySelector("#search-more");
const resultPageSize = 12;
const guidePages = {
  walkthrough: "chapters.html",
  endings: "endings.html",
  collectibles: "collectibles.html",
  achievements: "achievements.html",
  reference: "reference.html",
  paths: "reference.html",
  cast: "characters.html",
  epilogue: "epilogue.html",
};
const allPages = [...new Set(Object.values(guidePages))];
const pageRequests = new Map();
const pageResults = new Map();
const normalize = value => value.toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const searchFiller = new Set("a an and are at can do does for from get how i in is me of on the to what where".split(" "));

function routeLink(anchor, label) {
  return anchor && { href: anchor.getAttribute("href"), label: label || anchor.textContent.trim() };
}

function indexEntries(content, page) {
  const entries = Array.from(content.querySelectorAll("[data-search]"), entry => {
    const title = entry.querySelector("summary strong, label, h3").textContent;
    const section = entry.closest(".section");
    const heading = section.querySelector("h1, h2").textContent;
    const parent = entry.matches(".collectible") ? entry.closest("details").querySelector("summary strong").textContent : "";
    const chapter = entry.dataset.search === "Walkthrough" ? entry.querySelector("summary .meta").textContent : "";
    const group = entry.closest("[data-chapter]");
    const scope = group ? (group.dataset.chapter === "0" ? "Prologue" : `Chapter ${group.dataset.chapter}`) :
      entry.closest('[data-search="Walkthrough"]')?.querySelector("summary .meta").textContent || "";
    const types = entry.matches("[data-chapter]") ? [...new Set(Array.from(entry.querySelectorAll("[data-type]"), item => item.dataset.type))].join(" ") :
      entry.dataset.type || "";
    const fateTerms = entry.dataset.search === "Character fate" ? `save ${title} keep ${title} alive ${title} survive` : "";
    const terms = normalize(`${entry.dataset.searchTerms || ""} ${types.replace(/\bclue\b/, "clue clues")} ${fateTerms}`);
    let route = null;
    if (entry.matches(".collectible")) {
      const pickup = entry.querySelector('.pickup-video a[href^="rough-night.html#"]') ||
        entry.querySelector('.pickup-video a[href^="completion.html#"], .pickup-video a[href^="blood-pact.html#"]');
      route = routeLink(pickup);
    } else if (page === "endings.html") {
      route = routeLink(entry.querySelector(':scope > .entry-body > p > :is(a.button.primary, a[href^="massacre.html#sole-"])'), "Walkthrough");
    }
    return {
      href: `${page}#${entry.id}`,
      title: /^Chapter \d+$/.test(chapter) ? `${chapter} · ${title}` : title,
      label: entry.dataset.search,
      section: section.id,
      name: normalize(title),
      chapter: normalize(chapter),
      scope: normalize(scope),
      terms,
      route,
      text: normalize(`${title} ${scope} ${heading} ${parent} ${terms} ${entry.textContent}`),
    };
  });
  for (const heading of content.querySelectorAll("[data-search] :is(h3, h4, dt)[id]")) {
    const entry = heading.closest("[data-search]");
    const walkthrough = entry.closest('[data-search="Walkthrough"]');
    const chapter = walkthrough?.querySelector("summary .meta").textContent || "";
    const title = heading.textContent.trim();
    const context = entry.querySelector("summary strong, label, h3").textContent.trim();
    let body = "";
    for (let next = heading.nextElementSibling; next && !next.matches("h2, h3, h4, dt, nav, .source-note"); next = next.nextElementSibling) {
      body += ` ${next.textContent}`;
      if (heading.matches("dt")) break;
    }
    entries.push({
      href: `${page}#${heading.id}`,
      title,
      label: `${/^Chapter \d+$/.test(chapter) ? chapter : entry.dataset.search} · ${context}`,
      section: entry.closest(".section").id,
      name: normalize(title),
      scope: normalize(chapter),
      detail: true,
      text: normalize(`${chapter} ${context} ${title} ${body}`),
    });
  }
  return entries;
}

let resultLimit = resultPageSize;

function renderSearch() {
  const query = normalize(search.value).replace(/\bch (?=\d+\b)/g, "chapter ");
  searchResults.replaceChildren();
  searchCount.textContent = "";
  if (!query) {
    searchMore.hidden = true;
    return;
  }
  const words = query.split(" ").filter(word => !searchFiller.has(word));
  if (!words.length) words.push(...query.split(" "));
  const phrase = words.join(" ");
  const chapter = query.match(/\bchapter \d+\b/)?.[0];
  const patterns = words.map((word, index) => new RegExp(`(?:^| )${word}${
    index === words.length - 1 && !/^\d+$/.test(word) ? "" : "(?: |$)"
  }`));
  const section = searchSection.value;
  const pages = section ? [guidePages[section]] : allPages;
  const searchIndex = pages.flatMap(page => pageResults.get(page) || []);
  const matches = searchIndex.filter(entry => (!section || entry.section === section) &&
    patterns.every(pattern => pattern.test(entry.text)));
  function rank(entry) {
    if (entry.chapter === query) return 7;
    if (entry.name === query || entry.name === phrase) return 6;
    if (` ${entry.terms || ""} `.includes(` ${phrase} `)) return 5;
    if (entry.name.includes(query) || entry.name.includes(phrase)) return 4;
    const named = ` ${entry.scope || ""} ${entry.name} ${entry.terms || ""} `;
    if (words.every(word => named.includes(` ${word} `))) return 3;
    if (chapter && entry.scope === chapter) return 2;
    if (entry.text.includes(query) || entry.text.includes(phrase)) return entry.detail ? 1.5 : 1;
    return 0;
  }
  matches.sort((a, b) => rank(b) - rank(a));
  searchMore.hidden = matches.length <= resultLimit;
  searchCount.textContent = searchMore.hidden
    ? matches.length === 1 ? "1 match" : `${matches.length} matches`
    : `Showing ${resultLimit} of ${matches.length} matches`;
  if (pages.some(page => !pageResults.has(page))) searchCount.textContent += " · Loading guide results…";
  if (pages.some(page => pageResults.get(page) === null)) searchCount.textContent += " · Some results are unavailable. Open the guide sections directly or reload to retry.";
  for (const entry of matches.slice(0, resultLimit)) {
    const row = document.createElement("li");
    const link = document.createElement("a");
    const label = document.createElement("small");
    link.href = entry.href;
    link.textContent = entry.title;
    label.textContent = ` · ${entry.label}`;
    link.append(label);
    row.append(link);
    if (entry.route) {
      const action = document.createElement("a");
      action.href = entry.route.href;
      action.textContent = entry.route.label;
      action.setAttribute("aria-label", `${entry.route.label} for ${entry.title} · ${entry.label}`);
      row.append(" · ", action);
    }
    searchResults.append(row);
  }
}

function indexArchive(content) {
  const entries = [];
  const sections = {
    "Epilogue": "[data-fate], #after-the-night .entry[id], #audit > .entry[id]",
    "Eliza’s speech": "#eliza li[id], #eliza-no-cards",
    "Opening headline": "#headline-asset-intros > li[id]",
    "Closing headline": "#headline-asset-outros > li[id]",
    "Epilogue audit": "#recap-missing dt[id], #recap-file-notes dt[id]",
  };
  for (const [label, selector] of Object.entries(sections)) {
    for (const entry of content.querySelectorAll(selector)) {
      const character = entry.closest("[data-character]")?.querySelector("summary strong").textContent;
      const isTerm = entry.matches("dt");
      const title = isTerm ? entry.textContent : entry.querySelector("h3, summary strong, :scope > strong").textContent;
      const body = isTerm ? entry.nextElementSibling.textContent : entry.textContent;
      let walkthrough = null;
      if (entry.matches("[data-fate]")) walkthrough = entry.querySelector('a[href*="-routes.html#"]');
      else if (label.endsWith("headline")) walkthrough = entry.querySelector('a[href^="newspapers.html#"]');
      entries.push({
        href: `epilogue.html#${entry.id}`,
        title,
        label: character || label,
        section: "epilogue",
        name: normalize(character ? `${character} ${title}` : title),
        route: routeLink(walkthrough, "Walkthrough"),
        text: normalize(`Epilogue ${label} ${character || ""} ${title} ${body}`),
      });
    }
  }
  return entries;
}

async function loadResults(page) {
  try {
    const response = await fetch(page);
    if (!response.ok) throw new Error(response.statusText);
    const source = document.createElement("template");
    source.innerHTML = await response.text();
    pageResults.set(page, page === "epilogue.html" ? indexArchive(source.content) : indexEntries(source.content, page));
  } catch {
    pageResults.set(page, null);
  }
  const focused = searchResults.contains(document.activeElement) && document.activeElement;
  const focusedRow = focused && focused.parentElement.firstElementChild.getAttribute("href");
  renderSearch();
  if (focusedRow) {
    const row = searchResults.querySelector(`li > a:first-child[href="${CSS.escape(focusedRow)}"]`)?.parentElement;
    const result = row?.querySelector(`a[href="${CSS.escape(focused.getAttribute("href"))}"]`);
    (result || search).focus({ preventScroll: true });
  }
}

find.hidden = false;
document.querySelector(".search-link").hidden = false;
function updateSearch() {
  if (normalize(search.value)) {
    const pages = searchSection.value ? [guidePages[searchSection.value]] : allPages;
    for (const page of pages) {
      if (!pageRequests.has(page)) pageRequests.set(page, loadResults(page));
    }
  }
  renderSearch();
}
function resetSearch() {
  resultLimit = resultPageSize;
  updateSearch();
}
search.addEventListener("input", resetSearch);
searchSection.addEventListener("change", resetSearch);
searchResults.addEventListener("click", event => {
  const link = event.target.closest("a");
  if (!link) return;
  history.replaceState({
    ...history.state,
    guideSearch: { query: search.value, section: searchSection.value, limit: resultLimit },
  }, "");
});
const savedSearch = history.state?.guideSearch;
if (savedSearch) {
  search.value = savedSearch.query;
  searchSection.value = savedSearch.section;
  resultLimit = savedSearch.limit;
  updateSearch();
}
searchMore.addEventListener("click", () => {
  const firstNewResult = resultLimit;
  resultLimit += resultPageSize;
  renderSearch();
  searchResults.children[firstNewResult]?.querySelector("a").focus();
});

let legacyAnchors;
async function openHomeLink() {
  const hash = location.hash;
  if (hash === "#find") search.focus({ preventScroll: true });
  if (!hash || document.getElementById(hash.slice(1))) return;
  try {
    legacyAnchors ||= fetch("assets/guide-anchors.json").then(response => response.json());
    const pages = await legacyAnchors;
    if (location.hash !== hash) return;
    const match = Object.entries(pages).find(([, ids]) => ids.includes(hash.slice(1)));
    if (match) location.replace(`${match[0]}${location.search}${hash}`);
  } catch {
    // The home page still gives direct links to all sections.
  }
}
window.addEventListener("hashchange", openHomeLink);
document.querySelector(".search-link").addEventListener("click", () => search.focus({ preventScroll: true }));
openHomeLink();
