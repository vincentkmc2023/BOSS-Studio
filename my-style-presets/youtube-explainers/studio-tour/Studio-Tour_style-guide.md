# My style: Studio Tour (warm cream product explainer, real screens, one orange-red accent)

Written from draft v4 of `boss-studio-promo` (2:44, voiceover by Krista Mashore). It is a faceless product explainer in three parts: an animated pitch, a guided tour of the real app's screens, and a short dark close. The code it was built from is `remotion/src/promo/` (`scenes.tsx`, `ui.tsx`, `words.ts`), so the hex values and sizes below are exact. Use it for any app, tool or service explainer that has a voiceover and real screenshots or screen clips.

- Format: horizontal 16:9, 1920x1080 at 30 fps. Drafts render at 1728x972 (scale 0.9, crf 24).
- Faceless: no presenter, no stock people. The only people on screen are inside real product clips (sample videos playing on cards, phones and laptop screens).
- Voice first: the voiceover drives the timeline. Every graphic, highlight, cursor click and sound starts on the exact word it illustrates (word timestamps from the voiceover).
- Rhythm: a new beat every 1 to 2 seconds in the pitch, 3 to 6 seconds per screen in the tour. Where a screen needs room to read, open a short pause in the voiceover (1 to 2.6 s) rather than rushing it.

## Palette

| Role | Hex |
|---|---|
| Light stage (cream) | #F6F3EC, second tone #EDE6D9 |
| Ink | #14110F |
| Muted text | #6B645C, on dark #B9B1A5 |
| Accent (orange-red) | #DC2E0A |
| Card / pill | #FFFFFF with a #DDD5C6 3px border |
| Success | #1E9E5A |
| Secondary pops (chips, tracks, tiles only) | pink #FF3FB4, blue #4D8DFF, cyan #35D6EE, purple #A874FF, yellow #FFC83A |

One accent rule: orange-red is the only loud colour on a screen. The secondary pops appear as small dots, chip outlines, timeline tracks and floating tiles, never as headline colour.

## Three stages

- **Light stage** (most scenes): cream #F6F3EC, three soft radial glows (orange-red top-right, purple bottom-left, blue bottom-right, 16 to 20% opacity) and a faint 56px blueprint grid (ink at 6%) that drifts slowly down and fades out at the edges.
- **Dark stage** (title, "your own editor", close): near-black #14110F, one big orange-red glow (42%) that pulses gently, the same grid in cream at 10%.
- **Slate**: full-bleed orange-red #DC2E0A with a halftone dot ellipse in the centre. Used once, for the big promise ("YOU STAY THE BOSS.").

## Typography

- Montserrat 800 for headlines and UI text, tight tracking (-2 to -3px at 84 to 118px). Slate words 252px, -10px tracking, line height 0.98.
- Playfair Display Italic 700 for the accent word, always in the accent colour: *friend*, *style*, *editor.*, *projects*, *Ready.* One accent word per line, usually the last.
- JetBrains Mono 700, uppercase, 4px letter spacing for small labels: step badges, "NOTHING IS FINAL UNTIL YOU SAY SO", "FINAL VERSION · 1080×1920".
- The logo is a lockup: an orange-red dot, "BOSS" in Montserrat 800, "Studio" in Playfair Italic in the accent. Inline on dark, or stacked (BOSS over *Studio*) when it sits between arrows.

## Motion

- **Blur-in reveal** (the signature): text fades up 26px out of a 14px blur in 0.5 s. Headlines reveal word by word, each word on its spoken word.
- **Spring pop** for cards, chips, bubbles and buttons: a bouncy spring (damping 7, stiffness 170) from 40 to 70% scale and 30 to 90px below.
- **Highlighter sweep**: a translucent orange-red bar (22%) grows left to right behind key words as they are said.
- **Scene changes**: a 0.25 s cross-fade with a 0.2 s overlap, so a frame is never empty. No wipes, no whooshes.
- Ambient life on every frame: the drifting grid, the pulsing glow, gently bobbing objects, a mascot loop.

## The app tour (the core of the style)

- **Screen window**: a real 1920x1080 screenshot shown at 80% inside a 30px-radius window with a deep soft shadow.
- **Camera**: smooth eased pans and zooms (1.0 to 2.1x) that move to the control being described; each move takes 1.1 to 1.6 s and lands on the word.
- **Cursor**: a black arrow with a white outline that glides between points and clicks with an orange ripple ring and a soft click sound.
- **Highlight**: a pulsing 6px orange-red outline with a glow around the control being named.
- **Callout card**: white card, 12px orange-red left border, mono tag in the accent ("CREATE PROJECT", "PINNED TO 0:09") over a 40px bold line, with an optional orange line and dot pointing at the control. Always fully inside the frame; check each one at its zoom level.
- **Step badge**: top-left white pill, orange-red number circle, mono uppercase label ("STEP 3 · EDITING").
- **Bottom caption pill**: one idea per screen, white pill with a border and shadow, 54px Montserrat 800 with one italic accent phrase ("Draw right on the *frame.*").
- **Make screens live**: paint over disabled controls so buttons are active, type into fields as the voice names them (with soft key thocks), stack new items in lists, and swap static thumbnails for the real clips playing.

## Building blocks for the pitch

- Chat card: user bubbles in solid orange-red, replies in white with a green check, a typing-dots bubble between them.
- Flow row: raw-video card (waveform bars) → logo → finished video card that plays, with outlined chips under it (Cuts, Captions, Graphics, Sound), each popping on its word.
- Transcript cleanup: a mono transcript card where filler words get coloured highlights, strike through and collapse out.
- Style gallery: five tall cards playing each style's sample loop; the chosen one lifts, scales up and gets an orange-red ring while the others dim.
- Feature cards: tall dark cards with coloured borders playing real clips, with a bold label underneath.
- Format pair: a phone (9:16) and a wide screen (16:9), both playing, with platform chips under them.
- 3D laptop: a CSS-perspective laptop where an AI orb works through an edit (a task list ticking off, a timeline being sliced, a preview playing) with glossy gradient tool tiles floating around it.
- Big button moment: a full-screen green button that is clicked, fills while it renders, then flips to "It's done!" with a check and expanding rings.

## Close

Dark stage. The steps appear as solid coloured chips, then a centred two-line statement (104px white, 96px muted second line), then the logo, a two-line promise with an italic accent and a solid orange-red pill button ("Start creating"), with the mascot on the right and a real margin on the right side.

## Sound

- Voice first. No whooshes: soft clicks on cursor clicks, a clean high-tech ding on big reveals, a light pop on cards and chips, key thocks while text types.
- Music: new music for every project (ElevenLabs music composition, corporate upbeat, quiet at about 13%, 1.5 s fade in, 3 s fade out). Never reuse the music from this sample.
- Clips playing on screen are muted while the voice speaks. One clip may play with its own sound in a voiceover pause.

## Layout rules

- Keep a real margin on the right of any big graphic (about 140px); never let a mascot or illustration hug the edge.
- Centre big statements top to bottom, not just side to side.
- Text blocks get room: wide enough that a headline breaks into about four balanced lines, centred vertically next to its graphic.
