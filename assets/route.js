for (const button of document.querySelectorAll('[data-pickups]')) {
  const type = button.dataset.pickups;
  const pickups = Array.from(document.querySelectorAll(`details[id^="${type}-"]`));
  const update = () => {
    const open = pickups.every(pickup => pickup.open);
    button.textContent = `${open ? 'Hide' : 'Show'} all ${type} steps`;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => {
    const open = !pickups.every(pickup => pickup.open);
    for (const pickup of pickups) pickup.open = open;
    update();
  });
  for (const pickup of pickups) pickup.addEventListener('toggle', update);
  update();
}
document.querySelector('.route-options').hidden = false;

function openLinkedStep() {
  const step = document.getElementById(location.hash.slice(1));
  const pickup = step?.closest('details.route-pickup');
  if (pickup && !pickup.open) {
    pickup.open = true;
    if (step !== pickup) step.scrollIntoView();
  }
}

window.addEventListener('hashchange', openLinkedStep);
openLinkedStep();

const pickupFinder = document.querySelector('#pickup-index form');
if (pickupFinder) {
  const select = pickupFinder.querySelector('#route-item');
  const replay = pickupFinder.querySelector('#pickup-replay');
  const placeholder = select.firstElementChild;
  function listPickups() {
    select.replaceChildren(placeholder);
    select.value = '';
    const start = Number(replay?.selectedOptions[0].dataset.start || 0);
    for (const [type, label] of [['tarot', 'Tarot cards'], ['evidence', 'Evidence'], ['clue', 'Clues']]) {
      const group = document.createElement('optgroup');
      group.label = label;
      const clue = type === 'clue';
      for (const step of document.querySelectorAll(`[id^="${type}-"]`)) {
        if (!(clue ? /^clue-[cfh]\d+$/ : /-\d+$/).test(step.id)) continue;
        const section = step.closest('section');
        if (start) {
          const chapterNumber = Number(section.id.split('-')[1]);
          const replays = step.dataset.pickupReplays?.split(' ');
          if (chapterNumber < start || (replays && !replays.includes(replay.value))) continue;
        }
        const [prefix, title] = clue
          ? ['', step.dataset.pickupName || step.querySelector('strong').textContent.replace(/\.$/, '')]
          : step.querySelector('summary').textContent.trim().split(' · ');
        const chapter = section.querySelector('.eyebrow')?.textContent.split(' · ')[0] || prefix;
        group.append(new Option(`${chapter} · ${title}`, step.id));
      }
      if (group.children.length) select.append(group);
    }
  }

  if (replay) {
    const survivor = new URLSearchParams(location.search).get('survivor');
    if (Array.from(replay.options).some(option => option.value === survivor)) replay.value = survivor;
    replay.addEventListener('change', listPickups);
  }
  listPickups();
  pickupFinder.addEventListener('submit', event => {
    event.preventDefault();
    const step = document.getElementById(select.value);
    step.closest('details.route-pickup').open = true;
    location.hash = step.id;
    const focus = step.querySelector('summary') || step;
    if (focus === step) step.tabIndex = -1;
    focus.focus({preventScroll: true});
    step.scrollIntoView();
  });
  pickupFinder.hidden = false;
}

const routeChecklist = document.querySelector('#route-checklist');
if (routeChecklist) {
  const boxes = Array.from(routeChecklist.querySelectorAll('input[type="checkbox"]'));
  const progress = routeChecklist.querySelector('[data-route-progress]');
  const reset = routeChecklist.querySelector('[data-route-reset]');
  const key = 'quarry-rough-night-checklist-v1';

  try {
    const saved = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    for (const box of boxes) box.checked = saved.has(box.value);
  } catch {
    // Keep the checklist usable if storage is blocked or contains invalid data.
  }

  const update = () => {
    const checked = boxes.filter(box => box.checked).map(box => box.value);
    progress.textContent = `${checked.length} of ${boxes.length} checked`;
    return checked;
  };
  const save = () => {
    const checked = update();
    try {
      localStorage.setItem(key, JSON.stringify(checked));
    } catch {
      // Progress still updates for this visit.
    }
  };

  routeChecklist.addEventListener('change', save);
  reset.addEventListener('click', () => {
    for (const box of boxes) box.checked = false;
    save();
  });
  progress.hidden = reset.hidden = false;
  update();
}
