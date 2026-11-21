import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {F, FPS, useAbs} from '../promo/ui';
import {Sc} from '../promo/scenes';
import {Float, Laptop, Marks, Pointer, Ring, Screen, Stat, View} from './style';
import w00 from './vo/00-hook.json';
import w01 from './vo/01-intro.json';
import w02 from './vo/02-ask-chief.json';
import w03 from './vo/03-usage.json';
import w04 from './vo/04-helpers.json';
import w05 from './vo/05-todo.json';
import w06 from './vo/06-files.json';
import w07 from './vo/07-history.json';
import w08 from './vo/08-voice-notes.json';
import w09 from './vo/09-connections.json';
import w10 from './vo/10-sprints.json';
import w11 from './vo/11-outro.json';
import tracks from './tracks.json';
import {HookStory} from './hookstory';
import {SUBS} from './subs';

// BOSS dashboard walkthrough, take 2: BOSS is the operating system, and this dashboard is where its 136 team members
// come out. The live app is on screen from the first frame to the last — a section chip top left, a caption pill along
// the bottom, a red box on whatever control the voice is naming, and the engine marks and numbers riding low on the
// left over the app. No full-screen text cards anywhere.
//
// Every section is a real screen recording (walkthrough/record.mjs), shot against this exact voiceover: the mouse
// typed, dragged and clicked on the word that names it, and each clip ships a track of the cursor's real path and of
// where every named control really sat. Anything the viewer has to READ — the green status pill, a DRAFT badge, a key
// combo — is measured without the mouse ever touching it, so the hover state can't cover the thing being shown.

type Clip = {id: string; dur: number};
export const CLIPS: Clip[] = [
  {id: '00-hook', dur: 28.65},
  {id: '01-intro', dur: 32.51},
  {id: '02-ask-chief', dur: 35.9},
  {id: '03-usage', dur: 29.86},
  {id: '04-helpers', dur: 22.71},
  {id: '05-todo', dur: 24.98},
  {id: '06-files', dur: 28.0},
  {id: '07-history', dur: 31.81},
  {id: '08-voice-notes', dur: 51.5},
  {id: '09-connections', dur: 26.01},
  {id: '10-sprints', dur: 18.95},
  {id: '11-outro', dur: 13.28},
];
const WORDS = [w00, w01, w02, w03, w04, w05, w06, w07, w08, w09, w10, w11].map((j) => j.words);
const GAP = 0.45;
const LEAD = 0.3;
const starts: number[] = [];
CLIPS.reduce((t, c) => {
  starts.push(t);
  return t + c.dur + GAP;
}, LEAD);
export const WT_END = starts[starts.length - 1] + CLIPS[CLIPS.length - 1].dur + 1.2;
export const DURATION_WT = Math.round(WT_END * FPS);

/** The time-lapse on the laptop: each page of the dashboard, from a moment where something is moving. */
const LAPSE: [string, number][] = [['02-ask-chief', 5], ['05-todo', 5], ['06-files', 1], ['04-helpers', 14], ['07-history', 14], ['08-voice-notes', 20], ['09-connections', 17], ['10-sprints', 6], ['08-voice-notes', 36]];

const ENGINES = [
  {src: 'claude.svg', label: 'Claude'},
  {src: 'openai.svg', label: 'Codex'},
  {src: 'googlegemini.svg', label: 'Gemini'},
];

// ---- words
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const toksOf = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);
type TT = {T: (p: string, n?: number) => number; E: (p: string, n?: number) => number};
const mk = (i: number, a: number): TT => {
  const ws = WORDS[i];
  const tk = ws.map((w) => norm(w.text));
  const idx = (p: string, n = 0) => {
    const q = toksOf(p);
    let c = 0;
    for (let s = 0; s <= tk.length - q.length; s++) if (q.every((x, k) => tk[s + k] === x) && c++ === n) return s;
    throw new Error(`clip ${i}: phrase not found: "${p}"`);
  };
  return {T: (p, n = 0) => a + ws[idx(p, n)].start, E: (p, n = 0) => a + ws[idx(p, n) + toksOf(p).length - 1].end};
};

