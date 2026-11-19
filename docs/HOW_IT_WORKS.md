# How pop_OUT works (plain language)

This is a tour of the extension for anyone who wants to understand or change it.

## The pieces

```
extension/src/
  background.ts      the brain that's always available (but asleep most of the time)
  overlay.ts         draws the pet on a web page when it needs to pop out
  popup/             the small window when you click the toolbar icon
  options/           the Settings page
  shared/
    match.ts         "is this URL part of the preset?"
    brain.ts         "what should the pet say, and how does it feel?"
    storage.ts       reading/writing settings and the session (local only)
    pets.ts          sprite format, AI prompt, import checks, CSS animation
    i18n.ts          English and Spanish text
    types.ts         the shapes of all the data
```

## Why it uses almost nothing

Most trackers check what you're doing every second. pop_OUT never does. The background script registers
listeners and the browser wakes it only when one fires:

- you switch tabs or a tab's URL changes,
- the browser window gains or loses focus,
- you go idle or come back,
- a once-a-minute alarm (to update the badge and check the goal),
- the "nudge" alarm, set only while you're on a distracting site.

Each wake does the same small job (`evaluateNow` in `background.ts`):

1. If you were focused since the last wake, add that time to the total.
2. Look at the active tab and decide the new status: `focus`, `distracted`, `neutral`, `idle` or `paused`.
3. If you just became distracted, schedule a nudge after the grace period. If you came back, cancel it.
4. Check milestones (25/50/75 %) and the goal.
5. Save and update the badge. Then the browser puts the script back to sleep.

The timer you see ticking in the popup is calculated by the popup itself, only while it's open.

## Statuses

| Status       | When                                                        | Timer |
|--------------|-------------------------------------------------------------|-------|
| `focus`      | Active tab is in the preset (or you're in another app and the preset allows it) | runs |
| `distracted` | Active tab is a website outside the preset                  | stops, pet will pop out |
| `neutral`    | New tab, browser settings, or browser in background         | stops, no nagging |
| `idle`       | No keyboard/mouse for N minutes                              | stops |
| `paused`     | You pressed Pause or took a 5-minute break                   | stops |

"Keep counting when the browser is in the background" exists because a browser can't see other apps.
For Project/Work you're probably in your code editor or notes, so time keeps counting there.

## The "smart" part

`shared/brain.ts` is a small set of rules, no AI model, so it runs instantly and offline:

- first nudge in a distraction streak → gentle reminder that mentions your task (`alert`)
- still there after that → firmer (`annoyed`)
- a site you've opened 3+ times this session → called out by name and count
- after 50+ focused minutes, the first slip suggests a real 5-minute break instead of nagging
- coming back after a nudge → happy "welcome back"
- every 25 % → small celebration; goal → big one

Phrases rotate so it doesn't repeat itself.

## Showing the pet on a page

When there's something to say, the background injects `overlay.js` into the current tab and sends it the text,
mood and pet. The overlay draws inside a *closed Shadow DOM*, so the page's styles can't affect it and the
page can't read it. Text is inserted as plain text, never HTML. It removes itself when closed.
If a page can't be drawn on (new tab, browser pages, extension stores), a system notification is used instead.

## Privacy

Permissions and why:

- `tabs` + site access: read the active tab's address to compare it with your preset.
- `scripting`: draw the pet on the page.
- `storage`: keep settings and the current session on this device.
- `alarms`, `idle`: the once-a-minute check, the nudge timer, and pausing when you're away.
- `notifications`: fallback when the pet can't be drawn on the page.

There is no network code in pop_OUT at all.
