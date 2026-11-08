const find = document.querySelector("#find");
const search = document.querySelector("#search");
const searchSection = document.querySelector("#search-section");
const searchResults = document.querySelector("#search-results");
const searchCount = document.querySelector("#search-count");
const searchMore = document.querySelector("#search-more");
const resultPageSize = 12;
const normalize = value => value.toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const searchIndex = Array.from(document.querySelectorAll("[data-search]"), entry => {
  const title = entry.querySelector("summary strong, label, h3").textContent;
  const section = entry.closest(".section");
  const heading = section.querySelector("h2").textContent;
  const parent = entry.matches(".collectible") ? entry.closest("details").querySelector("summary strong").textContent : "";
  const chapter = entry.dataset.search === "Walkthrough" ? entry.querySelector("summary .meta").textContent : "";
  return {
    href: `#${entry.id}`,
    title: /^Chapter \d+$/.test(chapter) ? `${chapter} · ${title}` : title,
    label: entry.dataset.search,
    section: section.id,
    name: normalize(title),
    chapter: normalize(chapter),
    text: normalize(`${title} ${chapter} ${heading} ${parent} ${entry.textContent}`),
  };
});
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
  const words = query.split(" ");
  const section = searchSection.value;
  const matches = searchIndex.filter(entry => (!section || entry.section === section) &&
    words.every(word => /^\d+$/.test(word)
      ? ` ${entry.text} `.includes(` ${word} `)
      : entry.text.includes(word)));
  function rank(entry) {
    if (entry.chapter === query) return 5;
    if (entry.name === query) return 4;
    if (entry.name.includes(query)) return 3;
    if (words.every(word => ` ${entry.name} `.includes(` ${word} `))) return 2;
    return Number(entry.text.includes(query));
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
  resultLimit = resultPageSize;
  if (!archiveRequest && normalize(search.value) && (!searchSection.value || searchSection.value === "epilogue")) {
    archiveStatus = "Loading epilogue results…";
    archiveRequest = loadArchive();
  }
  renderSearch();
}
search.addEventListener("input", updateSearch);
searchSection.addEventListener("change", updateSearch);
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
