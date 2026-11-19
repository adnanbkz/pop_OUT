# pop_OUT

**A tiny, open-source focus companion that pulls you out of autopilot ("piloto automático").**

You tell pop_OUT what you're going to do and pick a preset (Work, Study, Project…).
The timer only moves while you're on the sites that belong to that preset.
Drift to something else and your pet pops out to ask what happened.

- 🔒 **100% local.** No account, no server, no analytics. Everything lives in your browser's storage.
- 🪶 **Very light.** No background loop: the browser wakes pop_OUT only when you switch tab, change page, go idle, or once a minute. All the code together is under 50 KB.
- 🐾 **Pets.** Comes with Pip. Add your own: pop_OUT writes the prompt for any image AI, you import the result.
- 🌍 English and Spanish.

Status: **v0.1, browser extension** (Chrome, Edge, Brave, Firefox; Safari through Xcode). Desktop (macOS, Ubuntu) and mobile (iOS, Android) come next, see [Roadmap](#roadmap).

## Install (from source)

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/adnanbkz/pop_OUT.git
cd pop_OUT/extension
npm install
npm run build
```

That creates `extension/dist/chrome` and `extension/dist/firefox`.

**Chrome / Edge / Brave / Arc**
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `extension/dist/chrome` folder.
4. Pin pop_OUT to the toolbar (puzzle-piece icon → pin).

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `extension/dist/firefox/manifest.json`.
3. Firefox asks for site access the first time you press **Start**. Allow it (it's how pop_OUT knows which site you're on; nothing leaves your browser).
   Temporary add-ons are removed when Firefox closes. A signed version will come with the first release.

**Safari (macOS, needs Xcode)**
```bash
xcrun safari-web-extension-converter extension/dist/chrome --app-name pop_OUT --macos-only
```
Xcode opens a project. Press ▶ Run, then enable pop_OUT in Safari → Settings → Extensions
(turn on Develop → Allow Unsigned Extensions first).

## How to use it

1. Click the pet in the toolbar.
2. Write what you're going to do, pick a preset, set the minutes, **Start**.
3. Work. The badge shows minutes left: green = on track, red = off track, grey = waiting/away, yellow = paused.
4. Stay on a site outside the preset for 30 s and the pet pops out. Come back and it's happy again.

Edit presets, language, timings and pets in **Settings**.

## How it works

See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) for a plain-language tour of the code, and
[docs/PET_FORMAT.md](docs/PET_FORMAT.md) for the sprite format.

## Development

```bash
cd extension
npm run watch      # rebuild on save
npm run typecheck  # TypeScript checks
npm test           # unit tests (Node 22+)
npm run pets       # redraw the Pip placeholder (needs Playwright installed globally)
```

## Roadmap

1. ✅ Browser extension MVP (presets, focus timer, pop-ups, EN/ES, custom pets)
2. Default pets: the pop_OUT character + 2 more
3. Packaged releases (Chrome Web Store, Firefox Add-ons, Safari)
4. Optional on-device AI (Chrome's built-in Gemini Nano) for smarter messages, only where the browser already has it
5. Desktop app for macOS and Ubuntu (Tauri: reuses this UI, ~5–10 MB)
6. iOS (Screen Time API) and Android (UsageStats) apps

## License

[MIT](LICENSE)