// ---- recordings and their tracks
type Pt = {t: number; x: number; y: number; click?: boolean};
type Rect = {x: number; y: number; w: number; h: number; t: number};
type Track = {cursor: Pt[]; rects: Record<string, Rect>};
const TR = tracks as unknown as Record<string, Track>;
const LIVE = (n: string) => `walkthrough/live/${n}.mp4`;
const has = (name: string, key: string) => Boolean(TR[name]?.rects[key]);
const rectOf = (name: string, key: string): Rect => {
  const r = TR[name]?.rects[key];
  if (!r) throw new Error(`no recorded position for ${name}/${key}`);
  return r;
};
/** The box that holds all of these controls at once — "these six cards". */
const spanOf = (name: string, keys: string[]): Rect => {
  const rs = keys.filter((k) => has(name, k)).map((k) => rectOf(name, k));
  if (!rs.length) throw new Error(`no recorded positions for ${name}/${keys.join(',')}`);
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return {x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y, t: 0};
};
/** Push in on a recorded control: its centre, at zoom z. */
const on = (name: string, key: string, t: number, z = 1.25, mv = 0): View => {
  const r = rectOf(name, key);
  return {t, z, x: r.x + r.w / 2, y: r.y + r.h / 2, mv};
};
const wide = (t: number, mv = 0): View => ({t, z: 1, x: 960, y: 540, mv});

type RingSpec = [key: string | string[], from: number, until: number];
type SP = {a: number; t: TT};

/** A section: the live recording fills the frame, with the real cursor and the red boxes on top of it. */
const Page: React.FC<{name: string; a: number; views?: View[]; rings?: RingSpec[]; children?: React.ReactNode}> = ({name, a, views, rings, children}) => (
  <Screen src={LIVE(name)} views={views}>
    {rings?.map(([key, from, until], i) => {
      const keys = Array.isArray(key) ? key : [key];
      if (!keys.some((k) => has(name, k))) return null; // a control that could not be measured is simply not ringed
      const r = Array.isArray(key) ? spanOf(name, keys) : rectOf(name, keys[0]);
      return <Ring key={i} x={r.x} y={r.y} w={r.w} h={r.h} from={from} until={until} />;
    })}
    {children}
    <Pointer pts={TR[name].cursor} a={a} />
  </Screen>
);

