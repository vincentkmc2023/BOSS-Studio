import React from 'react';
import {Img, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {F, ramp, useAbs} from '../promo/ui';

// The look of the monday.com "How to get started" tutorials, in BOSS colours:
//  - the app fills the frame, edge to edge, never a small window floating in a margin
//  - the words live on full-bleed colour cards between app sections, never on a bar over the app
//  - no step badges, no highlight rings, no callout cards: the real cursor and the app's own hover states do the pointing
//  - one weight of one sans; the accent is a colour, not a different typeface

export const C = {
  ink: '#14213D', // the dashboard's own navy
  black: '#0E0E10',
  cream: '#FBFAF7',
  gold: '#E0A030',
  red: '#DC2E0A',
  white: '#FFFFFF',
};

/** Words rise into place one after another between `from` and `to`. `*word*` marks the accent. */
export const Rise: React.FC<{text: string; from: number; to: number; accent?: string}> = ({text, from, to, accent = C.gold}) => {
  const abs = useAbs();
  let inAcc = false;
  const toks = text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (w.startsWith('*')) inAcc = true;
      const t = {w: w.replace(/\*/g, ''), acc: inAcc};
      if (/\*[^\w]*$/.test(w)) inAcc = false;
      return t;
    });
  const step = Math.min(0.1, Math.max(0.04, (to - from) / Math.max(1, toks.length)));
  return (
    <>
      {toks.map((t, i) => {
        const at = from + i * step;
        const k = ramp(abs, at, at + 0.4);
        return (
          <React.Fragment key={i}>
            {/* lift and fade, with no clipping mask: a mask wide enough to clear descenders also lets the
                rising word peek out and collide with the line above it when the text wraps */}
            <span style={{display: 'inline-block', opacity: k, transform: `translateY(${(1 - k) * 0.34}em)`, color: t.acc ? accent : undefined}}>{t.w}</span>
            {i < toks.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

/** A full-bleed colour card carrying one line. This is where every word of this video lives. */
export const Slab: React.FC<{from: number; to: number; text: string; bg?: string; fg?: string; accent?: string; size?: number; sub?: string}> = ({from, to, text, bg = C.ink, fg = C.white, accent = C.gold, size = 108, sub}) => {
  const abs = useAbs();
  return (
    <div style={{position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 180px', fontFamily: F.sans, fontWeight: 800, color: fg}}>
      <div style={{fontSize: size, lineHeight: 1.16, letterSpacing: -3}}>
        <Rise text={text} from={from} to={to} accent={accent} />
      </div>
      {sub && (
        <div style={{marginTop: 34, fontSize: 40, letterSpacing: -0.5, opacity: ramp(abs, to - 0.1, to + 0.45), color: fg, mixBlendMode: 'normal'}}>
          <span style={{opacity: 0.66}}>{sub}</span>
        </div>
      )}
    </div>
  );
};

/** A real piece of the app, cropped out and floated on a colour card — the reference's way of showing one detail. */
export const Float: React.FC<{src: string; at: number; w: number; x?: number; y?: number; tilt?: number}> = ({src, at, w, x = 960, y = 560, tilt = 0}) => {
  const abs = useAbs();
  const k = ramp(abs, at, at + 0.5);
  if (k <= 0.001) return null;
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        transform: `translate(-50%,-50%) scale(${0.86 + 0.14 * k}) rotate(${tilt}deg)`,
        opacity: k,
        borderRadius: 18,
        boxShadow: '0 40px 90px -20px rgba(0,0,0,.55)',
      }}
    />
  );
};

/** The screen recording, filling the frame. `z`/`x`/`y` push a little closer when a detail needs it. */
export type View = {t: number; z?: number; x?: number; y?: number; mv?: number};
const viewAt = (abs: number, views: View[]) => {
  const norm = (v: View) => ({z: v.z ?? 1, x: v.x ?? 960, y: v.y ?? 540});
  let out = norm(views[0]);
  for (let i = 1; i < views.length; i++) {
    const a = norm(views[i - 1]);
    const b = norm(views[i]);
    const mv = views[i].mv ?? 0; // 0 means a straight cut, like the reference
    const t0 = views[i].t - mv;
    if (abs >= views[i].t) out = b;
    else if (mv > 0 && abs > t0) {
      const k = (abs - t0) / mv;
      const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
      return {z: a.z + (b.z - a.z) * e, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e};
    } else return a;
  }
  return out;
};

export const Screen: React.FC<{src: string; views?: View[]; children?: React.ReactNode}> = ({src, views, children}) => {
  const abs = useAbs();
  const raw = views?.length ? viewAt(abs, views) : {z: 1, x: 960, y: 540};
  // never let a push leave the recording: the frame must stay inside the picture, whatever it was aimed at
  const z = Math.max(1, raw.z);
  const clamp = (v: number, half: number, max: number) => Math.min(Math.max(v, half / z), max - half / z);
  const v = {z, x: clamp(raw.x, 960, 1920), y: clamp(raw.y, 540, 1080)};
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: C.cream}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `translate(${960 - v.x * v.z}px, ${540 - v.y * v.z}px) scale(${v.z})`}}>
        {src.endsWith('.mp4') ? <OffthreadVideo src={staticFile(src)} muted style={{width: 1920, height: 1080}} /> : <Img src={staticFile(src)} style={{width: 1920, height: 1080}} />}
        {children}
      </div>
    </div>
  );
};

/** The section chip, top left, the way the BOSS Studio walkthrough marks where you are. Stays up for the whole section. */
export const Chip: React.FC<{label: string; n?: number; from: number; until?: number}> = ({label, n, from, until = 1e9}) => {
  const abs = useAbs();
  const k = ramp(abs, from, from + 0.3) * (1 - ramp(abs, until, until + 0.25));
  if (k <= 0.01) return null;
  return (
    <div style={{position: 'absolute', left: 44, top: 38, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 28px 12px 12px', borderRadius: 999, background: '#fff', border: `3px solid ${C.ink}`, boxShadow: '0 10px 24px -8px rgba(0,0,0,.4)', opacity: k, transform: `translateX(${(1 - k) * -26}px)`}}>
      {n !== undefined && <div style={{width: 40, height: 40, borderRadius: '50%', background: C.red, color: '#fff', fontFamily: F.sans, fontWeight: 800, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{n}</div>}
      <div style={{fontFamily: F.sans, fontWeight: 800, fontSize: 25, letterSpacing: 4, textTransform: 'uppercase', color: C.ink}}>{label}</div>
    </div>
  );
};

/** The red box drawn round the control being talked about. Lives INSIDE the recording, so it tracks every push. */
export const Ring: React.FC<{x: number; y: number; w: number; h: number; from: number; until?: number; pad?: number}> = ({x, y, w, h, from, until = 1e9, pad = 10}) => {
  const abs = useAbs();
  const k = ramp(abs, from, from + 0.28) * (1 - ramp(abs, until, until + 0.25));
  if (k <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - pad,
        top: y - pad,
        width: w + pad * 2,
        height: h + pad * 2,
        border: `4px solid ${C.red}`,
        borderRadius: 16,
        boxShadow: `0 0 0 6px rgba(220,46,10,.14)`,
        opacity: k,
        transform: `scale(${1 + (1 - k) * 0.06})`,
        pointerEvents: 'none',
      }}
    />
  );
};

const chip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 22px',
  borderRadius: 16,
  background: '#fff',
  border: `3px solid ${C.ink}`,
  boxShadow: '0 12px 28px -10px rgba(0,0,0,.45)',
  fontFamily: F.sans,
  fontWeight: 800,
  color: C.ink,
};

/** The engine marks, low on the left, over the live app — never a card of their own. One arrives per word. */
export const Marks: React.FC<{items: {src: string; label: string}[]; from: number; until?: number; step?: number; dim?: boolean}> = ({items, from, until = 1e9, step = 0.62, dim}) => {
  const abs = useAbs();
  const out = ramp(abs, until, until + 0.3);
  if (abs < from - 0.3 || out >= 1) return null;
  return (
    <div style={{position: 'absolute', left: 44, bottom: 168, display: 'flex', gap: 14, opacity: 1 - out}}>
      {items.map((m, i) => {
        const k = ramp(abs, from + i * step, from + i * step + 0.34);
        if (k <= 0.01) return null;
        return (
          <div key={m.label} style={{...chip, opacity: k * (dim ? 0.55 : 1), transform: `translateY(${(1 - k) * 22}px)`, filter: dim ? 'grayscale(1)' : undefined}}>
            <Img src={staticFile(`walkthrough/logos/${m.src}`)} style={{width: 34, height: 34}} />
            <span style={{fontSize: 30, letterSpacing: -0.5}}>{m.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/** One number from the script, held where it is said. Same chip, so the furniture stays one family. */
export const Stat: React.FC<{value: string; label: string; from: number; until?: number; tone?: string; top?: boolean}> = ({value, label, from, until = 1e9, tone = C.red, top}) => {
  const abs = useAbs();
  const k = ramp(abs, from, from + 0.34) * (1 - ramp(abs, until, until + 0.3));
  if (k <= 0.01) return null;
  return (
    <div style={{position: 'absolute', left: 44, ...(top ? {top: 44} : {bottom: 168}), display: 'flex', gap: 14, opacity: k, transform: `translateY(${(1 - k) * 22}px)`}}>
      <div style={{...chip, gap: 14}}>
        <span style={{fontSize: 46, letterSpacing: -2, color: tone}}>{value}</span>
        <span style={{fontSize: 30, letterSpacing: -0.5}}>{label}</span>
      </div>
    </div>
  );
};

/** Behind the laptop: a faint grid drifting slowly, and a network of nodes with data running along its links. */
const NODES: [number, number][] = [[120, 140], [330, 300], [150, 520], [300, 800], [90, 950], [560, 90], [1000, 60], [1380, 110], [1640, 260], [1820, 120], [1760, 520], [1600, 790], [1840, 940], [1330, 1010], [700, 1000]];
const LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [8, 10], [10, 11], [11, 12], [11, 13], [13, 14], [14, 3], [1, 5], [2, 0], [10, 9]];
const Network: React.FC = () => {
  const abs = useAbs();
  const drift = (abs * 5) % 64;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      <defs>
        <pattern id="wt-grid" width={64} height={64} patternUnits="userSpaceOnUse" patternTransform={'translate(' + drift + ',' + drift * 0.5 + ')'}>
          <path d="M64 0H0V64" fill="none" stroke="rgba(255,255,255,.055)" strokeWidth={1} />
        </pattern>
        <radialGradient id="wt-fade" cx="50%" cy="46%" r="62%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#fff" stopOpacity={1} />
        </radialGradient>
        <mask id="wt-mask">
          <rect width={1920} height={1080} fill="url(#wt-fade)" />
        </mask>
      </defs>
      <g mask="url(#wt-mask)">
        <rect width={1920} height={1080} fill="url(#wt-grid)" />
        {LINKS.map(([p, q], i) => {
          const [x1, y1] = NODES[p];
          const [x2, y2] = NODES[q];
          const k = (abs * 0.22 + i * 0.37) % 1; // a data dot running the link, each on its own beat
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7fa2ff" strokeWidth={1.5} opacity={0.16 + 0.1 * Math.sin(abs * 0.9 + i)} />
              <circle cx={x1 + (x2 - x1) * k} cy={y1 + (y2 - y1) * k} r={3.2} fill={i % 3 ? '#9fb8ff' : C.gold} opacity={0.75 * Math.sin(Math.PI * k)} />
            </g>
          );
        })}
        {NODES.map(([x, y], i) => {
          const p = 0.5 + 0.5 * Math.sin(abs * 1.3 + i * 1.7);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={9 + 7 * p} fill="none" stroke="#7fa2ff" strokeWidth={1} opacity={0.22 * (1 - p)} />
              <circle cx={x} cy={y} r={4} fill="#9fb8ff" opacity={0.45 + 0.3 * p} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

/** The navy stage the laptop and the hook story share: gradient, grid and network. */
export const Backdrop: React.FC<{children?: React.ReactNode}> = ({children}) => (
  <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 38%, #24345c 0%, ${C.ink} 55%, #0b1224 100%)`}}>
    <Network />
    {children}
  </div>
);

/** A MacBook Pro with the dashboard running fast on its screen: a time-lapse cut from the real recordings.
 *  `a` is the start of the scene this sits in (its Sequences count from there); `shots` are [recording, seconds in]. */
export const Laptop: React.FC<{a: number; from: number; until: number; shots: [string, number][]; seg?: number; rate?: number}> = ({a, from, until, shots, seg = 1.3, rate = 5}) => {
  const abs = useAbs();
  if (abs < from - 0.05 || abs > until) return null;
  const k = ramp(abs, from, from + 0.6);
  const n = Math.ceil((until - from) / seg);
  const W = 1240;
  const H = Math.round((W * 9) / 16);
  return (
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 38%, #24345c 0%, ${C.ink} 55%, #0b1224 100%)`, opacity: ramp(abs, from, from + 0.3)}}>
      <Network />
      {/* dead centre of the frame, both ways: lid 743 + base 24 = 767 tall */}
      <div style={{position: 'absolute', left: '50%', top: '50%', width: W + 28, marginTop: -384, transform: `translateX(-50%) scale(${0.93 + 0.07 * k})`, transformOrigin: '50% 50%'}}>
        {/* lid */}
        <div style={{width: W + 28, padding: '0 14px 16px', background: '#0b0b0d', borderRadius: '26px 26px 6px 6px', boxShadow: '0 0 0 2px #2c2c30, 0 50px 90px -30px rgba(0,0,0,.7)'}}>
          <div style={{height: 30, display: 'flex', justifyContent: 'center'}}>
            <div style={{width: 168, height: 22, background: '#000', borderRadius: '0 0 12px 12px'}} />
          </div>
          <div style={{position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: 4, background: C.cream}}>
            {Array.from({length: n}).map((_, i) => {
              const [name, at] = shots[i % shots.length];
              return (
                <Sequence key={i} from={Math.round((from - a + i * seg) * 30)} durationInFrames={Math.round(seg * 30)} layout="none">
                  <OffthreadVideo src={staticFile(`walkthrough/live/${name}.mp4`)} startFrom={Math.round(at * 30)} playbackRate={rate} muted style={{position: 'absolute', inset: 0, width: W, height: H}} />
                </Sequence>
              );
            })}
          </div>
        </div>
        {/* base */}
        <div style={{position: 'relative', marginLeft: -130, width: W + 288, height: 24, background: 'linear-gradient(#d9dbe0, #a9acb3 60%, #74777e)', borderRadius: '4px 4px 22px 22px'}}>
          <div style={{position: 'absolute', left: '50%', top: 0, width: 200, height: 10, transform: 'translateX(-50%)', background: '#8b8e95', borderRadius: '0 0 10px 10px'}} />
        </div>
      </div>
    </div>
  );
};

/** The cursor, replayed from the path the real mouse took while recording. Small and plain, like a real pointer. */
export const Pointer: React.FC<{pts: {t: number; x: number; y: number; click?: boolean}[]; a: number}> = ({pts, a}) => {
  const abs = useAbs();
  if (!pts?.length) return null;
  const t = abs - a;
  let x = pts[0].x;
  let y = pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    if (t >= q.t) {
      x = q.x;
      y = q.y;
      continue;
    }
    if (t > p.t) {
      const k = (t - p.t) / Math.max(0.001, q.t - p.t);
      x = p.x + (q.x - p.x) * k;
      y = p.y + (q.y - p.y) * k;
    }
    break;
  }
  const last = pts.filter((c) => c.click && t >= c.t).pop();
  const since = last ? t - last.t : 9;
  return (
    <>
      {last && since < 0.5 && <div style={{position: 'absolute', left: last.x - 28, top: last.y - 28, width: 56, height: 56, borderRadius: '50%', background: 'rgba(20,33,61,.18)', opacity: 1 - since / 0.5, transform: `scale(${0.4 + since * 2.4})`}} />}
      <svg width={46} height={46} viewBox="0 0 24 24" style={{position: 'absolute', left: x - 4, top: y - 3, transform: `scale(${since < 0.14 ? 0.9 : 1})`, transformOrigin: '4px 3px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.4))'}}>
        <path d="M5 3l14 8-6 1.8L10.2 19z" fill="#14110F" stroke="#fff" strokeWidth={1.7} strokeLinejoin="round" />
      </svg>
    </>
  );
};
