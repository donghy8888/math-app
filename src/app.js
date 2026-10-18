(function(){
'use strict';
/* ========== 基础工具 ========== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const dstr = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today = () => dstr(new Date());
const addDays = (ds,n) => { const [y,m,d] = ds.split('-').map(Number); const t = new Date(y,m-1,d+n); return dstr(t); };
const dayDiff = (a,b) => { const [y1,m1,d1]=a.split('-').map(Number),[y2,m2,d2]=b.split('-').map(Number); return Math.round((new Date(y2,m2-1,d2)-new Date(y1,m1-1,d1))/864e5); };
const fmtTime = sec => { sec=Math.max(0,Math.round(sec)); return pad(Math.floor(sec/60))+':'+pad(sec%60); };
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const INTERVALS = [1,2,4,7,15];
const BUILTIN_RAW = [['demo-pack','内置示例'],['builtin-pack-2','试卷原题']].map(([id,tag])=>{ try{ const o = JSON.parse(document.getElementById(id).textContent); o.__tag = tag; return o; }catch(e){ return null; } }).filter(Boolean);
let BUILTINS = [];
function initBuiltins(){ BUILTINS = BUILTIN_RAW.map(o=>{ try{ const {pack} = validatePack(o); pack.builtin = true; pack.tag = o.__tag; pack.importedAt = 0; return pack; }catch(e){ console.warn('内置题包校验失败', e.message); return null; } }).filter(Boolean); }
const DEMO = {id:'demo-pack-v1'};
const AI_PROMPT = document.getElementById('ai-prompt').textContent.trim();

/* ========== 数学渲染（KaTeX，离线降级为纯文本） ========== */
function fallbackTex(t){
  let s = t.replace(/\\cdots|\\ldots|\\dots/g,'…').replace(/\\left|\\right/g,'').replace(/\\[dt]frac/g,'\\frac');
  for(let i=0;i<4;i++){
    const w = x => /^[\w.]+$/.test(x) ? x : '('+x+')';
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g,(m,a,b)=>w(a)+'/'+w(b)).replace(/\\sqrt\{([^{}]*)\}/g,(m,a)=>'√'+w(a));
  }
  s = s.replace(/\\frac\s*(\\[a-zA-Z]+|\w)\s*(\\[a-zA-Z]+|\w)/g,'$1/$2').replace(/\\sqrt\s*(\\[a-zA-Z]+|\w)/g,'√$1');
  s = s.replace(/\\begin\{cases\}/g,'{ ').replace(/\\end\{cases\}/g,'').replace(/\\\\/g,'； ').replace(/&/g,'')
    .replace(/\\times/g,'×').replace(/\\div/g,'÷').replace(/\\cdot/g,'·').replace(/\\pm/g,'±').replace(/\\le(q)?(?![a-z])/g,'≤').replace(/\\ge(q)?(?![a-z])/g,'≥')
    .replace(/\\ne(q)?(?![a-z])/g,'≠').replace(/\\angle/g,'∠').replace(/\\triangle/g,'△').replace(/\\circ/g,'°').replace(/\\pi/g,'π')
    .replace(/\\Rightarrow/g,'⇒').replace(/\\to/g,'→').replace(/\\square/g,'□').replace(/\\cdots|\\ldots|\\dots/g,'…').replace(/\\dot\{?(\w)\}?/g,'$1\u0307').replace(/\\quad|\\qquad|\\[ ,;!]/g,' ')
    .replace(/\\left|\\right/g,'').replace(/\\(mathrm|text|textbf|mathbf|operatorname)/g,'').replace(/\^2/g,'²').replace(/\^3/g,'³')
    .replace(/\\([a-zA-Z]+)/g,'$1').replace(/[{}]/g,'');
  return s;
}
function tex(str){
  str = String(str ?? '');
  const parts = str.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return parts.map(p=>{
    if(/^\$\$[\s\S]+\$\$$/.test(p) || /^\$[^$]+\$$/.test(p)){
      const disp = p.startsWith('$$');
      const body = disp ? p.slice(2,-2) : p.slice(1,-1);
      if(window.katex){ try{ return katex.renderToString(body,{throwOnError:false,displayMode:disp,strict:'ignore'}); }catch(e){} }
      return '<span class="mathfb">'+esc(fallbackTex(body))+'</span>';
    }
    return esc(p).replace(/\*\*([^*]+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
  }).join('');
}
function texBlock(latex){ return tex('$'+String(latex||'').replace(/\$/g,'')+'$'); }

/* ========== 数据存储 ========== */
const KEY = 'mathquest_data_v1';
function defData(){
  return {v:1, settings:{nickname:'小数学家', goalNew:3, goalReview:true, voice:true, autoRead:true, reminders:true, rate:'normal', voicePick:''}, packs:[], attempts:[], review:{}, checkins:{}, points:0, badges:{}, daily:{}, marks:{}, hadReview:false, created:Date.now()};
}
let D;
function load(){
  try{ D = Object.assign(defData(), JSON.parse(localStorage.getItem(KEY)||'null')||{}); }catch(e){ D = defData(); }
  D.settings = Object.assign(defData().settings, D.settings||{});
  if(!D.marks || typeof D.marks!=='object') D.marks = {};
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(D)); }catch(e){ toast('保存失败：存储空间可能已满'); } }
load();
initBuiltins();

const allPacks = () => [...BUILTINS.map(b=>D.packs.find(p=>p.id===b.id)||b), ...D.packs.filter(p=>!BUILTINS.some(b=>b.id===p.id))];
const isBuiltinId = id => BUILTINS.some(b=>b.id===id);
const qk = (pid,qid) => pid+'::'+qid;
function findQ(key){
  const i = key.indexOf('::'); const pid = key.slice(0,i), qid = key.slice(i+2);
  const pack = allPacks().find(p=>p.id===pid); if(!pack) return null;
  const q = pack.questions.find(x=>String(x.id)===qid); return q ? {pack,q} : null;
}
function attemptsOf(key){ return D.attempts.filter(a=>a.key===key); }
function lastAttempt(key){ for(let i=D.attempts.length-1;i>=0;i--) if(D.attempts[i].key===key) return D.attempts[i]; return null; }
function dayRec(ds){ ds=ds||today(); return D.daily[ds] || (D.daily[ds]={newDone:[],reviewDone:[],points:0,questions:0}); }
function dueKeys(){ const t=today(); return Object.keys(D.review).filter(k=>D.review[k].due<=t && findQ(k)); }

/* ========== 答案判定（容错） ========== */
function toHalf(s){ return s.replace(/[\uFF01-\uFF5E]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/\u3000/g,' '); }
function norm(s){
  s = toHalf(String(s ?? '')).trim();
  s = s.replace(/\$/g,'').replace(/\\left|\\right/g,'').replace(/\\cdot|\\times/g,'*').replace(/\\div/g,'/');
  for(let i=0;i<3;i++) s = s.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g,'($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g,'√($1)');
  s = s.replace(/[−–—﹣]/g,'-').replace(/[×✕·]/g,'*').replace(/÷/g,'/').replace(/²/g,'^2').replace(/³/g,'^3')
       .replace(/，/g,',').replace(/。$/,'').replace(/\s+/g,'').toLowerCase();
  s = s.replace(/(\d)\*([a-z(])/g,'$1$2').replace(/\{|\}/g,'');
  return s;
}
function parseNum(raw){
  let s = norm(raw);
  if(!s) return null;
  s = s.replace(/^[a-z]{1,3}(\d)?=/,'');
  s = s.replace(/(cm|mm|km|m|kg|g|厘米|毫米|千米|米|度|°|个|元|人|天|岁)$/,'');
  let neg = false;
  if(/^-\(.*\)$/.test(s)){ neg = true; s = s.slice(1); }
  if(/^\(([^()]*)\)$/.test(s)) s = s.slice(1,-1);
  s = s.replace(/\(([^()]*)\)/g,'$1');
  const NUM = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)';
  let m, v = null;
  if((m = s.match(new RegExp('^('+NUM+')%$')))) v = parseFloat(m[1])/100;
  else if((m = s.match(new RegExp('^('+NUM+')/('+NUM+')$')))) v = parseFloat(m[1])/parseFloat(m[2]);
  else if((m = s.match(/^([+-]?\d*\.?\d*)√(\d+\.?\d*)$/))){ const c = m[1]===''||m[1]==='+'?1:m[1]==='-'?-1:parseFloat(m[1]); v = c*Math.sqrt(parseFloat(m[2])); }
  else if((m = s.match(new RegExp('^'+NUM+'$')))) v = parseFloat(s);
  if(v===null || !isFinite(v)) return null;
  return neg ? -v : v;
}
function decimals(raw){ const m = norm(raw).match(/\.(\d+)$/); return m ? m[1].length : 0; }
function numEq(user, exp){
  const a = parseNum(user), b = parseNum(exp);
  if(a===null || b===null) return false;
  if(Math.abs(a-b) <= 1e-9*Math.max(1,Math.abs(a),Math.abs(b))) return true;
  const d = decimals(user);
  if(d>=2){ const k=Math.pow(10,d); if(Math.abs(Math.round(b*k)/k-b)>1e-9 && Math.abs(a-b)<=0.5/k+1e-12) return true; } // 无限小数允许按位四舍五入
  return false;
}
function choiceIndex(step, v){
  const opts = step.options||[];
  const ok = i => (i>=0 && i<opts.length) ? i : -1;
  if(typeof v === 'number') return ok(v);
  const s = String(v ?? '').trim();
  if(/^[A-Ha-h]$/.test(s)) return ok(s.toUpperCase().charCodeAt(0)-65);
  const n = norm(s); const i = opts.findIndex(o=>norm(o)===n);
  if(i>=0) return i;
  if(/^\d+$/.test(s) && +s < opts.length) return +s;
  return -1;
}
function checkAnswer(step, input){
  const cands = [step.answer, ...(step.acceptable||[])];
  if(step.type==='choice'){ return cands.some(c=>choiceIndex(step,c)===input); }
  const u = String(input ?? '');
  if(!norm(u)) return false;
  const stripVar = s => s.replace(/^[a-z]{1,3}=/,'');
  return cands.some(c=>{
    if(numEq(u,c)) return true;
    const nu = norm(u), nc = norm(c);
    if(nu===nc || stripVar(nu)===stripVar(nc)) return true;
    return false;
  });
}
window.__mqCheck = {norm, parseNum, checkAnswer, choiceIndex, allPacks: () => allPacks()}; // 便于调试

/* ========== 题包校验与导入 ========== */
function hash(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
function extractJSON(text){
  let t = String(text||'').trim().replace(/^\uFEFF/,'');
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if(fence) t = fence[1].trim();
  try{ return JSON.parse(t); }catch(e){
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if(a>=0 && b>a){ try{ return JSON.parse(t.slice(a,b+1)); }catch(e2){} }
    throw new Error('JSON 格式有误：'+e.message);
  }
}
function validatePack(p, idx){
  const errs = [], warns = [];
  const L = idx!=null ? `第${idx+1}个题包：` : '';
  if(!p || typeof p!=='object') throw new Error(L+'不是有效的对象');
  if(!Array.isArray(p.questions) || !p.questions.length) throw new Error(L+'缺少 questions 数组（至少 1 道题）');
  const pack = { id: String(p.id || ('pk-'+hash((p.title||'')+'|'+(p.date||'')+'|'+p.questions.length+'|'+(p.questions[0]&&p.questions[0].original||'')))),
    title: String(p.title || '未命名题包'), date: String(p.date || today()), questions: [], importedAt: Date.now() };
  const ids = new Set();
  p.questions.forEach((q,i)=>{
    const QL = `${L}第${i+1}题`;
    if(!q || typeof q!=='object'){ errs.push(QL+'格式错误'); return; }
    if(!q.original) errs.push(QL+'缺少 original（原题）');
    let id = String(q.id ?? ('q'+(i+1))); if(ids.has(id)) id = id+'_'+i; ids.add(id);
    const steps = Array.isArray(q.steps) ? q.steps : [];
    if(!steps.length) errs.push(QL+'缺少 steps（引导步骤）');
    const st = steps.map((s,j)=>{
      const SL = `${QL}第${j+1}步`;
      let type = ['choice','number','text'].includes(s.type) ? s.type : (Array.isArray(s.options)&&s.options.length ? 'choice' : 'text');
      if(s.answer===undefined || s.answer===null || s.answer==='') errs.push(SL+'缺少 answer');
      if(!s.prompt) warns.push(SL+'缺少 prompt');
      const o = {prompt:String(s.prompt||'请作答'), type, answer: s.answer, acceptable: Array.isArray(s.acceptable)?s.acceptable.map(String):[], hint:String(s.hint||'再仔细读一遍题目，想想用到了哪个知识点。'), explanation:String(s.explanation||'')};
      if(type==='choice'){
        o.options = Array.isArray(s.options) ? s.options.map(String) : [];
        if(o.options.length<2) errs.push(SL+'是选择题但 options 少于 2 个');
        else if(choiceIndex(o,o.answer)<0) errs.push(SL+'的 answer 不在 options 中（可用 "A"/"B" 或选项原文）');
      }
      if(typeof o.answer==='number') o.answer = type==='choice' ? o.answer : String(o.answer);
      return o;
    });
    const tl = +q.timeLimitSec;
    pack.questions.push({ id, original:String(q.original||''), knowledgePoints: (Array.isArray(q.knowledgePoints)&&q.knowledgePoints.length ? q.knowledgePoints : ['综合']).map(String),
      difficulty: Math.min(5,Math.max(1,Math.round(+q.difficulty||2))), timeLimitSec: tl>0 ? Math.round(tl) : 180, steps: st,
      finalAnswer: String(q.finalAnswer||''), formulas: (Array.isArray(q.formulas)?q.formulas:[]).filter(f=>f&&(f.name||f.latex)).map(f=>({name:String(f.name||'公式'),latex:String(f.latex||''),tip:String(f.tip||'')})),
      method: String(q.method||'') });
  });
  if(errs.length) throw new Error(errs.slice(0,8).join('\n')+(errs.length>8?`\n…等共 ${errs.length} 处问题`:''));
  return {pack, warns};
}
function importPacksFromText(text){
  const obj = extractJSON(text);
  let list = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.packs) ? obj.packs : [obj]);
  if(obj && obj.app==='mathquest' && obj.data) throw new Error('这是“学习进度备份”文件，请到「我的 → 数据备份」里导入。');
  const results = list.map((p,i)=>validatePack(p, list.length>1?i:null));
  let added=0, replaced=0, qn=0;
  results.forEach(({pack})=>{
    const i = D.packs.findIndex(x=>x.id===pack.id);
    if(i>=0){ D.packs[i]=pack; replaced++; } else if(isBuiltinId(pack.id)){ D.packs.push(pack); replaced++; } else { D.packs.push(pack); added++; }
    qn += pack.questions.length;
  });
  D.badges.importer = D.badges.importer || Date.now();
  save();
  return {added, replaced, qn, warns: results.flatMap(r=>r.warns), firstId: results[0].pack.id};
}

