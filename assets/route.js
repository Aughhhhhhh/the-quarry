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
const routeOptions = document.querySelector('.route-options');
if (routeOptions) routeOptions.hidden = false;

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

function jumpToStep(step) {
  const pickup = step.closest('details.route-pickup');
  if (pickup) pickup.open = true;
  location.hash = step.id;
  const focus = step.querySelector(':scope > summary') || step;
  if (focus === step) step.tabIndex = -1;
  focus.focus({preventScroll: true});
  step.scrollIntoView();
}

const routeIndex = document.querySelector('.route-index');
if (routeIndex) {
  const jump = document.createElement('form');
  const destination = document.createElement('select');
  const go = document.createElement('button');
  jump.className = 'route-jump';
  destination.setAttribute('aria-label', 'Jump to chapter or route');
  destination.required = true;
  destination.add(new Option('Jump to chapter or route', ''));
  for (const link of routeIndex.querySelectorAll('nav a')) {
    destination.add(new Option(link.textContent.trim(), link.getAttribute('href')));
  }
  go.className = 'button secondary';
  go.type = 'submit';
  go.textContent = 'Go';
  jump.append(destination, go);
  routeIndex.append(jump);
  jump.addEventListener('submit', event => {
    event.preventDefault();
    const href = destination.value;
    if (!href.startsWith('#')) {
      location.assign(href);
      return;
    }
    const step = document.getElementById(href.slice(1));
    if (step) jumpToStep(step);
  });
}

const pickupFinder = document.querySelector('#pickup-index form');
if (pickupFinder) {
  const select = pickupFinder.querySelector('#route-item');
  const branch = pickupFinder.querySelector('select[name]');
  const placeholder = select.firstElementChild;
  function listPickups() {
    select.replaceChildren(placeholder);
    select.value = '';
    const start = Number(branch?.selectedOptions[0].dataset.start || 0);
    for (const [type, label] of [['tarot', 'Tarot cards'], ['evidence', 'Evidence'], ['clue', 'Clues']]) {
      const group = document.createElement('optgroup');
      group.label = label;
      const clue = type === 'clue';
      for (const step of document.querySelectorAll(`[id^="${type}-"]`)) {
        if (!(clue ? /^clue-[cfh]\d+$/ : /-\d+$/).test(step.id)) continue;
        const section = step.closest('section');
        const branches = step.dataset.pickupBranches;
        if (branch?.value && branches && !branches.split(' ').includes(branch.value)) continue;
        if (start && Number(section.id.split('-')[1]) < start) continue;
        const [prefix, title] = clue
          ? ['', step.dataset.pickupName || step.querySelector('strong').textContent.replace(/\.$/, '')]
          : step.querySelector('summary').textContent.trim().split(' · ');
        const chapter = section.querySelector('.eyebrow')?.textContent.split(' · ')[0] || prefix;
        group.append(new Option(`${chapter} · ${title}`, step.id));
      }
      if (group.children.length) select.append(group);
    }
  }

  if (branch) {
    const preset = new URLSearchParams(location.search).get(branch.name);
    if (Array.from(branch.options).some(option => option.value === preset)) branch.value = preset;
    branch.addEventListener('change', listPickups);
  }
  listPickups();
  pickupFinder.addEventListener('submit', event => {
    event.preventDefault();
    jumpToStep(document.getElementById(select.value));
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
