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
  const routeSearch = document.querySelector('.site-header .search-link');
  destination.add(new Option('Search this walkthrough', routeSearch.getAttribute('href')));
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
  const submit = pickupFinder.querySelector('button[type="submit"]');
  const filterField = document.createElement('div');
  const filterLabel = document.createElement('label');
  const filter = document.createElement('input');
  const count = document.createElement('p');
  filter.id = 'pickup-filter';
  filter.type = 'search';
  filter.autocomplete = 'off';
  filter.placeholder = 'Name, chapter, or type';
  filterLabel.htmlFor = filter.id;
  filterLabel.textContent = 'Filter pickups';
  filterField.append(filterLabel, filter);
  select.parentElement.before(filterField);
  count.className = 'meta';
  count.setAttribute('role', 'status');
  pickupFinder.after(count);

  const normalize = value => value.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  function listPickups() {
    select.replaceChildren(placeholder);
    select.value = '';
    const start = Number(branch?.selectedOptions[0].dataset.start || 0);
    const terms = normalize(filter.value).split(' ').filter(Boolean);
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
        const words = normalize(`${chapter} ${title} ${label}`).split(' ');
        if (!terms.every(term => /^\d+$/.test(term) ? words.includes(term) : words.some(word => word.startsWith(term)))) continue;
        group.append(new Option(`${chapter} · ${title}`, step.id));
      }
      if (group.children.length) select.append(group);
    }
    const matches = select.options.length - 1;
    if (terms.length && matches === 1) select.selectedIndex = 1;
    select.disabled = submit.disabled = matches === 0;
    count.textContent = matches ? `${matches} ${matches === 1 ? 'pickup' : 'pickups'} on this route.` : 'No matching pickups on this route.';
  }

  if (branch) {
    const preset = new URLSearchParams(location.search).get(branch.name);
    if (Array.from(branch.options).some(option => option.value === preset)) branch.value = preset;
    branch.addEventListener('change', listPickups);
  }
  filter.addEventListener('input', listPickups);
  listPickups();
  pickupFinder.addEventListener('submit', event => {
    event.preventDefault();
    const step = document.getElementById(select.value);
    if (step) jumpToStep(step);
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
