// Fills Etsy's "Add a listing" form. Runs inside the Etsy tab via
// chrome.scripting.executeScript, so fillEtsyForm must not use anything
// outside its own body. Selectors and defaults are passed in as arguments.
// It never clicks Save or Publish.

// Field ids from Etsy's listing editor, checked against a saved copy of the
// page on 7 Nov 2026. If Etsy changes the page, update these.
export const SELECTORS = {
  title: '#listing-title-input',
  description: '#listing-description-textarea',
  basketSummary: '#compliance-summary-textarea',
  quantity: '#listing-quantity-input',
  tagInput: '#listing-tags-input',
  tagAddButton: '#listing-tags-button',
};

export const ETSY_EDITOR_URL = /^https:\/\/www\.etsy\.com\/your\/shops\/[^/]+\/listing-editor\//;

export async function fillEtsyForm(listing, selectors, defaults) {
  const report = { filled: [], notFound: [] };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Etsy's page only notices a change if the value is set the way typing sets it.
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const fields = [
    ['Title', selectors.title, listing.title],
    ['Description', selectors.description, listing.description],
    ['Shopping basket summary', selectors.basketSummary, listing.basketSummary],
    ['Quantity', selectors.quantity, String(defaults.quantity)],
  ];
  for (const [label, selector, value] of fields) {
    if (typeof value !== 'string') continue;
    const el = document.querySelector(selector);
    if (!el) { report.notFound.push(label); continue; }
    setValue(el, value);
    report.filled.push(label);
  }

  const tagInput = document.querySelector(selectors.tagInput);
  const addButton = document.querySelector(selectors.tagAddButton);
  if (!tagInput || !addButton) {
    report.notFound.push('Tags');
  } else {
    for (const tag of listing.tags || []) {
      setValue(tagInput, tag);
      await sleep(80);
      addButton.click();
      await sleep(150);
    }
    report.filled.push(`${(listing.tags || []).length} tags`);
  }

  return report;
}

// Empties the boxes fillEtsyForm fills, and removes the tag chips. Like
// fillEtsyForm, it runs inside the Etsy tab and must be self-contained.
export async function clearEtsyForm(selectors) {
  const report = { cleared: [], notFound: [], tagsRemoved: 0, tagsLeft: false };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  for (const [label, selector] of [
    ['Title', selectors.title],
    ['Description', selectors.description],
    ['Shopping basket summary', selectors.basketSummary],
    ['Quantity', selectors.quantity],
  ]) {
    const el = document.querySelector(selector);
    if (!el) { report.notFound.push(label); continue; }
    setValue(el, '');
    report.cleared.push(label);
  }

  // Tag chips sit near the tag box. Search upward from the tag box, but stop
  // before reaching the area that also holds the title, so no other part of
  // the form (photos, variations) is touched.
  const tagInput = document.querySelector(selectors.tagInput);
  const title = document.querySelector(selectors.title);
  if (!tagInput) {
    report.notFound.push('Tags');
    return report;
  }
  let area = tagInput.parentElement;
  while (area.parentElement && !(title && area.parentElement.contains(title))) {
    area = area.parentElement;
  }
  const removeButtons = () => [...area.querySelectorAll('button')].filter((b) => {
    const name = `${b.getAttribute('aria-label') || ''} ${b.title || ''} ${b.textContent || ''}`;
    return /remove|delete|entfernen|löschen/i.test(name) && b.id !== selectors.tagAddButton.slice(1);
  });
  for (let i = 0; i < 20; i++) {
    const [next] = removeButtons();
    if (!next) break;
    next.click();
    report.tagsRemoved += 1;
    await sleep(120);
  }
  report.tagsLeft = removeButtons().length > 0;
  return report;
}