/* ========== 初始对错标记（家长手动标注试卷原始结果） ========== */
const MARKS = { ok:{e:'✅',n:'对',cls:'ok'}, wrong:{e:'❌',n:'错',cls:'bad'}, skip:{e:'⭕',n:'没做',cls:'warn'} };
const MARK_CYCLE = [null,'ok','wrong','skip'];
const isMiss = m => m==='wrong' || m==='skip';
function setMark(key, m){
  if(!findQ(key)) return;
  if(m) D.marks[key] = m; else delete D.marks[key];
  const r = D.review[key], t = today();
  if(isMiss(m)){
    if(!r) D.review[key] = {level:0, due:t, count:1, reason:'initial', src:'mark', added:t};
    else if(r.due>t){ r.due = t; r.level = 0; }
    D.hadReview = true;
  } else if(r && r.src==='mark'){ delete D.review[key]; }
  save();
}
function markChip(key, prefix='初始'){ const m = MARKS[D.marks[key]]; return m ? `<span class="chip ${m.cls}">${prefix}${m.e}${m.n}</span>` : ''; }
const qLabel = (q,i) => /^q\d+(-\d+)?$/i.test(String(q.id)) ? String(q.id).slice(1) : String(i+1);

/* ========== 统计 ========== */
function kpStats(){
  const m = {};
  D.attempts.forEach(a=>{
    (a.kps||[]).forEach(kp=>{
      const s = m[kp] || (m[kp] = {kp, att:0, steps:0, ok:0, clean:0, ot:0, time:0, pr:0, init:0});
      s.att++; s.pr++; s.steps+=a.stepsTotal; s.ok+=a.stepsOk; if(!a.missed) s.clean++; if(a.overtime) s.ot++; s.time+=a.timeUsed;
    });
  });
  Object.keys(D.marks).forEach(key=>{ // 试卷初始“错/没做”记为该知识点的一次失误
    if(!isMiss(D.marks[key])) return; const f = findQ(key); if(!f) return;
    f.q.knowledgePoints.forEach(kp=>{ const s = m[kp] || (m[kp] = {kp, att:0, steps:0, ok:0, clean:0, ot:0, time:0, pr:0, init:0}); s.att++; s.init++; s.steps += f.q.steps.length; });
  });
  return Object.values(m).map(s=>{
    s.acc = s.steps ? s.ok/s.steps : 0; s.otRate = s.att ? s.ot/s.att : 0; s.avg = s.pr ? s.time/s.pr : 0;
    s.weak = (1-s.acc) + 0.5*(1-s.clean/s.att) + 0.4*s.otRate;
    return s;
  }).sort((a,b)=>b.weak-a.weak);
}
function weakMap(){ const m={}; kpStats().forEach(s=>m[s.kp]=s.weak); return m; }
function streak(){
  let n=0, d=today();
  if(!D.checkins[d]) d = addDays(d,-1);
  while(D.checkins[d]){ n++; d = addDays(d,-1); }
  return n;
}
function bestStreak(){
  const ds = Object.keys(D.checkins).sort(); let best=0, cur=0, prev=null;
  ds.forEach(d=>{ cur = prev && dayDiff(prev,d)===1 ? cur+1 : 1; best=Math.max(best,cur); prev=d; });
  return best;
}
function goalInfo(){
  const r = dayRec(); const due = dueKeys().length;
  const rt = D.settings.goalReview ? r.reviewDone.length + due : 0;
  const nt = Math.max(0, +D.settings.goalNew||0);
  const rd = Math.min(r.reviewDone.length, rt), nd = Math.min(r.newDone.length, nt);
  const total = rt+nt; const pct = total ? (rd+nd)/total : 1;
  return {rt, nt, rd, nd, due, pct, done: total>0 && rd+nd>=total};
}
function totalStars(){ const best={}; D.attempts.forEach(a=>best[a.key]=Math.max(best[a.key]||0,a.stars)); return Object.values(best).reduce((x,y)=>x+y,0); }

/* ========== 徽章 ========== */
const BADGES = [
  {id:'first', e:'🎉', n:'首次通关', d:'完成第一道题'},
  {id:'perfect', e:'💯', n:'完美一题', d:'全部一次答对且不超时'},
  {id:'hard', e:'🧗', n:'攻克难题', d:'无失误拿下难度≥4的题'},
  {id:'speed', e:'⚡', n:'闪电侠', d:'用时不到限时一半且无失误'},
  {id:'streak3', e:'🔥', n:'连续3天', d:'连续打卡 3 天'},
  {id:'streak7', e:'🏆', n:'连续7天', d:'连续打卡 7 天'},
  {id:'zero', e:'🧹', n:'错题清零', d:'把巩固队列全部攻克'},
  {id:'ten', e:'📚', n:'勤学十题', d:'累计完成 10 次做题'},
  {id:'goal', e:'🎯', n:'目标达成', d:'完成一次每日目标'},
  {id:'p500', e:'💎', n:'积分达人', d:'累计获得 500 积分'},
  {id:'importer', e:'📦', n:'题包收藏家', d:'导入第一个题包'},
  {id:'review5', e:'🌱', n:'温故知新', d:'完成 5 次巩固复习'}
];
function checkBadges(ctx){
  const got = [];
  const give = id => { if(!D.badges[id]){ D.badges[id]=Date.now(); got.push(id); } };
  if(D.attempts.length>=1) give('first');
  if(D.attempts.length>=10) give('ten');
  if(ctx){
    if(ctx.stars===3) give('perfect');
    if(ctx.difficulty>=4 && !ctx.missed) give('hard');
    if(!ctx.missed && ctx.timeUsed <= ctx.limit/2) give('speed');
  }
  const st = streak(); if(st>=3) give('streak3'); if(st>=7) give('streak7');
  if(D.hadReview && Object.keys(D.review).length===0) give('zero');
  if(D.points>=500) give('p500');
  if(goalInfo().done) give('goal');
  if(D.attempts.filter(a=>a.mode==='review').length>=5) give('review5');
  return got;
}

/* ========== 状态与路由 ========== */
const S = { view:'home', tab:'home', packId:null, session:null, fTab:'f', fKp:'全部', flipped:{}, meTab:'weak' };
const TABS = [['home','🏠','首页'],['packs','🎮','闯关'],['review','🔁','巩固'],['formulas','🧠','公式'],['me','🙋','我的']];
function go(view, opts={}){
  if(view!=='play') hush();
  S.view = view;
  if(TABS.some(t=>t[0]===view)) S.tab = view;
  if(view==='pack' || view==='marks') S.tab='packs';
  if(view==='play') S.tab = S.session && S.session.mode==='review' ? 'review' : 'packs';
  render(); if(!opts.keepScroll) window.scrollTo(0,0);
}
function renderTabs(){
  const due = dueKeys().length;
  $('#tabs').innerHTML = TABS.map(([id,e,n])=>`<button data-act="tab" data-v="${id}" class="${S.tab===id?'on':''}" aria-label="${n}"><span class="e">${e}</span>${n}${id==='review'&&due?`<span class="badge-n">${due}</span>`:''}</button>`).join('');
}
function render(){
  if(voiceNoticePending && S.view!=='play') setTimeout(showVoiceNotice, 0);
  const v = S.view;
  const html = v==='home'?vHome(): v==='packs'?vPacks(): v==='pack'?vPack(): v==='play'?vPlay(): v==='review'?vReview(): v==='formulas'?vFormulas(): v==='marks'?vMarks(): vMe();
  $('#app').innerHTML = html;
  document.body.classList.toggle('inplay', v==='play');
  renderTabs();
  if(v==='play') afterPlay();
}

