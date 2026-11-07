const find = document.querySelector("#find");
const search = document.querySelector("#search");
const searchResults = document.querySelector("#search-results");
const searchCount = document.querySelector("#search-count");
const normalize = value => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
const searchIndex = Array.from(document.querySelectorAll("[data-search]"), entry => {
  const title = entry.querySelector("summary strong, label, h3").textContent;
  const heading = entry.closest(".section").querySelector("h2").textContent;
  const parent = entry.matches(".collectible") ? entry.closest("details").querySelector("summary strong").textContent : "";
  return {
    id: entry.id,
    title,
    label: entry.dataset.search,
    name: normalize(title),
    text: normalize(`${heading} ${parent} ${entry.textContent}`),
  };
});

find.hidden = false;
document.querySelector(".search-link").hidden = false;
search.addEventListener("input", () => {
  const query = normalize(search.value);
  searchResults.replaceChildren();
  searchCount.textContent = "";
  if (!query) return;
  const words = query.split(/\s+/);
  const matches = searchIndex.filter(entry => words.every(word => entry.text.includes(word)));
  const rank = entry => entry.name === query ? 2 : Number(entry.name.includes(query));
  matches.sort((a, b) => rank(b) - rank(a));
  searchCount.textContent = matches.length > 12
    ? `Showing 12 of ${matches.length} matches. Add another word to narrow the list.`
    : matches.length === 1 ? "1 match" : `${matches.length} matches`;
  for (const entry of matches.slice(0, 12)) {
    const row = document.createElement("li");
    const link = document.createElement("a");
    const label = document.createElement("small");
    link.href = `#${entry.id}`;
    link.textContent = entry.title;
    label.textContent = ` · ${entry.label}`;
    link.append(label);
    row.append(link);
    searchResults.append(row);
  }
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
        (type.value && type.value !== item.dataset.type) ||
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
