const find = document.querySelector("#find");
const search = document.querySelector("#search");
const searchSection = document.querySelector("#search-section");
const searchResults = document.querySelector("#search-results");
const searchCount = document.querySelector("#search-count");
const searchMore = document.querySelector("#search-more");
const resultPageSize = 12;
const normalize = value => value.toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const searchFiller = new Set("a an and are at can do does for from get how i in is me of on the to what where".split(" "));
const searchIndex = Array.from(document.querySelectorAll("[data-search]"), entry => {
  const title = entry.querySelector("summary strong, label, h3").textContent;
  const section = entry.closest(".section");
  const heading = section.querySelector("h2").textContent;
  const parent = entry.matches(".collectible") ? entry.closest("details").querySelector("summary strong").textContent : "";
  const chapter = entry.dataset.search === "Walkthrough" ? entry.querySelector("summary .meta").textContent : "";
  const group = entry.closest("[data-chapter]");
  const scope = group ? (group.dataset.chapter === "0" ? "Prologue" : `Chapter ${group.dataset.chapter}`) :
    entry.closest('[data-search="Walkthrough"]')?.querySelector("summary .meta").textContent || "";
  const types = entry.matches("[data-chapter]") ? [...new Set(Array.from(entry.querySelectorAll("[data-type]"), item => item.dataset.type))].join(" ") :
    entry.dataset.type || "";
  const fateTerms = entry.dataset.search === "Character fate" ? `save ${title} keep ${title} alive ${title} survive` : "";
  const terms = normalize(`${entry.dataset.searchTerms || ""} ${types.replace(/\bclue\b/, "clue clues")} ${fateTerms}`);
  return {
    href: `#${entry.id}`,
    title: /^Chapter \d+$/.test(chapter) ? `${chapter} · ${title}` : title,
    label: entry.dataset.search,
    section: section.id,
    name: normalize(title),
    chapter: normalize(chapter),
    scope: normalize(scope),
    terms,
    text: normalize(`${title} ${scope} ${heading} ${parent} ${terms} ${entry.textContent}`),
  };
});
for (const heading of document.querySelectorAll("[data-search] :is(h3, h4, dt)[id]")) {
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
  searchIndex.push({
    href: `#${heading.id}`,
    title,
    label: `${/^Chapter \d+$/.test(chapter) ? chapter : entry.dataset.search} · ${context}`,
    section: entry.closest(".section").id,
    name: normalize(title),
    scope: normalize(chapter),
    detail: true,
    text: normalize(`${chapter} ${context} ${title} ${body}`),
  });
}
let archiveRequest;
let archiveStatus = "";
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
  if (archiveStatus && (!section || section === "epilogue")) searchCount.textContent += ` · ${archiveStatus}`;
  for (const entry of matches.slice(0, resultLimit)) {
    const row = document.createElement("li");
    const link = document.createElement("a");
    const label = document.createElement("small");
    link.href = entry.href;
    link.textContent = entry.title;
    label.textContent = ` · ${entry.label}`;
    link.append(label);
    row.append(link);
    searchResults.append(row);
  }
}

async function loadArchive() {
  try {
    const response = await fetch("epilogue.html");
    if (!response.ok) throw new Error(response.statusText);
    const archive = document.createElement("template");
    archive.innerHTML = await response.text();
    const sections = {
      "Epilogue": "[data-fate], #after-the-night .entry[id], #audit > .entry[id]",
      "Eliza’s speech": "#eliza li[id], #eliza-no-cards",
      "Opening headline": "#headline-asset-intros > li[id]",
      "Closing headline": "#headline-asset-outros > li[id]",
      "Epilogue audit": "#recap-missing dt[id], #recap-file-notes dt[id]",
    };
    for (const [label, selector] of Object.entries(sections)) {
      for (const entry of archive.content.querySelectorAll(selector)) {
        const character = entry.closest("[data-character]")?.querySelector("summary strong").textContent;
        const isTerm = entry.matches("dt");
        const title = isTerm ? entry.textContent : entry.querySelector("h3, summary strong, :scope > strong").textContent;
        const body = isTerm ? entry.nextElementSibling.textContent : entry.textContent;
        searchIndex.push({
          href: `epilogue.html#${entry.id}`,
          title,
          label: character || label,
          section: "epilogue",
          name: normalize(character ? `${character} ${title}` : title),
          text: normalize(`Epilogue ${label} ${character || ""} ${title} ${body}`),
        });
      }
    }
    archiveStatus = "";
  } catch {
    archiveStatus = "Epilogue search unavailable. Browse the epilogue to see those results.";
  }
  const focused = searchResults.contains(document.activeElement) && document.activeElement.getAttribute("href");
  renderSearch();
  if (focused) {
    const result = searchResults.querySelector(`a[href="${CSS.escape(focused)}"]`);
    (result || search).focus({ preventScroll: true });
  }
}