/** Standard subtitles: the script's own lines (subs.ts), each timed by finding its opening words in the voiceover. */
type Word = {text: string; start: number; end: number};
const linesOf = (ws: Word[], lines: string[], clip: number) => {
  const tk = ws.map((x) => norm(x.text));
  let cur = 0;
  const t0 = lines.map((line) => {
    const q = toksOf(line);
    let at = -1;
    let used = 2;
    for (let s = cur; s < tk.length - 1 && at < 0; s++) if (tk[s] === q[0] && (q.length < 2 || tk[s + 1] === q[1])) at = s;
    if (at < 0) {
      used = 1; // one word is enough where the transcript misheard the second
      for (let s = cur; s < tk.length && at < 0; s++) if (tk[s] === q[0]) at = s;
    }
    if (at < 0) throw new Error(`clip ${clip}: subtitle line not found in voiceover: "${line}"`);
    cur = at + Math.min(used, q.length);
    return ws[at].start;
  });
  return lines.map((text, i) => ({t0: t0[i], t1: ws[ws.length - 1].end, text}));
};
const Subs: React.FC<{words: Word[]; a: number; clip: number}> = ({words, a, clip}) => {
  const abs = useAbs();
  const ls = linesOf(words, SUBS[clip], clip);
  const i = ls.findIndex((l, k) => abs >= a + l.t0 - 0.05 && abs < a + (ls[k + 1] ? ls[k + 1].t0 - 0.05 : l.t1 + 0.5));
  return (
    <>
      {/* a soft dark fade along the bottom, always on, so white text reads on the cream app without flickering between lines */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 250, background: 'linear-gradient(rgba(8,12,24,0), rgba(8,12,24,.5) 55%, rgba(8,12,24,.72))'}} />
      {i >= 0 && (
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 64, textAlign: 'center', padding: '0 160px', fontFamily: F.sans, fontWeight: 700, fontSize: 46, lineHeight: 1.2, letterSpacing: -0.5, color: '#fff', textShadow: '0 2px 3px rgba(0,0,0,.95), 0 0 10px rgba(0,0,0,.75), 0 0 26px rgba(0,0,0,.55)'}}>
          {ls[i].text}
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------- sections
const Hook: React.FC<SP> = ({a, t}) => (
  <>
    {/* not the tour yet: the first sixteen seconds are a story (hookstory.tsx), then the laptop reveals the app */}
    <HookStory
      at={{open: a, claude: t.T('claude'), codex: t.T('codex'), gemini: t.T('gemini'), sub: t.T('theyre one subscription'), you: t.T('you have them'), rival: t.T('your competitor'), cutter: t.T('the person who'), same: t.T('so the ai'), built: t.T('whats built'), end: t.T('this is whats built')}}
    />
    <Laptop a={a} from={t.T('this is whats built')} until={a + 40} shots={LAPSE} />
    <Stat value="136" label="team members" from={t.T('136 ai team members')} until={t.T('one place')} top />
  </>
);

const Intro: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="01-intro"
      a={a}
      views={[wide(a), on('01-intro', 'orb', t.T('chief sits'), 1.5, 0.9), wide(t.T('behind him'), 0.8), on('01-intro', 'box', t.T('you talk to chief'), 1.3, 0.8)]}
      rings={[
        ['orb', t.T('chief sits'), t.T('behind him')],
        ['box', t.T('you talk to chief'), 1e9],
      ]}
    />
    <Marks items={ENGINES} from={t.T('claude codex gemini')} until={t.T('boss is the house')} step={0.75} dim />
    <Stat value="16" label="managers" from={t.T('16 managers')} until={t.T('136 specialists')} />
    <Stat value="136" label="specialists" from={t.T('136 specialists')} until={t.T('you never meet')} />
  </>
);

const Ask: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="02-ask-chief"
      a={a}
      views={[on('02-ask-chief', 'box', a, 1.3), on('02-ask-chief', 'box', t.T('make a thumbnail'), 1.45, 0.8), on('02-ask-chief', 'go', t.T('press go'), 1.5, 0.7), wide(t.T('it reads your 19'), 0.8), wide(t.T('these six cards'), 0.6), on('02-ask-chief', 'pill', t.T('the green light'), 1.7, 0.8)]}
      rings={[
        ['box', t.T('it all starts'), t.T('press go')],
        ['go', t.T('press go'), t.T('it reads your 19')],
        [['card0', 'card1', 'card2', 'card3', 'card4', 'card5'], t.T('these six cards'), t.T('the green light')],
        ['pill', t.T('the green light'), 1e9],
      ]}
    />
    <Stat value="19" label="house rules" from={t.T('it reads your 19')} until={t.T('a manager picks')} />
  </>
);

/** The usage panel cannot be captured live — it won't read the figures from a cold browser — so the real panel is
 *  composited from a true crop, dropped under the ring the cursor just clicked, and zooms with everything else. */
const Usage: React.FC<SP> = ({a, t}) => {
  const r = rectOf('03-usage', 'ring');
  return (
    <>
      <Page name="03-usage" a={a} views={[wide(a), on('03-usage', 'ring', t.T('this ring'), 1.45, 0.8)]} rings={[['ring', t.T('this ring'), t.T('five-hour limit')]]}>
        <Float src="walkthrough/usage-card.png" at={t.T('five-hour limit') - 0.6} w={560} x={Math.min(1580, r.x + r.w / 2)} y={r.y + r.h + 185} />
      </Page>
      <Marks items={[{src: 'claude.svg', label: 'rented'}]} from={t.T('claude today')} until={t.T('everything else is yours')} />
      <Stat value="Yours" label="brain · rules · team · files" from={t.T('everything else is yours')} until={t.T('glance at the ring')} tone="#14213D" />
    </>
  );
};

