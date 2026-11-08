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
