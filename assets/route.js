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
  if (step?.matches('details.route-pickup')) step.open = true;
}

window.addEventListener('hashchange', openLinkedStep);
openLinkedStep();
