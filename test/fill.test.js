import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT, loadConfig } from '../src/validate/rules.js';
import { fillEtsyForm, clearEtsyForm, SELECTORS, ETSY_EDITOR_URL } from '../src/extension/fill.js';

// A tiny stand-in for Etsy's page: enough elements for fillEtsyForm to use.
class FakeField extends EventTarget {
  constructor() { super(); this._value = ''; this.events = []; }
  dispatchEvent(e) { this.events.push(e.type); return super.dispatchEvent(e); }
}
class FakeInput extends FakeField {}
class FakeTextArea extends FakeField {}
for (const C of [FakeInput, FakeTextArea]) {
  Object.defineProperty(C.prototype, 'value', {
    get() { return this._value; },
    set(v) { this._value = v; },
  });
}

function fakePage({ without = [] } = {}) {
  const tags = [];
  const els = {
    [SELECTORS.title]: new FakeTextArea(),
    [SELECTORS.description]: new FakeTextArea(),
    [SELECTORS.basketSummary]: new FakeTextArea(),
    [SELECTORS.quantity]: new FakeInput(),
    [SELECTORS.tagInput]: new FakeInput(),
  };
  els[SELECTORS.tagAddButton] = { click: () => { tags.push(els[SELECTORS.tagInput].value); els[SELECTORS.tagInput].value = ''; } };
  for (const sel of without) delete els[sel];
  globalThis.document = { querySelector: (sel) => els[sel] || null };
  return { els, tags };
}

const listing = JSON.parse(readFileSync(resolve(REPO_ROOT, 'data/samples/cozy-christmas-listing.json'), 'utf8'));
const { rules } = loadConfig();

describe('fillEtsyForm', () => {
  before(() => {
    globalThis.HTMLInputElement = FakeInput;
    globalThis.HTMLTextAreaElement = FakeTextArea;
  });

  test('fills title, description, basket summary, quantity 999, and all 13 tags', async () => {
    const { els, tags } = fakePage();
    const report = await fillEtsyForm(listing, SELECTORS, rules.fillDefaults);
    assert.equal(els[SELECTORS.title].value, listing.title);
    assert.equal(els[SELECTORS.description].value, listing.description);
    assert.equal(els[SELECTORS.basketSummary].value, listing.basketSummary);
    assert.equal(els[SELECTORS.quantity].value, '999');
    assert.deepEqual(tags, listing.tags);
    assert.deepEqual(els[SELECTORS.title].events, ['input', 'change']);
    assert.deepEqual(report.notFound, []);
    assert.deepEqual(report.filled, ['Title', 'Description', 'Shopping basket summary', 'Quantity', '13 tags']);
  });

  test('reports boxes it cannot find instead of failing silently', async () => {
    fakePage({ without: [SELECTORS.description, SELECTORS.tagAddButton] });
    const report = await fillEtsyForm(listing, SELECTORS, rules.fillDefaults);
    assert.deepEqual(report.notFound, ['Description', 'Tags']);
  });

  test('quantity default comes from rules/listing.rules.json', () => {
    assert.equal(rules.fillDefaults.quantity, 999);
  });
});

test('Fill only runs on Etsy listing editor pages', () => {
  assert.match('https://www.etsy.com/your/shops/me/listing-editor/create', ETSY_EDITOR_URL);
  assert.match('https://www.etsy.com/your/shops/me/listing-editor/edit/4610528504', ETSY_EDITOR_URL);
  assert.doesNotMatch('https://www.etsy.com/listing/4610528504/cozy-christmas', ETSY_EDITOR_URL);
  assert.doesNotMatch('https://evil.example/www.etsy.com/your/shops/me/listing-editor/', ETSY_EDITOR_URL);
});

// Uses the saved Etsy page in private/ (not on GitHub). Skipped when it's missing.
const savedPage = resolve(REPO_ROOT, 'private/etsy-listing.html');
test('every selector exists on the saved Etsy page', { skip: !existsSync(savedPage) && 'no saved page in private/' }, () => {
  const html = readFileSync(savedPage, 'utf8');
  for (const [name, sel] of Object.entries(SELECTORS)) {
    assert.ok(html.includes(`id="${sel.slice(1)}"`), `${name} (${sel}) not on the saved page`);
  }
});

// A small tree of elements, enough for clearEtsyForm to search for tag chips.
class Node {
  constructor(tag, attrs = {}) {
    this.tag = tag; this.attrs = attrs; this.children = []; this.parentElement = null;
    this.id = attrs.id || ''; this.title = attrs.title || ''; this.textContent = attrs.text || '';
    this.clicked = 0;
  }
  append(...kids) { for (const k of kids) { k.parentElement = this; this.children.push(k); } return this; }
  remove() { const p = this.parentElement; p.children = p.children.filter((c) => c !== this); this.parentElement = null; }
  contains(n) { return n === this || this.children.some((c) => c.contains(n)); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  querySelectorAll(tag) { return this.children.flatMap((c) => [...(c.tag === tag ? [c] : []), ...c.querySelectorAll(tag)]); }
  click() { this.clicked += 1; this.onclick?.(); }
}

describe('clearEtsyForm', () => {
  function pageWithTags(tagNames) {
    // Real fake fields (so events work), given just enough tree methods.
    const leaf = (el) => Object.assign(el, { tag: 'field', children: [], parentElement: null,
      contains(n) { return n === this; }, querySelectorAll() { return []; } });
    const title = leaf(new FakeTextArea());
    title.value = 'Old title';
    const tagInput = leaf(new FakeInput());
    const addButton = new Node('button', { id: 'listing-tags-button', text: 'Add' });
    const photoDelete = new Node('button', { 'aria-label': 'Delete photo' });
    const chips = new Node('ul');
    for (const name of tagNames) {
      const chip = new Node('li');
      const x = new Node('button', { 'aria-label': `Remove ${name}` });
      x.onclick = () => chip.remove();
      chips.append(chip.append(x));
    }
    const tagsSection = new Node('div').append(new Node('div').append(tagInput, addButton), chips);
    const detailsSection = new Node('section').append(title, tagsSection);
    const root = new Node('main').append(new Node('section').append(photoDelete), detailsSection);
    const els = {
      [SELECTORS.title]: title,
      [SELECTORS.tagInput]: tagInput,
      [SELECTORS.tagAddButton]: addButton,
    };
    globalThis.document = { querySelector: (sel) => els[sel] || null };
    return { title, chips, photoDelete, addButton, root };
  }

  test('empties the text boxes and removes every tag chip, without touching photos', async () => {
    const { title, chips, photoDelete, addButton } = pageWithTags(['snow brushes', 'ipad brush', 'brush set']);
    const report = await clearEtsyForm(SELECTORS);
    assert.equal(title.value, '');
    assert.equal(chips.children.length, 0);
    assert.equal(report.tagsRemoved, 3);
    assert.equal(report.tagsLeft, false);
    assert.equal(photoDelete.clicked, 0);
    assert.equal(addButton.clicked, 0);
    assert.deepEqual(report.cleared, ['Title']);
    assert.deepEqual(report.notFound, ['Description', 'Shopping basket summary', 'Quantity']);
  });

  test('with no tags on the page, nothing is clicked', async () => {
    const { photoDelete } = pageWithTags([]);
    const report = await clearEtsyForm(SELECTORS);
    assert.equal(report.tagsRemoved, 0);
    assert.equal(photoDelete.clicked, 0);
  });
});
