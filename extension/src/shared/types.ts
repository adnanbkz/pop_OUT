// Shared data shapes. Everything here is stored only in the browser
// (chrome.storage.local). Nothing ever leaves the device.

export type Lang = 'en' | 'es';

export interface Preset {
  id: string;
  name: string;
  emoji: string;
  /** Allowed sites, e.g. "github.com" or "docs.google.com/document". */
  sites: string[];
  /**
   * If true, time keeps counting while the browser isn't the focused app
   * (you are probably in your editor, notes app, etc).
   */
  countOutsideBrowser: boolean;
}

export interface Settings {
  lang: Lang;
  petId: string;
  presets: Preset[];
  /** Seconds on a distracting site before the pet pops out. */
  graceSeconds: number;
  /** Minutes without keyboard/mouse before the timer pauses. */
  idleMinutes: number;
}

/**
 * focus      = on an allowed site, timer advances
 * distracted = on a site that is not in the preset, timer stops
 * neutral    = new tab, settings page, browser in background: timer stops, no nag
 * idle       = no input for a while: timer stops
 * paused     = the user pressed pause / took a break
 */
export type Status = 'focus' | 'distracted' | 'neutral' | 'idle' | 'paused';

export interface Session {
  presetId: string;
  task: string;
  goalMin: number;
  focusedMs: number;
  status: Status;
  /** When the current status started (ms). */
  since: number;
  /** Last time focusedMs was brought up to date (ms). */
  lastTick: number;
  startedAt: number;
  currentHost: string;
  /** How many times each distracting host was visited this session. */
  distractions: Record<string, number>;
  /** Nudges shown during the current distraction streak. */
  streakNudges: number;
  totalNudges: number;
  /** Last 25% milestone celebrated (0..3). */
  lastMilestone: number;
  /** If set, the break ends at this time (ms). */
  pausedUntil: number | null;
  done: boolean;
}

export type Mood = 'idle' | 'happy' | 'alert' | 'annoyed' | 'celebrate';

/** Contents of pet.json. See docs/PET_FORMAT.md. */
export interface PetManifest {
  format: 1;
  id: string;
  name: string;
  author?: string;
  sheet: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  fps: number;
  rows: Record<Mood, number>;
}

export interface StoredPet {
  manifest: PetManifest;
  /** Data URL (imported pets) or extension URL (built-in pets). */
  sheetUrl: string;
  builtin: boolean;
}

/** Messages sent from the popup / overlay to the background. */
export type Command =
  | { type: 'start'; presetId: string; task: string; goalMin: number }
  | { type: 'stop' }
  | { type: 'pause'; minutes: number | null }
  | { type: 'resume' }
  | { type: 'test-pop' };

/** Message the background sends to the overlay script in a tab. */
export interface PopMessage {
  type: 'pop';
  text: string;
  mood: Mood;
  pet: StoredPet;
  lang: Lang;
  /** Show the "5 min break" button. */
  offerBreak: boolean;
  /** Auto-hide after this many seconds (0 = stay until closed). */
  autoHide: number;
}
