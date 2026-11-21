import React from 'react';
import {Img, staticFile} from 'remotion';
import {F, POP, ramp, sp, useAbs} from '../promo/ui';
import {Backdrop, C} from './style';

// The first sixteen seconds of the hook are not the tour yet, so they are told as a small story instead of shown on
// the app: everyone stands on the same three engines, so the engines stop being an advantage, and the only thing
// that lifts one person above the others is what they build on top. Every beat lands on the word that says it.

export type HookTimes = {open: number; claude: number; codex: number; gemini: number; sub: number; you: number; rival: number; cutter: number; same: number; built: number; end: number};

const LOGOS = [
  {src: 'claude.svg', label: 'Claude'},
  {src: 'openai.svg', label: 'Codex'},
  {src: 'googlegemini.svg', label: 'Gemini'},
];
const BLOCKS = ['Business brain', 'House rules', 'Frameworks', '136 AI team'];
const BLOCK_H = 66;

const Tile: React.FC<{src: string; size: number; dim?: number}> = ({src, size, dim = 0}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.24, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 14px 34px -12px rgba(0,0,0,.6)', opacity: 1 - 0.55 * dim, filter: `grayscale(${dim})`}}>
    <Img src={staticFile(`walkthrough/logos/${src}`)} style={{width: size * 0.56, height: size * 0.56}} />
  </div>
);

const Person: React.FC<{ring: string}> = ({ring}) => (
  <div style={{width: 132, height: 132, borderRadius: '50%', background: '#1c2a4d', border: `5px solid ${ring}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 16px 36px -14px rgba(0,0,0,.7)'}}>
    <svg width={96} height={104} viewBox="0 0 96 104">
      <circle cx={48} cy={36} r={22} fill={ring} />
      <path d="M6 104c0-26 18-40 42-40s42 14 42 40z" fill={ring} />
    </svg>
  </div>
);

export const HookStory: React.FC<{at: HookTimes}> = ({at}) => {
  const abs = useAbs();
  if (abs > at.end + 0.4) return null;

  // beat 1: the core everyone shares
  const core = ramp(abs, at.open, at.open + 0.5) * (1 - ramp(abs, at.claude - 0.25, at.claude + 0.1));
  // beat 2: the three engines, large, one per word
  const bigOut = ramp(abs, at.you - 0.45, at.you - 0.1);
  const big = [at.claude, at.codex, at.gemini].map((x) => sp(abs, x, POP) * (1 - bigOut));
  const tag = ramp(abs, at.sub, at.sub + 0.35) * (1 - bigOut);
  // beat 3: three people, each on the same three engines
  const cols = [
    {x: 480, label: 'You', at: at.you, ring: C.gold},
    {x: 960, label: 'Your competitor', at: at.rival, ring: '#8fa6d8'},
    {x: 1440, label: 'Undercut you last week', at: at.cutter, ring: '#8fa6d8'},
  ];
  // beat 4: the same thing under everyone is no advantage
  const same = ramp(abs, at.same, at.same + 0.5);
  // beat 5: what is built on top lifts one of them
  const blocks = BLOCKS.map((_, i) => sp(abs, at.built + i * 0.34, POP));
  const lift = blocks.reduce((s, k) => s + k, 0) * BLOCK_H;

  return (
    <Backdrop>
      {core > 0.01 && (
        <div style={{position: 'absolute', left: 960, top: 470, transform: 'translate(-50%,-50%)', opacity: core}}>
          {[0, 1, 2].map((i) => {
            const p = (abs * 0.55 + i / 3) % 1;
            return <div key={i} style={{position: 'absolute', left: '50%', top: '50%', width: 220 + p * 420, height: 220 + p * 420, marginLeft: -(110 + p * 210), marginTop: -(110 + p * 210), borderRadius: '50%', border: '2px solid #7fa2ff', opacity: 0.5 * (1 - p)}} />;
          })}
          <div style={{width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #5b7fe0, #22356b 70%)', boxShadow: '0 0 90px 10px rgba(110,150,255,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.sans, fontWeight: 800, fontSize: 92, letterSpacing: -3, color: '#fff', transform: `scale(${0.9 + 0.1 * core + 0.03 * Math.sin(abs * 3)})`}}>AI</div>
        </div>
      )}

      {LOGOS.map((l, i) =>
        big[i] > 0.01 ? (
          <div key={l.label} style={{position: 'absolute', left: 960 + (i - 1) * 400, top: 430, transform: `translate(-50%,-50%) scale(${0.5 + 0.5 * big[i]})`, opacity: Math.min(1, big[i] * 1.4), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
            <div style={{transform: `translateY(${Math.sin(abs * 1.6 + i * 2) * 8}px)`}}>
              <Tile src={l.src} size={230} />
            </div>
            <div style={{fontFamily: F.sans, fontWeight: 800, fontSize: 46, letterSpacing: -1, color: '#fff'}}>{l.label}</div>
          </div>
        ) : null,
      )}
      {tag > 0.01 && (
        <div style={{position: 'absolute', left: 960, top: 720, transform: `translate(-50%,-50%) translateY(${(1 - tag) * 18}px)`, opacity: tag, padding: '14px 34px', borderRadius: 999, border: '2px solid rgba(255,255,255,.5)', fontFamily: F.sans, fontWeight: 700, fontSize: 34, color: '#fff', background: 'rgba(255,255,255,.08)'}}>
          one subscription away
        </div>
      )}

      {cols.map((c, ci) => {
        const k = sp(abs, c.at, POP);
        if (k <= 0.01) return null;
        const up = ci === 0 ? lift : 0;
        return (
          <div key={c.label} style={{position: 'absolute', left: c.x, top: 0, opacity: Math.min(1, k * 1.5)}}>
            {/* the engines: the same three under every one of them */}
            <div style={{position: 'absolute', left: 0, top: 640, transform: 'translate(-50%,-50%)', display: 'flex', gap: 14}}>
              {LOGOS.map((l) => (
                <Tile key={l.label} src={l.src} size={78} dim={same} />
              ))}
            </div>
            {/* what one of them built on top */}
            {ci === 0 &&
              BLOCKS.map((b, i) =>
                blocks[i] > 0.01 ? (
                  <div key={b} style={{position: 'absolute', left: 0, top: 640 - 39 - 14 - (i + 0.5) * BLOCK_H, width: 262, height: BLOCK_H - 8, marginLeft: -131, marginTop: -(BLOCK_H - 8) / 2, borderRadius: 12, background: C.gold, color: C.ink, fontFamily: F.sans, fontWeight: 800, fontSize: 27, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: Math.min(1, blocks[i] * 1.5), transform: `scale(${0.6 + 0.4 * blocks[i]})`, boxShadow: '0 10px 24px -10px rgba(0,0,0,.6)'}}>
                    {b}
                  </div>
                ) : null,
              )}
            <div style={{position: 'absolute', left: 0, top: 512 - up, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * k})`}}>
              <Person ring={c.ring} />
            </div>
            <div style={{position: 'absolute', left: 0, top: 726, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontFamily: F.sans, fontWeight: 800, fontSize: 32, letterSpacing: -0.5, color: ci === 0 ? C.gold : '#c8d3ee'}}>{c.label}</div>
          </div>
        );
      })}
      {same > 0.01 &&
        [720, 1200].map((x) => (
          <div key={x} style={{position: 'absolute', left: x, top: 640, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * same})`, opacity: same, fontFamily: F.sans, fontWeight: 800, fontSize: 84, color: '#fff'}}>
            =
          </div>
        ))}
    </Backdrop>
  );
};