/* ========== 视图：首页 ========== */
const greetWord = () => { const h=new Date().getHours(); return h<6?'夜深了，注意休息':h<11?'早上好':h<14?'中午好':h<18?'下午好':'晚上好'; };
function ring(pct, size=96, stroke=10){
  const r=(size-stroke)/2, c=2*Math.PI*r;
  return `<svg width="${size}" height="${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${r}" style="stroke:var(--track)" stroke-width="${stroke}" fill="none"/>
  <circle cx="${size/2}" cy="${size/2}" r="${r}" style="stroke:${pct>=1?'var(--ok)':'var(--pri)'};transition:stroke-dashoffset .6s" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-Math.min(1,pct))}"/></svg>`;
}
function heatmap(weeks=16){
  const t = today(); const [y,m,d] = t.split('-').map(Number); const now = new Date(y,m-1,d);
  const dow = (now.getDay()+6)%7; // 周一=0
  const start = addDays(t, -(weeks-1)*7 - dow);
  let cells='';
  for(let i=0;i<weeks*7;i++){
    const ds = addDays(start,i);
    if(ds>t){ cells+='<i class="fut"></i>'; continue; }
    const q = (D.daily[ds]&&D.daily[ds].questions)||0; const ci = D.checkins[ds];
    const l = q>=6?4: q>=4?3: q>=2?2: (q>=1||ci)?1:0;
    cells += `<i class="l${l}${ds===t?' today':''}" title="${ds}：${q} 题${ci?' · 已打卡':''}"></i>`;
  }
  return `<div class="heat">${cells}</div><div class="legend">少 <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> 多</div>`;
}
function nextRecommend(){
  for(const p of allPacks()) for(const q of p.questions){ const k=qk(p.id,q.id); if(!lastAttempt(k)) return k; }
  return null;
}
function vHome(){
  const st = streak(), g = goalInfo(), checked = !!D.checkins[today()];
  const weak = kpStats().filter(s=>s.weak>0.15).slice(0,3);
  const rec = nextRecommend(); const recQ = rec && findQ(rec);
  const sess = S.session && S.session.phase!=='done' ? findQ(S.session.key) : null;
  return `
  <div class="hero">
    <div class="greet">${greetWord()}，</div>
    <div class="name">${esc(D.settings.nickname)} 👋</div>
    <div class="stats3">
      <div class="stat"><b>${st}</b><span>连续打卡(天)</span></div>
      <div class="stat"><b>${D.points}</b><span>积分</span></div>
      <div class="stat"><b>${totalStars()}</b><span>⭐ 星星</span></div>
    </div>
  </div>
  ${sess?`<button class="banner" data-act="resume">⏯️ <span class="grow">继续未完成的题：${esc(stripTex(sess.q.original).slice(0,18))}…</span>›</button>`:''}
  <div class="card">
    <div class="checkin">
      <div class="flame">${checked?'🔥':'🕯️'}</div>
      <div class="grow"><b>${checked?`今日已打卡，连续 ${st} 天！`:'今天还没打卡哦'}</b><div class="muted small">${checked?'坚持就是超能力 ✨':'做一道题会自动打卡，也可以直接点按钮'}</div></div>
      <button class="btn sm ${checked?'ghost':'warn'}" data-act="checkin" ${checked?'disabled':''}>${checked?'已打卡':'打卡'}</button>
    </div>
  </div>
  <div class="card">
    <h3>🎯 今日目标</h3>
    <div class="goalwrap">
      <div class="ring">${ring(g.pct)}<div class="lbl"><div>${Math.round(g.pct*100)}%<small>${g.done?'已达成':'完成度'}</small></div></div></div>
      <div class="grow">
        ${D.settings.goalReview?`<div class="goalitem"><span class="dot ${g.rd>=g.rt?'done':''}">${g.rd>=g.rt?'✓':'🔁'}</span>完成今日巩固 <b>${g.rd}/${g.rt}</b></div>`:''}
        <div class="goalitem"><span class="dot ${g.nd>=g.nt?'done':''}">${g.nd>=g.nt?'✓':'✏️'}</span>挑战新题 <b>${g.nd}/${g.nt}</b></div>
        <div class="muted small" style="margin-top:6px">${g.done?'今天的目标完成啦，太厉害了！🎉':'一点一点来，你可以的 💪'}</div>
      </div>
    </div>
  </div>
  <div class="quick">
    <button class="qcard g1" data-act="tab" data-v="review"><div class="big">${g.due}</div><div><div class="t">今日巩固</div><div class="s">${g.due?'错题和超时题待复习':'暂无待复习，真棒'}</div></div></button>
    <button class="qcard g4" data-act="${rec?'start':'tab'}" data-k="${esc(rec||'')}" data-v="packs"><div class="big">✏️</div><div><div class="t">${rec?'推荐下一题':'去闯关'}</div><div class="s">${recQ?esc(recQ.q.knowledgePoints.join('、')):'所有题目都做过啦'}</div></div></button>
    <button class="qcard g3" data-act="tab" data-v="formulas"><div class="big">🧠</div><div><div class="t">公式速记</div><div class="s">翻卡片，记得牢</div></div></button>
    <button class="qcard g2" data-act="import"><div class="big">📥</div><div><div class="t">导入题包</div><div class="s">粘贴 AI 生成的 JSON</div></div></button>
  </div>
  ${weak.length?`<div class="card"><h3>🔍 需要加强 <span class="sp grow"></span><button class="chip" data-act="tab" data-v="me">查看分析 ›</button></h3>
    ${weak.map((s,i)=>`<div class="weakpill"><span class="n">${i+1}</span><div class="grow"><b>${esc(s.kp)}</b><div class="muted small">正确率 ${Math.round(s.acc*100)}% · 超时 ${s.ot} 次</div></div><button class="btn sm white" data-act="fkp" data-v="${esc(s.kp)}">复习公式</button></div>`).join('')}</div>`:''}
  <div class="card"><h3>📅 学习足迹 <span class="grow"></span><span class="muted small">最长连续 ${bestStreak()} 天</span></h3>${heatmap()}</div>`;
}
const stripTex = s => fallbackTex(String(s||'').replace(/\$/g,''));

/* ========== 视图：题包列表 / 题目列表 ========== */
function qStatus(key){
  const a = lastAttempt(key); const mk = markChip(key);
  if(!a) return {chip:(mk?mk+' ':'')+'<span class="chip gray">未练习</span>'+(D.review[key]?` <span class="chip">🔁 ${D.review[key].due<=today()?'今日复习':D.review[key].due.slice(5)+' 复习'}</span>`:''), stars:0};
  const best = Math.max(...attemptsOf(key).map(x=>x.stars));
  const chips = mk ? [mk] : [];
  if(a.missed) chips.push('<span class="chip bad">✗ 错题</span>');
  if(a.overtime) chips.push('<span class="chip warn">⏱ 超时</span>');
  if(!a.missed && !a.overtime) chips.push('<span class="chip ok">✓ 已通关</span>');
  if(D.review[key]) chips.push(`<span class="chip">🔁 ${D.review[key].due<=today()?'今日复习':D.review[key].due.slice(5)+' 复习'}</span>`);
  return {chip:chips.join(' '), stars:best};
}
const starStr = (n,max=3) => '★'.repeat(n)+`<span class="off">${'★'.repeat(max-n)}</span>`;
const diffStr = n => `<span class="stars">${'●'.repeat(n)}<span class="off">${'●'.repeat(5-n)}</span></span>`;
function vPacks(){
  const sess = S.session && S.session.phase!=='done' ? findQ(S.session.key) : null;
  return `<div class="topbar"><h1>🎮 闯关做题</h1><span class="sp"></span><button class="btn sm" data-act="import">📥 导入题包</button></div>
  ${sess?`<button class="banner" data-act="resume">⏯️ <span class="grow">继续未完成的题</span>›</button>`:''}
  ${allPacks().map(p=>{
    const keys = p.questions.map(q=>qk(p.id,q.id)); const done = keys.filter(k=>lastAttempt(k)).length;
    const kps = [...new Set(p.questions.flatMap(q=>q.knowledgePoints))];
    return `<div class="card"><button class="packcard" data-act="openpack" data-v="${esc(p.id)}">
      <div class="row"><div class="packic ${p.tag==='内置示例'?'':'alt'}">${p.tag==='内置示例'?'🌟':'📄'}</div>
      <div class="grow"><div style="font-weight:800">${esc(p.title)}</div><div class="muted small">${esc(p.date)} · ${p.questions.length} 道题 ${p.builtin?'· '+esc(p.tag||'内置'):isBuiltinId(p.id)?'· 已更新':''}</div></div><span class="muted">›</span></div>
      <div class="chips" style="margin:10px 0">${kps.slice(0,5).map(k=>`<span class="chip">${esc(k)}</span>`).join('')}</div>
      <div class="row"><div class="prog grow"><i style="width:${done/p.questions.length*100}%"></i></div><span class="muted small">${done}/${p.questions.length}</span></div>
    </button></div>`;}).join('')}
  <div class="card tint-pri">
    <h3>📸 怎么添加新题？</h3>
    <div class="muted small">1. 家长拍下试卷，连同“AI 提示词”一起发给 AI 助手；<br>2. AI 返回一段 JSON 题包；<br>3. 点「导入题包」粘贴或选择 .json 文件即可。</div>
    <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="copyprompt">📋 复制 AI 提示词</button></div>
  </div>`;
}
function vPack(){
  const p = allPacks().find(x=>x.id===S.packId); if(!p){ S.view='packs'; return vPacks(); }
  return `<div class="topbar"><button class="iconbtn" data-act="tab" data-v="packs">‹</button><h1 class="grow" style="font-size:19px">${esc(p.title)}</h1></div>
  <div class="muted small" style="padding:0 4px">${esc(p.date)} · 共 ${p.questions.length} 题 · 点击题目开始闯关</div>
  ${markSummaryCard(p)}
  ${p.questions.map((q,i)=>{ const k=qk(p.id,q.id), s=qStatus(k);
    return `<button class="qrow" data-act="start" data-k="${esc(k)}"><div class="qnum" style="${qLabel(q,i).length>2?'font-size:12px':''}">${esc(qLabel(q,i))}</div><div class="grow">
      <div class="txt">${tex(q.original)}</div>
      <div class="row wrap" style="margin-top:8px;gap:6px">${q.knowledgePoints.map(x=>`<span class="chip gray">${esc(x)}</span>`).join('')}</div>
      <div class="row between" style="margin-top:8px"><span class="small muted">难度 ${diffStr(q.difficulty)} · ⏱ ${fmtTime(q.timeLimitSec)}</span><span class="stars">${starStr(s.stars)}</span></div>
      <div style="margin-top:6px">${s.chip}</div></div></button>`;}).join('')}
  ${p.builtin?'':isBuiltinId(p.id)?`<button class="btn danger block" style="margin-top:16px" data-act="delpack" data-v="${esc(p.id)}">↩️ 恢复为内置版本</button>`:`<button class="btn danger block" style="margin-top:16px" data-act="delpack" data-v="${esc(p.id)}">🗑️ 删除这个题包</button>`}`;
}

