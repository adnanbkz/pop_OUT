// UI text in English and Spanish. We use our own dictionary instead of
// chrome.i18n so the user can pick the language inside the app.
import type { Lang } from './types';

const en = {
  appName: 'pop_OUT',
  task: 'What are you going to do?',
  taskPlaceholder: 'e.g. Finish chapter 3',
  preset: 'Preset',
  goal: 'Focus goal (minutes)',
  start: 'Start focusing',
  stop: 'Stop',
  pause: 'Pause',
  resume: 'Resume',
  break5: '5 min break',
  settings: 'Settings',
  focused: 'focused',
  left: 'left',
  status_focus: 'On track',
  status_distracted: 'Off track',
  status_neutral: 'Waiting',
  status_idle: 'Away',
  status_paused: 'Paused',
  doneTitle: 'Goal reached!',
  newSession: 'New session',
  needPermission: 'pop_OUT needs permission to read which site you are on (it never leaves your browser).',
  language: 'Language',
  general: 'General',
  graceSeconds: 'Seconds on a distracting site before your pet pops out',
  idleMinutes: 'Minutes without activity before the timer pauses',
  presets: 'Presets',
  presetName: 'Name',
  presetSites: 'Allowed sites (one per line)',
  countOutside: 'Keep counting when the browser is in the background (you are in another app)',
  addPreset: 'Add preset',
  remove: 'Remove',
  save: 'Save',
  saved: 'Saved',
  pets: 'Pets',
  use: 'Use',
  inUse: 'In use',
  importPet: 'Add your own pet',
  importHelp: 'Select the pet.json and the sprite image the AI made for you.',
  importBtn: 'Import',
  importOk: 'Pet added!',
  promptTitle: 'Generate a prompt for any image AI',
  promptHelp: 'Describe your character, then copy the prompt into ChatGPT, Gemini, Midjourney, Higgsfield… and import what it makes.',
  promptName: 'Pet name',
  promptDesc: 'Describe the character (look, colours, style)',
  promptDescPlaceholder: 'a small orange fox with big eyes, wearing a green scarf, flat 2D cartoon style',
  copyPrompt: 'Copy prompt',
  copied: 'Copied!',
  testPop: 'Test pop-up on the current tab',
  privacy: 'Everything is stored only in this browser. pop_OUT has no server and collects nothing.',
  ok: 'OK',
  backToWork: "I'm on it",
} as const;

export type Key = keyof typeof en;

const es: Record<Key, string> = {
  appName: 'pop_OUT',
  task: '¿Qué vas a hacer?',
  taskPlaceholder: 'p. ej. Terminar el tema 3',
  preset: 'Preset',
  goal: 'Objetivo de foco (minutos)',
  start: 'Empezar',
  stop: 'Parar',
  pause: 'Pausa',
  resume: 'Seguir',
  break5: 'Descanso 5 min',
  settings: 'Ajustes',
  focused: 'en foco',
  left: 'restantes',
  status_focus: 'En lo tuyo',
  status_distracted: 'Despistado',
  status_neutral: 'Esperando',
  status_idle: 'Ausente',
  status_paused: 'En pausa',
  doneTitle: '¡Objetivo cumplido!',
  newSession: 'Nueva sesión',
  needPermission: 'pop_OUT necesita permiso para saber en qué web estás (nunca sale de tu navegador).',
  language: 'Idioma',
  general: 'General',
  graceSeconds: 'Segundos en una web que distrae antes de que salga tu mascota',
  idleMinutes: 'Minutos sin actividad antes de pausar el temporizador',
  presets: 'Presets',
  presetName: 'Nombre',
  presetSites: 'Webs permitidas (una por línea)',
  countOutside: 'Seguir contando cuando el navegador está en segundo plano (estás en otra app)',
  addPreset: 'Añadir preset',
  remove: 'Quitar',
  save: 'Guardar',
  saved: 'Guardado',
  pets: 'Mascotas',
  use: 'Usar',
  inUse: 'En uso',
  importPet: 'Añade tu propia mascota',
  importHelp: 'Selecciona el pet.json y la imagen de sprites que te hizo la IA.',
  importBtn: 'Importar',
  importOk: '¡Mascota añadida!',
  promptTitle: 'Genera un prompt para cualquier IA de imágenes',
  promptHelp: 'Describe tu personaje, copia el prompt en ChatGPT, Gemini, Midjourney, Higgsfield… e importa lo que te genere.',
  promptName: 'Nombre de la mascota',
  promptDesc: 'Describe al personaje (aspecto, colores, estilo)',
  promptDescPlaceholder: 'un zorro naranja pequeño con ojos grandes y bufanda verde, estilo cartoon 2D plano',
  copyPrompt: 'Copiar prompt',
  copied: '¡Copiado!',
  testPop: 'Probar el pop-up en la pestaña actual',
  privacy: 'Todo se guarda solo en este navegador. pop_OUT no tiene servidor y no recoge nada.',
  ok: 'OK',
  backToWork: 'Vuelvo a lo mío',
};

const dict: Record<Lang, Record<Key, string>> = { en, es };

export function t(lang: Lang, key: Key): string {
  return dict[lang][key] ?? en[key];
}

export function detectLang(): Lang {
  return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** Fill every [data-i18n] / [data-i18n-placeholder] element in a page. */
export function applyI18n(root: ParentNode, lang: Lang): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(lang, el.dataset.i18n as Key);
  });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(lang, el.dataset.i18nPlaceholder as Key);
  });
  document.documentElement.lang = lang;
}
