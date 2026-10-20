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
function isIOS(){ if(!hasWin) return false; var u = navigator.userAgent||''; return /iP(hone|ad|od)/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints>1); }
function now(){ return ctx ? ctx.currentTime : 0; }
function setSession(){ try{ if(hasWin && navigator.audioSession && navigator.audioSession.type!=='playback') navigator.audioSession.type = 'playback'; }catch(e){} }
var primed = false, stale = false, keepAlive = null, gen = 0, lastCT = -1, lastWall = 0, lastGesture = 0, reviveT = 0, stats = {recreated: 0, resumed: 0, fallback: 0, capped: 0};
function build(){
  try{
    setSession();
    ctx = new AC(); gen++; noiseBuf = null; silentBuf = null; active = 0; ends = []; lastCT = -1;
    comp = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null; /* 防止叠加时爆音 */
    master = ctx.createGain(); master.gain.value = BASE;
    if(comp){ try{ comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2; }catch(e){} master.connect(comp); comp.connect(ctx.destination); }
    else master.connect(ctx.destination);
    /* iOS：录音播放、来电、切到后台后上下文会变成 interrupted/suspended，标记下来，下一次点击时在手势里恢复 */
    var me = ctx; ctx.onstatechange = function(){ if(ctx===me && ctx.state!=='running') stale = true; };
  }catch(e){ ctx = null; }
  return ctx;
}
function ensure(){ if(ctx && ctx.state!=='closed') return ctx; if(!AC) return null; return build(); }
function recreate(){ /* 关掉旧上下文、重建（必须在手势里调用，新上下文才能直接 running） */
  var old = ctx; ctx = null; master = null; comp = null; stats.recreated++;
  try{ if(old && old.state!=='closed' && old.close){ var p = old.close(); if(p && p.catch) p.catch(function(){}); } }catch(e){}
  build(); resumeNow(); prime(); return ctx;
}
function resumeNow(){ /* 同步调用（在手势里才有效） */
  try{ if(ctx && ctx.state!=='running' && ctx.state!=='closed' && ctx.resume){ stats.resumed++; var p = ctx.resume(); if(p && p.catch) p.catch(function(){}); return p; } }catch(e){}
  return null;
}
var silentBuf = null;
function prime(){ /* 每次手势都放 1 个采样的静音缓冲（复用同一个 buffer），让 iOS 保持音频通路 */
  try{ if(!silentBuf) silentBuf = ctx.createBuffer(1, 1, 22050); var s = ctx.createBufferSource(); s.buffer = silentBuf; s.connect(ctx.destination);
    s.onended = function(){ try{ s.disconnect(); }catch(e){} }; s.start(0); primed = true; }catch(e){}
}
/* 每次 pointerdown/touchend/click（捕获阶段）调用：检查状态，必要时恢复或重建 */
function unlock(force){
  if(!enabled && !ctx) return;
  if(!AC) return;
  lastGesture = Date.now(); setSession();
  if(force===true || !ctx || ctx.state==='closed'){ if(ctx) recreate(); else { build(); resumeNow(); prime(); } check(); return; }
  var st = ctx.state, wall = performance.now();
  /* iOS 冻结时钟：状态显示 running，但 currentTime 不再前进 → 重建 */
  if(st==='running' && lastCT>=0 && wall - lastWall > 250 && ctx.currentTime === lastCT){ recreate(); check(); return; }
  if(st!=='running'){ resumeNow(); }
  prime(); check();
  if(ctx.state==='running') stale = false;
  note(wall);
}
function note(wall){ /* 只在时钟变化时记下（用于检测冻结） */ if(ctx && ctx.state==='running'){ var c = ctx.currentTime; if(c !== lastCT){ lastCT = c; lastWall = wall || performance.now(); } } else lastCT = -1; }
function check(){ /* resume 300ms 内没到 running → 标记，下一次手势里重建 */
  clearTimeout(reviveT); var g = gen;
  reviveT = setTimeout(function(){ if(!ctx || g!==gen) return; if(ctx.state!=='running'){ stale = true; needRebuild = true; } note(); }, 300);
}
var needRebuild = false;
function onGesture(){ if(!enabled || !ctx) return; if(needRebuild && ctx){ needRebuild = false; recreate(); check(); return; } unlock(); }
function markStale(){ stale = true; if(ctx && ctx.state!=='running') needRebuild = ctx.state==='closed'; }
if(hasWin && typeof document!=='undefined'){
  ['pointerdown','touchend','click'].forEach(function(ev){ document.addEventListener(ev, onGesture, {capture: true, passive: true}); });
  document.addEventListener('visibilitychange', function(){ markStale(); if(document.visibilityState==='hidden') lastCT = -1; });
  window.addEventListener('pageshow', function(e){ markStale(); if(e && e.persisted) needRebuild = !!ctx; });
  window.addEventListener('pagehide', markStale); window.addEventListener('focus', markStale); window.addEventListener('blur', markStale);
  /* 录音元素被系统打断（来电、Siri、其它 App 播放）时，音频会话往往也被打断 */
  ['pause','ended'].forEach(function(ev){ document.addEventListener(ev, function(e){ if(e.target && e.target.tagName==='AUDIO' && !e.target.__mqSfx) markStale(); }, true); });
}
function canPlay(){ return enabled && !!AC && !!ctx && ctx.state!=='closed'; }
/* 同时发声的节点上限（切公式里很多粒子/刀光时防止 WebKit 节点泄漏导致静音） */
var MAXV = 24, active = 0;
var ends = [];
function voices(){ var t = now(); ends = ends.filter(function(e){ return e > t; }); active = ends.length; return active; }
function track(src, nodes, end){ ends.push(end); active = ends.length; src.onended = function(){ nodes.forEach(function(n){ try{ n.disconnect(); }catch(e){} }); }; }
/* 兜底：Web Audio 恢复不了时，用预先渲染好的小音频（HTMLAudio 池）播放 */
var pool = [], poolI = 0, WAV = (hasWin && window.MQSfxWav) || {};
function fallback(kind, muted){
  var src = WAV[kind] || WAV[kind==='flip' || kind==='soft' ? 'chime' : kind]; if(!src || typeof Audio==='undefined') return false;
  try{ if(!pool.length) for(var i=0;i<3;i++){ var a = new Audio(); a.__mqSfx = true; a.preload = 'auto'; pool.push(a); }
    var e = pool[poolI++ % pool.length]; if(e.getAttribute('src')!==src) e.src = src; e.volume = Math.min(1, vol*2); e.muted = !!muted; try{ e.currentTime = 0; }catch(_){}
    var p = e.play(); if(p && p.catch) p.catch(function(){}); if(!muted) stats.fallback++; return e; }catch(e){ return false; }
}
/* 一个柔和的“铃音”：正弦基音 + 少量泛音，快起慢落，经低通去刺耳高频 */
function bell(freq, t, dur, gain, opts){
  opts = opts || {};
  if(voices() >= MAXV){ stats.capped++; return; }
  var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = opts.type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if(opts.glide) o.frequency.exponentialRampToValueAtTime(freq*opts.glide, t+dur*0.6);
  f.type = 'lowpass'; f.frequency.value = Math.min(9000, freq*4); f.Q.value = 0.4;
  var peak = Math.max(0.0002, gain*vol), att = opts.att || 0.008;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t+att); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(f); f.connect(g); g.connect(master); track(o, [o, f, g], t+dur+0.05); o.start(t); o.stop(t+dur+0.05);
  if(opts.partial!==false && voices() < MAXV){ /* 2 倍泛音，让声音更像铃 */
    var o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.setValueAtTime(freq*2.0, t);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(peak*0.22, t+att); g2.gain.exponentialRampToValueAtTime(0.0001, t+dur*0.5);
    o2.connect(g2); g2.connect(master); track(o2, [o2, g2], t+dur*0.5+0.05); o2.start(t); o2.stop(t+dur*0.5+0.05);
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
function flip(){ /* 翻卡：非常轻的“嗒”——短促下滑的正弦，不带泛音 */
  var t = now()+0.005;
  bell(N(-2+12) * (0.96+Math.random()*0.08), t, 0.12, 0.5, {partial:false, glide:0.7, att:0.004});
  return 'flip';
}
var noiseBuf = null;
function slice(){ /* 刀光“嗖”：带通滤波的噪声，频率快速上扫；不支持时用正弦滑音代替 */
  var t = now()+0.003, dur = 0.16;
  try{
    if(!noiseBuf){ var n = Math.floor(ctx.sampleRate*0.25); noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for(var i=0;i<n;i++) d[i] = Math.random()*2-1; }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf;
    f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(3200, t+dur);
    var pk = Math.max(0.0002, 0.55*vol);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t+0.03); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    if(voices() >= MAXV){ stats.capped++; return 'slice'; }
    s.connect(f); f.connect(g); g.connect(master); track(s, [s, f, g], t+dur+0.02); s.start(t); s.stop(t+dur+0.02); busyUntil = Math.max(busyUntil, t+dur);
  }catch(e){ bell(N(3+12), t, 0.12, 0.3, {partial:false, glide:1.6, att:0.004}); }
  return 'slice';
}
function soft(){ /* 切错：低而软的“咚”，不刺耳、不像警报 */
  var t = now()+0.005;
  bell(N(-14), t, 0.22, 0.55, {partial:false, glide:0.85, att:0.01});
  return 'soft';
}
var KINDS = {chime:chime, fanfare:fanfare, levelup:levelup, flip:flip, slice:slice, soft:soft};
function doPlay(kind, o){
  try{ if(master){ master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(BASE, now()); } var r = KINDS[kind](o); log.push({kind:kind, v:r, t:Date.now()});
    if(keepAlive) try{ keepAlive(); }catch(e){}
    return true; }
  catch(e){ return false; }
}
/* 上下文没在运行（iOS 的 suspended/interrupted）：先在当前手势里 resume，再播放。
   绝不在“冻结”的时钟上排队——否则恢复后会一下子补放一串旧音效。恢复不了就跳过这一次。 */
