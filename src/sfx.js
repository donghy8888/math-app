/* ========== 答对音效：Web Audio 合成（不需要音频文件） ==========
   - 录音走 speech.js 里共享的 HTMLAudioElement；音效走独立的 AudioContext，二者混音、互不打断。
   - iPad Safari：AudioContext 只能在用户手势里创建/恢复 → 由首次点击（捕获阶段）调用 unlock()。
   - iOS 静音开关会让 Web Audio 静音（录音元素不受影响）：支持 navigator.audioSession 时设为 playback，
     否则静默降级（只是听不到音效，不报错、不影响录音）。 */
var MQSfx = (function(){
'use strict';
var hasWin = typeof window!=='undefined';
var AC = hasWin ? (window.AudioContext || window.webkitAudioContext) : null;
var ctx = null, master = null, comp = null, enabled = true, vol = 0.3, busyUntil = 0, lastVariant = -1, log = [];
var VOLS = {low:0.15, mid:0.3, high:0.5};
var BASE = 0.65; /* 多个音叠加后的总峰值：中档约 0.3~0.45，低于朗读录音 */
function now(){ return ctx ? ctx.currentTime : 0; }
function ensure(){
  if(ctx || !AC) return ctx;
  try{
    try{ if(navigator.audioSession && navigator.audioSession.type!=='playback') navigator.audioSession.type = 'playback'; }catch(e){}
    ctx = new AC();
    comp = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null; /* 防止叠加时爆音 */
    master = ctx.createGain(); master.gain.value = BASE;
    if(comp){ try{ comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2; }catch(e){} master.connect(comp); comp.connect(ctx.destination); }
    else master.connect(ctx.destination);
  }catch(e){ ctx = null; }
  return ctx;
}
/* 必须在用户手势里调用：创建/恢复上下文，并播放 1 个采样的静音缓冲（老版 iOS 需要） */
var primed = false;
function unlock(){
  if(!enabled && !ctx) return;
  if(!ensure()) return;
  try{ if(ctx.state!=='running' && ctx.resume){ var p = ctx.resume(); if(p && p.catch) p.catch(function(){}); } }catch(e){}
  if(!primed){ try{ var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); primed = true; }catch(e){} }
}
/* 切到后台回来后 iOS 可能处于 interrupted：下次点击 unlock() 或播放前 ready() 会再 resume */
function ready(){
  if(!enabled || !AC) return false;
  if(!ctx) return false; /* 还没有用户手势：不创建，静默跳过 */
  if(ctx.state==='suspended' || ctx.state==='interrupted'){ try{ var p = ctx.resume(); if(p && p.catch) p.catch(function(){}); }catch(e){} }
  return ctx.state!=='closed';
}
/* 一个柔和的“铃音”：正弦基音 + 少量泛音，快起慢落，经低通去刺耳高频 */
function bell(freq, t, dur, gain, opts){
  opts = opts || {};
  var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = opts.type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if(opts.glide) o.frequency.exponentialRampToValueAtTime(freq*opts.glide, t+dur*0.6);
  f.type = 'lowpass'; f.frequency.value = Math.min(9000, freq*4); f.Q.value = 0.4;
  var peak = Math.max(0.0002, gain*vol), att = opts.att || 0.008;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t+att); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.05);
  if(opts.partial!==false){ /* 2 倍泛音，让声音更像铃 */
    var o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.setValueAtTime(freq*2.0, t);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(peak*0.22, t+att); g2.gain.exponentialRampToValueAtTime(0.0001, t+dur*0.5);
    o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t+dur*0.5+0.05);
  }
  busyUntil = Math.max(busyUntil, t+dur);
}
function sparkle(t, n, base, spread, gain){ /* 高音区随机小星星 */
  var pent = [0,2,4,7,9,12,14,16,19,21,24];
  for(var i=0;i<n;i++){ var semi = pent[Math.floor(Math.random()*pent.length)]; bell(base*Math.pow(2,semi/12), t + i*spread + Math.random()*0.02, 0.28, gain*(0.7+Math.random()*0.3), {partial:false}); }
}
var N = function(semiFromA4){ return 440*Math.pow(2, semiFromA4/12); };
/* 几个短音变体（大调五声音阶，避免单调） */
var CHIMES = [
  [N(3+12), N(7+12)],          /* C6 E6 */
  [N(5+12), N(10+12)],         /* D6 G6 */
  [N(7+12), N(12+12)],         /* E6 A6 */
  [N(-2+12), N(3+12), N(7+12)] /* G5 C6 E6 */
];
function chime(o){
  o = o || {};
  var i; do { i = Math.floor(Math.random()*CHIMES.length); } while(CHIMES.length>1 && i===lastVariant); lastVariant = i;
  var t = now()+0.01, notes = CHIMES[i];
  notes.forEach(function(f, k){ bell(f, t + k*0.075, k===notes.length-1 ? 0.55 : 0.32, 0.9); });
  if(o.bonus) sparkle(t + notes.length*0.075 + 0.04, 3, N(3+24), 0.05, 0.35);
  return 'chime'+(o.bonus?'+':'')+i;
}
function fanfare(o){
  o = o || {};
  var t = now()+0.02;
  var arp = [N(-9), N(-5), N(-2), N(3), N(7), N(10)]; /* C5 E5 G5 C6 E6 G6 上行琶音 */
  arp.forEach(function(f, k){ bell(f, t + k*0.085, 0.42, 0.65, {type: k%2 ? 'sine' : 'triangle'}); });
  var tc = t + arp.length*0.085 + 0.02;
  [N(3), N(7), N(10), N(15)].forEach(function(f){ bell(f, tc, 1.15, 0.38, {att:0.02}); }); /* 收尾大三和弦 */
  sparkle(tc+0.05, o.bonus ? 8 : 4, N(3+12), 0.07, 0.3);
  return 'fanfare'+(o.bonus?'+':'');
}
function levelup(){
  var t = now()+0.02;
  for(var k=0;k<8;k++) bell(N(-9 + [0,2,4,5,7,9,11,12][k]), t + k*0.055, 0.25, 0.5, {partial:false}); /* 快速上行音阶 */
  var t2 = t + 8*0.055 + 0.05;
  [N(3), N(10), N(15)].forEach(function(f){ bell(f, t2, 0.5, 0.45); });
  [N(5), N(12), N(17), N(22)].forEach(function(f){ bell(f, t2+0.22, 1.3, 0.34, {att:0.015}); }); /* 升高一个全音的“胜利”和弦 */
  sparkle(t2+0.25, 9, N(3+12), 0.08, 0.3);
  return 'levelup';
}
var KINDS = {chime:chime, fanfare:fanfare, levelup:levelup};
function play(kind, o){
  if(!ready()) { log.push({kind:kind, skipped:true}); return false; }
  try{ if(master){ master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(BASE, now()); } var r = KINDS[kind](o); log.push({kind:kind, v:r, t:Date.now()}); return true; }
  catch(e){ return false; }
}
/* 录音开始时如果音效还在响，把音效压低（不停止），两者都听得见 */
function duck(){
  if(!ctx || !master || now() >= busyUntil) return;
  try{ var t = now(); master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(BASE*0.45, t+0.08); }catch(e){}
}
function remainingMs(){ return ctx ? Math.max(0, (busyUntil - now())*1000) : 0; }
return { play: play, unlock: unlock, duck: duck, remainingMs: remainingMs, supported: !!AC,
  setEnabled: function(v){ enabled = !!v; }, setVolume: function(v){ vol = typeof v==='number' ? v : (VOLS[v] || 0.3); },
  state: function(){ return ctx ? ctx.state : 'none'; }, log: log, VOLS: VOLS };
})();
if(typeof module!=='undefined') module.exports = MQSfx;
