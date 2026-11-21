import React from 'react';
import {Img, OffthreadVideo, staticFile} from 'remotion';
import {Cam, ease, useAbs} from '../promo/ui';

// Same camera window as the promo's ShotLayer, but the source can also be a screen recording (.mp4) that plays from the start of the scene.
const BASE = 0.8;
const FOCY = 505;

const camAt = (abs: number, cam: Cam[]) => {
  let out = {x: cam[0].x, y: cam[0].y, z: cam[0].z};
  for (let i = 1; i < cam.length; i++) {
    const a = cam[i - 1];
    const b = cam[i];
    const t0 = Math.max(a.t, b.t - (b.mv ?? 1.3));
    if (abs >= b.t) out = {x: b.x, y: b.y, z: b.z};
    else if (abs > t0) {
      const k = ease((abs - t0) / (b.t - t0));
      return {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k};
    } else return {x: a.x, y: a.y, z: a.z};
  }
  return out;
};

export const Shot: React.FC<{src: string; cam: Cam[]; children?: React.ReactNode}> = ({src, cam, children}) => {
  const abs = useAbs();
  const c = camAt(abs, cam);
  const s = BASE * c.z;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `translate(${960 - c.x * s}px, ${FOCY - c.y * s}px) scale(${s})`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 30, overflow: 'hidden', boxShadow: '0 40px 120px -30px rgba(20,17,15,.55), 0 0 0 3px rgba(20,17,15,.10)'}}>
        {src.endsWith('.mp4') ? <OffthreadVideo src={staticFile(src)} muted style={{width: 1920, height: 1080}} /> : <Img src={staticFile(src)} style={{width: 1920, height: 1080}} />}
      </div>
      {children}
    </div>
  );
};
