/* ========== 🏃 跳台闯关：小火柴人跳到正确答案的平台上（孩子自己设计的游戏） ==========
   上半部分：侧视场景（火柴人、A/B/C/D 平台、水里的鳄鱼）；下半部分：题目和选项（正常卡片/按钮，KaTeX 完整显示）。
   选一个选项 → 对应平台高亮、火柴人看向它 → 点「跳！」→ 跳过去：
   对 → 落稳、欢呼、撒花、大公式卡 5 秒；错 → 平台下沉、掉水里、鳄鱼“啊呜”（卡通）、冒出来贴创可贴、提示正确平台、大公式卡 5 秒、扣 1 颗心。 */
var MQJump = (function(){
'use strict';
var G = null, ROUNDS = 10, LIVES = 3, FAST = 3, SLOWT = 15, SVGNS = 'http://www.w3.org/2000/svg';
function el(tag, cls, html){ var e = document.createElement(tag); if(cls) e.className = cls; if(html!=null) e.innerHTML = html; return e; }
function sv(tag, attrs, parent){ var e = document.createElementNS(SVGNS, tag); for(var k in attrs) e.setAttribute(k, attrs[k]); if(parent) parent.appendChild(e); return e; }
function shuffle(a){ a = a.slice(); for(var i=a.length-1;i>0;i--){ var j = Math.floor(Math.random()*(i+1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function ts(){ return window.__mqJumpTS || 1; }
function cardMs(){ return window.__mqJumpCardMs || 5000; }
function sfx(k, o){ if(G && G.cfg.sfx) try{ G.cfg.sfx(k, o); }catch(e){} }
function later(fn, ms){ var g = G; var t = setTimeout(function(){ if(G && G===g) fn(); }, ms/ts()); G.timers.push(t); return t; }
function tween(ms, step, done){ var g = G, t0 = performance.now(), dur = ms/ts();
  (function f(now){ if(!G || G!==g) return; var k = Math.min(1, (now - t0)/dur); step(k); if(k < 1) G.raf.push(requestAnimationFrame(f)); else if(done) done(); })(t0); }
function speedK(t){ return t <= FAST ? 1 : Math.max(0, 1 - (t-FAST)/(SLOWT-FAST)); }
function mult(){ return Math.min(3, 1 + 0.5*Math.floor(G.combo/3)); }

function start(cfg){
  close();
  var root = el('div', 'jump'); root.id = 'jump'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '跳台闯关小游戏');
  root.innerHTML = '<div class="sl-top jp-top"><button class="sl-x" aria-label="退出">✕</button><div class="sl-rd"></div><div class="sl-hearts" aria-label="生命"></div><div class="grow"></div><div class="sl-combo"></div><div class="sl-score">0</div></div>'
    + '<div class="jp-scene"><svg class="jp-svg" aria-hidden="true"></svg><div class="jp-fx"></div></div>'
    + '<div class="jp-panel"><div class="jp-q"><div class="jp-ql"></div><div class="jp-qp"></div></div>'
    + '<div class="sl-spd jp-spd"><i></i><span></span></div><div class="jp-opts" role="radiogroup" aria-label="选项"></div>'
    + '<div class="jp-tip">① 先选答案　② 在上面按住小人<b>往后下方拉</b>瞄准，松手起跳 🏹</div></div>'
    + '<div class="jp-card" hidden></div>';
  document.body.appendChild(root); document.body.classList.add('slicing');
  G = {cfg: cfg, root: root, svg: root.querySelector('.jp-svg'), fx: root.querySelector('.jp-fx'), items: cfg.items.slice(0, cfg.rounds || ROUNDS),
    round: -1, lives: LIVES, score: 0, combo: 0, maxCombo: 0, correct: 0, wrong: 0, times: [], seen: [], weak: [], log: [],
    state: 'idle', sel: -1, rt: 0, timers: [], raf: [], cleanup: []};
  root.querySelector('.sl-x').addEventListener('click', function(){ var c = G && G.cfg; close(); if(c && c.onQuit) c.onQuit(); });
  bindDrag(root.querySelector('.jp-scene'));
  var onR = function(){ if(G) layout(); }; window.addEventListener('resize', onR); window.addEventListener('orientationchange', onR);
  G.cleanup.push(function(){ window.removeEventListener('resize', onR); window.removeEventListener('orientationchange', onR); });
  /* 计时（用时越短得分越高） */
  var last = performance.now();
  (function tick(now){ if(!G) return; var dt = Math.min(0.1, (now - last)/1000); last = now;
    if(G.state === 'ask'){ G.rt += dt; spdBar(); } /* 真实用时 */ G.tick = requestAnimationFrame(tick); })(last);
  hud(); nextRound();
  return G;
}
function close(){
  if(!G) return; G.timers.forEach(clearTimeout); G.raf.forEach(cancelAnimationFrame); cancelAnimationFrame(G.tick); G.cleanup.forEach(function(f){ f(); });
  if(G.root.parentNode) G.root.remove(); document.body.classList.remove('slicing'); G = null;
}
function hud(){
  var r = G.root;
  r.querySelector('.sl-rd').textContent = Math.min(G.round+1, G.items.length) + '/' + G.items.length;
  r.querySelector('.sl-hearts').innerHTML = [0,1,2].map(function(i){ return '<span class="'+(i<G.lives?'on':'')+'">'+(i<G.lives?'❤️':'🤍')+'</span>'; }).join('');
  r.querySelector('.sl-score').textContent = G.score;
  var m = mult(); r.querySelector('.sl-combo').innerHTML = G.combo>=2 ? '连击 <b>'+G.combo+'</b>'+(m>1?' · ×'+m:'') : '';
}
function spdBar(){ var b = G.root.querySelector('.jp-spd'); var k = speedK(G.rt);
  b.firstChild.style.width = (k*100).toFixed(1)+'%'; b.className = 'sl-spd jp-spd' + (G.rt < FAST ? ' fast' : k > 0.4 ? ' mid' : ' slow');
  b.lastChild.textContent = (G.rt < FAST ? '⚡神速 ' : '⚡ ') + G.rt.toFixed(1) + 's'; }

/* ---------- 回合 ---------- */
function nextRound(){
  G.round++;
  if(G.round >= G.items.length || G.lives <= 0){ finish(); return; }
  var it = G.items[G.round]; G.cur = it; G.sel = -1; G.rt = 0;
  var opts = shuffle(it.opts).slice(0, Math.min(3, it.opts.length));
  G.opts = shuffle([{html: it.answer, ok: true}].concat(opts.map(function(h){ return {html: h, ok: false}; })));
  G.root.querySelector('.jp-ql').innerHTML = it.label || '';
  G.root.querySelector('.jp-qp').innerHTML = it.prompt;
  var box = G.root.querySelector('.jp-opts');
  box.innerHTML = G.opts.map(function(o, i){ return '<button class="jp-opt" role="radio" aria-checked="false" data-i="'+i+'"><span class="k">'+'ABCD'[i]+'</span><span class="jp-ot">'+o.html+'</span></button>'; }).join('');
  box.querySelectorAll('.jp-opt').forEach(function(b){ b.addEventListener('click', function(){ select(+b.dataset.i); }); });
  G.missed = false; G.root.querySelector('.jp-panel').scrollTop = 0;
  hud(); spdBar(); buildScene(); G.state = 'ask';
}
function select(i){
  if(!G || G.state !== 'ask' || i < 0 || i >= G.opts.length) return;
  G.sel = i;
  G.root.querySelectorAll('.jp-opt').forEach(function(b, j){ b.classList.toggle('on', j===i); b.setAttribute('aria-checked', j===i ? 'true' : 'false'); });
  G.plats.forEach(function(p, j){ p.g.classList.toggle('sel', j===i); });
  pose('look', G.plats[i]); aimGuide(); sfx('flip');
}
/* ---------- 弹弓式起跳：按住往后拉，虚线显示轨迹，松手起跳 ---------- */
var GRAV = 900, K = 7.5, MAXD = 150;
function svgPt(e){ var m = G.svg.getScreenCTM(); if(!m) return {x: 0, y: 0}; var p = G.svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; p = p.matrixTransform(m.inverse()); return {x: p.x - (G.wx || 0), y: p.y}; }
function launchV(dx, dy){ var L = Math.sqrt(dx*dx + dy*dy), k = L > MAXD ? MAXD/L : 1; return {vx: -dx*k*K, vy: -dy*k*K, power: Math.min(1, L/MAXD)}; }
/* 沿轨迹找落点：下降时穿过某个平台顶面（宽松判定），否则掉水里 */
function landing(v){
  var x0 = G.man.x, y0 = G.man.y, best = null;
  G.plats.forEach(function(p){ var a = 0.5*GRAV, b = v.vy, c = y0 - p.y, D = b*b - 4*a*c; if(D < 0) return;
    var t = (-b + Math.sqrt(D))/(2*a); if(t <= 0.05) return; var x = x0 + v.vx*t, cx = p.x + p.w/2, tol = p.w/2 + Math.max(22, p.w*0.35);
    var d = Math.abs(x - cx); if(d <= tol && (!best || d < best.d)) best = {p: p, t: t, d: d, x: Math.max(p.x + 8, Math.min(p.x + p.w - 8, x))}; });
  if(best) return best;
  var a = 0.5*GRAV, c = y0 - (G.waterY + 30), t = (-v.vy + Math.sqrt(v.vy*v.vy - 4*a*c))/(2*a);
  return {p: null, t: t, x: x0 + v.vx*t, y: G.waterY + 30};
}
function arcPath(v, t1, n){ var d = '', x0 = G.man.x, y0 = G.man.y; for(var i=0;i<=n;i++){ var t = t1*i/n; d += (i ? ' L' : 'M') + (x0 + v.vx*t).toFixed(1) + ' ' + (y0 + v.vy*t + 0.5*GRAV*t*t).toFixed(1); } return d; }
function idealV(p){ /* 引导线：固定 55° 起跳角，正好落到平台中央 */
  var th = 55*Math.PI/180, dx = p.x + p.w/2 - G.man.x, h = G.man.y - p.y, den = 2*Math.cos(th)*Math.cos(th)*(dx*Math.tan(th) - h);
  if(den <= 0) return null; var v = Math.sqrt(GRAV*dx*dx/den); return {vx: v*Math.cos(th), vy: -v*Math.sin(th)};
}
function aimGuide(){ if(!G.guide) return; var p = G.plats[G.sel], v = p && idealV(p); if(!v){ G.guide.setAttribute('d', ''); return; } G.guide.setAttribute('d', arcPath(v, landing(v).t, 24)); }
function bindDrag(scene){
  var drag = null;
  var down = function(e){ if(!G || G.state !== 'ask') return; e.preventDefault();
    if(G.sel < 0){ hintSelect(); return; }
    drag = {s: svgPt(e), id: e.pointerId}; try{ scene.setPointerCapture(e.pointerId); }catch(_){} G.man.g.classList.add('aim'); };
  var move = function(e){ if(!drag || !G) return; e.preventDefault(); var p = svgPt(e), dx = p.x - drag.s.x, dy = p.y - drag.s.y; drag.dx = dx; drag.dy = dy;
    var v = launchV(dx, dy), L = landing(v); G.traj.setAttribute('d', Math.sqrt(dx*dx+dy*dy) > 12 ? arcPath(v, Math.min(L.t, 2.5), 30) : ''); G.power.style.width = (v.power*100).toFixed(0) + '%';
    G.plats.forEach(function(q){ q.g.classList.toggle('target', !!(L.p && L.p === q)); }); };
  var up = function(e){ if(!drag || !G) return; var d = drag; drag = null; G.man.g.classList.remove('aim'); G.traj.setAttribute('d', ''); G.power.style.width = '0';
    G.plats.forEach(function(q){ q.g.classList.remove('target'); });
    if(!d.dx || Math.sqrt(d.dx*d.dx + d.dy*d.dy) < 15) return; launch(launchV(d.dx, d.dy)); };
  scene.addEventListener('pointerdown', down); scene.addEventListener('pointermove', move); scene.addEventListener('pointerup', up); scene.addEventListener('pointercancel', up);
  scene.addEventListener('touchmove', function(e){ e.preventDefault(); }, {passive: false});
}
function hintSelect(){ var q = G.root.querySelector('.jp-opts'); q.classList.remove('shake'); void q.offsetWidth; q.classList.add('shake'); floatText('先选答案 👇', 'tip'); sfx('soft'); }
function launch(v){
  G.state = 'jump'; var L = landing(v), rt = G.rt, x0 = G.man.x, y0 = G.man.y;
  G.root.querySelectorAll('.jp-opt').forEach(function(b){ b.disabled = true; });
  if(G.guide) G.guide.setAttribute('d', '');
  sfx('slice'); pose('jump');
  var tEnd = L.t;
  tween(Math.max(450, Math.min(1100, tEnd*900)), function(k){ var t = tEnd*k, x = x0 + v.vx*t, y = y0 + v.vy*t + 0.5*GRAV*t*t;
    if(L.p && k === 1){ x = L.x; y = L.p.y; } placeMan(x, y); }, function(){
    if(!L.p){ miss(); return; }
    G.sel = L.p.i; G.root.querySelectorAll('.jp-opt').forEach(function(b, j){ b.classList.toggle('on', j===L.p.i); });
    G.plats.forEach(function(q){ q.g.classList.toggle('sel', q===L.p); });
    if(L.p.ok) land(L.p, rt); else fall(L.p, rt); });
}
/* 没跳到任何平台：第一次不扣心，再试一次；第二次算答错 */
function miss(){
  var x = G.man.x; splash(x); G.man.g.style.opacity = '0'; crocChomp(x);
  if(!G.missed){ G.missed = true; G.state = 'miss';
    later(function(){ floatText('没跳到～再试一次！', 'tip'); }, 500);
    later(function(){ G.man.g.style.opacity = '1'; placeMan(G.start.x + G.start.w*0.55, G.start.y); pose('look', G.plats[G.sel]); G.man.g.classList.add('pop');
      G.root.querySelectorAll('.jp-opt').forEach(function(b){ b.disabled = false; }); aimGuide(); G.state = 'ask'; G.log.push({round: G.round, res: 'retry'}); }, 1500);
    return; }
  wrongOut(null, G.rt, true);
}
function land(p, rt){
  G.state = 'cheer'; pose('cheer'); p.g.classList.add('good');
  G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.correct++; G.times.push(rt);
  var pts = Math.round((50 + 100*speedK(rt))*mult()); G.score += pts;
  G.log.push({round: G.round, res: 'ok', t: rt, pts: pts}); G.seen.push({item: G.cur, kind: 'ok'});
  floatText('+' + pts + ' ⚡' + (rt < FAST ? '神速' : ''), 'good');
  confetti(36); sfx('chime', {bonus: G.combo >= 3}); hud();
  later(function(){ showCard('ok'); }, 900);
}
function fall(p, rt){ wrongOut(p, rt, false); }
function wrongOut(p, rt, inWater){
  G.state = 'croc'; G.combo = 0; G.wrong++; G.lives = Math.max(0, G.lives - 1);
  G.log.push({round: G.round, res: 'wrong', t: rt}); G.seen.push({item: G.cur, kind: 'wrong'}); addWeak();
  var h = G.root.querySelector('.sl-hearts'); hud(); h.classList.remove('hurt'); void h.offsetWidth; h.classList.add('hurt');
  sfx('soft'); if(p) p.g.classList.add('sink'); pose('fall');
  var x = G.man.x, y0 = G.man.y;
  tween(inWater ? 1 : 520, function(k){ if(!inWater) placeMan(x, y0 + (G.waterY + 30 - y0)*k*k); }, function(){
    if(!inWater){ splash(x); G.man.g.style.opacity = '0'; crocChomp(x); }
    later(function(){ /* 冒出来：贴着创可贴，回到起点平台 */
      G.man.band.style.display = ''; G.man.g.style.opacity = '1'; placeMan(G.start.x, G.start.y); pose('stand'); G.man.g.classList.add('pop');
      G.plats.forEach(function(q){ if(q.ok) q.g.classList.add('hint'); });
      G.root.querySelectorAll('.jp-opt').forEach(function(b, j){ if(G.opts[j].ok) b.classList.add('right'); else if(p && j===p.i) b.classList.add('wrong'); });
    }, 1300);
    later(function(){ showCard('wrong'); }, 2100);
  });
}
function addWeak(){ var it = G.cur; if(G.weak.indexOf(it) < 0) G.weak.push(it); if(G.cfg.onWeak) try{ G.cfg.onWeak(it); }catch(e){} }

/* ---------- 大公式卡（5 秒倒计时圆环，2 秒后可点击跳过） ---------- */
function showCard(kind){
  G.state = 'card'; var c = G.root.querySelector('.jp-card'), ms = cardMs(), R0 = 20, L = 2*Math.PI*R0;
  c.className = 'jp-card ' + kind; c.hidden = false;
  c.innerHTML = '<div class="sl-big jp-big">' + (kind==='wrong' ? '<div class="sl-tag">记住它 👀 正确答案是 ' + 'ABCD'[G.opts.findIndex(function(o){ return o.ok; })] + '</div>' : '<div class="sl-tag">跳对啦！🎉</div>') + G.cur.reveal
    + '<div class="jp-cd"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="'+R0+'" class="bg"/><circle cx="24" cy="24" r="'+R0+'" class="fg" stroke-dasharray="'+L.toFixed(2)+'" stroke-dashoffset="0"/></svg><b>5</b></div><div class="jp-skip">点一下继续</div></div>';
  fitBig(c.querySelector('.jp-big'));
  var fg = c.querySelector('.fg'), num = c.querySelector('.jp-cd b'), canSkip = false, done = false;
  var t0 = performance.now(), g = G;
  (function f(now){ if(!G || G!==g || done) return; var e = (now - t0)*ts(), k = Math.min(1, e/ms);
    fg.setAttribute('stroke-dashoffset', (L*k).toFixed(2)); num.textContent = Math.max(1, Math.ceil((ms - e)/1000));
    if(!canSkip && e >= Math.min(2000, ms*0.4)){ canSkip = true; c.classList.add('skip'); }
    if(k < 1) G.raf.push(requestAnimationFrame(f)); else end(); })(t0);
  function end(){ if(done || !G) return; done = true; c.hidden = true; c.innerHTML = ''; advance(); }
  c.onclick = function(){ if(canSkip) end(); };
  G.endCard = end;
}
function fitBig(bg){ var maxW = Math.min(window.innerWidth*0.94, 680), fs = 100; bg.style.maxWidth = maxW + 'px';
  for(var i=0;i<12 && (bg.scrollWidth > maxW + 1 || bg.offsetHeight > window.innerHeight*0.86);i++){ fs -= 7; bg.style.fontSize = fs + '%'; } }
/* 场景向前滚动：选中的（或正确的）平台变成新起点 */
function advance(){
  if(G.lives <= 0 || G.round + 1 >= G.items.length){ nextRound(); return; }
  G.state = 'scroll';
  var target = G.plats.find(function(p){ return p.ok; }), dx = target.x - G.start.x + 0; var world = G.world;
  if(G.man.band.style.display !== 'none'){ /* 掉水后：火柴人先跳到正确平台再前进 */ }
  placeMan(target.x + target.w/2, target.y);
  tween(650, function(k){ G.wx = -dx*k; world.setAttribute('transform', 'translate(' + (-dx*k).toFixed(1) + ',0)'); }, function(){ G.man.band.style.display = 'none'; G.man.g.classList.remove('pop'); nextRound(); });
}

/* ---------- 场景绘制 ---------- */
function dims(){ var r = G.root.querySelector('.jp-scene').getBoundingClientRect(); var H = 300, W = Math.max(300, Math.round(H * r.width / Math.max(1, r.height))); return {W: W, H: H}; }
function layout(){ if(!G || !G.plats) return; buildScene(true); }
function buildScene(keep){
  var d = dims(), W = d.W, H = d.H, svg = G.svg; G.W = W; G.H = H; G.waterY = 228;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.innerHTML = '';
  sv('rect', {x: 0, y: 0, width: W, height: H, class: 'jp-sky'}, svg);
  sv('circle', {cx: W - 46, cy: 44, r: 22, class: 'jp-sun'}, svg);
  [[0.18, 46], [0.52, 30], [0.8, 70]].forEach(function(c){ var g = sv('g', {class: 'jp-cloud', transform: 'translate(' + (W*c[0]) + ',' + c[1] + ')'}, svg);
    sv('ellipse', {cx: 0, cy: 0, rx: 26, ry: 10}, g); sv('ellipse', {cx: 16, cy: -6, rx: 16, ry: 10}, g); });
  var world = sv('g', {class: 'jp-world'}, svg); G.world = world; G.wx = 0;
  sv('rect', {x: -W, y: G.waterY, width: W*3, height: H - G.waterY, class: 'jp-water'}, world);
  for(var i=0;i<14;i++) sv('path', {d: 'M' + (i*W/7 - W) + ' ' + (G.waterY+10) + ' q 12 -7 24 0 t 24 0', class: 'jp-wave'}, world);
  /* 鳄鱼（卡通）：在水里游，露出眼睛，冒泡泡 */
  var croc = sv('g', {class: 'jp-croc'}, world), cg = sv('g', {class: 'jp-crocb'}, croc);
  sv('ellipse', {cx: 0, cy: 14, rx: 46, ry: 14, class: 'body'}, cg);
  sv('path', {d: 'M30 8 L78 12 L78 20 L30 22 Z', class: 'jawl'}, cg);
  var up = sv('path', {d: 'M28 6 L80 6 Q82 12 76 13 L30 14 Z', class: 'jawu'}, cg); G.jaw = up;
  for(var t=0;t<4;t++) sv('path', {d: 'M' + (40 + t*9) + ' 13 l4 5 l4 -5', class: 'tooth'}, cg);
  [[-6, 0], [12, -2]].forEach(function(e){ sv('circle', {cx: e[0], cy: e[1], r: 7, class: 'eye'}, cg); sv('circle', {cx: e[0] + 2, cy: e[1] - 1, r: 3, class: 'pupil'}, cg); });
  sv('path', {d: 'M-46 16 q -26 4 -40 -6', class: 'tail'}, cg);
  for(var b=0;b<3;b++) sv('circle', {cx: 70 + b*8, cy: -6 - b*10, r: 3 + b, class: 'bubble b' + b}, croc);
  G.croc = croc; G.crocX = W*0.55; croc.setAttribute('transform', 'translate(' + G.crocX + ',' + (G.waterY - 2) + ')');
  /* 起点平台 */
  var sw = Math.min(110, W*0.16); G.start = {x: W*0.03, y: 176, w: sw};
  plat(world, G.start.x, G.start.y, sw, '', false);
  /* 选项平台 */
  var n = G.opts.length, x0 = W*0.03 + sw + 18, span = W - x0 - 10, slot = span / n, pw = Math.min(118, slot*0.74);
  var ys = [160, 184, 168, 190];
  G.plats = G.opts.map(function(o, i){ var x = x0 + slot*i + (slot - pw)/2, y = ys[i % 4];
    var p = plat(world, x, y, pw, 'ABCD'[i], true); p.ok = o.ok; p.i = i;
    p.g.addEventListener('click', function(){ select(i); }); return p; });
  /* 火柴人 */
  var man = sv('g', {class: 'jp-man'}, world);
  var m = {g: man, head: sv('circle', {r: 10, class: 'head'}, man), body: sv('line', {class: 'limb'}, man), la: sv('polyline', {class: 'limb'}, man), ra: sv('polyline', {class: 'limb'}, man),
    ll: sv('polyline', {class: 'limb'}, man), rl: sv('polyline', {class: 'limb'}, man), eye: sv('circle', {r: 1.8, class: 'eyed'}, man), mouth: sv('path', {class: 'mouth'}, man), band: sv('g', {class: 'band'}, man)};
  sv('rect', {x: -9, y: -64, width: 18, height: 6, rx: 3, transform: 'rotate(-20 0 -61)'}, m.band); sv('path', {d: 'M-2 -64 v6 M2 -64 v6', class: 'bandl', transform: 'rotate(-20 0 -61)'}, m.band);
  m.band.style.display = 'none'; G.man = m;
  G.guide = sv('path', {class: 'jp-guide'}, world); G.traj = sv('path', {class: 'jp-traj'}, world);
  if(!G.power){ var pw = el('div', 'jp-pow', '<i></i>'); G.root.querySelector('.jp-scene').appendChild(pw); G.power = pw.firstChild; }
  placeMan(G.start.x + sw*0.55, G.start.y); pose(G.sel >= 0 && G.state === 'ask' ? 'look' : 'stand', G.sel >= 0 ? G.plats[G.sel] : null);
  if(keep && G.sel >= 0){ G.plats[G.sel].g.classList.add('sel'); aimGuide(); }
}
function plat(parent, x, y, w, label, opt){
  var g = sv('g', {class: 'jp-plat' + (opt ? ' opt' : ' home')}, parent);
  sv('rect', {x: x + w*0.22, y: y + 10, width: w*0.56, height: G.waterY - y + 30, class: 'post'}, g);
  sv('rect', {x: x, y: y, width: w, height: 14, rx: 6, class: 'top'}, g);
  sv('rect', {x: x - 4, y: y - 30, width: w + 8, height: 70, class: 'hit', fill: 'transparent'}, g);
  if(label){ var t = sv('g', {class: 'lbl'}, g); sv('circle', {cx: x + w/2, cy: y + 34, r: 13}, t); var tx = sv('text', {x: x + w/2, y: y + 39, 'text-anchor': 'middle'}, t); tx.textContent = label; }
  return {g: g, x: x, y: y, w: w};
}
function placeMan(x, y){ G.man.x = x; G.man.y = y; G.man.g.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')'); }
function pts(a){ return a.map(function(p){ return p.join(','); }).join(' '); }
function pose(kind, target){
  var m = G.man; if(!m) return; m.pose = kind;
  var hx = 0, lean = 0;
  if(kind === 'look' && target){ var dx = target.x + target.w/2 - m.x; lean = Math.max(-6, Math.min(6, dx/40)); hx = Math.max(-3, Math.min(5, dx/30)); }
  m.head.setAttribute('cx', hx + lean*0.5); m.head.setAttribute('cy', -50);
  m.eye.setAttribute('cx', hx + lean*0.5 + 4); m.eye.setAttribute('cy', -52);
  m.body.setAttribute('x1', lean*0.5); m.body.setAttribute('y1', -40); m.body.setAttribute('x2', 0); m.body.setAttribute('y2', -18);
  var A = {stand: [[[0,-34],[-9,-24],[-11,-14]], [[0,-34],[9,-24],[11,-14]], [[0,-18],[-6,-9],[-8,0]], [[0,-18],[6,-9],[8,0]]],
    look: [[[0,-34],[-8,-26],[-10,-16]], [[0,-34],[12,-38],[22,-42]], [[0,-18],[-6,-9],[-8,0]], [[0,-18],[6,-9],[8,0]]],
    jump: [[[0,-34],[-10,-44],[-14,-54]], [[0,-34],[10,-44],[14,-54]], [[0,-18],[-10,-14],[-12,-6]], [[0,-18],[10,-12],[16,-8]]],
    cheer: [[[0,-34],[-12,-46],[-16,-58]], [[0,-34],[12,-46],[16,-58]], [[0,-18],[-8,-9],[-10,0]], [[0,-18],[8,-9],[10,0]]],
    fall: [[[0,-34],[-14,-40],[-20,-50]], [[0,-34],[14,-40],[20,-50]], [[0,-18],[-10,-12],[-14,-16]], [[0,-18],[10,-12],[14,-16]]]}[kind] || null;
  if(!A) return;
  [m.la, m.ra, m.ll, m.rl].forEach(function(e, i){ e.setAttribute('points', pts(A[i])); });
  var mx = hx + lean*0.5;
  m.mouth.setAttribute('d', kind === 'cheer' ? 'M' + (mx-3) + ' -46 q 4 5 8 0' : kind === 'fall' ? 'M' + (mx-2) + ' -45 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0' : 'M' + (mx-2) + ' -46 q 3 2 6 0');
  m.g.classList.toggle('cheer', kind === 'cheer');
}
function crocChomp(x){
  var c = G.croc, y = G.waterY - 2, x0 = G.crocX, g = G;
  sfx('soft');
  tween(320, function(k){ c.setAttribute('transform', 'translate(' + (x0 + (x - 50 - x0)*k).toFixed(1) + ',' + y + ')'); }, function(){
    c.classList.add('leap');
    tween(560, function(k){ var up = Math.sin(Math.PI*k)*46; c.setAttribute('transform', 'translate(' + (x - 50) + ',' + (y - up).toFixed(1) + ') rotate(' + (-18*Math.sin(Math.PI*k)).toFixed(1) + ')');
      G.jaw.setAttribute('transform', 'rotate(' + (k < 0.5 ? -28*k*2 : -28*(1-k)*2).toFixed(1) + ' 30 10)'); }, function(){
      c.classList.remove('leap'); G.crocX = x - 50; splash(x - 20); });
    later(function(){ floatText('啊呜！', 'chomp'); }, 260);
  });
}
function splash(x){ var fx = G.fx; for(var i=0;i<10;i++){ var s = el('i', 'jp-drop'); s.style.left = (100*x/G.W).toFixed(1) + '%'; s.style.top = (100*G.waterY/G.H).toFixed(1) + '%';
  s.style.setProperty('--dx', ((Math.random()-0.5)*80).toFixed(0) + 'px'); s.style.setProperty('--dy', (-30 - Math.random()*50).toFixed(0) + 'px'); fx.appendChild(s); (function(s){ setTimeout(function(){ s.remove(); }, 900); })(s); } }
function confetti(n){ var fx = G.fx, cols = (getComputedStyle(document.documentElement).getPropertyValue('--confetti') || '#6E9584,#B98637').split(',');
  for(var i=0;i<n;i++){ var s = el('i', 'jp-conf'); s.style.left = (100*G.man.x/G.W + (Math.random()-0.5)*30).toFixed(1) + '%'; s.style.top = '0%'; s.style.background = cols[i % cols.length].trim();
    s.style.setProperty('--dx', ((Math.random()-0.5)*120).toFixed(0) + 'px'); s.style.animationDelay = (Math.random()*0.3).toFixed(2) + 's'; fx.appendChild(s); (function(s){ setTimeout(function(){ s.remove(); }, 1800); })(s); } }
function floatText(txt, cls){ var e = el('div', 'jp-ft ' + (cls||''), txt); e.style.left = (100*G.man.x/G.W).toFixed(1) + '%'; e.style.top = (100*(G.man.y - 70)/G.H).toFixed(1) + '%'; G.fx.appendChild(e); setTimeout(function(){ e.remove(); }, 1300); }

/* ---------- 结束 ---------- */
function finish(){
  G.state = 'end';
  var res = {score: G.score, correct: G.correct, wrong: G.wrong, miss: 0, gold: 0, rounds: G.round, total: G.items.length, lives: G.lives, maxCombo: G.maxCombo,
    avgT: G.times.length ? G.times.reduce(function(a,b){ return a+b; }, 0)/G.times.length : null, fastT: G.times.length ? Math.min.apply(null, G.times) : null,
    fastN: G.times.filter(function(x){ return x < FAST; }).length, seen: G.seen.map(function(s){ return s.item; }), weak: G.weak.slice(), log: G.log.slice()};
  var info = G.cfg.onEnd ? G.cfg.onEnd(res) : {};
  var stars = info.stars != null ? info.stars : 0;
  var seenU = [], seenH = {}; res.seen.forEach(function(it){ if(!seenH[it.reveal]){ seenH[it.reveal] = 1; seenU.push(it); } });
  var weakH = {}; res.weak.forEach(function(it){ weakH[it.reveal] = 1; });
  var root = G.root; root.querySelector('.jp-scene').style.display = 'none';
  var panel = root.querySelector('.jp-panel'); panel.classList.add('ended');
  panel.innerHTML = '<div class="sl-end jp-end"><div class="sl-stars">' + [1,2,3].map(function(i){ return '<span class="'+(i<=stars?'on':'')+'">★</span>'; }).join('') + '</div>'
    + '<div class="sl-et">' + (info.title || '') + '</div>'
    + '<div class="sl-nums"><div><b>' + res.score + '</b><span>得分' + (info.newBest ? ' · 新纪录！' : '') + '</span></div><div><b>' + (info.best || res.score) + '</b><span>最高分</span></div><div><b>' + res.correct + '/' + res.rounds + '</b><span>跳对</span></div><div><b>' + res.maxCombo + '</b><span>最大连击</span></div><div><b>' + (res.avgT != null ? res.avgT.toFixed(1)+'s' : '–') + '</b><span>平均用时</span></div><div><b>' + (res.fastT != null ? res.fastT.toFixed(1)+'s' : '–') + '</b><span>最快 ⚡</span></div></div>'
    + (info.pointsHtml ? '<div class="sl-pts">' + info.pointsHtml + '</div>' : '')
    + (res.weak.length ? '<div class="sl-weak">🌱 ' + res.weak.length + ' 个跳错的已加入「今日待记」，去记忆练习再巩固一下</div>' : '')
    + '<div class="sl-rech">今天跳过的公式</div><div class="sl-recap">' + seenU.map(function(it){ return '<div class="sl-rc ' + (weakH[it.reveal] ? 'weak' : '') + '">' + it.reveal + '</div>'; }).join('') + '</div>'
    + '<div class="sl-btns"><button class="btn grow sl-again">🦘 再来一局' + (info.nextBonus ? '（奖励×' + info.nextBonus + '）' : '') + '</button><button class="btn ghost grow sl-back">返回</button></div></div>';
  var c = G.cfg;
  panel.querySelector('.sl-again').addEventListener('click', function(){ close(); if(c.onReplay) c.onReplay(); });
  panel.querySelector('.sl-back').addEventListener('click', function(){ close(); if(c.onQuit) c.onQuit(); });
  sfx(stars >= 2 ? 'fanfare' : 'chime', {bonus: stars === 3});
}
/* 测试用：给出把小人拉到哪里能落到第 i 个平台（屏幕坐标）；i = -1 表示拉得太轻掉水里 */
function aimFor(i, far){
  var v = i >= 0 ? idealV(G.plats[i]) : {vx: far ? 1400 : 60, vy: far ? -500 : -120}; if(!v) return null;
  var dx = -v.vx/K, dy = -v.vy/K, m = G.svg.getScreenCTM(), r = G.svg.getBoundingClientRect();
  var sx = G.man.x + (G.wx||0), sy = G.man.y - 30, p = G.svg.createSVGPoint(); p.x = sx; p.y = sy; var a = p.matrixTransform(m); p.x = sx + dx; p.y = sy + dy; var b = p.matrixTransform(m);
  return {x0: a.x, y0: a.y, x1: b.x, y1: b.y, len: Math.sqrt(dx*dx+dy*dy)};
}
return { start: start, close: close, active: function(){ return !!G; }, select: function(i){ select(i); }, aimFor: aimFor,
  skipCard: function(){ if(G && G.state === 'card' && G.endCard) G.endCard(); },
  _g: function(){ return G; },
  state: function(){ if(!G) return null; return {phase: G.state, round: G.round, lives: G.lives, score: G.score, combo: G.combo, correct: G.correct, wrong: G.wrong, sel: G.sel, rt: G.rt, times: G.times.slice(),
    missed: !!G.missed, right: G.opts ? G.opts.findIndex(function(o){ return o.ok; }) : -1, n: G.opts ? G.opts.length : 0, pose: G.man ? G.man.pose : null}; } };
})();
if(typeof module !== 'undefined') module.exports = MQJump;
