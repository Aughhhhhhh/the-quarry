const filters = document.querySelector("#fate-filters");
const search = document.querySelector("#fate-search");
const character = document.querySelector("#fate-character");
const outcome = document.querySelector("#fate-outcome");
const count = document.querySelector("#fate-count");
const groups = Array.from(document.querySelectorAll("[data-character]"), group => ({
  group,
  label: group.querySelector("summary .meta"),
  cards: Array.from(group.querySelectorAll("[data-fate]"), card => ({
    card,
    text: `${group.querySelector("summary strong").textContent} ${card.textContent}`.toLowerCase(),
  })),
}));

function filterCards() {
  const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtering = terms.length || character.value || outcome.value;
  let total = 0;
  for (const { group, label, cards } of groups) {
    const personMatches = !character.value || character.value === group.dataset.character;
    let visible = 0;
    for (const { card, text } of cards) {
      const fateMatches = !outcome.value || outcome.value === card.dataset.fate;
      card.hidden = !(personMatches && fateMatches && terms.every(term => text.includes(term)));
      visible += Number(!card.hidden);
    }
    group.hidden = visible === 0;
    if (filtering && visible) group.open = true;
    label.textContent = `${visible} ${visible === 1 ? "record" : "records"}`;
    total += visible;
  }
  count.textContent = `${total} ${total === 1 ? "record" : "records"} shown`;
}

function revealCard() {
  const target = document.getElementById(location.hash.slice(1));
  const group = target?.closest("details");
  if (!group) return;
  if (target.hidden || group.hidden) {
    search.value = "";
    character.value = "";
    outcome.value = "";
    filterCards();
  }
  for (let details = group; details; details = details.parentElement.closest("details")) {
    details.open = true;
  }
}

filters.hidden = false;
count.hidden = false;
filters.addEventListener("input", filterCards);
window.addEventListener("hashchange", revealCard);
filterCards();
revealCard();

const evidenceList = document.querySelector("#podcast-evidence-order");
const evidenceOptions = Array.from(evidenceList.querySelectorAll("input"));
const preview = document.querySelector("#podcast-preview");
const previewCount = preview.querySelector("strong");
const previewLink = preview.querySelector("a");

function updateEvidencePreview() {
  const selected = evidenceOptions.filter(item => item.checked);
  let target = "#closing-camp-closed";
  let headline = "The summer camp closes for good";
  if (selected.length === evidenceOptions.length) {
    target = "#closing-all-evidence";
    headline = "Use your opening headline to find the closing";
  } else if (selected.filter(item => item.name === "hiker").length === 3) {
    target = "#closing-hiker-evidence";
    headline = "Hiker remains recovered. Check which Hacketts survive";
  } else if (selected.some(item => item.name === "animal")) {
    target = "#closing-animal-evidence";
    headline = "Unidentified animals are loose in North Kill Forest";
  } else if (selected.some(item => item.name === "kaylee")) {
    target = "#closing-kaylee-letter";
    headline = "Evidence describes Kaylee’s private struggles";
  }
  previewCount.textContent = `${selected.length} of ${evidenceOptions.length} selected`;
  previewLink.href = target;
  previewLink.textContent = headline;
}

for (const item of evidenceOptions) item.hidden = false;
document.querySelector("#podcast-preview-instructions").hidden = false;
preview.hidden = false;
evidenceList.addEventListener("change", updateEvidencePreview);
updateEvidencePreview();