function markCounts(p){ const c={ok:0,wrong:0,skip:0,none:0}; p.questions.forEach(q=>{ const m=D.marks[qk(p.id,q.id)]; c[m||'none']++; }); return c; }
function markSummaryCard(p){
  const c = markCounts(p);
  return `<div class="card tint-warn"><div class="row between"><div><b>📝 试卷初始对错</b><div class="muted small">✅ ${c.ok} · ❌ ${c.wrong} · ⭕ ${c.skip} · 未标 ${c.none}</div></div><button class="btn sm warn" data-act="openmarks" data-v="${esc(p.id)}">批量标记</button></div>
  <div class="muted small" style="margin-top:6px">标为 ❌错 / ⭕没做 的题会计入薄弱项，并从今天起进入每日巩固。</div></div>`;
}
function vMarks(){
  const p = allPacks().find(x=>x.id===S.packId); if(!p){ S.view='packs'; return vPacks(); }
  const c = markCounts(p);
  return `<div class="topbar"><button class="iconbtn" data-act="openpack" data-v="${esc(p.id)}">‹</button><h1 class="grow" style="font-size:19px">📝 标记初始对错</h1></div>
  <div class="muted small" style="padding:0 4px">${esc(p.title)}<br>对照孩子<b>原始作答</b>标记：点题号可循环切换（未标→✅→❌→⭕），或直接点右侧按钮；再点一次已选中的按钮即取消。</div>
  <div class="card" style="position:sticky;top:6px;z-index:4;padding:12px 14px"><div class="row between"><div class="chips"><span class="chip ok">✅ ${c.ok}</span><span class="chip bad">❌ ${c.wrong}</span><span class="chip warn">⭕ ${c.skip}</span><span class="chip gray">未标 ${c.none}</span></div>
  ${c.none?`<button class="btn sm ghost" data-act="markrest" data-v="${esc(p.id)}">未标的全设为✅</button>`:''}</div></div>
  <div class="card" style="padding:4px 12px">${p.questions.map((q,i)=>{ const k=qk(p.id,q.id), m=D.marks[k];
    return `<div class="mrow"><button class="mnum ${m?MARKS[m].cls:''}" data-act="cyclemark" data-k="${esc(k)}" aria-label="第${esc(qLabel(q,i))}题，点按切换"><span>${esc(qLabel(q,i))}</span><i>${m?MARKS[m].e:'·'}</i></button>
      <div class="grow mprev">${esc(stripTex(q.original).replace(/\s+/g,' ').slice(0,60))}<div class="muted" style="font-size:11.5px">${q.knowledgePoints.map(esc).join('、')}</div></div>
      <div class="mseg">${['ok','wrong','skip'].map(x=>`<button class="${m===x?'on '+MARKS[x].cls:''}" data-act="setmark" data-k="${esc(k)}" data-v="${x}" title="${MARKS[x].n}">${MARKS[x].e}</button>`).join('')}</div></div>`;}).join('')}</div>
  <button class="btn block" data-act="openpack" data-v="${esc(p.id)}" style="margin-top:6px">完成</button>`;
}

/* ========== 视图：闯关做题 ========== */
const MSG_OK = ['漂亮！✨','完全正确！','思路很清晰 👍','太棒了，继续保持！','稳！就是这样 💪','答对啦，你真行！'];
const MSG_WRONG = ['差一点点！看看提示再试一次 💪','别急，错误是学习的一部分～','思路已经在路上了，再想想！','没关系，换个角度试试看 🌱','深呼吸，结合提示再来一次 😊'];
const MSG_MISS = ['这一步有点难，我们一起看看解析 📖','没关系，弄懂比做对更重要！','记下这个小坑，下次就能轻松跨过 ✨','学会了就是赚到，继续加油！'];
/* ---------- 语音朗读与温馨提醒 ---------- */
const VS = (typeof MQSpeech!=='undefined') ? MQSpeech : {supported:false, ttsSupported:false, speak(){return false;}, stop(){}, isSpeaking(){return false;}, onChange(){}, onNotice(){}, toSpeech:x=>x, voiceName(){return '';}, voices(){return [];}, addClips(){}, clipCount(){return 0;}, hasMandarin(){return false;}, whenVoices(){return Promise.resolve();}};
const RATES = {slow:0.75, normal:0.9, fast:1.1};
const PLAYRATES = {slow:0.85, normal:1, fast:1.15}; // 内置录音本身已放慢 10%
const voiceOn = () => VS.supported && !!D.settings.voice;
function say(texts){ if(!voiceOn()) return false; return VS.speak(texts, {rate: RATES[D.settings.rate] || 0.9, playbackRate: PLAYRATES[D.settings.rate] || 1, voiceName: D.settings.voicePick || ''}); }
function hush(){ VS.stop(); }
const REMIND = MQVoiceTexts.REMIND;
const REMIND_ICON = {start:'📝', calc:'✏️', wrong:'🌱', idle:'🔍', overtime:'🍵', finish:'🌟'};
const lastRemind = {}; let sessionQCount = 0;
function remind(kind){
  const ss = S.session; if(!D.settings.reminders || !ss) return null;
  const arr = REMIND[kind]; let t; do { t = pick(arr); } while(arr.length>1 && t===lastRemind[kind]);
  lastRemind[kind] = t; ss.remind = {kind, text:t, until: Date.now() + (kind==='idle'||kind==='overtime' ? 12000 : 9000)};
  return t;
}
function remindHTML(){
  const r = S.session && S.session.remind; if(!r || r.until < Date.now()) return '';
  return `<div class="remind pop"><span class="ri">${REMIND_ICON[r.kind]||'🌱'}</span><span class="grow">${esc(r.text)}</span>${voiceOn()?'<button class="spk sm" data-act="say" data-w="remind" aria-label="朗读提醒">🔊</button>':''}<button class="rx" data-act="closeremind" aria-label="关闭">×</button></div>`;
}
function refreshRemind(){ const el = $('#remind'); if(el) el.innerHTML = remindHTML(); }
const isCalcStep = st => st.type==='number' || /算|计算|求|化简|代入/.test(st.prompt);
function stepSpeech(q, idx){ return MQVoiceTexts.forQuestion(q,'prompt',idx); } // 只读引导小问题，不读选项
function autoStepSpeech(q, idx){ // 每次出现只自动朗读一次（按 题目key + 步骤序号 去重）
  const ss = S.session; if(!ss || !D.settings.autoRead) return null;
  const g = ss.key+'#'+idx; if(ss.spokenSteps[g]) return null; ss.spokenSteps[g] = true;
  return stepSpeech(q, idx);
}
const spk = (w, label) => voiceOn() ? `<button class="spk" data-act="say" data-w="${w}" aria-label="朗读${label||''}" title="朗读">🔊</button>` : '';

