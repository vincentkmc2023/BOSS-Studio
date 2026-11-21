// Renders one still per named moment of the walkthrough, for approval before the full render.
//   node stills.mjs <outDir>
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const IDS = ['00-hook', '01-intro', '02-ask-chief', '03-usage', '04-helpers', '05-todo', '06-files', '07-history', '08-voice-notes', '09-connections', '10-sprints', '11-outro'];
const vo = IDS.map((id) => JSON.parse(readFileSync(`src/walkthrough/vo/${id}.json`, 'utf8')));
// same clock as Walkthrough.tsx: LEAD 0.3, GAP 0.45, each clip as long as its audio (2 dp)
const starts = [];
vo.reduce((t, j) => { starts.push(t); return t + +j.audio_duration_secs.toFixed(2) + 0.45; }, 0.3);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const T = (i, p) => {
  const q = p.split(/\s+/).map(norm).filter(Boolean), tk = vo[i].words.map((w) => norm(w.text));
  for (let s = 0; s <= tk.length - q.length; s++) if (q.every((x, k) => tk[s + k] === x)) return starts[i] + vo[i].words[s].start;
  throw new Error(`clip ${i}: phrase not found: ${p}`);
};
// SHOTS env var (JSON) overrides the list, for a closer look at one section
const SHOTS = process.env.SHOTS ? JSON.parse(process.env.SHOTS) : [
  [0, 'claude codex gemini', 2.2], [0, '136 ai team members', 1.5], [0, 'one place', 1.5],
  [1, 'every one of them', 1], [1, 'chief sits', 1.2], [1, 'chief is just the name', 2], [1, '16 managers', 0.6], [1, '136 specialists', 0.8], [1, 'you talk to chief', 1.2],
  [2, 'one box', 1], [2, 'new video', 0.6], [2, 'press go', 0.8], [2, 'it reads your 19', 1.2], [2, 'these six cards', 0.8], [2, 'the green light', 1.6],
  [3, 'this ring', 1.2], [3, 'claude today', 1], [3, 'five-hour limit', 1.2], [3, 'everything else is yours', 1.5],
  [4, 'cut a long video', 0.6], [4, 'build a quiz', 0.5], [4, 'test a big decision', 0.5], [4, 'see whos back there', 1.3], [4, 'hand a job straight', 1.5],
  [5, 'type a job', 1.6], [5, 'drag it into today', 1.0], [5, 'read more', 1.0], [5, 'help is the handover', 1.2],
  [6, 'waiting for you', 1.2], [6, 'images', 0.3], [6, 'reports', 0.3], [6, 'search for it', 1.2], [6, '136 workers', 1.5],
  [7, 'claude codex any of them', 1.3], [7, 'images and design', 0.6], [7, 'open one and pick up', 0.8], [7, 'becomes a rule', 1],
  [8, 'hold the two keys', 1.2], [8, 'the words appear', 1.5], [8, 'tap show what i really said', 1.5], [8, 'every note keeps its time', 1.5], [8, 'today yesterday everything', 0.8], [8, 'search for the idea', 1.5], [8, 'copy one note', 1], [8, 'copy the whole day', 1.2], [8, '136 people', 1.5],
  [9, 'your files', 0.4], [9, 'gmail calendar and drive', 0.8], [9, 'each one is a real test', 1.5], [9, 'green means', 1.5],
  [10, 'pick a task', 1], [10, 'start the timer', 0.8], [10, '25 minutes', 1], [10, 'counts up', 1],
  [11, 'start with start my day', 1.2], [11, 'new chat', 1], [11, 'everybody has the same ai', 1.5], [11, 'have a boss', 0.6],
];
const serveUrl = await bundle({ entryPoint: join(process.cwd(), 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Walkthrough' });
let n = 0;
const only = process.argv[3];
for (const [i, p, off] of SHOTS) {
  if (only !== undefined && +only !== i) { n++; continue; }
  const frame = Math.min(composition.durationInFrames - 1, Math.round((T(i, p) + off) * 30));
  const name = `${String(++n).padStart(2, '0')}_${IDS[i]}_${norm(p).slice(0, 22)}.jpg`;
  await renderStill({ composition, serveUrl, frame, output: join(OUT, name), imageFormat: 'jpeg', jpegQuality: 88, scale: 0.6 });
  console.log(name);
}
console.log('done', n);
