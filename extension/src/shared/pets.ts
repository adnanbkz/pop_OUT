// Pet format helpers: the AI prompt, validation on import, and the CSS that
// animates a sprite sheet. Animation is pure CSS (steps()), so the browser
// does it on its own with zero JavaScript per frame.
import type { Mood, PetManifest } from './types';

export const MOODS: Mood[] = ['idle', 'happy', 'alert', 'annoyed', 'celebrate'];
export const FRAME = 256;
export const FRAMES = 4;

export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'pet'
  );
}

export function manifestFor(name: string): PetManifest {
  return {
    format: 1,
    id: slug(name),
    name,
    sheet: 'sprites.png',
    frameWidth: FRAME,
    frameHeight: FRAME,
    frames: FRAMES,
    fps: 6,
    rows: { idle: 0, happy: 1, alert: 2, annoyed: 3, celebrate: 4 },
  };
}

/** The exact prompt users paste into any image AI. Always in English: image models follow it best. */
export function buildPrompt(name: string, description: string): string {
  const w = FRAME * FRAMES;
  const h = FRAME * MOODS.length;
  return `Create a 2D sprite sheet of a single character for a small desktop pet app.

CHARACTER: "${name}" — ${description.trim() || 'a cute small mascot'}.

STRICT LAYOUT (very important, the app cuts the image automatically):
- One PNG image, exactly ${w} × ${h} pixels, fully TRANSPARENT background (no white, no checkerboard, no scenery).
- A grid of ${FRAMES} columns × ${MOODS.length} rows. Every cell is exactly ${FRAME} × ${FRAME} px.
- No borders, lines, labels, numbers or text anywhere in the image.
- Same character, same size, same colours and same art style in every cell.
- Keep the character centred in each cell, feet near the bottom, with ~16 px of empty margin on every side. Nothing may cross into a neighbouring cell.
- Each row is a short looping animation: the ${FRAMES} cells from left to right are consecutive frames, so changes between frames must be small and smooth.

ROWS (top to bottom):
1. IDLE — calm, gentle breathing / blinking.
2. HAPPY — smiling, small bounce.
3. ALERT — surprised, eyes wide, one hand raised like "hey!".
4. ANNOYED — frowning, arms crossed or tapping foot, a little impatient (cute, never aggressive).
5. CELEBRATE — jumping with joy, arms up, maybe small sparkles close to the body.

STYLE: clean flat 2D cartoon, bold readable silhouette, works at small size (96 px), soft outline.

If you can output files, also give me this file named pet.json next to the image (named sprites.png):
${JSON.stringify(manifestFor(name), null, 2)}`;
}

/** Load an image file and check it fits the grid; returns a normalized PNG data URL. */
export async function normalizeSheet(file: Blob, manifest: PetManifest): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const rows = Math.max(...Object.values(manifest.rows)) + 1;
  const wantW = manifest.frameWidth * manifest.frames;
  const wantH = manifest.frameHeight * rows;
  const ratio = bitmap.width / bitmap.height;
  const wantRatio = wantW / wantH;
  if (Math.abs(ratio - wantRatio) / wantRatio > 0.05) {
    throw new Error(`Image is ${bitmap.width}×${bitmap.height}, expected a ${wantW}×${wantH} grid (${manifest.frames} columns × ${rows} rows).`);
  }
  // Rescale to the exact size so frames line up, and cap the stored size.
  const canvas = new OffscreenCanvas(wantW, wantH);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, wantW, wantH);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export function validateManifest(raw: unknown): PetManifest {
  const m = raw as PetManifest;
  const ok =
    m &&
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    m.frameWidth > 0 &&
    m.frameHeight > 0 &&
    m.frames > 0 &&
    m.fps > 0 &&
    m.rows &&
    MOODS.every((mood) => Number.isInteger(m.rows[mood]));
  if (!ok) throw new Error('pet.json is missing fields. Use the one from the "Generate prompt" section.');
  return { ...m, format: 1, id: slug(m.id) };
}

/**
 * Inline style for a <div> that plays one row of a sheet.
 * Needs the @keyframes from spriteKeyframes() in the page.
 */
export function spriteStyle(m: PetManifest, sheetUrl: string, mood: Mood, size: number): string {
  const row = m.rows[mood] ?? 0;
  const rows = Math.max(...Object.values(m.rows)) + 1;
  const dur = m.frames / m.fps;
  return [
    `width:${size}px`,
    `height:${size}px`,
    `background-image:url("${sheetUrl}")`,
    `background-size:${size * m.frames}px ${size * rows}px`,
    `background-repeat:no-repeat`,
    `background-position:0 ${-row * size}px`,
    `--pop-w:${-size * m.frames}px`,
    `--pop-y:${-row * size}px`,
    `animation:pop-sprite ${dur}s steps(${m.frames}) infinite`,
  ].join(';');
}

export const spriteKeyframes = `@keyframes pop-sprite{from{background-position-x:0}to{background-position-x:var(--pop-w)}}
@media (prefers-reduced-motion: reduce){[style*="pop-sprite"]{animation:none!important}}`;