function startQ(key, mode='normal', queue=null){
  const f = findQ(key); if(!f){ toast('找不到这道题'); return; }
  const isReview = mode==='review' || (D.review[key] && D.review[key].due<=today());
  hush();
  S.session = { key, mode: isReview?'review':'normal', queue: queue||null, stepIdx:0, tries:0, results:[], elapsed:0, overtime:false, phase:'answer', fb:null, draft:'', sel:null, points:0, startedAt:Date.now(), lastAct:0, idleDone:false, remind:null, spokenSteps:{} };
  const r = (sessionQCount===0 || Math.random()<0.5) ? remind('start') : null; sessionQCount++;
  go('play');
  say([r, autoStepSpeech(f.q, 0)]); // 在点击事件内同步调用，满足浏览器“需用户手势”的限制
}
function vPlay(){
  const ss = S.session; if(!ss){ S.view='packs'; return vPacks(); }
  const f = findQ(ss.key); if(!f){ S.session=null; S.view='packs'; return vPacks(); }
  const {pack,q} = f; const n = q.steps.length;
  const qi = pack.questions.indexOf(q)+1;
  const head = `<div class="playhead"><button class="iconbtn" data-act="quit">‹</button>
    <div class="grow"><div style="font-weight:800;font-size:15px">${ss.mode==='review'?'🔁 巩固复习':'第 '+esc(qLabel(q,qi-1))+' 题'} ${ss.queue?`<span class="muted small">(${ss.queue.indexOf(ss.key)+1}/${ss.queue.length})</span>`:''}</div><div class="small muted">难度 ${diffStr(q.difficulty)}</div></div>
    <button class="hushpill" data-act="hush" aria-label="停止朗读"><span class="wave"><i></i><i></i><i></i></span>停止</button>
    <div class="timer" id="timer">⏱ <span id="tval">--:--</span></div></div>
    <div class="tbar" id="tbar"><i style="width:100%"></i></div>`;
  const curM = D.marks[ss.key];
  const markRow = `<div class="markrow"><span class="muted small">试卷初始结果</span><span class="grow"></span>${['ok','wrong','skip'].map(x=>`<button class="mpill ${curM===x?'on '+MARKS[x].cls:''}" data-act="setmark" data-k="${esc(ss.key)}" data-v="${x}">${MARKS[x].e} ${MARKS[x].n}</button>`).join('')}</div>`;
  const col = pinCollapsed();
  const orig = `<div class="card orig"><div class="ohead"><div class="lab grow">原题 · ${q.knowledgePoints.map(esc).join(' · ')}</div>${spk('orig','原题')}<button class="pintgl" data-act="pintoggle" aria-expanded="${col?'false':'true'}">${col?'展开 ▾':'收起 ▴'}</button></div><div class="obody" id="obody">${tex(q.original)}</div></div>`;
  /* 原题（含计时器、🔊）固定在上方；步骤在下方随页面滚动。iPad 横屏改为左右两栏。 */
  const pin = `<div class="pin ${col?'collapsed':''}" id="pin">${head}${orig}</div>`;
  const wrap = (right) => `<div class="playgrid">${pin}<div class="stepspane" id="stepspane"><div id="remind">${remindHTML()}</div>${right}<div class="card markcard">${markRow}</div></div></div>`;
  const dots = `<div class="stepdots">${q.steps.map((s,i)=>`<i class="${ss.results[i]?ss.results[i].status:(i===ss.stepIdx&&ss.phase!=='done'?'cur':'')}"></i>`).join('')}</div>`;
  const done = ss.results.map((r,i)=> (i<ss.stepIdx || ss.phase==='done') ? `<div class="donestep"><span class="b ${r.status==='missed'?'bad':'ok'}">${r.status==='missed'?'!':'✓'}</span><div class="grow"><div class="muted small">第 ${i+1} 步</div>${tex(q.steps[i].prompt)}<div class="small" style="margin-top:4px">答案：<b>${tex(answerText(q.steps[i]))}</b></div></div></div>` : '').join('');
  if(ss.phase==='done') return wrap(dots + vResult(q, ss) + `<details class="card"><summary style="font-weight:700;cursor:pointer">查看全部步骤</summary>${done}</details>`);
  const st = q.steps[ss.stepIdx];
  let input = '';
  const locked = ss.phase==='feedback';
  if(st.type==='choice'){
    const right = locked ? choiceIndex(st, st.answer) : -1;
    input = `<div class="opts">${st.options.map((o,i)=>{
      let cls = ss.sel===i?'sel':''; if(locked){ if(i===right) cls='right'; else if(ss.sel===i) cls='wrong'; }
      return `<button class="opt ${cls}" data-act="sel" data-v="${i}" ${locked?'disabled':''}><span class="k">${String.fromCharCode(65+i)}</span><span class="grow">${tex(o)}</span></button>`;}).join('')}</div>`;
  } else {
    input = `<input id="ans" class="ans" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" ${st.type==='number'?'inputmode="text"':''} placeholder="${st.type==='number'?'输入数字，可写分数如 3/4':'输入你的答案'}" value="${esc(ss.draft)}" ${locked?'disabled':''}>
    ${locked?'':`<div class="keys">${(st.type==='number'?['-','/','.','√']:['x','y','^2','+','-','(',')']).map(k=>`<button data-act="key" data-v="${esc(k)}">${k==='^2'?'x²':esc(k)}</button>`).join('')}</div>`}`;
  }
  let fb = '';
  if(ss.fb){
    const F = ss.fb;
    if(F.kind==='ok') fb = `<div class="fb ok pop"><b class="t row between"><span>✅ ${esc(F.msg)} ${F.pts?`<span class="chip ok">+${F.pts} 积分</span>`:''}</span>${st.explanation?spk('exp','解析'):''}</b>${st.explanation?tex(st.explanation):''}</div>`;
    else if(F.kind==='wrong') fb = `<div class="fb bad pop"><b class="t">🤔 ${esc(F.msg)}</b>还有 1 次机会</div><div class="fb hint pop"><b class="t row between">💡 提示 ${spk('hint','提示')}</b>${tex(st.hint)}</div>`;
    else if(F.kind==='miss') fb = `<div class="fb bad pop"><b class="t">🌱 ${esc(F.msg)}</b>正确答案：<b>${tex(answerText(st))}</b></div><div class="fb exp pop"><b class="t row between">📖 解析 ${spk('exp','解析')}</b>${tex(st.explanation||'对照正确答案再想一想。')}</div>`;
  }
  const actions = locked
    ? `<button class="btn block ${ss.stepIdx===n-1?'ok':''}" data-act="next" style="margin-top:14px">${ss.stepIdx===n-1?'🏁 完成本题':'下一步 →'}</button>`
    : `<button class="btn block" data-act="submit" style="margin-top:14px">提交答案</button>`;
  return wrap(dots + done + `<div class="card stepcard" id="stepcard"><div class="row between"><span class="steplab">第 ${ss.stepIdx+1} / ${n} 步</span>${spk('prompt','本步')}</div><div class="prompt">${tex(st.prompt)}</div>${input}${fb}${actions}</div>`);
}
/* 收起/展开状态：本次打开网页期间记住（sessionStorage） */
function pinCollapsed(){ try{ return sessionStorage.getItem('mq_pin_collapsed')==='1'; }catch(e){ return !!S.pinCol; } }
function setPinCollapsed(v){ S.pinCol=v; try{ sessionStorage.setItem('mq_pin_collapsed', v?'1':'0'); }catch(e){} }
function wideLayout(){ const pin=$('#pin'), sp=$('#stepspane'); return !!(pin && sp && pin.getBoundingClientRect().right <= sp.getBoundingClientRect().left + 1); }
/* 把元素滚到“固定原题”下方、底部标签栏上方的可见区域里 */
const SMOOTH_OK = !/[?&]nosmooth\b/.test(location.search);
function scrollBelowPin(el, mode){
  if(!el) return;
  const pin=$('#pin'), tab=document.querySelector('.tabbar');
  const topLimit = (pin && !wideLayout()) ? pin.getBoundingClientRect().bottom + 10 : 12;
  const botLimit = (tab ? tab.getBoundingClientRect().top : innerHeight) - 10;
  const r = el.getBoundingClientRect(); let dy = 0;
  if(mode==='top') dy = r.top - topLimit;
  else { if(r.bottom > botLimit) dy = Math.min(r.bottom - botLimit, r.top - topLimit); else if(r.top < topLimit) dy = r.top - topLimit; }
  if(Math.abs(dy) > 2) window.scrollTo({top: Math.max(0, scrollY + dy), behavior: SMOOTH_OK ? 'smooth' : 'auto'});
}
function answerText(st){
  if(st.type==='choice'){ const i = choiceIndex(st, st.answer); return i>=0 ? String.fromCharCode(65+i)+'. '+st.options[i] : String(st.answer); }
  return String(st.answer);
}
function vResult(q, ss){
  const r = ss.result;
  const title = r.stars===3?'完美通关！':r.missed?'完成啦，收获满满！':r.overtime?'完成啦，下次再快一点！':'干得漂亮！';
  const sub = r.missed ? '这道题已加入「每日巩固」，过几天再来挑战它 💪' : r.overtime ? '已加入巩固，再做一次争取不超时 ⏱' : (r.reviewNote || '继续保持这个状态！');
  const nextKey = nextInFlow(ss);
  return `<div class="card result pop">
    <div class="bigstars">${'⭐'.repeat(r.stars)}<span class="off">${'⭐'.repeat(3-r.stars)}</span></div>
    <h2 style="margin:4px 0">${title}</h2><div class="muted small">${sub}</div>
    <div class="kv"><div><b>${r.stepsOk}/${r.stepsTotal}</b><span>步骤正确</span></div><div><b class="${r.overtime?'bad':'ok'}">${fmtTime(r.timeUsed)}</b><span>${r.overtime?'超时 ⏱':'限时内 ⚡'}</span></div><div><b>+${r.points}</b><span>积分</span></div></div>
    ${r.newBadges.length?`<div class="fb ok">🏅 获得新徽章：${r.newBadges.map(id=>{const b=BADGES.find(x=>x.id===id);return b.e+' '+b.n;}).join('、')}</div>`:''}
  </div>
  <div class="card"><h3>✅ 最终答案</h3><div>${tex(q.finalAnswer||'—')}</div></div>
  ${q.method?`<div class="card"><h3>🧭 解题思路 <span class="grow"></span>${spk('method','解题思路')}</h3><div>${tex(q.method)}</div></div>`:''}
  ${q.formulas.length?`<div class="card"><h3>📐 用到的公式</h3>${q.formulas.map(fm=>`<div class="formula"><b>${esc(fm.name)}</b><div style="margin:4px 0;overflow-x:auto">${texBlock(fm.latex)}</div><div class="muted small">${tex(fm.tip)}</div></div>`).join('')}</div>`:''}
  <div class="row" style="gap:10px">
    <button class="btn ghost grow" data-act="retry">🔄 再做一次</button>
    ${nextKey?`<button class="btn grow" data-act="nextq" data-k="${esc(nextKey)}">下一题 →</button>`:`<button class="btn grow" data-act="backlist">${ss.mode==='review'?'完成巩固 🎉':'返回列表'}</button>`}
  </div>`;
}
function nextInFlow(ss){
  if(ss.queue){ const i = ss.queue.indexOf(ss.key); return ss.queue[i+1] || null; }
  const f = findQ(ss.key); if(!f) return null; const qs = f.pack.questions; const i = qs.indexOf(f.q);
  return qs[i+1] ? qk(f.pack.id, qs[i+1].id) : null;
}
function afterPlayMarkToast(m){ toast(isMiss(m) ? `已标记为 ${MARKS[m].e}${MARKS[m].n}，已计入薄弱项并加入今日巩固` : m ? '已标记为 ✅ 对' : '已清除初始标记'); }
let lastTick = 0;
function afterPlay(){
  updateTimer();
  { /* 原题只有 1-2 行时不需要收起/展开按钮 */
    const pin=$('#pin'), ob=$('#obody');
    if(pin && ob){ const col=pin.classList.contains('collapsed'); if(col) pin.classList.remove('collapsed');
      const lh=parseFloat(getComputedStyle(ob).lineHeight)||30; const short = ob.scrollHeight <= lh*2.3 + 4;
      if(col) pin.classList.add('collapsed'); pin.classList.toggle('short', short); }
  }
  const inp = $('#ans');
  if(inp && S.session.phase==='answer'){
    inp.addEventListener('input', e=>{ S.session.draft = e.target.value; S.session.lastAct = S.session.elapsed; });
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); act.submit(); } });
    if(window.matchMedia('(hover:hover)').matches) setTimeout(()=>inp.focus({preventScroll:true}),50);
  }
  const sc = $('#stepcard'); if(sc && S.session.fb){ if(S.session.fb.kind!=='ok') sc.classList.toggle('shake', S.session.fb.fresh); S.session.fb.fresh=false; setTimeout(()=>scrollBelowPin(sc,'nearest'),30); }
  const ss2=S.session, sk=ss2.key+'#'+ss2.stepIdx+'#'+ss2.phase.replace('feedback','answer');
  if(S.lastStepShown!==sk){ const first = S.lastStepShown===undefined || !S.lastStepShown.startsWith(ss2.key+'#'); S.lastStepShown=sk; if(!first && sc && !ss2.fb) requestAnimationFrame(()=>scrollBelowPin(sc,'top')); }
}
function updateTimer(){
  const ss = S.session; if(!ss || S.view!=='play') return;
  const f = findQ(ss.key); if(!f) return;
  const lim = f.q.timeLimitSec, used = (ss.phase==='done' ? ss.result.timeUsed : ss.elapsed/1000);
  const el = $('#timer'), tv = $('#tval'), tb = $('#tbar'); if(!el) return;
  const left = lim - used;
  if(left>=0){ tv.textContent = fmtTime(left); el.className = 'timer'+(left<=lim*0.2?' low':''); tb.className='tbar'+(left<=lim*0.2?' low':''); tb.firstElementChild.style.width = (left/lim*100)+'%'; }
  else { tv.textContent = '超时 +'+fmtTime(-left); el.className='timer over'; tb.className='tbar over'; tb.firstElementChild.style.width='100%'; }
  if(ss.phase==='done') el.classList.remove('over');
}
setInterval(()=>{ const ss = S.session; if(ss && ss.remind && ss.remind.until < Date.now()){ ss.remind = null; refreshRemind(); } }, 1000);
setInterval(()=>{
  const now = Date.now(); const dt = lastTick ? Math.min(now-lastTick, 2000) : 0; lastTick = now;
  const ss = S.session;
  if(!ss || S.view!=='play' || ss.phase==='done' || document.hidden) return;
  ss.elapsed += dt;
  const f = findQ(ss.key); if(!f) return;
  if(!ss.overtime && ss.elapsed/1000 > f.q.timeLimitSec){
    ss.overtime = true;
    const r = remind('overtime');
    if(r){ refreshRemind(); if(!VS.isSpeaking()) say([r]); } else toast('⏳ 时间到啦！不过别着急，慢慢把它做完');
  }
  if(ss.phase==='answer' && !ss.idleDone && ss.elapsed - (ss.lastAct||0) > 60000){
    ss.idleDone = true; const r = remind('idle'); if(r){ refreshRemind(); if(!VS.isSpeaking()) say([r]); }
  }
  updateTimer();
}, 250);

function finishQ(){
  const ss = S.session; const {pack,q} = findQ(ss.key); const t = today();
  const stepsTotal = q.steps.length, missed = ss.results.filter(r=>r.status==='missed').length, stepsOk = stepsTotal - missed;
  const firstAll = ss.results.every(r=>r.status==='first');
  const timeUsed = Math.round(ss.elapsed/1000), overtime = ss.overtime || timeUsed > q.timeLimitSec;
  const stars = missed ? 1 : (firstAll && !overtime) ? 3 : 2;
  let pts = ss.points + 5; if(!overtime) pts += 20; if(stars===3) pts += 15;
  const wasDue = D.review[ss.key] && D.review[ss.key].due<=t;
  const mode = (ss.mode==='review' || wasDue) ? 'review' : 'normal';
  D.attempts.push({key:ss.key, packId:pack.id, qid:q.id, ts:Date.now(), date:t, kps:q.knowledgePoints.slice(), difficulty:q.difficulty, stepsTotal, stepsOk, missed, overtime, timeUsed, limit:q.timeLimitSec, stars, points:pts, mode});
  // 间隔复习
  let reviewNote = '';
  const prev = D.review[ss.key];
  if(missed || overtime){
    D.review[ss.key] = {level:0, due:addDays(t,INTERVALS[0]), count:(prev?prev.count:0)+1, reason: missed?'wrong':'overtime', added: prev?prev.added:t};
    D.hadReview = true;
  } else if(prev && prev.due<=t){
    const lv = prev.level+1;
    if(lv>=INTERVALS.length){ delete D.review[ss.key]; reviewNote = '🎓 这道题已经彻底掌握，移出巩固队列！'; }
    else { D.review[ss.key] = Object.assign({}, prev, {level:lv, due:addDays(t,INTERVALS[lv])}); reviewNote = `👍 巩固成功！下次复习：${INTERVALS[lv]} 天后`; }
  }
  // 每日记录
  const r = dayRec(t); r.questions++; r.points += pts;
  if(mode==='review'){ if(!r.reviewDone.includes(ss.key)) r.reviewDone.push(ss.key); }
  else if(!r.newDone.includes(ss.key)) r.newDone.push(ss.key);
  D.points += pts;
  let autoChk = false; if(!D.checkins[t]){ D.checkins[t] = Date.now(); autoChk = true; }
  const goalBefore = r.goalDone;
  const newBadges = checkBadges({stars, difficulty:q.difficulty, missed, timeUsed, limit:q.timeLimitSec});
  const g = goalInfo(); if(g.done && !goalBefore){ r.goalDone = true; }
  save();
  ss.result = {stars, missed, stepsOk, stepsTotal, overtime, timeUsed, points:pts, newBadges, reviewNote};
  ss.phase = 'done';
  render(); window.scrollTo({top:0, behavior:'smooth'});
  confetti(stars===3 ? 220 : 140);
  hush(); const fr = remind('finish'); if(fr){ refreshRemind(); say([fr]); }
  setTimeout(()=>{
    if(g.done && !goalBefore){ toast('🎯 今日目标达成！给自己鼓个掌 👏'); confetti(160); }
    else if(autoChk) toast(`🔥 已自动打卡，连续 ${streak()} 天！`);
  }, 900);
}

