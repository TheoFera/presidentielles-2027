// Ces classes, styles et attributs appartiennent au composant qui les met à jour.
// Le cache évite aussi les lectures répétées du DOM pendant une image.
const values = new WeakMap();
function changed(element, key, value) {
  let previous = values.get(element);
  if (!previous) { previous = new Map(); values.set(element, previous); }
  if (previous.has(key) && previous.get(key) === value) return false;
  previous.set(key, value); return true;
}

export function setHidden(element, hidden) {
  if (element.hidden !== hidden) element.hidden = hidden;
}
export function setClass(element, name, active) {
  if (changed(element, `class:${name}`, active)) element.classList.toggle(name, active);
}
export function setStyle(element, name, value) {
  if (changed(element, `style:${name}`, value)) element.style.setProperty(name, value);
}
export function setAttribute(element, name, value) {
  if (changed(element, `attribute:${name}`, value)) element.setAttribute(name, value);
}
