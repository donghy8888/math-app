/* ========== 🍉 切公式：把今天复习过的卡片做成“切西瓜”小游戏 ==========
   引擎只负责画面与交互；题目、积分、勋章由 app.js 通过 cfg 传入/回调。
   - 水果是 DOM（里面是 KaTeX），每帧只改 transform；刀光、果汁、粒子用一个 canvas。
   - 切中正确答案：果子沿刀口裂成两半 + 果汁，粒子飞向屏幕中央拼成“大公式卡”，发光后淡出。
   - 切错：轻轻弹开 + 屏幕小抖动，正确的那个发光提示（慢动作），可以补切看大卡（不得分）。
   - 漏掉：正确答案掉出屏幕，扣一颗心，也会展示大卡帮助记忆。 */
var MQSlice = (function(){
'use strict';
var ROUNDS = 10, LIVES = 3;
var G = null; /* 当前游戏 */
function el(tag, cls, html){ var e = document.createElement(tag); if(cls) e.className = cls; if(html!=null) e.innerHTML = html; return e; }
function rnd(a, b){ return a + Math.random()*(b-a); }
function shuffle(a){ a = a.slice(); for(var i=a.length-1;i>0;i--){ var j = Math.floor(Math.random()*(i+1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function cssVar(n, d){ try{ var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || d; }catch(e){ return d; } }
function now(){ return performance.now(); }
/* 线段与圆是否相交 */
function segHit(x1, y1, x2, y2, cx, cy, r){
  var dx = x2-x1, dy = y2-y1, L = dx*dx+dy*dy, t = L ? ((cx-x1)*dx+(cy-y1)*dy)/L : 0; t = Math.max(0, Math.min(1, t));
  var px = x1+t*dx-cx, py = y1+t*dy-cy; return px*px+py*py <= r*r;
}
/* 用穿过中心、方向为 (dx,dy) 的直线把 w×h 的方块切成两半，返回 clip-path 多边形（百分比） */
function halfPoly(w, h, dx, dy, side){
  var pts = [[0,0],[w,0],[w,h],[0,h]], cx = w/2, cy = h/2, out = [];
  var s = function(p){ return side*((p[0]-cx)*dy - (p[1]-cy)*dx); };
  for(var i=0;i<4;i++){ var a = pts[i], b = pts[(i+1)%4], sa = s(a), sb = s(b);
    if(sa>=0) out.push(a);
    if((sa>=0) !== (sb>=0)){ var t = sa/(sa-sb); out.push([a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])]); } }
  return 'polygon(' + out.map(function(p){ return (p[0]/w*100).toFixed(1)+'% '+(p[1]/h*100).toFixed(1)+'%'; }).join(',') + ')';
}
function sfx(k, o){ if(G && G.cfg.sfx) try{ G.cfg.sfx(k, o); }catch(e){} }

function start(cfg){
  close();
  var root = el('div', 'slice'); root.id = 'slice'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '切公式小游戏');
  root.innerHTML = '<div class="sl-top"><button class="sl-x" aria-label="退出">✕</button><div class="sl-rd"></div><div class="sl-hearts" aria-label="生命"></div><div class="grow"></div><div class="sl-combo"></div><div class="sl-score">0</div></div>'
    + '<div class="sl-prompt"><div class="sl-pl"></div><div class="sl-pq"></div></div>'
    + '<div class="sl-stage"><canvas class="sl-cv"></canvas><div class="sl-fruits"></div><div class="sl-reveal"></div><div class="sl-float"></div></div>';
  document.body.appendChild(root); document.body.classList.add('slicing');
  G = {cfg: cfg, root: root, stage: root.querySelector('.sl-stage'), cv: root.querySelector('.sl-cv'), layer: root.querySelector('.sl-fruits'),
    reveal: root.querySelector('.sl-reveal'), flt: root.querySelector('.sl-float'),
    items: cfg.items.slice(0, cfg.rounds || ROUNDS), round: -1, lives: LIVES, score: 0, combo: 0, maxCombo: 0,
    correct: 0, wrong: 0, miss: 0, gold: 0, seen: [], weak: [], fruits: [], debris: [], parts: [], trail: [],
    ts: (window.__mqSliceTS || 1), raf: 0, last: now(), phase: 'play', shake: 0, ptr: null, lastWhoosh: 0, log: []};
  G.ctx = G.cv.getContext('2d');
  G.colors = (cssVar('--confetti', '#6E9584,#B98637,#B4614F')).split(',').map(function(x){ return x.trim(); });
  G.trailCol = cssVar('--pri', '#4A7563');
  root.querySelector('.sl-x').addEventListener('click', function(){ var c = G && G.cfg; close(); if(c && c.onQuit) c.onQuit(); });
  bindInput();
  resize(); G.onResize = function(){ resize(); }; window.addEventListener('resize', G.onResize);
  hud(); nextRound();
  G.raf = requestAnimationFrame(loop);
  return G;
}
function close(){
  if(!G) return; cancelAnimationFrame(G.raf); window.removeEventListener('resize', G.onResize);
  clearTimeout(G.t1); clearTimeout(G.t2); clearTimeout(G.t3);
  if(G.root && G.root.parentNode) G.root.parentNode.removeChild(G.root); document.body.classList.remove('slicing'); G = null;
}
function resize(){
  var r = G.stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  G.W = r.width; G.H = r.height; G.cv.width = Math.round(r.width*dpr); G.cv.height = Math.round(r.height*dpr);
  G.cv.style.width = r.width+'px'; G.cv.style.height = r.height+'px'; G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function hud(){
  var r = G.root;
  r.querySelector('.sl-rd').textContent = (Math.min(G.round+1, G.items.length)) + '/' + G.items.length;
  r.querySelector('.sl-hearts').innerHTML = [0,1,2].map(function(i){ return '<span class="'+(i<G.lives?'on':'')+'">'+(i<G.lives?'❤️':'🤍')+'</span>'; }).join('');
  r.querySelector('.sl-score').textContent = G.score;
  var m = mult(); r.querySelector('.sl-combo').innerHTML = G.combo>=2 ? '连击 <b>'+G.combo+'</b>'+(m>1?' · ×'+m:'') : '';
}
function mult(){ return Math.min(3, 1 + 0.5*Math.floor(G.combo/3)); }

/* ---------- 回合 ---------- */
function nextRound(){
  G.round++;
  if(G.round >= G.items.length || G.lives <= 0){ finish(); return; }
  var it = G.items[G.round]; G.cur = it; G.state = 'fly'; G.failed = false; G.slow = 1; G.done = false;
  G.root.querySelector('.sl-pl').innerHTML = it.label || '';
  G.root.querySelector('.sl-pq').innerHTML = it.prompt;
  hud();
  /* 水果数量随回合增加：3 → 5；速度每回合加快一点 */
  var nOpt = Math.min(it.opts.length, 2 + Math.floor(G.round/4)), opts = shuffle(it.opts).slice(0, nOpt);
  var all = shuffle([{html: it.answer, ok: true}].concat(opts.map(function(h){ return {html: h, ok: false}; })));
  var gold = G.round>=2 && Math.random() < (window.__mqSliceGold!=null ? window.__mqSliceGold : 0.22);
  var T = Math.max(2.5, 4.4 - G.round*0.13) * (it.slowT || 1); /* 空中停留时间（秒） */
  var slots = shuffle(all.map(function(_, i){ return (i+0.5)/all.length; }));
  G.fruits = all.map(function(o, i){ return makeFruit(o, i, T, slots[i], gold && o.ok); });
}
function makeFruit(o, i, T, slot, gold){
  var f = el('div', 'sf c' + (i%4) + (gold ? ' gold' : '') + (o.ok ? ' ok' : ''), '<div class="sfc">'+o.html+'</div>');
  G.layer.appendChild(f);
  var c = f.firstChild, w = c.scrollWidth, h = c.scrollHeight;
  var maxD = Math.min(210, G.W*0.36), inner = maxD - 30, sc = Math.min(1, inner/Math.max(w, h, 1));
  var d = Math.max(Math.min(110, maxD), Math.min(maxD, Math.max(w, h)*sc + 34));
  f.style.width = f.style.height = d+'px'; c.style.transform = 'scale('+sc.toFixed(3)+')';
  var W = G.W, H = G.H, ax = W*(0.12 + 0.76*slot) + rnd(-12, 12), apex = H*rnd(0.1, 0.3) + d/2;
  var x0 = Math.max(d/2, Math.min(W-d/2, ax + rnd(-W*0.18, W*0.18))), y0 = H + d/2 + 4, Ti = T*rnd(0.92, 1.08), h0 = y0 - apex;
  var fr = {el: f, ok: o.ok, gold: gold, html: o.html, d: d, r: d/2, x: x0, y: y0, vx: (ax - x0)/(Ti/2), vy: -4*h0/Ti, g: 8*h0/(Ti*Ti),
    rot: rnd(-10, 10), vr: rnd(-25, 25), delay: i*rnd(0.18, 0.32), alive: true, cut: false, bumped: false};
  place(fr); return fr;
}
function place(f){ f.el.style.transform = 'translate3d('+(f.x-f.r).toFixed(1)+'px,'+(f.y-f.r).toFixed(1)+'px,0) rotate('+f.rot.toFixed(1)+'deg)'; }

/* ---------- 输入：指针/触摸刀光 ---------- */
function bindInput(){
  var s = G.stage, pos = function(e){ var r = s.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top, t: now()}; };
  s.addEventListener('pointerdown', function(e){ if(!G || G.state==='end') return; G.ptr = pos(e); G.trail.push(G.ptr); try{ s.setPointerCapture(e.pointerId); }catch(_){} e.preventDefault(); });
  s.addEventListener('pointermove', function(e){ if(!G || !G.ptr) return; var p = pos(e), q = G.ptr; G.ptr = p; G.trail.push(p); swipe(q, p); e.preventDefault(); });
  var up = function(){ if(G) G.ptr = null; };
  s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up); s.addEventListener('pointerleave', up);
  /* iPad：禁止滑动时页面滚动 / 回弹 */
  G.root.addEventListener('touchmove', function(e){ if(G && G.state==='end' && e.target.closest && e.target.closest('.sl-end')) return; e.preventDefault(); }, {passive: false});
  G.reveal.addEventListener('click', function(){ if(G && G.state==='reveal' && G.revealReady) endReveal(); });
}
function swipe(a, b){
  var dx = b.x-a.x, dy = b.y-a.y, len = Math.sqrt(dx*dx+dy*dy);
  if(len < 6) return; /* 点一下不算切 */
  if(b.t - G.lastWhoosh > 140 && len > 18){ G.lastWhoosh = b.t; sfx('slice'); }
  if(G.state!=='fly') return;
  for(var i=0;i<G.fruits.length;i++){ var f = G.fruits[i];
    if(!f.alive || f.cut || f.delay>0) continue;
    if(segHit(a.x, a.y, b.x, b.y, f.x, f.y, f.r*0.92)){ hit(f, dx/len, dy/len); if(G.state!=='fly') return; }
  }
}
function hit(f, ux, uy){
  if(f.ok){
    f.cut = true; f.alive = false; splitFruit(f, ux, uy); juice(f.x, f.y, f.gold ? 46 : 30);
    if(!G.failed){
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.correct++; if(f.gold) G.gold++;
      var rising = f.vy < 0, pts = Math.round(100*mult()*(f.gold?2:1)) + (rising ? 20 : 0); G.score += pts;
      floatText(f.x, f.y - f.r, '+'+pts + (f.gold ? ' 金果！' : '') + (rising ? ' 快！' : ''), f.gold ? 'gold' : '');
      sfx('chime', {bonus: f.gold || G.combo>=3});
    } else sfx('chime');
    G.log.push({round: G.round, res: G.failed ? 'late' : 'ok', gold: f.gold});
    hud(); startReveal(f, G.failed ? 'learn' : 'ok');
  } else {
    if(f.bumped) return; f.bumped = true;
    /* 轻轻弹开 + 抖动；正确的那个发光；慢动作给孩子看清 */
    f.vy = Math.min(f.vy, 0) - 180; f.vx += ux*140; f.vr += uy*80; f.el.classList.add('bump');
    G.shake = 0.32;
    if(!G.failed){ G.failed = true; G.wrong++; G.combo = 0; loseLife(); addWeak(); G.log.push({round: G.round, res: 'wrong'}); }
    G.slow = 0.45; G.fruits.forEach(function(x){ if(x.ok) x.el.classList.add('hint'); });
    sfx('soft'); hud();
  }
}
function loseLife(){ G.lives = Math.max(0, G.lives-1); var h = G.root.querySelector('.sl-hearts'); h.classList.remove('hurt'); void h.offsetWidth; h.classList.add('hurt'); }
function addWeak(){ var it = G.cur; if(G.weak.indexOf(it)<0) G.weak.push(it); if(G.cfg.onWeak) try{ G.cfg.onWeak(it); }catch(e){} }
function splitFruit(f, ux, uy){
  var w = f.d, h = f.d, nx = -uy, ny = ux;
  [1, -1].forEach(function(side){
    var e = f.el.cloneNode(true); e.classList.add('half'); e.classList.remove('hint');
    e.style.clipPath = e.style.webkitClipPath = halfPoly(w, h, ux, uy, side);
    G.layer.appendChild(e);
    G.debris.push({el: e, r: f.r, x: f.x, y: f.y, vx: f.vx*0.3 + side*nx*160, vy: Math.min(f.vy, 0)*0.3 + side*ny*160 - 60, g: 900, rot: f.rot, vr: side*140, life: 1.1});
  });
  f.el.remove();
}
/* ---------- 粒子 ---------- */
function juice(x, y, n){
  for(var i=0;i<n;i++){ var a = Math.random()*Math.PI*2, v = rnd(80, 360);
    G.parts.push({x: x, y: y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 120, g: 700, life: rnd(0.45, 0.8), t: 0, s: rnd(2.5, 6), c: G.colors[i%G.colors.length]}); }
}
function floatText(x, y, txt, cls){
  var e = el('div', 'sl-ft ' + (cls||''), txt); e.style.left = x+'px'; e.style.top = y+'px'; G.flt.appendChild(e);
  setTimeout(function(){ e.remove(); }, 1100);
}
/* ---------- 大卡揭晓：粒子汇聚成大公式 ---------- */
function startReveal(f, kind){
  G.state = 'reveal'; G.revealReady = false;
  var it = G.cur; G.seen.push({item: it, kind: kind});
  /* 其它水果化成光点消散 */
  G.fruits.forEach(function(x){ if(x.alive){ x.alive = false; x.el.classList.add('fade'); juice(x.x, x.y, 6); var e = x.el; setTimeout(function(){ e.remove(); }, 400); } });
  var R = G.reveal; R.className = 'sl-reveal ' + kind; R.innerHTML = '<div class="sl-big">' + (kind==='miss' ? '<div class="sl-tag">记住它 👀</div>' : kind==='learn' ? '<div class="sl-tag">再看一眼，记牢 💪</div>' : '') + it.reveal + '</div>';
  (function(){ var bg = R.querySelector('.sl-big'); if(!bg) return; var maxW = Math.min(window.innerWidth*0.94, 640), fs = 100;
    bg.style.maxWidth = maxW + 'px'; bg.style.boxSizing = 'border-box';
    for(var i=0;i<12 && (bg.scrollWidth > maxW + 1 || bg.offsetHeight > window.innerHeight*0.9);i++){ fs -= 7; bg.style.fontSize = fs + '%'; }
  })();
  var big = R.firstChild, br = big.getBoundingClientRect(), sr = G.stage.getBoundingClientRect();
  var bx = br.left - sr.left, by = br.top - sr.top, bw = br.width, bh = br.height;
  var sx = f ? f.x : G.W/2, sy = f ? f.y : G.H*0.85, N = kind==='ok' ? 90 : 50;
  for(var i=0;i<N;i++){
    var edge = Math.random() < 0.6, tx, ty;
    if(edge){ var p = Math.random()*2*(bw+bh); if(p<bw){ tx = bx+p; ty = by; } else if(p<bw+bh){ tx = bx+bw; ty = by+p-bw; } else if(p<2*bw+bh){ tx = bx+(p-bw-bh); ty = by+bh; } else { tx = bx; ty = by+(p-2*bw-bh); } }
    else { tx = bx + Math.random()*bw; ty = by + Math.random()*bh; }
    G.parts.push({x: sx + rnd(-20, 20), y: sy + rnd(-20, 20), x0: sx, y0: sy, tx: tx, ty: ty, t: -i*0.004, dur: rnd(0.5, 0.7), life: 1.3, s: rnd(2.5, 5), c: G.colors[i%G.colors.length], fly: true});
  }
  G.t1 = setTimeout(function(){ if(!G) return; R.classList.add('show'); G.revealReady = true; if(kind==='ok' && G.cur && G.combo>0 && G.combo%5===0) sfx('levelup'); }, 560);
  G.t2 = setTimeout(function(){ if(G) endReveal(); }, kind==='ok' ? 2100 : 2400);
}
function endReveal(){
  if(!G || G.state!=='reveal') return; clearTimeout(G.t2);
  G.state = 'gap'; G.reveal.classList.add('out');
  G.t3 = setTimeout(function(){ if(!G) return; G.reveal.className = 'sl-reveal'; G.reveal.innerHTML = ''; clearFruits(); nextRound(); }, 260);
}
function clearFruits(){ G.fruits.forEach(function(x){ if(x.el.parentNode) x.el.remove(); }); G.fruits = []; }

/* ---------- 主循环 ---------- */
function loop(t){
  if(!G) return;
  var dt = Math.min(0.05, (t - G.last)/1000); G.last = t;
  var ts = (window.__mqSliceTS || G.ts) * G.slow, d = dt*ts;
  if(G.state==='fly'){
    var anyAlive = false;
    G.fruits.forEach(function(f){
      if(!f.alive) return;
      if(f.delay>0){ f.delay -= d; return; } anyAlive = true;
      f.vy += f.g*d; f.x += f.vx*d; f.y += f.vy*d; f.rot += f.vr*d;
      if(f.x < f.r){ f.x = f.r; f.vx = Math.abs(f.vx)*0.6; } if(f.x > G.W-f.r){ f.x = G.W-f.r; f.vx = -Math.abs(f.vx)*0.6; }
      place(f);
      if(f.vy>0 && f.y - f.r > G.H + 6){ f.alive = false; f.el.remove(); }
    });
    var pend = G.fruits.some(function(f){ return f.alive; });
    if(!pend){ /* 正确答案没被切到 → 漏掉 */
      if(!G.failed){ G.miss++; G.combo = 0; loseLife(); addWeak(); G.log.push({round: G.round, res: 'miss'}); hud(); }
      G.slow = 1; startReveal(null, 'miss');
    }
  }
  G.debris = G.debris.filter(function(b){ b.life -= dt; b.vy += b.g*dt; b.x += b.vx*dt; b.y += b.vy*dt; b.rot += b.vr*dt;
    b.el.style.transform = 'translate3d('+(b.x-b.r).toFixed(1)+'px,'+(b.y-b.r).toFixed(1)+'px,0) rotate('+b.rot.toFixed(1)+'deg)'; b.el.style.opacity = Math.max(0, Math.min(1, b.life*1.6));
    if(b.life<=0 || b.y - b.r > G.H + 40){ b.el.remove(); return false; } return true; });
  if(G.shake>0){ G.shake -= dt; var a = G.shake*22; G.stage.style.transform = 'translate('+(Math.sin(t/18)*a).toFixed(1)+'px,0)'; if(G.shake<=0) G.stage.style.transform = ''; }
  draw(dt, t);
  if(G && G.state!=='end') G.raf = requestAnimationFrame(loop);
}
function draw(dt, t){
  var x = G.ctx; x.clearRect(0, 0, G.W, G.H);
  /* 粒子 */
  G.parts = G.parts.filter(function(p){
    p.t += dt;
    if(p.fly){ if(p.t<0) return true; var k = Math.min(1, p.t/p.dur), e = k<0.5 ? 2*k*k : 1-Math.pow(-2*k+2, 2)/2;
      p.x = p.x0 + (p.tx-p.x0)*e + Math.sin(k*Math.PI)*30*Math.sin(p.tx); p.y = p.y0 + (p.ty-p.y0)*e - Math.sin(k*Math.PI)*60;
      var al = k<1 ? 1 : Math.max(0, 1 - (p.t-p.dur)/0.45); if(al<=0) return false;
      x.globalAlpha = al; x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.s*(k<1?1:1+(p.t-p.dur)*3), 0, 7); x.fill(); return true; }
    p.vy += p.g*dt; p.x += p.vx*dt; p.y += p.vy*dt; var al2 = 1 - p.t/p.life; if(al2<=0) return false;
    x.globalAlpha = al2; x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.s, 0, 7); x.fill(); return true;
  });
  /* 刀光：最近 160ms 的轨迹，越新越粗 */
  var tn = now(); G.trail = G.trail.filter(function(p){ return tn - p.t < 160; });
  if(G.trail.length>1){
    x.lineCap = 'round'; x.strokeStyle = G.trailCol;
    for(var i=1;i<G.trail.length;i++){ var a = G.trail[i-1], b = G.trail[i], k = 1 - (tn - b.t)/160;
      x.globalAlpha = 0.25 + 0.6*k; x.lineWidth = 2 + 9*k; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
  }
  x.globalAlpha = 1;
}
/* ---------- 结束 ---------- */
function finish(){
  G.state = 'end'; clearFruits(); cancelAnimationFrame(G.raf); G.stage.style.transform = '';
  var res = {score: G.score, correct: G.correct, wrong: G.wrong, miss: G.miss, gold: G.gold, rounds: G.round, total: G.items.length,
    lives: G.lives, maxCombo: G.maxCombo, seen: G.seen.map(function(s){ return s.item; }), weak: G.weak.slice(), log: G.log.slice()};
  var info = G.cfg.onEnd ? G.cfg.onEnd(res) : {};
  var root = G.root, acc = res.correct/Math.max(1, res.rounds);
  var stars = info.stars!=null ? info.stars : 0;
  var seenU = [], seenH = {}; res.seen.forEach(function(it){ if(!seenH[it.reveal]){ seenH[it.reveal] = 1; seenU.push(it); } });
  var weakH = {}; res.weak.forEach(function(it){ weakH[it.reveal] = 1; });
  root.querySelector('.sl-prompt').style.display = 'none';
  G.stage.innerHTML = '<div class="sl-end"><div class="sl-stars">' + [1,2,3].map(function(i){ return '<span class="'+(i<=stars?'on':'')+'">★</span>'; }).join('') + '</div>'
    + '<div class="sl-et">' + (info.title || '') + '</div>'
    + '<div class="sl-nums"><div><b>' + res.score + '</b><span>得分' + (info.newBest ? ' · 新纪录！' : '') + '</span></div><div><b>' + (info.best||res.score) + '</b><span>最高分</span></div><div><b>' + res.correct + '/' + res.rounds + '</b><span>切对</span></div><div><b>' + res.maxCombo + '</b><span>最大连击</span></div></div>'
    + (info.pointsHtml ? '<div class="sl-pts">' + info.pointsHtml + '</div>' : '')
    + (res.weak.length ? '<div class="sl-weak">🌱 ' + res.weak.length + ' 个没切对的已加入「今日待记」，去记忆练习再巩固一下</div>' : '')
    + '<div class="sl-rech">今天切出的大公式</div><div class="sl-recap">' + seenU.map(function(it){ return '<div class="sl-rc ' + (weakH[it.reveal] ? 'weak' : '') + '">' + it.reveal + '</div>'; }).join('') + '</div>'
    + '<div class="sl-btns"><button class="btn grow sl-again">🍉 再来一局' + (info.nextBonus ? '（奖励×' + info.nextBonus + '）' : '') + '</button><button class="btn ghost grow sl-back">返回</button></div></div>';
  var c = G.cfg;
  G.stage.querySelector('.sl-again').addEventListener('click', function(){ close(); if(c.onReplay) c.onReplay(); });
  G.stage.querySelector('.sl-back').addEventListener('click', function(){ close(); if(c.onQuit) c.onQuit(); });
  G.stage.classList.add('ended');
  sfx(stars>=2 ? 'fanfare' : 'chime', {bonus: stars===3});
}
return { start: start, close: close, active: function(){ return !!G; },
  /* 测试/调试用 */
  _g: function(){ return G; },
  state: function(){ if(!G) return null; var sr = G.stage.getBoundingClientRect();
    return {phase: G.state, round: G.round, lives: G.lives, score: G.score, combo: G.combo, correct: G.correct, wrong: G.wrong, miss: G.miss, failed: G.failed,
      fruits: G.fruits.filter(function(f){ return f.alive && f.delay<=0; }).map(function(f){ return {x: f.x + sr.left, y: f.y + sr.top, r: f.r, ok: f.ok, gold: f.gold, vy: f.vy}; })}; },
  halfPoly: halfPoly, segHit: segHit };
})();
if(typeof module!=='undefined') module.exports = MQSlice;