/* ========== 视图：每日巩固 ========== */
function vReview(){
  const due = dueKeys(); const t = today();
  const later = Object.entries(D.review).filter(([k,v])=>v.due>t && findQ(k)).sort((a,b)=>a[1].due.localeCompare(b[1].due));
  const r = dayRec();
  const item = (k, right) => { const f=findQ(k); const v=D.review[k];
    return `<div class="item"><div class="ic" style="background:${v.reason==='overtime'?'var(--warn-soft)':'var(--bad-soft)'}">${v.reason==='wrong'?'✗':v.reason==='initial'?'📝':'⏱'}</div>
    <div class="grow"><div class="tt small">${tex(f.q.original)}</div><div class="muted small">${f.q.knowledgePoints.map(esc).join('、')} · 第 ${v.level+1}/${INTERVALS.length} 轮 ${v.reason==='initial'?'· 试卷'+(MARKS[D.marks[k]]?MARKS[D.marks[k]].n:'错题'):''}</div></div>${right}</div>`; };
  return `<div class="topbar"><h1>🔁 每日巩固</h1></div>
  <div class="hero warm">
    <div class="greet">今日待复习</div><div class="name" style="font-size:40px;margin:0">${due.length} <span style="font-size:16px">道</span></div>
    <div class="note">今天已复习 ${r.reviewDone.length} 道 · 间隔 1→2→4→7→15 天，答对且不超时就升级，失误则从头开始</div>
  </div>
  ${due.length?`<button class="btn block warn" style="margin:14px 0" data-act="startreview">▶ 开始今日巩固（${due.length} 道）</button>
    <div class="card list">${due.map(k=>item(k,`<button class="btn sm ghost" data-act="start" data-k="${esc(k)}" data-mode="review">做</button>`)).join('')}</div>`
  :`<div class="card empty"><div class="e">${Object.keys(D.review).length?'🌈':'🎈'}</div><b>今天没有要复习的题</b><div class="small">${Object.keys(D.review).length?'按计划，过几天再来巩固下面的题目吧':'做错或超时的题会自动出现在这里'}</div></div>`}
  ${later.length?`<div class="sec-title">📆 复习计划</div><div class="card list">${later.map(([k,v])=>item(k,`<span class="chip">${dayDiff(t,v.due)===1?'明天':dayDiff(t,v.due)+' 天后'}</span>`)).join('')}</div>`:''}`;
}

/* ========== 视图：公式速记 ========== */
function collectCards(){
  const fm = new Map(), methods = [];
  allPacks().forEach(p=>p.questions.forEach(q=>{
    q.formulas.forEach(f=>{ const id = f.name+'|'+f.latex; const c = fm.get(id) || {type:'f', id:'f'+hash(id), name:f.name, latex:f.latex, tip:f.tip, kps:new Set()}; q.knowledgePoints.forEach(k=>c.kps.add(k)); fm.set(id,c); });
    if(q.method) methods.push({type:'m', id:'m'+hash(p.id+q.id), name:stripTex(q.original).slice(0,40), original:q.original, method:q.method, kps:new Set(q.knowledgePoints)});
  }));
  return {f:[...fm.values()], m:methods};
}
function vFormulas(){
  const {f,m} = collectCards(); const wm = weakMap();
  const list = S.fTab==='f' ? f : m;
  const allKp = [...new Set([...f,...m].flatMap(c=>[...c.kps]))].sort((a,b)=>(wm[b]||0)-(wm[a]||0));
  const score = c => Math.max(0,...[...c.kps].map(k=>wm[k]||0));
  const shown = list.filter(c=>S.fKp==='全部' || c.kps.has(S.fKp)).sort((a,b)=>score(b)-score(a));
  return `<div class="topbar"><h1>🧠 公式速记</h1></div>
  <div class="seg"><button class="${S.fTab==='f'?'on':''}" data-act="ftab" data-v="f">📐 公式卡 (${f.length})</button><button class="${S.fTab==='m'?'on':''}" data-act="ftab" data-v="m">🧭 思路卡 (${m.length})</button></div>
  <div class="filter">${['全部',...allKp].map(k=>`<button class="${S.fKp===k?'on':''}" data-act="fkp" data-v="${esc(k)}">${(wm[k]||0)>0.15?'🔥':''}${esc(k)}</button>`).join('')}</div>
  <div class="muted small" style="margin:0 4px 8px">点卡片翻面 · 🔥 = 你的薄弱知识点，已排在前面</div>
  <div class="fgrid">${shown.length?shown.map(c=>{
    const weak = score(c)>0.15;
    return `<div class="flip ${S.flipped[c.id]?'on':''}" data-act="flip" data-v="${c.id}"><div class="in">
      <div class="f ${c.type==='m'?'m':''}"><div class="chips" style="justify-content:center">${[...c.kps].map(k=>`<span class="chip">${esc(k)}</span>`).join('')}${weak?'<span class="chip hot">🔥 薄弱</span>':''}</div>
        <div class="nm">${c.type==='f'?esc(c.name):'这道题怎么想？'}</div>${c.type==='m'?`<div class="small muted" style="max-height:56px;overflow:hidden">${tex(c.original)}</div>`:''}<div class="tap">👆 点击翻面</div></div>
      <div class="bk">${c.type==='f'?`<div class="ttl">${esc(c.name)}</div><div class="ltx">${texBlock(c.latex)}</div><div class="muted small">💡 ${tex(c.tip)}</div>`
        :`<div class="ttl m">🧭 解题思路</div><div style="font-size:15px">${tex(c.method)}</div>`}</div>
    </div></div>`;}).join(''):`<div class="card empty"><div class="e">🗂️</div>这个知识点下暂时没有卡片</div>`}</div>`;
}

