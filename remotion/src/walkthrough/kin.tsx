import React from 'react';
import {F, P, ramp, sh, sp, POP, useAbs} from '../promo/ui';

// Kinetic text for the walkthrough. Every piece takes a `from` and a `to` time (seconds) read from the voiceover's word
// timings, so words land while the voice says them. `*word*` (or `*two words*`) marks an accent phrase.
// Words rise out of a mask, one after another. No typewriter: the only typing in this video is the real typing on screen.

type Tok = {w: string; acc: boolean};

const parse = (text: string): Tok[] => {
  let inAcc = false;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (w.startsWith('*')) inAcc = true;
      const tok = {w: w.replace(/\*/g, ''), acc: inAcc};
      if (/\*[^\w]*$/.test(w)) inAcc = false;
      return tok;
    });
};

const accStyle: React.CSSProperties = {fontFamily: F.serif, fontStyle: 'italic', fontWeight: 700, color: P.acc, letterSpacing: -2};

/** Words rise into place one after another, between `from` and `to`. */
export const Kin: React.FC<{text: string; from: number; to: number; stagger?: number}> = ({text, from, to, stagger}) => {
  const abs = useAbs();
  const toks = parse(text);
  const step = stagger ?? Math.min(0.11, Math.max(0.045, (to - from) / Math.max(1, toks.length)));
  return (
    <>
      {toks.map((t, i) => {
        const at = from + i * step;
        const k = ramp(abs, at, at + 0.42);
        return (
          <React.Fragment key={i}>
            {/* the mask the word rises out of: it has to clear descenders and the italic accent face, or letters look cut off */}
            <span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', padding: '0.06em 0.12em 0.22em', margin: '-0.06em -0.12em -0.22em'}}>
              <span style={{display: 'inline-block', transform: `translateY(${(1 - k) * 105}%)`, opacity: k > 0 ? 1 : 0, ...(t.acc ? accStyle : {})}}>{t.w}</span>
            </span>
            {i < toks.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

/** The bottom caption pill: one idea at a time. */
export const Cap: React.FC<{from: number; to: number; until?: number; text: string}> = ({from, to, until = 1e9, text}) => {
  const abs = useAbs();
  if (abs < from - 0.25 || abs > until + 0.4) return null;
  const inn = ramp(abs, from - 0.22, from + 0.16);
  const out = ramp(abs, until, until + 0.32);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center', opacity: inn * (1 - out), transform: `translateY(${(1 - inn) * 26 + out * 18}px)`}}>
      <div style={{padding: '14px 54px 18px', borderRadius: 999, background: '#fff', border: `3px solid ${P.line}`, boxShadow: sh.card, fontFamily: F.sans, fontWeight: 800, fontSize: 54, letterSpacing: -1.5, color: P.ink, whiteSpace: 'nowrap'}}>
        <Kin text={text} from={from} to={to} />
      </div>
    </div>
  );
};

/** A note card, for the one thing on a screen the picture cannot say by itself. Positions are in screenshot pixels. */
export const Note: React.FC<{from: number; to: number; until?: number; x: number; y: number; w?: number; tag?: string; text: string; pt?: [number, number]}> = ({from, to, until = 1e9, x, y, w = 460, tag, text, pt}) => {
  const abs = useAbs();
  const k = sp(abs, from, POP) * (1 - ramp(abs, until, until + 0.3));
  if (k <= 0.01) return null;
  return (
    <>
      {pt && (
        <svg style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'visible', opacity: k}}>
          <line x1={x + w / 2} y1={y + 50} x2={pt[0]} y2={pt[1]} stroke={P.acc} strokeWidth={6} strokeLinecap="round" />
          <circle cx={pt[0]} cy={pt[1]} r={11} fill={P.acc} />
        </svg>
      )}
      <div style={{position: 'absolute', left: x, top: y, width: w, padding: '20px 26px 22px', borderRadius: 26, background: '#fff', border: `3px solid ${P.line}`, borderLeft: `12px solid ${P.acc}`, boxShadow: sh.card, opacity: k, transform: `scale(${0.72 + 0.28 * k})`, transformOrigin: '0 50%', fontFamily: F.sans, fontWeight: 800, fontSize: 38, lineHeight: 1.15, color: P.ink}}>
        {tag && <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 21, letterSpacing: 4, textTransform: 'uppercase', color: P.acc, marginBottom: 8}}>{tag}</div>}
        <Kin text={text} from={from + 0.12} to={to} />
      </div>
    </>
  );
};
