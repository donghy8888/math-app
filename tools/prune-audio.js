#!/usr/bin/env node
/* 删除 audio/ 中不再被任何文本使用的录音（文本改动后运行） */
const fs = require('fs'), path = require('path'); const ROOT = path.resolve(__dirname, '..');
const S = require(path.join(ROOT, 'src/speech.js')), VT = require(path.join(ROOT, 'src/voice-texts.js')), DR = require(path.join(ROOT, 'src/drill.js'));
let texts = VT.fixed().concat(DR.speechTexts());
for (const f of ['demo-pack.json', ...fs.readdirSync(path.join(ROOT, 'packs')).filter(f => f.endsWith('.json')).map(f => 'packs/' + f)]) texts.push(...VT.allForPack(JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
const want = new Set(texts.map(t => S.hash(S.toSpeech(t))));
const mp = path.join(ROOT, 'audio/manifest.json'), man = JSON.parse(fs.readFileSync(mp, 'utf8'));
const stale = Object.keys(man.clips).filter(h => !want.has(h));
stale.forEach(h => { delete man.clips[h]; try { fs.unlinkSync(path.join(ROOT, 'audio', h + '.mp3')); } catch (e) {} });
fs.writeFileSync(mp, JSON.stringify(man, null, 1)); console.log('删除', stale.length, '条：', stale.map(h => h).join(' '));
