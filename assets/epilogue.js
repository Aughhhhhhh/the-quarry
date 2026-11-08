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
  const filtered = target.closest("[hidden]");
  if (filtered) {
    search.value = "";
    character.value = "";
    outcome.value = "";
    filterCards();
  }
  for (let details = group; details; details = details.parentElement.closest("details")) {
    details.open = true;
  }
  if (filtered) {
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView();
  }
}

filters.hidden = false;
count.hidden = false;
filters.addEventListener("input", filterCards);
window.addEventListener("hashchange", revealCard);
document.addEventListener("click", event => {
  const link = event.target.closest('a[href^="#"]');
  if (link?.hash === location.hash && !event.defaultPrevented &&
      !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) revealCard();
});
filterCards();
revealCard();

const evidenceList = document.querySelector("#podcast-evidence-order");
const evidenceOptions = Array.from(evidenceList.querySelectorAll("input"));
const preview = document.querySelector("#podcast-preview");
const previewCount = preview.querySelector("strong");
const previewMessage = preview.querySelector("span");
const previewLink = preview.querySelector("a");
const opening = document.querySelector("#podcast-opening");
const caleb = document.querySelector("#podcast-caleb");
const hikers = document.querySelector("#podcast-hikers");
const hikerChoice = document.querySelector("#podcast-hiker-choice");
const openingClosings = new Map(Array.from(
  document.querySelectorAll("#headline-asset-outros a[href^='#opening-']"),
  link => [link.hash.slice(1), link.closest("li").id],
));

for (const item of document.querySelectorAll("#headline-asset-intros > li")) {
  opening.add(new Option(item.dataset.previewLabel || item.querySelector("strong").textContent, item.id));
}

function updateEvidencePreview() {
  const selected = evidenceOptions.filter(item => item.checked);
  const allEvidence = selected.length === evidenceOptions.length;
  const needCaleb = allEvidence && opening.value === "opening-no-soul";
  const needHikers = !allEvidence && selected.filter(item => item.name === "hiker").length === 3;
  opening.parentElement.hidden = !allEvidence;
  caleb.parentElement.hidden = !needCaleb;
  hikerChoice.hidden = !needHikers;

  let target = "closing-camp-closed";
  let message = "";
  if (needCaleb) {
    target = caleb.value;
    if (!target) message = "Choose whether Caleb survived.";
  } else if (allEvidence) {
    target = openingClosings.get(opening.value);
    if (!target) message = "Choose the opening newspaper from the credits.";
    if (opening.value === "opening-drowning") {
      message = "Jacob’s drowning prevents the Chapter 6 Memory Card pickup. ";
    }
  } else if (needHikers) {
    target = hikers.value;
    if (!target) message = "Choose how many of the six Hacketts survived.";
  } else if (selected.some(item => item.name === "animal")) {
    target = "closing-animal-evidence";
  } else if (selected.some(item => item.name === "kaylee")) {
    target = "closing-kaylee-letter";
  }
  previewCount.textContent = `${selected.length} of ${evidenceOptions.length} selected`;
  previewMessage.textContent = message;
  previewLink.hidden = !target;
  if (target) {
    previewLink.href = `#${target}`;
    previewLink.textContent = target === "closing-teen-and-hikers"
      ? "See the unused newspaper"
      : document.getElementById(target).querySelector("strong").textContent;
  }
}

for (const item of evidenceOptions) item.hidden = false;
document.querySelector("#podcast-preview-instructions").hidden = false;
preview.hidden = false;
evidenceList.addEventListener("change", updateEvidencePreview);
for (const choice of [opening, caleb, hikers]) {
  choice.addEventListener("change", updateEvidencePreview);
}
updateEvidencePreview();
