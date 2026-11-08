const checklist = document.querySelector("#collectibles");
const chapterGroups = Array.from(checklist?.querySelectorAll("[data-chapter]") || []);
const items = Array.from(checklist?.querySelectorAll("[data-type]") || []);
const type = document.querySelector("#item-type");
const chapter = document.querySelector("#item-chapter");
const unchecked = document.querySelector("#unchecked-only");
const progress = document.querySelector("#collect-progress");
const storageKey = "quarry-field-guide-checklist-v1";

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

if (checklist) {
  try {
    const saved = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    for (const item of items) item.querySelector("input").checked = saved.has(item.id);
  } catch {
    // The checklist still works for this visit when storage is unavailable.
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
}

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
}

window.addEventListener("hashchange", () => revealTarget(location.hash));
document.addEventListener("click", event => {
  const link = event.target.closest('a[href^="#"]');
  if (link) revealTarget(link.hash);
});
revealTarget(location.hash);
