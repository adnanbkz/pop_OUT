// The "smart" part, fully local. No AI model: a few rules that read the
// session and pick what the pet says and how it feels. Rules are instant
// and use no memory, which keeps pop_OUT tiny.
//
// Rules:
//  - First visit to a distracting site in a streak: gentle reminder (alert).
//  - Still there after more nudges, or a site you keep going back to: firmer (annoyed).
//  - A site visited 3+ times this session gets called out by name and count.
//  - Coming back to an allowed site after a nudge: happy "welcome back".
//  - Every 25% of the goal: short happy message. Goal reached: celebrate.
import type { Lang, Mood } from './types';

export type Event =
  | { kind: 'distracted'; site: string; task: string; streakNudges: number; visits: number; focusedMin: number }
  | { kind: 'back'; task: string; leftMin: number }
  | { kind: 'milestone'; percent: number; leftMin: number; task: string }
  | { kind: 'done'; task: string; goalMin: number };

export interface Reaction {
  text: string;
  mood: Mood;
  offerBreak: boolean;
  autoHide: number;
}

type Pools = Record<string, string[]>;

const phrases: Record<Lang, Pools> = {
  en: {
    gentle: [
      'Hey! Weren\'t you doing "{task}"?',
      '{site}? That\'s not on the plan. Back to "{task}"?',
      'Psst… autopilot detected. "{task}" is waiting.',
      'Quick check: is {site} helping with "{task}"?',
    ],
    firm: [
      'Still on {site}. The timer is frozen until you go back.',
      'Come on, "{task}" won\'t do itself. Close {site}?',
      'This is the moment to pop out. Back to "{task}".',
    ],
    repeat: [
      'That\'s {visits} times on {site} today. Notice the pattern?',
      '{site} again ({visits}×). Your hand opens it on autopilot.',
    ],
    tired: [
      'You\'ve focused {focusedMin} min. Need a real break? Take 5, then back.',
    ],
    back: [
      'Welcome back! Timer running again.',
      'There you are. {leftMin} min to go.',
      'Nice, back on "{task}".',
    ],
    milestone: [
      '{percent}% done! {leftMin} min left.',
      'Look at you: {percent}% of "{task}".',
    ],
    done: [
      'You did it! {goalMin} min of real focus on "{task}". 🎉',
      'Goal reached! "{task}": {goalMin} focused minutes.',
    ],
  },
  es: {
    gentle: [
      '¡Ey! ¿No estabas con "{task}"?',
      '¿{site}? Eso no estaba en el plan. ¿Volvemos a "{task}"?',
      'Psst… piloto automático detectado. "{task}" te espera.',
      'Pregunta rápida: ¿{site} te ayuda con "{task}"?',
    ],
    firm: [
      'Sigues en {site}. El temporizador está congelado hasta que vuelvas.',
      'Venga, "{task}" no se hace sola. ¿Cierras {site}?',
      'Este es el momento de salir del piloto automático. A "{task}".',
    ],
    repeat: [
      'Llevas {visits} veces en {site} hoy. ¿Ves el patrón?',
      '{site} otra vez ({visits}×). Tu mano lo abre en automático.',
    ],
    tired: [
      'Llevas {focusedMin} min de foco. ¿Necesitas un descanso de verdad? 5 min y vuelves.',
    ],
    back: [
      '¡Bienvenido de vuelta! El temporizador sigue.',
      'Ahí estás. Quedan {leftMin} min.',
      'Bien, de vuelta a "{task}".',
    ],
    milestone: [
      '¡{percent}% hecho! Quedan {leftMin} min.',
      'Mírate: {percent}% de "{task}".',
    ],
    done: [
      '¡Lo lograste! {goalMin} min de foco real en "{task}". 🎉',
      '¡Objetivo cumplido! "{task}": {goalMin} minutos en foco.',
    ],
  },
};

let lastPicked = '';

function pick(pool: string[], rand: () => number): string {
  if (pool.length === 1) return pool[0];
  let choice = pool[Math.floor(rand() * pool.length)];
  if (choice === lastPicked) choice = pool[(pool.indexOf(choice) + 1) % pool.length];
  lastPicked = choice;
  return choice;
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function react(event: Event, lang: Lang, rand: () => number = Math.random): Reaction {
  const p = phrases[lang];
  switch (event.kind) {
    case 'distracted': {
      const vars = { ...event };
      // Long focus run: suggest a proper break instead of nagging.
      if (event.streakNudges === 0 && event.focusedMin >= 50 && event.visits === 1) {
        return { text: fill(pick(p.tired, rand), vars), mood: 'alert', offerBreak: true, autoHide: 0 };
      }
      if (event.visits >= 3 && event.streakNudges === 0) {
        return { text: fill(pick(p.repeat, rand), vars), mood: 'annoyed', offerBreak: true, autoHide: 0 };
      }
      if (event.streakNudges === 0) {
        return { text: fill(pick(p.gentle, rand), vars), mood: 'alert', offerBreak: true, autoHide: 0 };
      }
      return { text: fill(pick(p.firm, rand), vars), mood: 'annoyed', offerBreak: true, autoHide: 0 };
    }
    case 'back':
      return { text: fill(pick(p.back, rand), event), mood: 'happy', offerBreak: false, autoHide: 4 };
    case 'milestone':
      return { text: fill(pick(p.milestone, rand), event), mood: 'happy', offerBreak: false, autoHide: 5 };
    case 'done':
      return { text: fill(pick(p.done, rand), event), mood: 'celebrate', offerBreak: false, autoHide: 10 };
  }
}