const Helpers: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="04-helpers"
      a={a}
      views={[wide(a), on('04-helpers', 'search', t.T('this page is so'), 1.35, 0.7), on('04-helpers', 'use', t.T('hand a job straight'), 1.5, 0.7)]}
      rings={[
        ['job0', t.T('cut a long video'), t.T('make an image')],
        ['job1', t.T('make an image'), t.T('build a quiz')],
        ['job2', t.T('build a quiz'), t.T('plan a week')],
        ['job3', t.T('plan a week'), t.T('get ready for a meeting') - 0.9],
        ['job4', t.T('get ready for a meeting'), t.T('test a big decision')],
        ['job5', t.T('test a big decision'), t.T('you dont have to come here')],
        ['search', t.T('this page is so'), t.T('hand a job straight')],
        ['use', t.T('hand a job straight'), 1e9],
      ]}
    />
  </>
);

const Todo: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="05-todo"
      a={a}
      views={[on('05-todo', 'add', a, 1.3), wide(t.T('drag it into today') - 0.3, 0.6), on('05-todo', 'more', t.T('read more'), 1.35, 0.7), on('05-todo', 'help', t.T('help is the handover'), 1.5, 0.7), wide(t.T('thats the point'), 0.7)]}
      rings={[
        ['add', t.T('type a job'), t.T('give it a date')],
        ['date', t.T('give it a date'), t.T('drag it into today')],
        ['more', t.T('read more'), t.T('help is the handover')],
        ['help', t.T('help is the handover'), t.T('thats the point')],
      ]}
    />
  </>
);

const Files: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="06-files"
      a={a}
      views={[wide(a), on('06-files', 'waiting', t.T('waiting for you'), 1.3, 0.7), wide(t.T('videos'), 0.7), on('06-files', 'search', t.T('search for it'), 1.3, 0.7), wide(t.T('136 workers'), 0.7)]}
      rings={[
        ['waiting', t.T('waiting for you'), t.T('videos')],
        ['chip-videos', t.T('videos'), t.T('images')],
        ['chip-images', t.T('images'), t.T('pages')],
        ['chip-pages', t.T('pages'), t.T('writing')],
        ['chip-writing', t.T('writing'), t.T('messages')],
        ['chip-messages', t.T('messages'), t.T('reports')],
        ['chip-reports', t.T('reports'), t.T('filter by')],
        ['search', t.T('search for it'), t.T('136 workers')],
      ]}
    />
    <Stat value="136" label="workers, none of them you" from={t.T('136 workers')} until={1e9} />
  </>
);

const History: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="07-history"
      a={a}
      views={[wide(a), on('07-history', 'cat-video', t.T('video'), 1.3, 0.7), wide(t.T('open one and pick up'), 0.7), on('07-history', 'open', t.T('and it isnt only storage'), 1.35, 0.7), wide(t.T('becomes a rule'), 0.7)]}
      rings={[
        ['cat-video', t.T('video'), t.T('images and design')],
        ['cat-imagesanddesign', t.T('images and design'), t.T('pages and funnels')],
        ['cat-pagesandfunnels', t.T('pages and funnels'), t.T('planning')],
        ['cat-planning', t.T('planning'), t.T('open one and pick up')],
        ['open', t.T('open one and pick up'), t.T('becomes a rule')],
      ]}
    />
    <Marks items={ENGINES} from={t.T('claude codex any of them')} until={t.T('this is the opposite')} step={0.4} dim />
    <Stat value="+1" label="rule, every time you correct it" from={t.T('becomes a rule')} until={1e9} />
  </>
);

