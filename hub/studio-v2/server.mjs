// Local server for the Editing Studio: serves the hub, keeps projects as folders, and runs Claude in them.
//   node hub/studio-v2/server.mjs        (or double-click hub/open-studio-v2.bat)
// Only answers to localhost, and its API only to requests that carry the x-studio header
// (a page on another website can't add it), so other sites can't drive it.
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { cpSync, createReadStream, createWriteStream, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJECTS = join(ROOT, 'projects');
const PORT = +process.env.PORT || 1986;
const SHOW = ['hub', 'my-style-presets', 'projects']; // the only folders served as files
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
mkdirSync(PROJECTS, { recursive: true });

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'project';
const safeName = (s) => basename(String(s || 'file')).replace(/[\\/:*?"<>|]/g, '_');
const pdir = (id) => join(PROJECTS, slug(id));
const PRESETS = join(ROOT, 'my-style-presets');
const pendingDir = (propSlug) => join(PRESETS, '_pending', safeName(propSlug));
const readProject = (id) => { try { return JSON.parse(readFileSync(join(pdir(id), 'project.json'), 'utf8')); } catch { return null; } };
const writeProject = (p) => writeFileSync(join(pdir(p.id), 'project.json'), JSON.stringify(p, null, 2));
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = (req, max = 60e6) => new Promise((ok, no) => { let n = 0; const c = []; req.on('data', (d) => { n += d.length; if (n > max) { no(new Error('too big')); req.destroy(); } else c.push(d); }); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); req.on('error', no); });

// ---- running Claude in the workspace
function trashProject(id) { // move a deleted project's folder to projects/.trash; if it is locked right now, try again later
  try { mkdirSync(join(PROJECTS, '.trash'), { recursive: true }); renameSync(pdir(id), join(PROJECTS, '.trash', id + '-' + Date.now())); return true; } catch { return false; }
}
const runs = new Map(); // project id -> { running, text, tool, error, code, child }
function findClaude() {
  const dirs = [...(process.env.PATH || '').split(';'), join(homedir(), '.local', 'bin')];
  for (const d of dirs) for (const n of ['claude.exe', 'claude.cmd']) if (d && existsSync(join(d, n))) return join(d, n);
  return null;
}
const PREFACE = (id) => {
  const p = readProject(id) || {};
  const f = p.format && p.format.w && p.format.h ? p.format : { label: 'TikTok', ratio: '9:16', w: 1080, h: 1920 };
  const draftW = Math.round(f.w * 0.9), draftH = Math.round(f.h * 0.9);
  const formatLine = `Target format: ${f.label || 'default'} (${f.ratio || ''}, ${f.w}x${f.h}). If a style's own guide assumes a different aspect ratio, adapt its captions, graphics placement and composition to this canvas while keeping its visual identity (colours, fonts, transitions, pacing) intact.`;
  return `You are working inside the bossstudio workspace for the video project "${id}". Follow .agents/skills/bossstudio/SKILL.md and my-rules.md.
Project folder: projects/${id}/
- raw/ holds the raw video. Do not modify it.
- cut/edited.mp4, when it exists, is the raw video with the words I removed in the Script step already cut out (its word timings: cut/source.mistakes-transcript.json). Edit from it instead of the raw video, and do not remove other words unless I ask.
- cut/voiceover-edited.m4a, when it exists, is my voiceover with the words I removed in the Script step already cut out (its word timings: cut/vo.mistakes-transcript.json). Use it as the audio track instead of the voiceover in voiceover/.
- frames/: write still image frames here as JPEG, about 540 px wide, named frame-001_t03.5.jpg (frame number, then _t, then the time in seconds). Replace the old frames when you update them.
- drafts/: write rendered draft videos here (only after I approve the frames).
- voiceover/: an existing voiceover audio file, or where you save one you generate with the ElevenLabs MCP from a script I paste. If I ask you to generate one and the ElevenLabs connector is not connected, stop and tell me to connect it first, with no other changes.
- reference/ holds a video whose editing style I want copied (uploaded, or downloaded from my link with yt-dlp).
- broll/ holds extra footage clips my notes ask you to cut in at a specific point or over a specific range.
- audio/ holds music or sound files my notes ask you to add at a specific point or over a specific range, mixed under the voice.
- revisions/ holds my annotated snapshots. Look at each image file named in my notes.
Never overwrite or delete anything in drafts/. Save every new render as draft-v<N>.mp4, where N is one more than the highest number already there, so older versions stay in the gallery. Final renders are named final-<project>.mp4.
${formatLine}
Always render drafts at low resolution (about ${draftW}x${draftH}, scale 0.9, crf 24) so they are fast. Render full resolution (${f.w}x${f.h}) only when I press Render final.
How to edit: use the bossstudio pipeline in this repo, not Remotion and not a custom renderer. This beats any "Built with: Remotion" line in a style guide.
- Work in kit/video-projects/${id}/ (create it from kit/ with npm run new-video -- ${id} if it does not exist). Read kit/AGENTS.md and follow the kit skill short-form-edit (or edit-video for long horizontal videos).
- Transcripts: use projects/${id}/transcript.json (or cut/source.mistakes-transcript.json for the cut video) when it exists. Otherwise run node tools/transcribe.mjs <video>, which uses Groq in the cloud. Never use --local or a local Whisper model.
- Cuts: the kit's cut-silences and cut-mistakes scripts.
- Motion graphics and rendering: HyperFrames (the kit's hyperframes, hyperframes-video-beats and hyperframes-cli skills; render with npx hyperframes render from kit/). Take the look (colours, fonts, timing, layouts) from the style guide; the Remotion code in remotion/src/ is only a visual reference.
- Frames for review: hyperframes snapshot, saved to frames/ as above.
People rule: follow the style's sample videos exactly as they are. Never add Krista's photos or cut-outs, stock people or any other presenter. The only person on screen is the one in this project's own raw video. If the project has no raw video (only an MP3 voiceover) and the style is built on video of a person, do not build it: tell the user that style needs a video and stop.

Music rule (it beats any music line in a style guide, a style's sample video or a reference video): never reuse music that came with a style. Every new project gets NEW music made for that video. Generate it with the ElevenLabs MCP (music composition), to fit this video's mood, pace and length, and render it into the video. Never copy the music out of a style's sample or a reference video. If the ElevenLabs connector is not connected, use a my-sounds/ track that the style's sample and guide did not use and that no earlier project of mine used; if there is none, leave the music out and say so in your reply.
Rendering rules (important, they stop duplicate renders and slow renders):
- Never run \`npx hyperframes render\` directly. Always start it through the guard, in the background: \`node tools/render-guard.mjs kit/video-projects/${id} -- npx hyperframes render -o renders/<name>.mp4 -q draft --crf 24\`. The guard refuses to start a second render for the same project, and it writes progress to kit/video-projects/${id}/renders/render.log.
- Never run a render in the foreground. A tool time-out does NOT stop a render: it keeps running unseen, and starting it again makes two renders that slow each other down. If a command with a render in it times out, assume the render is still running and check \`node tools/render-guard.mjs kit/video-projects/${id} --status\` before doing anything else.
- If the guard says a render is already running, do NOT start another one. Wait, and check with \`node tools/render-guard.mjs kit/video-projects/${id} --status\` every 2 to 3 minutes.
- A long render (HDR footage, lots of B-roll) can take 30 to 60+ minutes and print nothing for a long time. Silence is normal, not a failure. Only call a render stuck when --status says it is no longer running and no video file was produced.
- Speed: iPhone or other HDR clips (ffprobe shows color_transfer arib-std-b67 or smpte2084) push the renderer onto its slow 16-bit HDR path. Before you build the composition, convert such a clip, and every B-roll clip, to SDR bt709 with ffmpeg (zscale tonemap) and use that copy. Keep B-roll clips short and small.
Reply briefly when done.\n\n`;
};
const MODELS = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', fable: 'claude-fable-5-2', haiku: 'claude-haiku-5-5' }; // the brains the studio offers; anything else falls back to opus
function startRun(id, prompt, brain) {
  const exe = findClaude();
  const st = { running: true, text: '', tool: '', error: '', code: null, startedAt: Date.now() };
  runs.set(id, st);
  if (!exe) { st.running = false; st.error = "Can't find Claude Code. Install it and sign in first."; return st; }
  const p = readProject(id) || {};
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', MODELS[brain] || MODELS[p.model] || MODELS.opus, '--effort', 'medium', '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash,PowerShell,Read,Write,Edit,Glob,Grep,Skill,mcp__ElevenLabs__text_to_speech,mcp__ElevenLabs__search_voices,mcp__ElevenLabs__text_to_voice,mcp__ElevenLabs__compose_music,mcp__ElevenLabs__create_composition_plan,mcp__ElevenLabs__text_to_sound_effects'];
  if (p.session) args.push('--resume', p.session);
  const child = spawn(exe, args, { cwd: ROOT, windowsHide: true });
  st.child = child;
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d; const lines = buf.split('\n'); buf = lines.pop();
    for (const l of lines) {
      let e; try { e = JSON.parse(l); } catch { continue; }
      if (e.session_id) { const q = readProject(id); if (q && q.session !== e.session_id) { q.session = e.session_id; writeProject(q); } }
      if (e.type === 'assistant') for (const c of e.message?.content || []) { if (c.type === 'tool_use') st.tool = c.name; else if (c.type === 'text') st.text = c.text.slice(0, 400); }
      if (e.type === 'result' && e.is_error) st.error = String(e.result || 'Claude stopped with an error').slice(0, 400);
    }
  });
  let err = ''; child.stderr.on('data', (d) => (err = (err + d).slice(-800)));
  child.on('close', (code) => { st.running = false; st.code = code; st.finishedAt = Date.now(); if (code && !st.error) st.error = err.trim().split('\n').pop() || 'Claude stopped (code ' + code + ')'; });
  child.on('error', (e) => { st.running = false; st.error = e.message; });
  child.stdin.end(PREFACE(id) + prompt);
  return st;
}
// ---- Script step: word-level transcript, cut suggestions, and text cuts applied to the video (no Claude involved)
const MISTAKES = join(ROOT, 'kit', '.agents', 'skills', 'cut-mistakes', 'scripts');
const busy = new Set(); // project ids with a script job running
const node = (args) => proc(process.execPath, args);
function proc(exe, args) {
  return new Promise((ok) => {
    const c = spawn(exe, args, { cwd: ROOT, windowsHide: true });
    let out = '', err = '';
    c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (err = (err + d).slice(-1500)));
    c.on('close', (code) => ok({ code, out, err: err.trim().split('\n').pop() || 'failed (code ' + code + ')' }));
    c.on('error', (e) => ok({ code: 1, out, err: e.message }));
  });
}
// Two sources Script can work on: the raw footage / voiceover (step 2, before frames exist, j.target
// absent — this is the only one that can cut anything, and every cut lands in the next version), or —
// on the Editing page (step 4) — the rendered draft itself (j.target === 'draft'), read-only: it's
// transcribed so the words can be selected, but never cut here.
async function scriptJob(id, p, b, j) {
  const dir = pdir(id), draftMode = j.target === 'draft';
  let media, tr, sd, stem;
  if (draftMode) {
    const file = safeName(j.file || '');
    if (!file || !existsSync(join(dir, 'drafts', file))) return { status: 400, error: 'Pick a rendered version first' };
    stem = file.replace(/\.[^.]+$/, ''); // e.g. "draft-v2"
    media = join(dir, 'drafts', file);
    tr = join(dir, 'script', stem + '.json');
    sd = join(dir, 'script', stem);
  } else {
    const vo = p.voiceoverFile && existsSync(join(dir, 'voiceover', p.voiceoverFile));
    if (!p.rawName && !vo) return { status: 400, error: 'Attach the raw video first' };
    stem = vo ? 'vo' : 'source';
    media = vo ? join(dir, 'voiceover', p.voiceoverFile) : join(dir, 'raw', p.rawName || '');
    tr = join(dir, vo ? 'vo-transcript.json' : 'transcript.json');
    sd = join(dir, 'script');
  }
  if (!existsSync(media)) return { status: 400, error: draftMode ? 'Pick a rendered version first' : 'Attach the raw video first' };
  if (b === 'transcribe') {
    mkdirSync(dirname(tr), { recursive: true });
    const r = await node([join(ROOT, 'tools', 'transcribe.mjs'), media]);
    const made = media.replace(/\.[^.\\/]+$/, '.json'); // transcribe.mjs writes beside the media
    if (r.code !== 0 || !existsSync(made)) return { status: 500, error: 'Transcription failed: ' + r.err };
    renameSync(made, tr);
    return { words: JSON.parse(readFileSync(tr, 'utf8')).words };
  }
  if (!existsSync(tr)) return { status: 400, error: draftMode ? 'Open this version in the Script panel first' : 'Transcribe the video first' };
  mkdirSync(sd, { recursive: true });
  if (b === 'suggest') {
    const r = await node([join(MISTAKES, 'find-cut-candidates.mjs'), tr, '--out-dir', sd]);
    if (r.code !== 0) return { status: 500, error: 'Could not find suggestions: ' + r.err };
    return JSON.parse(readFileSync(join(sd, stem + '.cut-candidates.json'), 'utf8')); // the kit names outputs after the transcript file
  }
  if (draftMode) return { status: 400, error: 'The Editing page only points at words; it never cuts. Cut in the Script step instead, before frames exist.' };
  const cuts = (Array.isArray(j.cuts) ? j.cuts : []).filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start);
  if (!cuts.length) { rmSync(join(dir, 'cut'), { recursive: true, force: true }); return { cutFile: '' }; }
  writeFileSync(join(sd, 'cuts.json'), JSON.stringify({ cuts }, null, 2));
  const vo = stem === 'vo', cd = join(dir, 'cut'); mkdirSync(cd, { recursive: true });
  if (vo) { // audio only: re-time the words with apply-cuts, cut the audio with FFmpeg
    const t = await node([join(MISTAKES, 'apply-cuts.mjs'), tr, '--cuts', join(sd, 'cuts.json'), '--out-dir', cd]);
    if (t.code !== 0) return { status: 500, error: 'Could not cut the voiceover: ' + t.err };
    const keep = 'not(' + cuts.map((c) => `between(t,${c.start},${c.end})`).join('+') + ')';
    const r = await proc('ffmpeg', ['-y', '-loglevel', 'error', '-i', media, '-af', `aselect='${keep}',asetpts=N/SR/TB`, '-c:a', 'aac', '-b:a', '192k', join(cd, 'voiceover-edited.m4a')]);
    if (r.code !== 0) return { status: 500, error: 'Could not cut the voiceover: ' + r.err };
    return { cutFile: 'cut/voiceover-edited.m4a' };
  }
  const out = join(cd, 'edited.mp4');
  const r = await node([join(MISTAKES, 'apply-cuts.mjs'), tr, '--cuts', join(sd, 'cuts.json'), '--video', media, '--output', out, '--out-dir', cd, '--apply']);
  if (r.code !== 0 || !existsSync(out)) return { status: 500, error: 'Could not cut the video: ' + r.err };
  return { cutFile: 'cut/edited.mp4' };
}
// Project card picture, as a path inside the project folder (or '' to fall back to the style cover).
// A voiceover project is faceless, so its raw video is only B-roll: show a rendered frame once BOSS has made some.
// Otherwise (or before frames exist) show a still from the raw video, made once with FFmpeg and kept as thumb.jpg.
async function thumbOf(q) {
  const dir = pdir(q.id);
  if (q.voiceoverFile) {
    let f; try { f = readdirSync(join(dir, 'frames')).filter((x) => /\.(jpe?g|png)$/i.test(x)).sort()[0]; } catch {}
    if (f) return 'frames/' + encodeURIComponent(f) + '?v=' + statSync(join(dir, 'frames', f)).mtimeMs;
  }
  const raw = join(dir, 'raw', q.rawName || ''), t = join(dir, 'thumb.jpg');
  if (!q.rawName || !existsSync(raw)) return '';
  if (!existsSync(t) || statSync(t).mtimeMs < statSync(raw).mtimeMs) {
    rmSync(t, { force: true });
    for (const ss of ['1', '0']) { await proc('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-i', raw, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', t]); if (existsSync(t)) break; } // -ss 0 for clips under a second
  }
  return existsSync(t) ? 'thumb.jpg?v=' + statSync(t).mtimeMs : '';
}
const dataUrl = (u) => { const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(u || ''); return m ? { buf: Buffer.from(m[2], 'base64'), ext: m[1] === 'png' ? 'png' : 'jpg' } : null; };

// ---- Upload to Drive with rclone: one Google sign-in, then renders go straight into the Drive folder the user pasted
const DRIVE_REMOTE = 'bossdrive';
const exec = (bin, args, ms = 180000) => new Promise((ok) => {
  let out = '', err = '';
  const c = spawn(bin, args, { windowsHide: true });
  const t = setTimeout(() => c.kill(), ms);
  c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (err += d));
  c.on('error', (e) => { clearTimeout(t); ok({ code: -1, out, err: String(e.message) }); });
  c.on('close', (code) => { clearTimeout(t); ok({ code, out, err }); });
});
let rcloneBin;
const findRclone = async () => {
  if (rcloneBin) return rcloneBin;
  const c = ['rclone'];
  const base = join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages'); // winget installs it here before the PATH reaches an already-running server
  try { for (const d of readdirSync(base)) if (/^Rclone.Rclone/.test(d)) for (const s of readdirSync(join(base, d))) c.push(join(base, d, s, 'rclone.exe')); } catch {}
  for (const b of c) if ((await exec(b, ['version'], 15000)).code === 0) return (rcloneBin = b);
  return '';
};

// ---- API
// ---- Mashore Method (GoHighLevel) Social Planner: token + location id live in .env (git-ignored)
const mashoreEnv = () => { const o = {}; try { for (const l of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) { const m = l.trim().match(/^(MASHORE_\w+)\s*=\s*(.*)$/); if (m) o[m[1]] = m[2].trim(); } } catch {} return o; };
async function ghl(path, init = {}) {
  const e = mashoreEnv(); if (!e.MASHORE_TOKEN || !e.MASHORE_LOCATION_ID) return { status: 0, body: { message: 'NOT_CONNECTED' } };
  const r = await fetch('https://services.leadconnectorhq.com' + path.replace('{loc}', e.MASHORE_LOCATION_ID), { ...init, headers: { Authorization: 'Bearer ' + e.MASHORE_TOKEN, Version: '2021-07-28', Accept: 'application/json', ...(init.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });
// ---- Claude usage (same numbers as the Claude app): read-only call with the local Claude sign-in; the token is never logged or stored
let usageCache = { at: 0, v: null };
async function getUsage() {
  if (usageCache.v && Date.now() - usageCache.at < 60000) return usageCache.v;
  let v;
  try {
    const oa = JSON.parse(readFileSync(join(homedir(), '.claude', '.credentials.json'), 'utf8')).claudeAiOauth || {};
    if (!oa.accessToken) v = { plans: {}, note: 'Not signed in to Claude on this computer.' };
    else if (oa.expiresAt && oa.expiresAt < Date.now()) v = { plans: {}, note: 'Open the Claude app once so it refreshes your sign-in, then check again.' };
    else {
      const body = await new Promise((resolve, reject) => {
        const rq = https.request('https://api.anthropic.com/api/oauth/usage', { method: 'GET', timeout: 8000, headers: { Authorization: 'Bearer ' + oa.accessToken, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'boss-studio', Accept: 'application/json' } }, (r) => {
          let t = ''; r.on('data', (d) => { if (t.length < 100000) t += d; }); r.on('end', () => (r.statusCode === 200 ? resolve(t) : reject(new Error('status ' + r.statusCode))));
        });
        rq.on('timeout', () => rq.destroy(new Error('timeout'))); rq.on('error', reject); rq.end();
      });
      const plans = {};
      for (const [k, x] of Object.entries(JSON.parse(body) || {})) if (x && typeof x === 'object' && typeof x.utilization === 'number') plans[k.slice(0, 40)] = { utilization: x.utilization / 100, resetsAt: Date.parse(x.resets_at) || 0 };
      v = Object.keys(plans).length ? { plans, note: '' } : { plans: {}, note: 'Claude did not send usage numbers this time.' };
    }
  } catch { v = { plans: {}, note: 'I could not read your Claude usage right now.' }; }
  usageCache = { at: Date.now(), v };
  return v;
}
async function mashoreApi(req, res, id) {
  if (id === 'accounts') { // which apps are linked in Mashore Method
    const r = await ghl('/social-media-posting/{loc}/accounts');
    if (r.body.message === 'NOT_CONNECTED') return send(res, 200, { connected: false, accounts: [] });
    if (r.status !== 200) return send(res, 200, { connected: false, error: r.body.message || 'Mashore Method said no', accounts: [] });
    return send(res, 200, { connected: true, accounts: (r.body.results?.accounts || []).filter((x) => x.active && !x.deleted).map((x) => ({ id: x.id, platform: x.platform, name: x.name, profileId: x.profileId })) });
  }
  if (id === 'posts') { // this project's posts, newest first, with the live link of each
    const qs = new URL(req.url, 'http://x').searchParams, pj = qs.get('project') || '', title = (qs.get('title') || '').trim().toLowerCase(), f = join(pdir(pj), 'posts.json'); let all = []; try { all = JSON.parse(readFileSync(f, 'utf8')); } catch {}
    const a = await ghl('/social-media-posting/{loc}/accounts'), ids = (a.body.results?.accounts || []).map((x) => x.id).join(','); let live = [];
    if (ids) { const r = await ghl('/social-media-posting/{loc}/posts/list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'all', accounts: ids, skip: '0', limit: '100', fromDate: '2020-01-01T00:00:00.000Z', toDate: '2035-01-01T00:00:00.000Z', includeUsers: 'false' }) }); live = r.body.results?.posts || []; }
    // check Mashore Method for anything posted today with this project's title that no project has recorded yet (posts made before the studio kept a record, or from another computer)
    if (title && live.length) {
      const midnight = new Date(); midnight.setHours(0, 0, 0, 0); const claimed = new Set();
      for (const d of readdirSync(PROJECTS, { withFileTypes: true })) if (d.isDirectory()) { try { for (const x of JSON.parse(readFileSync(join(PROJECTS, d.name, 'posts.json'), 'utf8'))) claimed.add(x.id); } catch {} }
      const groups = new Map(); for (const l of live) { if (l.status === 'draft' || new Date(l.createdAt) < midnight || String(l.summary || '').split(String.fromCharCode(10))[0].trim().toLowerCase() !== title) continue; const g = l.parentPostId || l._id; if (!claimed.has(g) && !claimed.has(l._id)) (groups.get(g) || groups.set(g, []).get(g)).push(l); }
      for (const [g, ls] of groups) all.unshift({ id: ls[0]._id, status: ls.some((l) => l.status === 'published') ? 'published' : ls[0].status, platforms: ls.map((l) => l.platform), when: ls[0].scheduleDate || '', at: new Date(ls[0].createdAt).getTime(), file: '', title: String(ls[0].summary || '').split(String.fromCharCode(10))[0].slice(0, 100), found: true });
      if (groups.size) try { writeFileSync(f, JSON.stringify(all.slice(0, 30))); } catch {}
    }
    return send(res, 200, { posts: all.slice(0, 5).map((x) => ({ ...x, links: live.filter((l) => l._id === x.id || l.parentPostId === x.id).map((l) => ({ platform: l.platform, status: l.status, link: l.previewLink || '' })) })) });
  }
  if (id === 'status') { // where a post ended up: its state per app and the link to the live post
    const pid = new URL(req.url, 'http://x').searchParams.get('id') || '', a = await ghl('/social-media-posting/{loc}/accounts');
    const ids = (a.body.results?.accounts || []).map((x) => x.id).join(',');
    if (!pid || !ids) return send(res, 200, { posts: [] });
    const r = await ghl('/social-media-posting/{loc}/posts/list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'all', accounts: ids, skip: '0', limit: '50', fromDate: '2020-01-01T00:00:00.000Z', toDate: '2035-01-01T00:00:00.000Z', includeUsers: 'false' }) });
    return send(res, 200, { posts: (r.body.results?.posts || []).filter((x) => x._id === pid || x.parentPostId === pid).map((x) => ({ platform: x.platform, status: x.status, link: x.previewLink || '', when: x.scheduleDate || '' })) });
  }
  if (id === 'post' && req.method === 'POST') { // body: {platforms:['facebook'], text, draft, when (ISO) | null, project, file}
    const b = await readBody(req), a = await ghl('/social-media-posting/{loc}/accounts');
    if (a.body.message === 'NOT_CONNECTED') return send(res, 409, { error: 'NOT_CONNECTED' });
    const accts = (a.body.results?.accounts || []).filter((x) => x.active && !x.deleted && (b.platforms || []).includes(x.platform));
    if (!accts.length) return send(res, 409, { error: 'NO_ACCOUNT' });
    let media = [];
    if (b.file && !b.draft) { // upload the finished video to the Mashore Method media library so it can be attached
      const f = join(PROJECTS, String(b.project || '').replace(/[^\w.-]/g, ''), 'drafts', basename(String(b.file)));
      if (!existsSync(f)) return send(res, 404, { error: 'That video file is missing.' });
      const fd = new FormData(); fd.append('file', new Blob([readFileSync(f)], { type: 'video/mp4' }), basename(f)); fd.append('hosted', 'false');
      const u = await ghl('/medias/upload-file', { method: 'POST', body: fd });
      if (u.status === 401) return send(res, 409, { error: 'NEEDS_MEDIA_SCOPE' });
      if (u.status >= 300 || !u.body.url) return send(res, 502, { error: 'Video upload failed: ' + (u.body.message || u.status) });
      media = [{ url: u.body.url, type: 'video/mp4' }];
    }
    const post = { accountIds: accts.map((x) => x.id), summary: String(b.text || ''), type: 'post', media, userId: accts[0].profileId, status: b.draft ? 'draft' : b.when ? 'scheduled' : 'published' };
    if (b.when && !b.draft) post.scheduleDate = new Date(b.when).toISOString();
    const r = await ghl('/social-media-posting/{loc}/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(post) });
    if (r.status < 300) { // keep the record in its own file: it cannot be overwritten by a stale save of project.json
      try { const f = join(pdir(String(b.project || '')), 'posts.json'); let all = []; try { all = JSON.parse(readFileSync(f, 'utf8')); } catch {} all.unshift({ id: r.body.results?.post?._id, status: post.status, platforms: b.platforms || [], when: post.scheduleDate || '', at: Date.now(), file: b.file || '', title: String(b.text || '').split(String.fromCharCode(10))[0].slice(0, 100) }); writeFileSync(f, JSON.stringify(all.slice(0, 30))); } catch {}
    }
    return r.status < 300 ? send(res, 200, { ok: true, id: r.body.results?.post?._id, status: post.status, planner: 'https://app.mashoremethod.com/v2/location/' + mashoreEnv().MASHORE_LOCATION_ID + '/marketing/social-planner' }) : send(res, 502, { error: Array.isArray(r.body.message) ? r.body.message.join(', ') : r.body.message || 'Mashore Method said no' });
  }
  return send(res, 404, { error: 'not found' });
}
async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // after /api
  const [a, id, b] = parts;
  if (a === 'drive' && id === 'connect' && req.method === 'POST') { // opens the Google sign-in in the browser; waits until it is allowed
    const bin = await findRclone(); if (!bin) return send(res, 409, { error: 'NEEDS_RCLONE' });
    const r = await exec(bin, ['config', 'create', DRIVE_REMOTE, 'drive', 'scope', 'drive'], 300000);
    return r.code === 0 ? send(res, 200, { ok: true }) : send(res, 500, { error: 'Google sign-in did not finish: ' + r.err.trim().split(/\r?\n/).pop() });
  }
  if (a === 'usage') return send(res, 200, await getUsage());
  if (a === 'mashore') return mashoreApi(req, res, id);
  if (a === 'ping') return send(res, 200, { ok: true, maintainer: existsSync(join(ROOT, '.maintainer')) });
  if (a === 'style-proposals') {
    const dir = pendingDir(id);
    if (req.method === 'GET') {
      const metaPath = join(dir, 'meta.json');
      if (!existsSync(metaPath)) return send(res, 404, { error: 'not ready yet' });
      let meta; try { meta = JSON.parse(readFileSync(metaPath, 'utf8')); } catch { return send(res, 500, { error: 'bad proposal data' }); }
      const guidePath = join(dir, 'STYLE-GUIDE.md');
      return send(res, 200, { ...meta, guide: existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '', hasCover: existsSync(join(dir, 'cover.jpg')) });
    }
    if (req.method === 'DELETE') { rmSync(dir, { recursive: true, force: true }); return send(res, 200, { ok: true }); }
    return send(res, 404, { error: 'not found' });
  }
  if (a !== 'projects') return send(res, 404, { error: 'not found' });
  if (!id) {
    if (req.method === 'GET') {
      const list = readdirSync(PROJECTS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => readProject(d.name)).filter(Boolean).filter((q) => !q.deleted || (trashProject(q.id) && false)).sort((x, y) => (y.created || 0) - (x.created || 0));
      for (const q of list) q.thumb = await thumbOf(q);
      return send(res, 200, list);
    }
    if (req.method === 'POST') {
      const j = JSON.parse(await body(req, 1e5)); if (!String(j.name || '').trim()) return send(res, 400, { error: 'name needed' });
      let s = slug(j.name), n = 2; while (existsSync(pdir(s))) s = slug(j.name) + '-' + n++;
      for (const d of ['raw', 'frames', 'drafts', 'revisions', 'voiceover']) mkdirSync(join(pdir(s), d), { recursive: true });
      const p = { id: s, name: String(j.name).trim(), styleId: j.styleId || '', format: j.format && j.format.w && j.format.h ? j.format : undefined, rawName: '', notes: [], phase: 'script', brief: '', dur: 0, created: Date.now() };
      writeProject(p); return send(res, 200, p);
    }
  }
  const p = readProject(id); if (!p) return send(res, 404, { error: 'no such project' });
  if (!b && req.method === 'DELETE') {
    if (runs.get(id)?.running) return send(res, 409, { error: 'Claude is working on this project. Stop it first.' });
    const kids = readdirSync(PROJECTS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => readProject(d.name)).filter((q) => q && !q.deleted && q.madeFrom === p.id);
    if (kids.length) return send(res, 409, { error: 'COPIES:' + kids.map((q) => q.name).join(' | ') });
    p.deleted = true; writeProject(p); trashProject(p.id); return send(res, 200, { ok: true });
  }
  if (b === 'restyle' && req.method === 'POST') { // a copy of this project in a new style: same footage, no notes or old renders
    if (runs.get(id)?.running) return send(res, 409, { error: 'Claude is working on this project. Wait for it to finish.' });
    const j = JSON.parse(await body(req, 1e4)), nm = String(j.styleName || '').trim();
    const root = p.baseName || p.name, ver = 1 + Math.max(p.version || 1, ...readdirSync(PROJECTS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => readProject(d.name)).filter((x) => x && !x.deleted && x.baseName === root).map((x) => x.version || 1)), title = root + ' - V' + ver + ' - ' + (nm || 'new style');
    let n = slug(title), i = 2; const base = n; while (existsSync(pdir(n))) n = base + '-' + i++;
    const share = (from, to) => { mkdirSync(to, { recursive: true }); for (const e of readdirSync(from, { withFileTypes: true })) { const f = join(from, e.name), t = join(to, e.name); if (e.isDirectory()) share(f, t); else { try { linkSync(f, t); } catch { cpSync(f, t); } } } }; // hardlink = no extra disk; copy if the drive cannot link
    for (const e of readdirSync(pdir(id), { withFileTypes: true })) {
      if (['drafts', 'frames', 'revisions', 'project.json', 'thumb.jpg'].includes(e.name) || e.name.startsWith('.')) continue;
      e.isDirectory() ? share(join(pdir(id), e.name), join(pdir(n), e.name)) : cpSync(join(pdir(id), e.name), join(pdir(n), e.name));
    }
    for (const d of ['drafts', 'frames', 'revisions']) mkdirSync(join(pdir(n), d), { recursive: true });
    const q = { ...p, id: n, name: title, baseName: root, version: ver, styleId: j.styleId || '', notes: [], versions: [], hiddenDrafts: [], struck: p.struck || [], created: Date.now(), phase: 'approved', madeFrom: p.id, madeFromName: p.name };
    for (const k of ['session', 'deleted', 'reached', 'cutNotes', 'sched', 'scriptSrc', 'skipFrames', 'framesV', 'thumb', '_t']) delete q[k];
    writeProject(q); return send(res, 200, q);
  }
  if (b === 'duplicate' && req.method === 'POST') {
    let n = slug(p.name + ' copy'), i = 2; while (existsSync(pdir(n))) n = slug(p.name + ' copy') + '-' + i++;
    cpSync(pdir(id), pdir(n), { recursive: true });
    const q = { ...p, id: n, name: p.name + ' copy', created: Date.now() }; delete q.session; writeProject(q); return send(res, 200, q);
  }
  if (!b && req.method === 'PUT') { const j = JSON.parse(await body(req, 5e6)); writeProject({ ...j, id: p.id, session: p.session || j.session }); return send(res, 200, { ok: true }); }
  if (b === 'raw' && req.method === 'PUT') {
    const name = safeName(url.searchParams.get('name')); const out = createWriteStream(join(pdir(id), 'raw', name));
    req.pipe(out); out.on('finish', () => {
      // a new raw video makes the old transcript and text cuts wrong
      rmSync(join(pdir(id), 'transcript.json'), { force: true }); rmSync(join(pdir(id), 'cut'), { recursive: true, force: true });
      Object.assign(p, { rawName: name, struck: [], cuts: [], cutFile: '' }); writeProject(p); send(res, 200, p);
    }); out.on('error', () => send(res, 500, { error: 'could not save' })); return;
  }
  if (b === 'rawpart' && req.method === 'PUT') { // one of several clips to be joined into one raw video before anything else happens
    const name = safeName(url.searchParams.get('name')); const out = createWriteStream(join(pdir(id), 'raw', name));
    req.pipe(out); out.on('finish', () => send(res, 200, { name })); out.on('error', () => send(res, 500, { error: 'could not save' })); return;
  }
  if (b === 'concat' && req.method === 'POST') { // joins the uploaded rawpart clips, in the given order, into the project's one raw video
    const j = JSON.parse(await body(req, 1e5));
    const files = (Array.isArray(j.files) ? j.files : []).map(safeName).filter((f) => existsSync(join(pdir(id), 'raw', f)));
    if (files.length < 2) return send(res, 400, { error: 'need at least two clips to combine' });
    const out = 'combined' + (extname(files[0]) || '.mp4'), outPath = join(pdir(id), 'raw', out), listFile = join(pdir(id), 'raw', '.concat-list.txt');
    writeFileSync(listFile, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    // the fast path only works when the clips already match (codec/resolution); otherwise fall back to a re-encoding concat
    let r = await proc('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outPath]);
    if (r.code !== 0 || !existsSync(outPath)) {
      const inputs = files.flatMap((f) => ['-i', join(pdir(id), 'raw', f)]);
      const filt = files.map((_, i) => `[${i}:v:0][${i}:a:0]`).join('') + `concat=n=${files.length}:v=1:a=1[v][a]`;
      r = await proc('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filt, '-map', '[v]', '-map', '[a]', outPath]);
    }
    rmSync(listFile, { force: true });
    if (r.code !== 0 || !existsSync(outPath)) return send(res, 500, { error: 'Could not join the clips: ' + r.err });
    files.forEach((f) => rmSync(join(pdir(id), 'raw', f), { force: true })); // the separate parts aren't needed once combined
    rmSync(join(pdir(id), 'transcript.json'), { force: true }); rmSync(join(pdir(id), 'cut'), { recursive: true, force: true });
    Object.assign(p, { rawName: out, struck: [], cuts: [], cutFile: '' }); writeProject(p); return send(res, 200, p);
  }
  if (b === 'broll' && req.method === 'PUT') { // extra footage a revision note asks BOSS to cut in
    const name = safeName(url.searchParams.get('name')), dir = url.searchParams.get('kind') === 'audio' ? 'audio' : 'broll'; mkdirSync(join(pdir(id), dir), { recursive: true });
    const out = createWriteStream(join(pdir(id), dir, name));
    req.pipe(out); out.on('finish', () => send(res, 200, { name })); out.on('error', () => send(res, 500, { error: 'could not save' })); return;
  }
  if (b === 'reference' && req.method === 'PUT') { // a video whose editing style BOSS should copy
    const name = safeName(url.searchParams.get('name')); mkdirSync(join(pdir(id), 'reference'), { recursive: true });
    const out = createWriteStream(join(pdir(id), 'reference', name));
    req.pipe(out); out.on('finish', () => { p.refFile = name; writeProject(p); send(res, 200, p); }); out.on('error', () => send(res, 500, { error: 'could not save' })); return;
  }
  if (b === 'voiceover' && req.method === 'PUT') {
    const name = safeName(url.searchParams.get('name')); mkdirSync(join(pdir(id), 'voiceover'), { recursive: true });
    const out = createWriteStream(join(pdir(id), 'voiceover', name));
    req.pipe(out); out.on('finish', () => {
      // the Script step now edits this voiceover, so old voiceover script edits no longer apply
      rmSync(join(pdir(id), 'vo-transcript.json'), { force: true }); rmSync(join(pdir(id), 'cut'), { recursive: true, force: true });
      Object.assign(p, { voiceoverFile: name, struck: [], cuts: [], cutFile: '' }); writeProject(p); send(res, 200, p);
    }); out.on('error', () => send(res, 500, { error: 'could not save' })); return;
  }
  const ls = (dir, re) => { try { return readdirSync(join(pdir(id), dir)).filter((f) => re.test(f)); } catch { return []; } };
  if (b === 'voiceover') { const f = ls('voiceover', /\.(mp3|wav|m4a|ogg)$/i).map((file) => ({ file, v: statSync(join(pdir(id), 'voiceover', file)).mtimeMs })).sort((x, y) => y.v - x.v); return send(res, 200, f); }
  if (b === 'frames') { const f = ls('frames', /\.(jpe?g|png)$/i).map((file) => ({ file, t: +(/_t(\d+(?:\.\d+)?)/.exec(file) || [0, 0])[1], v: statSync(join(pdir(id), 'frames', file)).mtimeMs })).sort((x, y) => x.t - y.t); return send(res, 200, f); }
  if (b === 'reveal' && req.method === 'POST') { // show a rendered version in Explorer / Finder
    const f = safeName(url.searchParams.get('file')), src = join(pdir(id), 'drafts', f);
    if (!existsSync(src)) return send(res, 404, { error: 'no such file' });
    const [exe, args] = process.platform === 'win32' ? ['explorer.exe', ['/select,"' + src + '"']] : process.platform === 'darwin' ? ['open', ['-R', src]] : ['xdg-open', [dirname(src)]];
    try { const c = spawn(exe, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }); c.on('error', () => {}); c.unref(); } catch { return send(res, 500, { error: 'could not open the folder' }); }
    // a new Explorer/Finder window can open behind the browser: ask the OS to bring it to the front
    // Windows blocks background apps from taking focus, so tap Alt first (that lifts the lock), then restore and focus the window
    const winFront = `Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n); [DllImport("user32.dll")] public static extern void keybd_event(byte k,byte s,uint f,UIntPtr e);'; $d=([Uri]$env:BS_DIR).AbsoluteUri.TrimEnd('/'); for($i=0;$i -lt 25;$i++){ $w=(New-Object -ComObject Shell.Application).Windows() | Where-Object { $_.LocationURL.TrimEnd('/') -ieq $d } | Select-Object -First 1; if($w){ $h=[IntPtr]$w.HWND; [W.U]::keybd_event(0x12,0,0,[UIntPtr]::Zero); [W.U]::keybd_event(0x12,0,2,[UIntPtr]::Zero); [void][W.U]::ShowWindow($h,9); [void][W.U]::SetForegroundWindow($h); break }; Start-Sleep -Milliseconds 120 }`;
    const front = process.platform === 'win32' ? ['powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', winFront]] : process.platform === 'darwin' ? ['osascript', ['-e', 'tell application "Finder" to activate']] : null;
    if (front) try { const c = spawn(front[0], front[1], { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, BS_DIR: dirname(src) } }); c.on('error', () => {}); c.unref(); } catch {}
    return send(res, 200, { ok: true });
  }
  if (b === 'drive' && req.method === 'POST') { // upload a rendered version into the Drive folder (by its id)
    const f = safeName(url.searchParams.get('file')), src = join(pdir(id), 'drafts', f), folder = url.searchParams.get('folder') || '';
    if (!existsSync(src)) return send(res, 404, { error: 'no such file' });
    if (!/^[A-Za-z0-9_-]{10,}$/.test(folder)) return send(res, 400, { error: 'That Drive folder link has no folder in it' });
    const bin = await findRclone(); if (!bin) return send(res, 409, { error: 'NEEDS_RCLONE' });
    if (!(await exec(bin, ['listremotes'], 20000)).out.includes(DRIVE_REMOTE + ':')) return send(res, 409, { error: 'NEEDS_CONNECT' });
    const name = safeName(p.name) + ' - ' + f;
    const r = await exec(bin, ['copyto', src, DRIVE_REMOTE + ':' + name, '--drive-root-folder-id=' + folder, '--stats=0'], 900000);
    return r.code === 0 ? send(res, 200, { ok: true, name }) : send(res, 500, { error: 'Drive upload failed: ' + (r.err.trim().split(/\r?\n/).pop() || 'unknown error') });
  }
  if (b === 'drafts' && req.method === 'DELETE') {
    const f = safeName(url.searchParams.get('file')), src = join(pdir(id), 'drafts', f);
    if (!existsSync(src)) return send(res, 404, { error: 'no such file' });
    if (runs.get(id)?.running) return send(res, 409, { error: 'Claude is rendering. Stop it first.' });
    try { mkdirSync(join(PROJECTS, '.trash'), { recursive: true }); renameSync(src, join(PROJECTS, '.trash', p.id + '-draft-' + Date.now() + '-' + f)); } catch { p.hiddenDrafts = [...new Set([...(p.hiddenDrafts || []), f])]; writeProject(p); } return send(res, 200, { ok: true });
  }
  if (b === 'drafts') { const f = ls('drafts', /\.(mp4|mov|webm)$/i).filter((x) => !(p.hiddenDrafts || []).includes(x)).map((file) => { const st = statSync(join(pdir(id), 'drafts', file)); return { file, v: st.mtimeMs, size: st.size }; }).sort((x, y) => y.v - x.v); return send(res, 200, f); }
  if (b === 'status') { const s = runs.get(id); return send(res, 200, s ? { running: s.running, text: s.text, tool: s.tool, error: s.error, code: s.code, startedAt: s.startedAt, finishedAt: s.finishedAt } : { running: false }); }
  if (['transcribe', 'suggest', 'apply'].includes(b) && req.method === 'POST') {
    if (busy.has(id) || runs.get(id)?.running) return send(res, 409, { error: 'Something is still running on this project. Wait for it to finish.' });
    const raw = await body(req, 5e6); let j; try { j = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { error: 'bad request' }); }
    busy.add(id);
    try {
      const r = await scriptJob(id, p, b, j);
      if (b === 'apply' && !r.error) { const q = readProject(id); q.cutFile = r.cutFile; q.cuts = j.cuts || []; writeProject(q); }
      return send(res, r.status || 200, r.status ? { error: r.error } : r);
    } finally { busy.delete(id); }
  }
  if (b === 'cancel' && req.method === 'POST') { const s = runs.get(id); if (s?.child && s.running) s.child.kill(); return send(res, 200, { ok: true }); }
  if (b === 'run' && req.method === 'POST') {
    if (runs.get(id)?.running) return send(res, 409, { error: 'Claude is already working on this project' });
    const j = JSON.parse(await body(req, 40e6)); let prompt = String(j.prompt || ''); if (!prompt) return send(res, 400, { error: 'no prompt' });
    const batch = 'batch-' + Date.now(); let any = false;
    for (const [k, u] of Object.entries(j.images || {})) {
      const key = String(k).replace(/[^a-z0-9-]/gi, '').slice(0, 40), img = dataUrl(u); if (!key || !img) continue;
      mkdirSync(join(pdir(id), 'revisions', batch), { recursive: true });
      writeFileSync(join(pdir(id), 'revisions', batch, key + '.' + img.ext), img.buf); any = true;
      prompt = prompt.split('{{img:' + key + '}}').join('projects/' + id + '/revisions/' + batch + '/' + key + '.' + img.ext);
    }
    prompt = prompt.replace(/\{\{img:[a-z0-9-]+\}\}/gi, '(no image)');
    startRun(id, prompt, j.model); return send(res, 200, { ok: true, batch: any ? batch : '' });
  }
  return send(res, 404, { error: 'not found' });
}

// ---- files (with Range, so videos can seek)
function serve(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') { res.writeHead(302, { location: '/hub/studio-v2/index.html' }); return res.end(); }
  if (rel === '/hub/my-styles.js' && !existsSync(join(ROOT, 'hub', 'my-styles.js'))) { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end('// no personal styles yet\n'); }
  const file = normalize(join(ROOT, rel));
  const top = file.slice(ROOT.length + 1).split(sep)[0];
  if (!file.startsWith(ROOT + sep) || !SHOW.includes(top) || file.slice(ROOT.length).split(sep).some((x) => x.startsWith('.'))) { res.writeHead(404); return res.end('not found'); }
  let target = file; try { if (statSync(target).isDirectory()) target = join(target, 'index.html'); } catch { res.writeHead(404); return res.end('not found'); }
  let size; try { size = statSync(target).size; } catch { res.writeHead(404); return res.end('not found'); }
  const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const s = m[1] ? +m[1] : Math.max(0, size - +m[2]), e = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${e}/${size}`, 'content-length': e - s + 1, 'cache-control': 'no-cache' });
    return createReadStream(target, { start: s, end: e }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size, 'cache-control': 'no-cache' });
  createReadStream(target).pipe(res);
}

http.createServer(async (req, res) => {
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  if (host !== 'localhost' && host !== '127.0.0.1') { res.writeHead(403); return res.end('forbidden'); }
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const o = req.headers.origin; if (req.headers['x-studio'] !== '1' || (o && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))) return send(res, 403, { error: 'forbidden' });
      return await api(req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serve(req, res, url);
  } catch (e) { if (!res.headersSent) send(res, 500, { error: String(e.message || e) }); else res.end(); }
}).listen(PORT, '127.0.0.1', () => console.log(`Editing Studio running at http://localhost:${PORT}  (workspace: ${ROOT})`));