find.hidden = false;
document.querySelector(".search-link").hidden = false;
function updateSearch() {
  if (!archiveRequest && normalize(search.value) && (!searchSection.value || searchSection.value === "epilogue")) {
    archiveStatus = "Loading epilogue results…";
    archiveRequest = loadArchive();
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
  if (link.getAttribute("href").startsWith("#")) {
    const target = document.getElementById(link.hash.slice(1));
    if (target && !target.hasAttribute("tabindex")) target.tabIndex = -1;
  } else {
    history.replaceState({
      ...history.state,
      guideSearch: { query: search.value, section: searchSection.value, limit: resultLimit },
    }, "");
  }
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

const checklist = document.querySelector("#collectibles");
const chapterGroups = Array.from(checklist.querySelectorAll("[data-chapter]"));
const items = Array.from(checklist.querySelectorAll("[data-type]"));
const type = document.querySelector("#item-type");
const chapter = document.querySelector("#item-chapter");
const unchecked = document.querySelector("#unchecked-only");
const progress = document.querySelector("#collect-progress");
const storageKey = "quarry-field-guide-checklist-v1";

try {
  const saved = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  for (const item of items) item.querySelector("input").checked = saved.has(item.id);
} catch {
  // The checklist still works for this visit when storage is unavailable.
}

function filterChecklist() {
  let visible = 0;
  let checked = 0;
  for (const group of chapterGroups) {
    let matches = 0;
    for (const item of group.querySelectorAll("[data-type]")) {
      const isChecked = item.querySelector("input").checked;
      checked += Number(isChecked);
      item.hidden = Boolean(
        (type.value && type.value !== item.dataset.type && type.value !== item.dataset.clueGroup) ||
        (chapter.value && chapter.value !== group.dataset.chapter) ||
        (unchecked.checked && isChecked)
      );
      matches += Number(!item.hidden);
    }
    group.hidden = matches === 0;
    group.querySelector("summary .meta").textContent = `${matches} ${matches === 1 ? "location" : "locations"}`;
    visible += matches;
  }
  progress.textContent = `${checked} of ${items.length} checked across runs. ${visible || "No"} items match these filters.`;
}

document.querySelector("#collect-filters").hidden = false;
progress.hidden = false;
filterChecklist();

checklist.addEventListener("change", event => {
  filterChecklist();
  if (event.target.closest("[data-type]")) {
    try {
      const checked = items.filter(item => item.querySelector("input").checked).map(item => item.id);
      localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      progress.textContent += " Checks could not be saved in this browser.";
    }
  } else if (event.target === chapter && chapter.value) {
    chapterGroups.find(group => group.dataset.chapter === chapter.value).open = true;
  }
});

const awardTracker = document.querySelector("#achievement-checklist");
if (awardTracker) {
  const awardEdition = awardTracker.querySelector("#award-edition");
  const awardUnearned = awardTracker.querySelector("#award-unearned");
  const awardProgress = awardTracker.querySelector("#award-progress");
  const awardList = awardTracker.querySelector(".award-list");
  const awardStorageKey = "quarry-field-guide-achievements-v1";
  let savedAwards = {};
  try {
    savedAwards = JSON.parse(localStorage.getItem(awardStorageKey) || "{}") || {};
  } catch {
    // The tracker still works for this visit.
  }
  const earnedAwards = Object.fromEntries(Array.from(awardEdition.options, ({ value }) => [
    value, new Set(Array.isArray(savedAwards[value]) ? savedAwards[value] : []),
  ]));
  if (Object.hasOwn(earnedAwards, savedAwards.edition)) awardEdition.value = savedAwards.edition;

  const awardRows = Array.from(document.querySelectorAll('#achievements [data-search="Achievement"]'), entry => {
    const row = document.createElement("li");
    const input = document.createElement("input");
    const label = document.createElement("label");
    const link = document.createElement("a");
    input.type = "checkbox";
    input.id = `award-check-${entry.id}`;
    input.value = entry.id;
    label.htmlFor = input.id;
    link.href = `#${entry.id}`;
    link.textContent = "Route";
    row.append(input, label, link);
    awardList.append(row);
    return {
      entry, row, input, label, link,
      name: entry.querySelector("summary strong").textContent,
      points: Number(entry.querySelector("summary .meta").textContent.match(/(\d+)G$/)?.[1] || 0),
    };
  });

  function renderAwards() {
    const edition = awardEdition.value;
    const earned = earnedAwards[edition];
    const xbox = edition.startsWith("xbox-");
    const platformName = xbox ? "awardXbox" : edition === "ps4" ? "awardPs4" : "awardPs5";
    const playStation = edition === "ps4" || edition === "ps5";
    let count = 0;
    let total = 0;
    let score = 0;
    let totalScore = 0;
    for (const { entry, row, input, label, link, name, points } of awardRows) {
      const onList = playStation || entry.id !== "platinum";
      input.checked = earned.has(entry.id);
      row.hidden = !onList || (awardUnearned.checked && input.checked);
      const title = edition === "steam" ? name : entry.dataset[platformName] || name;
      label.textContent = title;
      link.setAttribute("aria-label", `Open ${title} route`);
      if (onList) {
        total++;
        totalScore += points;
        if (input.checked) {
          count++;
          score += points;
        }
      }
    }
    awardProgress.textContent = `${count} of ${total} earned${xbox ? ` · ${score.toLocaleString("en-US")} / ${totalScore.toLocaleString("en-US")}G` : ""}.`;
  }

  awardTracker.addEventListener("change", event => {
    const field = event.target;
    if (awardList.contains(field)) {
      const earned = earnedAwards[awardEdition.value];
      if (field.checked) earned.add(field.value);
      else earned.delete(field.value);
    }
    renderAwards();
    if (awardList.contains(field) && field.closest("li").hidden) {
      let next = field.closest("li").nextElementSibling;
      while (next?.hidden) next = next.nextElementSibling;
      (next?.querySelector("input") || awardUnearned).focus();
    }
    if (field === awardUnearned) return;
    try {
      const saved = Object.fromEntries(Object.entries(earnedAwards).map(([edition, awards]) => [edition, [...awards]]));
      localStorage.setItem(awardStorageKey, JSON.stringify({ ...saved, edition: awardEdition.value }));
    } catch {
      awardProgress.textContent += " Checks could not be saved in this browser.";
    }
  });
  renderAwards();
  awardTracker.hidden = false;
  document.querySelector("#achievement-checklist-link").hidden = false;
}

function revealTarget(hash) {
  const entry = document.getElementById(hash.slice(1));
  if (!entry) return;
  const collectibleGroup = entry.closest("[data-chapter]");
  if (collectibleGroup?.hidden || entry.closest("[data-type]")?.hidden) {
    type.value = "";
    chapter.value = "";
    unchecked.checked = false;
    filterChecklist();
  }
  for (let group = entry.closest("details"); group; group = group.parentElement.closest("details")) {
    group.open = true;
  }
  if (entry === find) search.focus({ preventScroll: true });
}

window.addEventListener("hashchange", () => revealTarget(location.hash));
document.addEventListener("click", event => {
  const link = event.target.closest('a[href^="#"]');
  if (link) revealTarget(link.hash);
});
revealTarget(location.hash);
