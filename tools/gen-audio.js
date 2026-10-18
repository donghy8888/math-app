#!/usr/bin/env node
/*
 * 为题包生成「内置普通话」朗读录音（Microsoft Edge 神经网络语音 zh-CN-XiaoxiaoNeural）。
 * 依赖：Node 18+、Python 包 edge-tts（pip install edge-tts）、ffmpeg。
 * 用法：
 *   node tools/gen-audio.js                       # 内置题包（demo-pack.json + packs/*.json）+ 温馨提醒
 *   node tools/gen-audio.js packs/new-pack.json   # 只为指定题包补生成
 * 选项：--voice zh-CN-XiaoxiaoNeural  --rate -10%  --kbps 24  --analysis-kbps 16  --out audio  --only-prompts
 * 生成后：重新运行 ./build.sh（把清单内嵌进 index.html），并把 audio/ 目录一起发布。
 */
const fs = require('fs'), path = require('path'), os = require('os'), { execFile } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const S = require(path.join(ROOT, 'src/speech.js'));
const VT = require(path.join(ROOT, 'src/voice-texts.js'));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i >= 0) { const v = args[i + 1]; args.splice(i, 2); return v; } return d; };
const VOICE = opt('--voice', 'zh-CN-XiaoxiaoNeural'), RATE = opt('--rate', '-10%'), KBPS = opt('--kbps', '24'), AKBPS = opt('--analysis-kbps', '16'), OUT = path.resolve(ROOT, opt('--out', 'audio'));
const onlyPrompts = args.includes('--only-prompts'); const files = args.filter(a => !a.startsWith('--'));
if (!/^zh-CN-/.test(VOICE)) { console.error('只允许 zh-CN 普通话声音'); process.exit(1); }
const packFiles = files.length ? files : [path.join(ROOT, 'demo-pack.json'), ...fs.readdirSync(path.join(ROOT, 'packs')).filter(f => f.endsWith('.json')).map(f => path.join(ROOT, 'packs', f))];
let texts = files.length ? [] : VT.fixed();
for (const f of packFiles) {
  const pack = JSON.parse(fs.readFileSync(f, 'utf8'));
  let t = VT.allForPack(pack);
  if (onlyPrompts) t = pack.questions.flatMap(q => q.steps.map((s, i) => VT.forQuestion(q, 'prompt', i)));
  texts.push(...t);
}
const spoken = [...new Set(texts.map(t => S.toSpeech(t)).filter(t => t && t.trim()))];
/* 审题分析文本较长、只在手动点 🔊 时播放，用更低码率（默认 16kbps）控制体积 */
const analysisSet = new Set();
for (const f of packFiles) { const pack = JSON.parse(fs.readFileSync(f, 'utf8')); (pack.questions || []).forEach(q => { if (q.analysis) VT.ANALYSIS_KINDS.forEach(k => analysisSet.add(S.toSpeech(VT.forQuestion(q, k)))); }); }
fs.mkdirSync(OUT, { recursive: true });
const manPath = path.join(OUT, 'manifest.json');
const man = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : { clips: {} };
Object.assign(man, { voice: VOICE, rate: RATE, kbps: +KBPS, analysisKbps: +AKBPS, format: 'mp3 mono', note: '文件名 = hash(朗读文本)，见 src/speech.js 的 hash()' });
const run = (cmd, a) => new Promise((res, rej) => execFile(cmd, a, { maxBuffer: 1 << 24 }, (e, so, se) => e ? rej(new Error(se || e.message)) : res(so)));
const edge = fs.existsSync(path.join(os.homedir(), '.local/bin/edge-tts')) ? path.join(os.homedir(), '.local/bin/edge-tts') : 'edge-tts';
let made = 0, skipped = 0, failed = 0;
async function one(text) {
  const h = S.hash(text), out = path.join(OUT, h + '.mp3');
  if (fs.existsSync(out) && fs.statSync(out).size > 500) { man.clips[h] = text; skipped++; return; }
  const tmp = path.join(os.tmpdir(), 'mq-' + h + '.mp3');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await run(edge, ['--voice', VOICE, '--rate=' + RATE, '--text', text, '--write-media', tmp]);
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', '24000', '-b:a', (analysisSet.has(text) ? AKBPS : KBPS) + 'k', '-map_metadata', '-1', out]);
      fs.unlinkSync(tmp); man.clips[h] = text; made++; return;
    } catch (e) { if (attempt === 3) { failed++; console.error('失败', h, text.slice(0, 30), e.message.slice(0, 120)); } else await new Promise(r => setTimeout(r, 1500 * attempt)); }
  }
}
(async () => {
  console.log(`声音 ${VOICE}（普通话），语速 ${RATE}，${KBPS}kbps（审题分析 ${AKBPS}kbps）；文本 ${spoken.length} 条`);
  const queue = spoken.slice(); const workers = Array.from({ length: 6 }, async () => { while (queue.length) await one(queue.shift()); });
  await Promise.all(workers);
  man.generated = new Date().toISOString();
  fs.writeFileSync(manPath, JSON.stringify(man, null, 1));
  const total = fs.readdirSync(OUT).filter(f => f.endsWith('.mp3')).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`完成：新生成 ${made}，已存在 ${skipped}，失败 ${failed}；清单共 ${Object.keys(man.clips).length} 条，目录总大小 ${(total / 1048576).toFixed(2)} MB`);
  process.exit(failed ? 1 : 0);
})();