function inGesture(){ return Date.now() - lastGesture < 150; }
function play(kind, o){
  if(!enabled || !AC){ log.push({kind:kind, skipped:true}); return false; }
  if(!canPlay() && inGesture()) unlock(true);
  if(!canPlay()){ log.push({kind:kind, skipped:true}); return false; }
  if(ctx.state==='running') return doPlay(kind, o);
  var p = resumeNow();
  if(ctx.state==='running') return doPlay(kind, o);
  /* 手势里：先静音启动兜底音频（保住手势权限）；Web Audio 250ms 内恢复就用合成音，否则取消静音用兜底音频 */
  var fb = inGesture() ? fallback(kind, true) : null, t0 = Date.now(), done = false;
  var useFb = function(why){ if(done) return; done = true; if(fb){ try{ fb.muted = false; fb.currentTime = 0; }catch(e){} stats.fallback++; needRebuild = true; log.push({kind:kind, v:'fallback', fallback:true, why:why, t:Date.now()}); } else log.push({kind:kind, skipped:why}); };
  if(p && p.then){
    p.then(function(){ if(done) return; if(ctx && ctx.state==='running' && Date.now()-t0 < 600){ done = true; if(fb) try{ fb.pause(); }catch(e){} doPlay(kind, o); } else useFb('late'); }, function(){ useFb('resume'); });
    if(fb) setTimeout(function(){ useFb('timeout'); }, 250);
    return true;
  }
  if(fb){ useFb('noresume'); return true; }
  log.push({kind:kind, skipped:'suspended'}); return false;
}
/* 录音开始时如果音效还在响，把音效压低（不停止），两者都听得见 */
function duck(){
  if(!ctx || !master || now() >= busyUntil) return;
  try{ var t = now(); master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(BASE*0.45, t+0.08); }catch(e){}
}
function remainingMs(){ return ctx ? Math.max(0, (busyUntil - now())*1000) : 0; }
return { play: play, unlock: unlock, duck: duck, remainingMs: remainingMs, supported: !!AC,
  /* iOS 旧版本没有 navigator.audioSession：页面上没有媒体元素在播放时，Web Audio 会跟随静音开关。
     传入一个回调（让共享录音元素在空闲时放一小段静音），把音频会话保持在 playback。 */
  setKeepAlive: function(f){ keepAlive = f; }, needsKeepAlive: function(){ return isIOS() && !(hasWin && navigator.audioSession); },
  setEnabled: function(v){ enabled = !!v; }, setVolume: function(v){ vol = typeof v==='number' ? v : (VOLS[v] || 0.3); },
  state: function(){ return ctx ? ctx.state : 'none'; }, repair: function(){ lastGesture = Date.now(); recreate(); return ctx ? ctx.state : 'none'; },
  info: function(){ return {state: ctx ? ctx.state : 'none', active: active, max: MAXV, gen: gen, stale: stale, needRebuild: needRebuild, stats: stats, session: hasWin && navigator.audioSession ? navigator.audioSession.type : null}; }, log: log, VOLS: VOLS };
})();
if(typeof module!=='undefined') module.exports = MQSfx;
