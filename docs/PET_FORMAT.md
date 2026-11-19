# Pet format (v1)

A pet is two files: a sprite sheet image and a `pet.json`.

## Sprite sheet

- PNG (or WebP) with a **transparent background**.
- A grid of **4 columns × 5 rows**, each cell **256 × 256 px** → the image is **1024 × 1280 px**.
- Each row is one mood; the 4 cells in a row are the frames of a short loop, left to right.

| Row | Mood        | When it's used                                 |
|-----|-------------|------------------------------------------------|
| 1   | `idle`      | Toolbar popup, nothing happening               |
| 2   | `happy`     | You're on track, came back, hit 25/50/75 %     |
| 3   | `alert`     | First nudge when you drift                     |
| 4   | `annoyed`   | You stayed off track, or keep going back       |
| 5   | `celebrate` | Goal reached                                   |

Images with the right proportions but another size (for example 2048 × 2560) are rescaled on import.

## pet.json

```json
{
  "format": 1,
  "id": "mochi",
  "name": "Mochi",
  "author": "you",
  "sheet": "sprites.png",
  "frameWidth": 256,
  "frameHeight": 256,
  "frames": 4,
  "fps": 6,
  "rows": { "idle": 0, "happy": 1, "alert": 2, "annoyed": 3, "celebrate": 4 }
}
```

`pet.json` is optional on import: if you only have the image, pop_OUT uses these defaults and names the pet after the file.

## Making one with AI

Settings → Pets → **Generate a prompt**. Describe your character, copy the prompt, paste it into any image AI,
then import the image. The prompt is strict about the grid because image AIs tend to add borders, labels or
backgrounds; if the result has those, ask the AI to fix them or clean them up before importing.

## How it's animated

The pet is a `<div>` whose background is the sheet. A CSS animation with `steps(4)` slides the background one
cell at a time. The browser does all the work, so animating costs no JavaScript.
