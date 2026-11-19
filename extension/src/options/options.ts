// Settings page: language, presets, pets, AI prompt, pet import.
import { applyI18n, t } from '../shared/i18n';
import { normalizePattern } from '../shared/match';
import { buildPrompt, manifestFor, normalizeSheet, slug, spriteKeyframes, spriteStyle, validateManifest } from '../shared/pets';
import { addCustomPet, getPets, getSettings, removeCustomPet, saveSettings } from '../shared/storage';
import type { Command, Preset, Settings } from '../shared/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let settings: Settings;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props) as HTMLElementTagNameMap[K];
  node.append(...kids);
  return node;
}

// ---------- general ----------

function bindGeneral(): void {
  const lang = $<HTMLSelectElement>('lang');
  const grace = $<HTMLInputElement>('grace');
  const idle = $<HTMLInputElement>('idle');
  lang.value = settings.lang;
  grace.value = String(settings.graceSeconds);
  idle.value = String(settings.idleMinutes);

  lang.onchange = async () => {
    settings.lang = lang.value as Settings['lang'];
    await saveSettings(settings);
    renderAll();
  };
  grace.onchange = async () => {
    settings.graceSeconds = Math.max(30, Number(grace.value) || 30);
    await saveSettings(settings);
  };
  idle.onchange = async () => {
    settings.idleMinutes = Math.max(1, Number(idle.value) || 5);
    await saveSettings(settings);
  };
  $('testPop').onclick = async () => {
    // Show it on the last tab you were on (not this settings tab).
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    const current = await chrome.tabs.getCurrent();
    const target = tabs.filter((tb) => tb.id !== current?.id && /^https?:/.test(tb.url ?? '')).sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
    if (target?.id) await chrome.tabs.update(target.id, { active: true });
    const cmd: Command = { type: 'test-pop' };
    setTimeout(() => chrome.runtime.sendMessage(cmd), 300);
  };
}

// ---------- presets ----------

function presetCard(p: Preset): HTMLElement {
  const lang = settings.lang;
  const emoji = el('input', { className: 'emoji', value: p.emoji, maxLength: 4 });
  const name = el('input', { value: p.name, maxLength: 30 });
  const sites = el('textarea', { rows: 4, value: p.sites.join('\n') });
  const outside = el('input', { type: 'checkbox', checked: p.countOutsideBrowser });
  const remove = el('button', { className: 'danger', textContent: t(lang, 'remove') });
  const card = el(
    'div',
    { className: 'preset' },
    el('div', { className: 'top' }, emoji, name, remove),
    el('label', {}, t(lang, 'presetSites'), sites),
    el('label', { className: 'check' }, outside, t(lang, 'countOutside')),
  );
  card.dataset.id = p.id;
  remove.onclick = () => card.remove();
  return card;
}

function renderPresets(): void {
  const box = $('presets');
  box.replaceChildren(...settings.presets.map(presetCard));
}

function readPresets(): Preset[] {
  return [...document.querySelectorAll<HTMLElement>('.preset')].map((card) => {
    const [emoji, name] = card.querySelectorAll<HTMLInputElement>('.top input');
    const sites = card.querySelector('textarea')!.value.split(/[\n,]+/).map(normalizePattern).filter(Boolean);
    const outside = card.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked;
    const label = name.value.trim() || 'Preset';
    return { id: card.dataset.id || slug(label) + '-' + Date.now().toString(36), name: label, emoji: emoji.value || '⭐', sites, countOutsideBrowser: outside };
  });
}

function bindPresets(): void {
  $('addPreset').onclick = () => {
    $('presets').append(presetCard({ id: '', name: '', emoji: '⭐', sites: [], countOutsideBrowser: false }));
  };
  $('savePresets').onclick = async () => {
    settings.presets = readPresets();
    await saveSettings(settings);
    renderPresets();
    const msg = $('savedMsg');
    msg.hidden = false;
    setTimeout(() => (msg.hidden = true), 1500);
  };
}

// ---------- pets ----------

async function renderPets(): Promise<void> {
  const lang = settings.lang;
  const pets = await getPets();
  const cards = pets.map((pet) => {
    const active = pet.manifest.id === settings.petId;
    const sprite = el('div');
    sprite.setAttribute('style', spriteStyle(pet.manifest, pet.sheetUrl, active ? 'happy' : 'idle', 96));
    const use = el('button', { className: active ? 'primary' : '', textContent: active ? t(lang, 'inUse') : t(lang, 'use'), disabled: active });
    use.onclick = async () => {
      settings.petId = pet.manifest.id;
      await saveSettings(settings);
      await renderPets();
    };
    const card = el('div', { className: 'petCard' + (active ? ' active' : '') }, sprite, el('span', { className: 'name', textContent: pet.manifest.name }), use);
    if (!pet.builtin) {
      const del = el('button', { className: 'danger', textContent: t(lang, 'remove') });
      del.onclick = async () => {
        await removeCustomPet(pet.manifest.id);
        if (settings.petId === pet.manifest.id) {
          settings.petId = 'pip';
          await saveSettings(settings);
        }
        await renderPets();
      };
      card.append(del);
    }
    return card;
  });
  $('pets').replaceChildren(...cards);
  const hero = pets.find((p) => p.manifest.id === settings.petId) ?? pets[0];
  $('heroPet').setAttribute('style', spriteStyle(hero.manifest, hero.sheetUrl, 'celebrate', 72));
}

function updatePrompt(): void {
  $('promptPreview').textContent = buildPrompt($<HTMLInputElement>('petName').value || 'Pet', $<HTMLTextAreaElement>('petDesc').value);
}

function bindPets(): void {
  $('petName').oninput = updatePrompt;
  $('petDesc').oninput = updatePrompt;
  $('copyPrompt').onclick = async () => {
    await navigator.clipboard.writeText($('promptPreview').textContent ?? '');
    const msg = $('copiedMsg');
    msg.hidden = false;
    setTimeout(() => (msg.hidden = true), 1500);
  };
  $('importBtn').onclick = async () => {
    const out = $('importMsg');
    try {
      const jsonFile = $<HTMLInputElement>('petJson').files?.[0];
      const sheetFile = $<HTMLInputElement>('petSheet').files?.[0];
      if (!sheetFile) throw new Error(settings.lang === 'es' ? 'Falta la imagen.' : 'Pick the sprite image.');
      // pet.json is optional: many image AIs can only give you the picture.
      const manifest = validateManifest(
        jsonFile ? JSON.parse(await jsonFile.text()) : defaultManifestFromName(sheetFile.name),
      );
      const sheetUrl = await normalizeSheet(sheetFile, manifest);
      await addCustomPet({ manifest, sheetUrl, builtin: false });
      out.textContent = t(settings.lang, 'importOk');
      await renderPets();
    } catch (e) {
      out.textContent = '⚠️ ' + (e instanceof Error ? e.message : String(e));
    }
  };
}

function defaultManifestFromName(fileName: string) {
  const name = fileName.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').trim() || 'My pet';
  return manifestFor(name);
}

// ---------- boot ----------

function renderAll(): void {
  applyI18n(document, settings.lang);
  renderPresets();
  void renderPets();
  updatePrompt();
}

async function init(): Promise<void> {
  settings = await getSettings();
  const style = document.createElement('style');
  style.textContent = spriteKeyframes;
  document.head.append(style);
  bindGeneral();
  bindPresets();
  bindPets();
  renderAll();
}

void init();
