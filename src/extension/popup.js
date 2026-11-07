// Opens when Timea clicks the extension icon. Reads the listing Claude put on
// the clipboard, checks it against the shop rules, and fills Etsy's form.
// Never saves or publishes.
import { validate } from '../validate/index.js';
import { parseBannedWords } from '../validate/checks.js';
import rules from '../../rules/listing.rules.json';
import bannedWordsText from '../../rules/banned-words.txt';
import { fillEtsyForm, clearEtsyForm, SELECTORS, ETSY_EDITOR_URL } from './fill.js';

const config = { rules, bannedWords: parseBannedWords(bannedWordsText) };
const statusEl = document.getElementById('status');
const detailsEl = document.getElementById('details');
const again = document.getElementById('again');

function show(text, kind = '', details = []) {
  statusEl.className = kind;
  statusEl.textContent = text;
  detailsEl.replaceChildren(...details.map((d) => {
    const li = document.createElement('li');
    li.textContent = d;
    return li;
  }));
}

// Pasting into a hidden box works as soon as the popup opens (it needs the
// clipboardRead permission). navigator.clipboard often fails at that moment
// because the popup is not focused yet, so it is only the fallback.
async function readClipboard() {
  const box = document.createElement('textarea');
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.append(box);
  box.focus();
  const pasted = document.execCommand('paste');
  const text = box.value;
  box.remove();
  if (pasted && text) return text;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

function parseListing(text) {
  try {
    const doc = JSON.parse(text);
    return doc && typeof doc === 'object' && 'title' in doc && 'tags' in doc ? doc : null;
  } catch {
    return null;
  }
}

const pasteBox = document.getElementById('paste');
const pasteLabel = document.getElementById('paste-label');

function offerPasteBox() {
  pasteLabel.hidden = false;
  pasteBox.hidden = false;
  pasteBox.value = '';
  pasteBox.focus();
}

// First try the clipboard on its own; if that fails, show the paste box.
async function run() {
  const text = await readClipboard();
  const listing = text === null ? null : parseListing(text);
  if (!listing) {
    show('Paste the listing from Claude into the box below.', 'error');
    return offerPasteBox();
  }
  await fill(listing);
}

pasteBox.addEventListener('input', () => {
  if (!pasteBox.value.trim()) return;
  const listing = parseListing(pasteBox.value);
  if (!listing) {
    return show('That is not the whole listing. Copy the complete block from Claude and paste it again.', 'error');
  }
  fill(listing);
});

async function fill(listing) {
  const failed = validate(listing, config, { type: 'listing' }).results.filter((r) => r.status === 'fail');
  if (failed.length) {
    return show('Not filled. This listing breaks a shop rule. Ask Claude to fix:', 'error',
      failed.map((r) => `${r.label}: ${r.detail}`));
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !ETSY_EDITOR_URL.test(tab.url || '')) {
    return show('Open "Add a listing" on Etsy first, then click the extension again.', 'error');
  }

  show('Filling...');
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillEtsyForm,
      args: [listing, SELECTORS, rules.fillDefaults],
    });
    if (result.notFound.length) {
      show(`Filled ${result.filled.join(', ')}. Could not find on the page: ${result.notFound.join(', ')}. Tell Claude which ones.`, 'error');
    } else {
      show('Done. Check the form, add photos, files, and price, then save.', 'ok', [listing.title]);
    }
  } catch (err) {
    show(`Could not fill the form: ${err.message}`, 'error');
  }
  pasteLabel.hidden = true;
  pasteBox.hidden = true;
}

again.addEventListener('click', run);

// Empties title, description, basket summary, quantity, and tags.
document.getElementById('clear').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !ETSY_EDITOR_URL.test(tab.url || '')) {
    return show('Open the Etsy listing page first, then click Clear form.', 'error');
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: clearEtsyForm,
      args: [SELECTORS],
    });
    const parts = [`Cleared ${result.cleared.join(', ') || 'nothing'}`];
    if (result.tagsRemoved) parts.push(`removed ${result.tagsRemoved} tags`);
    let message = `${parts.join(' and ')}.`;
    if (result.tagsLeft || (!result.tagsRemoved && !result.notFound.includes('Tags'))) {
      message += ' If any tags are still there, remove them with their x, and tell Claude.';
    }
    if (result.notFound.length) message += ` Could not find: ${result.notFound.join(', ')}.`;
    show(message, result.tagsLeft || result.notFound.length ? 'error' : 'ok');
    pasteLabel.hidden = true;
    pasteBox.hidden = true;
  } catch (err) {
    show(`Could not clear the form: ${err.message}`, 'error');
  }
});