/* ========== 视图：我的（薄弱项分析 / 徽章 / 设置） ========== */
function vMe(){
  const ks = kpStats(); const tot = D.attempts.length;
  const stepsT = D.attempts.reduce((a,b)=>a+b.stepsTotal,0), stepsO = D.attempts.reduce((a,b)=>a+b.stepsOk,0);
  const latest = {}; D.attempts.forEach(a=>latest[a.key]=a);
  const wrongs = Object.values(latest).filter(a=>a.missed && findQ(a.key));
  const initMiss = Object.keys(D.marks).filter(k=>isMiss(D.marks[k]) && !latest[k] && findQ(k));
  const overs = Object.values(latest).filter(a=>a.overtime && findQ(a.key));
  const allKps = [...new Set(allPacks().flatMap(p=>p.questions.flatMap(q=>q.knowledgePoints)))];
  const untried = allKps.filter(k=>!ks.some(s=>s.kp===k));
  const top = ks.filter(s=>s.weak>0.15).slice(0,3);
  const qline = (a, chip) => { const f=findQ(a.key); return `<div class="item"><div class="grow"><div class="tt small">${tex(f.q.original)}</div><div class="muted small">${f.q.knowledgePoints.map(esc).join('、')} · ${a.date.slice(5)} · 用时 ${fmtTime(a.timeUsed)}/${fmtTime(a.limit)}</div></div>${chip}<button class="btn sm ghost" data-act="start" data-k="${esc(a.key)}">重做</button></div>`; };
  const weakSec = `
  <div class="card"><h3>📊 总体表现</h3>
    <div class="kv" style="margin:0"><div><b>${tot}</b><span>做题次数</span></div><div><b>${stepsT?Math.round(stepsO/stepsT*100):0}%</b><span>步骤正确率</span></div><div><b>${tot?Math.round(D.attempts.filter(a=>!a.overtime).length/tot*100):0}%</b><span>按时完成率</span></div></div></div>
  <div class="card"><h3>🔥 最需要加强</h3>${top.length?top.map((s,i)=>`<div class="weakpill"><span class="n">${i+1}</span><div class="grow"><b>${esc(s.kp)}</b><div class="muted small">正确率 ${Math.round(s.acc*100)}% · 失误 ${s.att-s.clean}/${s.att} 次${s.init?`（含试卷 ${s.init}）`:''} · 超时 ${s.ot} 次</div></div><button class="btn sm white" data-act="fkp" data-v="${esc(s.kp)}">看公式</button></div>`).join(''):`<div class="empty" style="padding:10px"><div class="e">🌟</div>${tot?'目前没有明显的薄弱点，继续保持！':'做几道题后，这里会显示你的薄弱知识点'}</div>`}</div>
  <div class="card"><h3>🧩 知识点正确率</h3>${ks.length?ks.slice().sort((a,b)=>a.acc-b.acc).map(s=>{const p=Math.round(s.acc*100);return `<div class="bar"><div class="top"><b>${esc(s.kp)}</b><span class="muted small">${p}% · ${s.pr} 次练习${s.init?` · 试卷错 ${s.init}`:''}${s.pr?` · 平均 ${fmtTime(s.avg)}`:''}${s.ot?` · <span style="color:var(--bad)">超时${s.ot}</span>`:''}</span></div><div class="prog"><i class="${p<60?'lo':p<85?'mid':'hi'}" style="width:${Math.max(4,p)}%"></i></div></div>`;}).join(''):'<div class="muted small">暂无数据</div>'}
    ${untried.length?`<div class="muted small" style="margin-top:10px">还没练过：${untried.map(esc).join('、')}</div>`:''}</div>
  <div class="card list"><h3>❌ 错题本 <span class="chip bad">${wrongs.length+initMiss.length}</span></h3>${wrongs.length+initMiss.length?wrongs.map(a=>qline(a,markChip(a.key))).join('')+initMiss.map(k=>{const f=findQ(k);return `<div class="item"><div class="grow"><div class="tt small">${tex(f.q.original)}</div><div class="muted small">${f.q.knowledgePoints.map(esc).join('、')} · 试卷初始结果，尚未练习</div></div>${markChip(k)}<button class="btn sm ghost" data-act="start" data-k="${esc(k)}">去练</button></div>`;}).join(''):'<div class="muted small">没有错题，棒！</div>'}</div>
  <div class="card list"><h3>⏱ 超时题 <span class="chip warn">${overs.length}</span></h3>${overs.length?overs.map(a=>qline(a,'')).join(''):'<div class="muted small">没有超时题，速度很稳！</div>'}</div>`;
  const badgeSec = `<div class="card"><h3>🏅 我的徽章 <span class="muted small">${Object.keys(D.badges).length}/${BADGES.length}</span></h3><div class="badges">${BADGES.map(b=>`<div class="badge ${D.badges[b.id]?'got':'lock'}"><div class="e">${b.e}</div><div class="n">${b.n}</div><div class="d">${D.badges[b.id]?'已获得 '+dstr(new Date(D.badges[b.id])).slice(5):b.d}</div></div>`).join('')}</div></div>
  <div class="card"><h3>📅 打卡日历 <span class="grow"></span><span class="muted small">连续 ${streak()} 天 · 最长 ${bestStreak()} 天 · 共 ${Object.keys(D.checkins).length} 天</span></h3>${heatmap(20)}</div>`;
  const curTheme = getTheme();
  const tg = (k,label,desc) => `<div class="switch"><div class="grow"><b style="font-size:14px">${label}</b>${desc?`<div class="muted small">${desc}</div>`:''}</div><button class="tgl ${D.settings[k]?'on':''}" data-act="vset" data-k="${k}" role="switch" aria-checked="${!!D.settings[k]}" aria-label="${label}"><i></i></button></div>`;
  const voiceSec = `<div class="card"><h3>🔊 语音与提醒</h3>
    ${VS.supported ? tg('voice','语音朗读','用普通话读出题目、步骤和提示') + (D.settings.voice ? tg('autoRead','自动朗读','每一步出现时自动读题（首次需点一下开始做题）') : '') : '<div class="muted small" style="margin-bottom:6px">当前浏览器不支持语音朗读，温馨提醒会以文字气泡显示。</div>'}
    ${tg('reminders','温馨提醒','拿草稿纸、静心思考等温柔小提示')}
    ${VS.supported && D.settings.voice ? `<div class="field"><label>朗读声音</label><select id="voicePick">
      <option value="" ${!D.settings.voicePick?'selected':''}>内置普通话（推荐）</option>
      ${VS.voices().slice().sort((a,b)=>(b.mandarin-a.mandarin)||a.lang.localeCompare(b.lang)).map(v=>`<option value="${esc(v.name)}" ${D.settings.voicePick===v.name?'selected':''}>${esc(v.name)} · ${esc(v.lang)}${v.mandarin?'（普通话）':''}</option>`).join('')}
    </select><div class="muted small" style="margin-top:6px">内置普通话录音 ${VS.clipCount()} 条，覆盖内置题包的步骤、提示、解析和温馨提醒。${VS.ttsSupported ? (VS.hasMandarin() ? '其它文字使用系统普通话语音：'+esc(VS.voiceName())+'。' : '<span class="err">本机没有普通话系统语音，新导入题目将不朗读（避免粤语），可在系统设置里安装“中文（普通话）”语音。</span>') : ''}</div></div>
    <div class="field"><label>语速</label><div class="seg">${[['slow','🐢 慢'],['normal','🙂 正常'],['fast','🐇 快']].map(([v,n])=>`<button class="${D.settings.rate===v?'on':''}" data-act="vrate" data-v="${v}">${n}</button>`).join('')}</div></div>
    <div class="row" style="justify-content:flex-end"><button class="btn sm ghost" data-act="vtest">▶ 试听</button></div>` : ''}
  </div>`;
  const setSec = voiceSec + `<div class="card"><h3>🎨 外观主题</h3>
    <div class="seg themeseg">${[['eye','🌿 护眼'],['dark','🌙 深色'],['system','📱 跟随系统']].map(([v,n])=>`<button class="${curTheme===v?'on':''}" data-act="theme" data-v="${v}">${n}</button>`).join('')}</div>
    <div class="muted small">「护眼」使用暖纸色低眩光背景；「跟随系统」会随手机的深色模式自动切换。</div></div>
  <div class="card"><h3>⚙️ 设置</h3>
    <div class="field"><label>昵称</label><input type="text" id="setName" maxlength="12" value="${esc(D.settings.nickname)}"></div>
    <div class="field"><label>每日新题目标（道）</label><input type="number" id="setGoal" min="0" max="30" value="${D.settings.goalNew}"></div>
    <div class="switch"><b style="font-size:14px">每日目标包含“完成今日巩固”</b><input type="checkbox" id="setRev" ${D.settings.goalReview?'checked':''} style="width:24px;height:24px"></div>
    <button class="btn block" data-act="savesettings" style="margin-top:8px">保存设置</button></div>
  <div class="card"><h3>💾 数据备份</h3><div class="muted small">学习记录只保存在这台设备的浏览器里。换设备或清理浏览器前，记得导出备份。</div>
    <div class="row" style="margin-top:12px;gap:10px"><button class="btn ghost grow" data-act="export">⬇️ 导出备份</button><button class="btn ghost grow" data-act="importbk">⬆️ 导入备份</button></div>
    <button class="btn danger block" style="margin-top:12px" data-act="reset">🗑️ 清空所有数据</button></div>
  <div class="muted small" style="text-align:center;margin:16px 0">数学闯关岛 · 离线可用 · 数据保存在本机</div>`;
  return `<div class="topbar"><h1>🙋 ${esc(D.settings.nickname)}</h1><span class="sp"></span><span class="chip">💰 ${D.points} 积分</span><span class="chip">⭐ ${totalStars()}</span></div>
  <div class="seg"><button class="${S.meTab==='weak'?'on':''}" data-act="metab" data-v="weak">📊 薄弱项</button><button class="${S.meTab==='badge'?'on':''}" data-act="metab" data-v="badge">🏅 成就</button><button class="${S.meTab==='set'?'on':''}" data-act="metab" data-v="set">⚙️ 设置</button></div>
  ${S.meTab==='weak'?weakSec:S.meTab==='badge'?badgeSec:setSec}`;
}

/* ========== 主题 ========== */
const THEME_KEY = 'mathquest_theme';
function getTheme(){ try{ return localStorage.getItem(THEME_KEY) || 'eye'; }catch(e){ return 'eye'; } }
function isDark(t){ return t==='dark' || (t==='system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name=theme-color]'); if(m) m.setAttribute('content', isDark(t)?'#1F1F1C':'#F3EDDF');
}
if(window.matchMedia){ const mq = matchMedia('(prefers-color-scheme: dark)'); const f = ()=>{ if(getTheme()==='system') applyTheme('system'); }; mq.addEventListener ? mq.addEventListener('change',f) : mq.addListener && mq.addListener(f); }

/* ========== 弹窗 / 提示 / 撒花 ========== */
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2600); }
function modal(html){ $('#modal').innerHTML = `<div class="mask" data-act="maskclose"><div class="sheet">${html}</div></div>`; }
function closeModal(){ $('#modal').innerHTML=''; }
function confetti(n=150){
  const c = document.createElement('canvas'); c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:70';
  const W = c.width = innerWidth*devicePixelRatio, H = c.height = innerHeight*devicePixelRatio; c.style.width='100%'; c.style.height='100%';
  document.body.appendChild(c); const x = c.getContext('2d');
  const cols = (getComputedStyle(document.documentElement).getPropertyValue('--confetti')||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!cols.length) cols.push('#6E9584','#B98637','#B4614F');
  const ps = Array.from({length:n},()=>({x:W/2+(Math.random()-.5)*W*.3, y:H*.35, vx:(Math.random()-.5)*W*.022, vy:-Math.random()*H*.022-H*.006, s:(Math.random()*8+5)*devicePixelRatio, r:Math.random()*6, vr:(Math.random()-.5)*.3, c:pick(cols), sh:Math.random()<.5}));
  const t0 = performance.now();
  (function f(t){
    x.clearRect(0,0,W,H); const age = (t-t0)/1000;
    ps.forEach(p=>{ p.vy += H*.0006; p.vx *= .99; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; x.save(); x.translate(p.x,p.y); x.rotate(p.r); x.globalAlpha=Math.max(0,1-age/3); x.fillStyle=p.c;
      if(p.sh) x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2); else { x.beginPath(); x.arc(0,0,p.s/3,0,7); x.fill(); } x.restore(); });
    if(age<3.2) requestAnimationFrame(f); else c.remove();
  })(t0);
}
function copyText(text){
  const fb = () => { const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); let ok=false; try{ ok=document.execCommand('copy'); }catch(e){} ta.remove(); return ok; };
  if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(text).then(()=>toast('📋 已复制'),()=>toast(fb()?'📋 已复制':'复制失败，请手动选择文字复制')); }
  else toast(fb()?'📋 已复制':'复制失败，请手动选择文字复制');
}
function download(name, text){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text],{type:'application/json'})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},500);
}
function importModal(){
  modal(`<h2>📥 导入题包</h2><div class="muted small">把 AI 助手返回的 JSON 粘贴到下面（带 \`\`\`json 代码块也没关系），或选择 .json 文件。</div>
  <textarea class="code" id="packText" placeholder='{"title":"期中测试","date":"2026-10-17","questions":[...]}' style="margin-top:10px"></textarea>
  <div class="row" style="margin-top:8px;gap:8px"><label class="btn sm ghost" style="cursor:pointer">📂 选择文件<input type="file" id="packFile" accept=".json,.txt,application/json,text/plain" hidden></label><button class="btn sm ghost" data-act="copyprompt">📋 复制 AI 提示词</button></div>
  <div id="impMsg" class="small" style="white-space:pre-wrap;margin-top:10px"></div>
  <div class="row" style="margin-top:12px;gap:10px"><button class="btn ghost grow" data-act="close">取消</button><button class="btn grow" data-act="doimport">校验并导入</button></div>`);
  $('#packFile').addEventListener('change', e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ $('#packText').value=r.result; act.doimport(); }; r.readAsText(f,'utf-8'); });
}

