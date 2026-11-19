// Thin wrapper around chrome.storage.local (on-device only, never synced).
import { detectLang } from './i18n';
import type { PetManifest, Preset, Session, Settings, StoredPet } from './types';

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'work',
    name: 'Work',
    emoji: '💼',
    sites: ['mail.google.com', 'calendar.google.com', 'docs.google.com', 'notion.so', 'slack.com', 'linear.app', 'figma.com'],
    countOutsideBrowser: true,
  },
  {
    id: 'study',
    name: 'Study',
    emoji: '📚',
    sites: ['wikipedia.org', 'classroom.google.com', 'docs.google.com', 'khanacademy.org', 'coursera.org', 'claude.ai', 'deepl.com'],
    countOutsideBrowser: false,
  },
  {
    id: 'project',
    name: 'Project',
    emoji: '🚀',
    sites: ['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'claude.ai', 'localhost', '127.0.0.1'],
    countOutsideBrowser: true,
  },
];

export function defaultSettings(): Settings {
  return {
    lang: detectLang(),
    petId: 'pip',
    presets: structuredClone(DEFAULT_PRESETS),
    graceSeconds: 30,
    idleMinutes: 5,
  };
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...defaultSettings(), ...(settings ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

export async function getSession(): Promise<Session | null> {
  const { session } = await chrome.storage.local.get('session');
  return session ?? null;
}

export async function saveSession(session: Session | null): Promise<void> {
  if (session) await chrome.storage.local.set({ session });
  else await chrome.storage.local.remove('session');
}

/** Pets that ship inside the extension (folder /pets). */
export const BUILTIN_PET_IDS = ['pip'];

export async function getPets(): Promise<StoredPet[]> {
  const builtin = await Promise.all(
    BUILTIN_PET_IDS.map(async (id) => {
      const res = await fetch(chrome.runtime.getURL(`pets/${id}/pet.json`));
      const manifest = (await res.json()) as PetManifest;
      return { manifest, sheetUrl: chrome.runtime.getURL(`pets/${id}/${manifest.sheet}`), builtin: true };
    }),
  );
  const { customPets } = await chrome.storage.local.get('customPets');
  return [...builtin, ...((customPets as StoredPet[] | undefined) ?? [])];
}

export async function getPet(id: string): Promise<StoredPet> {
  const pets = await getPets();
  return pets.find((p) => p.manifest.id === id) ?? pets[0];
}

export async function addCustomPet(pet: StoredPet): Promise<void> {
  const { customPets } = await chrome.storage.local.get('customPets');
  const list = ((customPets as StoredPet[] | undefined) ?? []).filter((p) => p.manifest.id !== pet.manifest.id);
  list.push(pet);
  await chrome.storage.local.set({ customPets: list });
}

export async function removeCustomPet(id: string): Promise<void> {
  const { customPets } = await chrome.storage.local.get('customPets');
  const list = ((customPets as StoredPet[] | undefined) ?? []).filter((p) => p.manifest.id !== id);
  await chrome.storage.local.set({ customPets: list });
}