const Voice: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="08-voice-notes"
      a={a}
      views={[
        wide(a),
        on('08-voice-notes', 'how', t.T('hold the two keys'), 1.45, 0.8),
        on('08-voice-notes', 'note', t.T('the words appear'), 1.4, 0.8),
        on('08-voice-notes', 'orig', t.T('tap show what i really said'), 1.4, 0.8),
        wide(t.T('dont want to hold'), 0.7),
        on('08-voice-notes', 'tags', t.T('every note keeps its time'), 1.4, 0.8),
        wide(t.T('today yesterday everything'), 0.6),
        on('08-voice-notes', 'q', t.T('search for the idea'), 1.35, 0.7),
        on('08-voice-notes', 'copy', t.T('copy one note'), 1.45, 0.7),
        on('08-voice-notes', 'copyall', t.T('copy the whole day'), 1.4, 0.7),
        wide(t.T('the shortest road'), 0.8),
      ]}
      rings={[
        ['how', t.T('hold the two keys'), t.T('the words appear')],
        ['note', t.T('the words appear'), t.T('tap show what i really said')],
        ['orig', t.T('tap show what i really said'), t.T('dont want to hold')],
        ['tags', t.T('every note keeps its time'), t.T('today yesterday everything')],
        ['today', t.T('today yesterday everything'), t.T('search for the idea')],
        ['q', t.T('search for the idea'), t.T('copy one note')],
        ['copy', t.T('copy one note'), t.T('copy the whole day')],
        ['copyall', t.T('copy the whole day'), t.T('the shortest road')],
      ]}
    />
    <Stat value="136" label="people working on it" from={t.T('136 people')} until={1e9} />
  </>
);

const Check: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="09-connections"
      a={a}
      views={[wide(a), on('09-connections', 'row1', t.T('chief chat'), 1.3, 0.7), wide(t.T('nothing is connected'), 0.7), on('09-connections', 'rows', t.T('green means'), 1.35, 0.8)]}
      rings={[
        ['row0', t.T('chief chat'), t.T('your files')],
        ['row1', t.T('your files'), t.T('your helpers')],
        ['row2', t.T('your helpers'), t.T('your backup')],
        ['row3', t.T('your backup'), t.T('gmail calendar and drive')],
        ['row4', t.T('gmail calendar and drive'), t.T('even your video tools')],
        ['row5', t.T('even your video tools'), t.T('nothing is connected')],
      ]}
    />
  </>
);

const Sprints: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="10-sprints"
      a={a}
      views={[wide(a), on('10-sprints', 'task', t.T('pick a task'), 1.3, 0.7), on('10-sprints', 'go', t.T('start the timer'), 1.4, 0.7), on('10-sprints', 'ring', t.T('25 minutes'), 1.35, 0.8), wide(t.T('counts up'), 0.7)]}
      rings={[
        ['task', t.T('pick a task'), t.T('start the timer')],
        ['go', t.T('start the timer'), t.T('25 minutes')],
        ['ring', t.T('25 minutes'), t.T('counts up')],
        ['stats', t.T('counts up'), t.T('they carry the work')],
      ]}
    />
  </>
);

const Outro: React.FC<SP> = ({a, t}) => (
  <>
    <Page
      name="11-outro"
      a={a}
      views={[wide(a), on('11-outro', 'start', t.T('start with start my day'), 1.4, 0.8), wide(t.T('new chat') - 0.6, 0.6), on('11-outro', 'new', t.T('new chat'), 1.5, 0.8), wide(t.T('everybody has the same ai'), 0.9)]}
      rings={[
        ['start', t.T('start with start my day'), t.T('new chat')],
        ['new', t.T('new chat'), t.T('everybody has the same ai')],
      ]}
    />
    <Laptop a={a} from={t.T('from here on')} until={a + 40} shots={LAPSE} seg={1.0} />
    <Marks items={ENGINES} from={t.T('everybody has the same ai')} until={t.T('from here on')} step={0.22} />
  </>
);

const SCENES: React.FC<SP>[] = [Hook, Intro, Ask, Usage, Helpers, Todo, Files, History, Voice, Check, Sprints, Outro];

export const Walkthrough: React.FC = () => (
  <>
    {CLIPS.map((c, i) => {
      const a = starts[i];
      const b = i === CLIPS.length - 1 ? WT_END : starts[i + 1] + 0.12;
      const S = SCENES[i];
      return (
        <React.Fragment key={c.id}>
          <Sc a={a} b={b}>
            <S a={a} t={mk(i, a)} />
            <Subs words={WORDS[i]} a={a} clip={i} />
          </Sc>
          <Sequence from={Math.round(a * FPS)} durationInFrames={Math.round((c.dur + 0.3) * FPS)}>
            <Audio src={staticFile(`walkthrough/vo/${c.id}.mp3`)} />
          </Sequence>
        </React.Fragment>
      );
    })}
  </>
);