/* ========== 交互 ========== */
const act = {
  tab(d){ if(S.view==='play' && S.session && S.session.phase==='done') S.session=null; go(d.v); },
  resume(){ go('play'); },
  openpack(d){ S.packId=d.v; go('pack'); },
  start(d){ if(!d.k){ go('packs'); return; } startQ(d.k, d.mode||'normal'); },
  startreview(){ const q = dueKeys(); if(q.length) startQ(q[0],'review',q); },
  quit(){ hush(); const ss=S.session; if(ss && ss.phase==='done'){ act.backlist(); return; } const f = ss && findQ(ss.key); S.view = ss&&ss.mode==='review'?'review':'pack'; if(f) S.packId=f.pack.id; S.tab = S.view==='review'?'review':'packs'; render(); toast('进度已保留，可随时回来继续'); },
  backlist(){ hush(); const ss=S.session; const f=ss&&findQ(ss.key); const rv = ss&&ss.mode==='review'; S.session=null; if(rv) go('review'); else { if(f) S.packId=f.pack.id; go('pack'); } },
  retry(){ const k=S.session.key; startQ(k, S.session.mode); },
  nextq(d){ const ss=S.session; startQ(d.k, ss.queue?'review':'normal', ss.queue); },
  pintoggle(){ const v=!pinCollapsed(); setPinCollapsed(v); const pin=$('#pin'), b=pin&&pin.querySelector('.pintgl'); if(pin) pin.classList.toggle('collapsed', v); if(b){ b.textContent = v?'展开 ▾':'收起 ▴'; b.setAttribute('aria-expanded', v?'false':'true'); } const ob=$('#obody'); if(ob) ob.scrollTop=0; },
  sel(d){ const ss=S.session; if(ss.phase!=='answer') return; ss.sel=+d.v; ss.lastAct=ss.elapsed; document.querySelectorAll('.opt').forEach((b,i)=>b.classList.toggle('sel', i===ss.sel)); },
  key(d){ const inp=$('#ans'); if(!inp) return; S.session.lastAct=S.session.elapsed; const s=inp.selectionStart??inp.value.length, e=inp.selectionEnd??s; inp.value = inp.value.slice(0,s)+d.v+inp.value.slice(e); S.session.draft=inp.value; inp.focus(); const p=s+d.v.length; try{inp.setSelectionRange(p,p);}catch(_){} },
  submit(){
    const ss=S.session; if(!ss||ss.phase!=='answer') return; const {q} = findQ(ss.key); const st=q.steps[ss.stepIdx];
    let val; if(st.type==='choice'){ if(ss.sel===null){ toast('先选一个答案吧 😊'); return; } val=ss.sel; } else { val = ($('#ans')||{}).value||ss.draft; if(!norm(val)){ toast('先写下你的答案吧 ✍️'); return; } ss.draft=val; }
    ss.lastAct = ss.elapsed; let speech = [];
    if(checkAnswer(st,val)){
      const pts = ss.tries===0?10:5; ss.points+=pts; ss.results[ss.stepIdx]={status:ss.tries===0?'first':'second', tries:ss.tries};
      ss.phase='feedback'; ss.fb={kind:'ok', msg:pick(MSG_OK), pts, fresh:true};
      ss.remind = null;
    } else {
      ss.tries++;
      if(ss.tries>=2){ ss.results[ss.stepIdx]={status:'missed', tries:ss.tries}; ss.phase='feedback'; ss.fb={kind:'miss', msg:pick(MSG_MISS), fresh:true};
        /* 不自动朗读答案和解析，可点 🔊 手动收听 */ }
      else { ss.fb={kind:'wrong', msg:pick(MSG_WRONG), fresh:true}; if(st.type==='choice') ss.sel=null;
        const r = Math.random()<0.6 ? remind('wrong') : null;
        speech = [r]; /* 只读温馨提醒；不重读题目、不自动读提示 */ }
    }
    render(); if(speech.some(Boolean)){ hush(); say(speech); }
  },
  next(){ hush(); const ss=S.session; const {q}=findQ(ss.key); if(ss.stepIdx>=q.steps.length-1){ finishQ(); return; } ss.stepIdx++; ss.tries=0; ss.fb=null; ss.draft=''; ss.sel=null; ss.phase='answer'; ss.lastAct=ss.elapsed; ss.idleDone=false;
    ss.remind = null; const r = (isCalcStep(q.steps[ss.stepIdx]) && Math.random()<0.35) ? remind('calc') : null;
    render(); say([r, autoStepSpeech(q, ss.stepIdx)]); },
  checkin(){ const t=today(); if(D.checkins[t]) return; D.checkins[t]=Date.now(); const nb=checkBadges(); save(); render(); confetti(90); toast(`🔥 打卡成功！已连续 ${streak()} 天`+(nb.length?' · 获得新徽章':'')); },
  import(){ importModal(); },
  copyprompt(){ copyText(AI_PROMPT); },
  doimport(){
    const m=$('#impMsg'); try{ const r = importPacksFromText($('#packText').value); closeModal(); S.packId=r.firstId; go('pack');
      toast(`✅ 导入成功：${r.added?`新增 ${r.added} 个题包`:''}${r.replaced?`更新 ${r.replaced} 个题包`:''}，共 ${r.qn} 道题`); }
    catch(e){ m.className='small err'; m.textContent='❌ '+e.message; }
  },
  delpack(d){ const bi = isBuiltinId(d.v); if(!confirm(bi?'恢复为内置版本吗？（做题记录和标记会保留）':'确定删除这个题包吗？（做题记录会保留）')) return; D.packs=D.packs.filter(p=>p.id!==d.v); if(!bi) Object.keys(D.review).forEach(k=>{ if(k.startsWith(d.v+'::')) delete D.review[k]; }); save(); go('packs'); toast('已删除'); },
  openmarks(d){ S.packId=d.v; go('marks'); },
  setmark(d){ const cur = D.marks[d.k]; const m = cur===d.v ? null : d.v; setMark(d.k, m); render(); if(S.view==='play') afterPlayMarkToast(m); },
  cyclemark(d){ const cur = D.marks[d.k]||null; const m = MARK_CYCLE[(MARK_CYCLE.indexOf(cur)+1)%MARK_CYCLE.length]; setMark(d.k, m); render(); },
  markrest(d){ const p = allPacks().find(x=>x.id===d.v); if(!p) return; p.questions.forEach(q=>{ const k=qk(p.id,q.id); if(!D.marks[k]) D.marks[k]='ok'; }); save(); render(); toast('✅ 已把未标记的题设为“对”'); },
  theme(d){ try{ localStorage.setItem(THEME_KEY, d.v); }catch(e){} D.settings.theme = d.v; save(); applyTheme(d.v); render(); toast(d.v==='eye'?'🌿 已切换到护眼模式':d.v==='dark'?'🌙 已切换到深色模式':'📱 已设为跟随系统'); },
  say(d){
    const ss = S.session; const f = ss && findQ(ss.key);
    if(d.w==='remind'){ if(ss && ss.remind) say([ss.remind.text]); return; }
    if(!f) return; const q = f.q, st = q.steps[ss.stepIdx];
    if(['orig','prompt','hint','exp','method'].includes(d.w)) say([MQVoiceTexts.forQuestion(q, d.w, ss.stepIdx)]);
  },
  hush(){ hush(); },
  closeremind(){ if(S.session) S.session.remind = null; refreshRemind(); },
  vset(d){ D.settings[d.k] = !D.settings[d.k]; save(); if(d.k==='voice' && !D.settings.voice) hush(); render(); },
  vrate(d){ D.settings.rate = d.v; save(); render(); say([MQVoiceTexts.EXTRA.ratePreview]); },
  vtest(){ say([MQVoiceTexts.EXTRA.test]); },
  ftab(d){ S.fTab=d.v; render(); },
  fkp(d){ S.fKp=d.v; if(S.view!=='formulas'){ go('formulas'); } else render(); },
  flip(d,el){ S.flipped[d.v]=!S.flipped[d.v]; el.classList.toggle('on'); },
  metab(d){ S.meTab=d.v; render(); },
  savesettings(){ D.settings.nickname = ($('#setName').value.trim()||'小数学家').slice(0,12); D.settings.goalNew = Math.max(0,Math.min(30,parseInt($('#setGoal').value)||0)); D.settings.goalReview = $('#setRev').checked; save(); render(); toast('✅ 设置已保存'); },
  export(){ const txt = JSON.stringify({app:'mathquest', version:1, exportedAt:new Date().toISOString(), data:D}, null, 2); download(`数学闯关岛备份-${today()}.json`, txt);
    modal(`<h2>⬇️ 导出备份</h2><div class="muted small">已尝试下载文件。如果手机上没有下载成功，可以复制下面的内容保存到备忘录。</div><textarea class="code" readonly style="margin-top:10px">${esc(txt)}</textarea><div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost grow" data-act="copybk">📋 复制</button><button class="btn grow" data-act="close">完成</button></div>`); S._bk=txt; },
  copybk(){ copyText(S._bk||''); },
  importbk(){ modal(`<h2>⬆️ 导入备份</h2><div class="small err">导入会覆盖当前设备上的全部学习记录。</div><textarea class="code" id="bkText" placeholder="粘贴备份 JSON" style="margin-top:10px"></textarea><div class="row" style="margin-top:8px"><label class="btn sm ghost" style="cursor:pointer">📂 选择备份文件<input type="file" id="bkFile" accept=".json,.txt,application/json" hidden></label></div><div id="bkMsg" class="small" class="small err" style="margin-top:8px"></div><div class="row" style="gap:10px;margin-top:12px"><button class="btn ghost grow" data-act="close">取消</button><button class="btn grow" data-act="dobk">导入</button></div>`);
    $('#bkFile').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ $('#bkText').value=r.result; }; r.readAsText(f,'utf-8'); }); },
  dobk(){ try{ const o = extractJSON($('#bkText').value); const data = o && o.app==='mathquest' ? o.data : o; if(!data || !Array.isArray(data.attempts) || !data.settings) throw new Error('不是有效的备份文件');
      if(!confirm('确定用备份覆盖当前数据吗？')) return; D = Object.assign(defData(), data); save(); if(D.settings && D.settings.theme){ try{ localStorage.setItem(THEME_KEY, D.settings.theme); }catch(e){} applyTheme(D.settings.theme); } closeModal(); go('home'); toast('✅ 备份已恢复'); }
    catch(e){ $('#bkMsg').textContent='❌ '+e.message; } },
  reset(){ if(!confirm('确定清空所有学习数据吗？导入的题包、做题记录、徽章都会被删除。')) return; if(!confirm('真的确定吗？此操作无法撤销。')) return; localStorage.removeItem(KEY); load(); S.session=null; go('home'); toast('已清空，重新出发吧！'); },
  close(){ closeModal(); },
  maskclose(d,el,e){ if(e.target===el) closeModal(); }
};
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-act]'); if(!el) return;
  const fn = act[el.dataset.act]; if(!fn) return;
  if(el.tagName==='BUTTON' || el.dataset.act==='flip' || el.dataset.act==='maskclose'){ fn(el.dataset, el, e); }
});
/* 内置普通话录音清单（构建时内嵌；网页版另外尝试加载 audio/manifest.json 以获取后来补生成的录音） */
try{ VS.addClips(JSON.parse(document.getElementById('audio-manifest').textContent||'[]')); }catch(e){}
if(/^https?:/.test(location.protocol)){ fetch('audio/manifest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(m=>{ if(m&&m.clips) VS.addClips(Object.keys(m.clips)); }).catch(()=>{}); }
VS.whenVoices(1500).then(()=>{ if(S.view==='me' && S.meTab==='set') render(); });
VS.onNotice(kind=>{
  if(kind!=='nomandarin') return; let seen=false; try{ seen = localStorage.getItem('mathquest_voice_notice')==='1'; localStorage.setItem('mathquest_voice_notice','1'); }catch(e){}
  if(seen) return;
  if(S.view==='play'){ voiceNoticePending=true; toast('本机没有普通话语音，新导入的题暂不朗读'); return; } /* 做题时不弹窗打断，回到其他页面再说明 */
  showVoiceNotice();
});
let voiceNoticePending=false;
function showVoiceNotice(){
  voiceNoticePending=false;
  modal(`<h2>🔈 本机没有普通话语音</h2><div class="muted" style="font-size:14.5px">内置题目使用<b>内置普通话录音</b>，不受影响。新导入的题目需要系统的普通话语音才能朗读——为了避免读成粤语，暂时不朗读。<br><br><b>iPhone / iPad：</b>设置 → 辅助功能 → 朗读内容 → 声音 → 中文 → 下载“婷婷”等普通话声音。<br><b>安卓：</b>设置 → 文字转语音（TTS）→ 首选引擎（如 Google）→ 安装语音数据 → 中文（中国）普通话。<br><br>也可以在「我的 → 设置 → 朗读声音」里手动选择声音。</div><button class="btn block" data-act="close" style="margin-top:14px">知道了</button>`);
}
document.addEventListener('change', e=>{ if(e.target && e.target.id==='voicePick'){ D.settings.voicePick = e.target.value; save(); render(); say([MQVoiceTexts.EXTRA.ratePreview]); } });
/* 首次触摸/点击即解锁 iPad Safari 的音频（捕获阶段，先于按钮处理） */
['touchend','pointerup','click','keydown'].forEach(ev=>document.addEventListener(ev, ()=>{ if(VS.unlock) VS.unlock(); }, {capture:true, passive:true}));
VS.onChange(sp=>{ const on=!!sp && voiceOn(); const b=$('#speakbar'); if(b) b.classList.toggle('show', on); document.body.classList.toggle('speaking', on); });
window.addEventListener('storage', e=>{ if(e.key===KEY){ load(); render(); } });
window.__mqKatexReady = () => render();
render();
})();
