# Style library

Every saved style, organized by what it is for. Say a style's name to the editor ("use Type & Wipe") and it opens that style's guide. The old BOSS names still work.

## How it is organized

`my-style-presets/<category>/<style>/<Style-Name>_<kind-of-document>.<ext>`

- **Category folder:** what kind of video the style is for (motion-graphics reels, talking-head edits, YouTube explainers, captions-first shorts, app-walkthrough shorts).
- **Style folder:** the style's short name, in lowercase with dashes.
- **File name:** the style name, then what the file is: `_style-guide` (the rules), `_scripts` (example scripts), `_reference-analysis` (study of the video it came from), `_script-and-structure` (a finished script with its beat structure).

## The styles

| Category | Say this | Old name | Files |
| --- | --- | --- | --- |
| Motion-graphics reels | **Type & Wipe** (+ Head Pop-Out) | BOSS Motion Graphics - 01 (+ Split Cutout) | `motion-graphics-reels/type-and-wipe/Type-and-Wipe_style-guide.md` |
| Motion-graphics reels | **Carousel Style V1** | Pink Carousel, BOSS Motion Graphics - 02 | `motion-graphics-reels/pink-carousel/Pink-Carousel_style-guide.md` |
| Motion-graphics reels | **Carousel Style V2** | Pink and Cream Reel Recreate | `motion-graphics-reels/carousel-style-v2/Carousel-Style-V2_style-guide.md` |
| Talking-head edits | **Punch-In + Split** (also: Punch-In Split) | BOSS Editing - Vertical01 | `talking-head-edits/punch-in-split/Punch-In-Split_style-guide.html`, `…_scripts.md`, `…_reference-analysis.md` (+ `-02`, `-03`, `-04`) |
| Talking-head edits | **Split-Card Reels** / **Viral Style v1** | (new) | `talking-head-edits/split-card-reels/viral-style-v1.md`, `…/Split-Card-Reels_reference-analysis.md` |
| Talking-head edits | **Window Stack** | (new) | `talking-head-edits/window-stack/Window-Stack_style-guide.md` |
| Talking-head edits | **Liquid Orange Flow** | (new) | `talking-head-edits/liquid-orange-flow/Liquid-Orange-Flow_style-guide.md` |
| Talking-head edits | **Blue Stage Split** | (new) | `talking-head-edits/blue-stage-split/Blue-Stage-Split_style-guide.md` |
| Talking-head edits | **Cream Card Cuts** | (new) | `talking-head-edits/cream-card-cuts/Cream-Card-Cuts_style-guide.md` |
| Talking-head edits | **Marker Map** | (new) | `talking-head-edits/marker-map/Marker-Map_style-guide.md` |
| Talking-head edits | **Effect Counter** | (new) | `talking-head-edits/effect-counter/Effect-Counter_style-guide.md` |
| Talking-head edits | **Deep Blue Promo** | (new) | `talking-head-edits/deep-blue-promo/Deep-Blue-Promo_style-guide.md` |
| YouTube explainers | **Clean Motion Explainer** | (same) | `youtube-explainers/clean-motion-explainer/Clean-Motion-Explainer_style-guide.md`, `…_reference-analysis.md` |
| Captions-first shorts | **Bold & Energetic** | (same) | `captions-first-shorts/bold-energetic/Bold-Energetic_style-guide.md` |
| YouTube explainers | **Cobalt Cards** | (new) | `youtube-explainers/cobalt-cards/Cobalt-Cards_style-guide.md` |
| YouTube explainers | **Studio Tour** | (new) | `youtube-explainers/studio-tour/Studio-Tour_style-guide.md` (code: `remotion/src/promo/`) |
| YouTube explainers | **Explainer Video** | (new) | `youtube-explainers/explainer-video/Explainer-Video_style-guide.md` (code: `remotion/src/fbreel/FbReel.tsx`) |
| App-walkthrough shorts | **The BOSS** | Onyx & Gold Walkthrough, BOSS UI Short: Onyx and Gold | `app-walkthrough-shorts/onyx-gold-walkthrough/Onyx-Gold-Walkthrough_script-and-structure.md` |

## Notes

- `my-style.md` (repo root) is the **live** file the editor reads for "edit this". It must keep that exact name. The Clean Motion Explainer guide here is a reference copy of it: edit `my-style.md` to change the active style.
- The Remotion code for each style lives in `remotion/src/`: `aiteam01/` (Type & Wipe + Head Pop-Out), `aiteam/` (Pink Carousel), `reviews/` (the original Type & Wipe reels).
- Private files in this library stay local (see `.gitignore`).
