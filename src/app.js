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
  return {v:1, settings:{nickname:'小数学家', goalNew:3, goalReview:true, voice:true, autoRead:true, reminders:true, rate:'normal', voicePick:'', showAnalysis:true}, packs:[], attempts:[], review:{}, checkins:{}, points:0, badges:{}, daily:{}, marks:{}, hadReview:false, created:Date.now()};
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
      method: String(q.method||''), analysis: normAnalysis(q.analysis) });
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

/* ========== 等级（由累计积分决定） ========== */
const LEVELS = [[0,'数学新手'],[100,'数学学徒'],[300,'计算小将'],[600,'解题能手'],[1000,'思维达人'],[1600,'数学高手'],[2500,'数学精英'],[4000,'数学专家'],[6000,'数学宗师'],[9000,'数学大师']];
function levelInfo(p){
  p = p==null ? (D.points||0) : p; let i=0; while(i<LEVELS.length-1 && p>=LEVELS[i+1][0]) i++;
  const cur=LEVELS[i][0], nxt=LEVELS[i+1]?LEVELS[i+1][0]:null;
  return {lv:i+1, title:LEVELS[i][1], cur, next:nxt, pct: nxt ? (p-cur)/(nxt-cur) : 1, toNext: nxt ? nxt-p : 0};
}

/* ========== 勋章：分级（铜/银/金/钻石）+ 纪念 + 知识点专项 ========== */
const TIER_NAMES = ['铜牌','银牌','金牌','钻石'];
const TIERED = [
  {id:'streak', e:'🔥', n:'连续打卡', unit:'天', th:[3,7,30,100], val:()=>Math.max(bestStreak(), streak())},
  {id:'done', e:'📚', n:'累计做题', unit:'题次', th:[10,50,200,500], val:()=>D.attempts.length},
  {id:'points', e:'💎', n:'累计积分', unit:'分', th:[500,2000,5000,10000], val:()=>D.points||0},
  {id:'review', e:'🌱', n:'巩固复习', unit:'次', th:[5,30,100,300], val:()=>D.attempts.filter(a=>a.mode==='review').length},
  {id:'perfect', e:'💯', n:'完美一题', unit:'次', th:[1,10,50,100], val:()=>D.attempts.filter(a=>a.stars===3).length},
  {id:'hard', e:'🧗', n:'攻克难题', unit:'次', th:[1,5,20,50], val:()=>D.attempts.filter(a=>a.difficulty>=4 && !a.missed).length},
  {id:'speed', e:'⚡', n:'闪电侠', unit:'次', th:[1,10,30,100], val:()=>D.attempts.filter(a=>!a.missed && a.limit && a.timeUsed<=a.limit/2).length},
  {id:'goal', e:'🎯', n:'目标达成', unit:'天', th:[1,7,30,100], val:()=>Object.values(D.daily).filter(r=>r.goalDone).length}
];
const ONEOFF = [
  {id:'first', e:'🎉', n:'首次通关', d:'完成第一道题'},
  {id:'zero', e:'🧹', n:'错题清零', d:'把巩固队列全部攻克（可重复获得）'},
  {id:'importer', e:'📦', n:'题包收藏家', d:'导入第一个题包'}
];
const BADGES = ONEOFF; // 兼容旧代码
function tierOf(b, v){ let l=0; b.th.forEach((t,i)=>{ if(v>=t) l=i+1; }); return l; }
/* 每个知识点的步骤作答序列（1=对，0=错），按时间顺序 */
function kpSteps(){
  const m = {};
  D.attempts.forEach(a=>{
    const seq = []; const wrong = Math.max(0,(a.stepsTotal||0)-(a.stepsOk||0));
    for(let i=0;i<wrong;i++) seq.push(0); for(let i=0;i<(a.stepsOk||0);i++) seq.push(1);
    (a.kps||[]).forEach(kp=>{ const arr = m[kp] || (m[kp]=[]); seq.forEach(x=>arr.push(x)); });
  });
  return m;
}
function kpMedalInfo(arr){
  arr = arr || []; const n = arr.length, last = arr.slice(-20);
  const acc = last.length ? last.reduce((x,y)=>x+y,0)/last.length : 0;
  let lv = 0; if(n>=10 && acc>=0.8) lv = 1; if(n>=30 && acc>=0.9) lv = 2;
  return {n, acc, lv};
}
function packKps(){ return [...new Set(allPacks().flatMap(p=>p.questions.flatMap(q=>q.knowledgePoints||[])))]; }
const kpMedalName = (kp, lv) => kp + (lv>=2 ? '达人' : '小能手');
/* 检查并发放勋章；返回本次新获得/升级的事件列表 */
function checkBadges(){
  const ev = [];
  D.tiers = D.tiers || {}; D.tierDates = D.tierDates || {}; D.kpMedals = D.kpMedals || {};
  const give = id => { if(!D.badges[id]){ D.badges[id]=Date.now(); ev.push({t:'one', id}); } };
  if(D.attempts.length>=1) give('first');
  if(D.packs.some(p=>!isBuiltinId(p.id))) give('importer');
  if(D.hadReview && Object.keys(D.review).length===0){ /* 错题清零：每次清空巩固队列记一次 */
    D.zeroCount = (D.zeroCount||0) + 1; D.hadReview = false;
    if(!D.badges.zero) D.badges.zero = Date.now();
    ev.push({t:'one', id:'zero', n:D.zeroCount});
  }
  TIERED.forEach(b=>{ const l = tierOf(b, b.val()), old = D.tiers[b.id]||0; if(l>old){ D.tiers[b.id]=l; D.tierDates[b.id]=Date.now(); ev.push({t:'tier', id:b.id, lv:l}); } });
  const ks = kpSteps();
  packKps().forEach(kp=>{ const i = kpMedalInfo(ks[kp]), old = D.kpMedals[kp]||0; if(i.lv>old){ D.kpMedals[kp]=i.lv; ev.push({t:'kp', kp, lv:i.lv}); } });
  const lv = levelInfo().lv; if(lv > (D.level||1)){ D.level = lv; ev.push({t:'level', lv}); }
  return ev;
}
function evLabel(e){
  if(e.t==='tier'){ const b = TIERED.find(x=>x.id===e.id); return `${b.e} ${b.n} · ${TIER_NAMES[e.lv-1]}`; }
  if(e.t==='kp') return `🎖️ ${kpMedalName(e.kp, e.lv)}`;
  if(e.t==='level') return `⬆️ 升到 Lv${e.lv} ${LEVELS[e.lv-1][1]}`;
  const b = ONEOFF.find(x=>x.id===e.id); return `${b.e} ${b.n}${e.id==='zero' && e.n>1 ? ` ×${e.n}` : ''}`;
}
/* 庆祝弹窗：不阻挡操作，几秒后自动消失；撒花 + 普通话语音 */
let celebT;
function celebrate(ev){
  if(!ev || !ev.length) return;
  const C = MQVoiceTexts.CELEBRATE;
  const tiers = ev.filter(e=>e.t==='tier'), top = tiers.sort((a,b)=>b.lv-a.lv)[0];
  const line = top ? C.tier[top.lv-1] : ev.some(e=>e.t==='kp') ? C.kp : ev.some(e=>e.t==='one') ? C.badge : C.level;
  const headE = top ? TIERED.find(x=>x.id===top.id).e : ev[0].t==='kp' ? '🎖️' : ev[0].t==='level' ? '⬆️' : (ONEOFF.find(x=>x.id===ev[0].id)||{e:'🏅'}).e;
  let el = document.getElementById('celebrate');
  if(!el){ el = document.createElement('div'); el.id = 'celebrate'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite'); document.body.appendChild(el); el.addEventListener('click', ()=>el.classList.remove('show')); }
  el.innerHTML = `<div class="cb ${top?'t'+top.lv:''}"><div class="ce">${headE}</div><div class="ct">${top?TIER_NAMES[top.lv-1]+'勋章！':'新成就！'}</div>${ev.map(e=>`<div class="ci">${esc(evLabel(e))}</div>`).join('')}</div>`;
  el.classList.add('show'); clearTimeout(celebT); celebT = setTimeout(()=>el.classList.remove('show'), 4200);
  confetti(top && top.lv>=3 ? 260 : 180);
  hush(); say([line]);
}
/* ========== 积分兑换 ========== */
const DEFAULT_REWARDS = [
  {id:'r1', e:'🎮', n:'30分钟游戏时间', cost:300},
  {id:'r2', e:'🍦', n:'一个冰淇淋', cost:200},
  {id:'r3', e:'📺', n:'周末看一部电影', cost:800}
];
/* 数据迁移：可用积分 = 现有积分；按历史记录点亮分级勋章（不逐个弹窗） */
function migrate(){
  if(typeof D.spend!=='number' || !isFinite(D.spend)) D.spend = D.points||0;
  D.tiers = D.tiers || {}; D.tierDates = D.tierDates || {}; D.kpMedals = D.kpMedals || {};
  if(!Array.isArray(D.rewards)) D.rewards = DEFAULT_REWARDS.map(r=>Object.assign({}, r));
  if(!Array.isArray(D.redeems)) D.redeems = [];
  if(D.tierInit) return 0;
  if(D.badges.zero){ D.zeroCount = D.zeroCount || 1; if(!Object.keys(D.review).length) D.hadReview = false; }
  D.level = levelInfo().lv;
  const ev = checkBadges(); D.tierInit = 1; save();
  return ev.length;
}
/* 积分规则（防刷分）：首次完成 = 全额；正常模式重做：同一天 0 分，之后 30%；每日巩固复习 = 全额，零失误再 +10 */
function awardKind(key, isReview){
  const t = today(); const prior = D.attempts.filter(a=>a.key===key);
  if(!prior.length) return {kind:'first', factor:1};
  if(isReview) return {kind:'review', factor:1};
  if(prior.some(a=>a.date===t)) return {kind:'same', factor:0};
  return {kind:'later', factor:0.3};
}
const SAME_DAY_NOTE = '今天已经拿过这题的积分啦，换一道试试？';
/* 家长模式：4 位 PIN（散列后存本机）；只是防误操作的轻量锁 */
const PIN_KEY = 'mathquest_parent_pin';
const pinHash = pin => { const t = 'mathquest-parent|' + pin + '|v1'; let a = 0x811c9dc5, b = 0x9e3779b9; for(let k=0;k<t.length;k++){ const c=t.charCodeAt(k); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c, 0x5bd1e995) >>> 0; b = (b ^ (b>>>15)) >>> 0; } return a.toString(16).padStart(8,'0') + b.toString(16).padStart(8,'0'); };
function pinSet(){ try{ return !!localStorage.getItem(PIN_KEY); }catch(e){ return false; } }
function parentOn(){ return (S.parentUntil||0) > Date.now(); }
function enterParent(){ S.parentUntil = Date.now() + 10*60*1000; }
function mathQ(hard){ const a = hard ? 100+Math.floor(Math.random()*800) : 12+Math.floor(Math.random()*38), b = hard ? 12+Math.floor(Math.random()*80) : 3+Math.floor(Math.random()*7), c = Math.floor(Math.random()*20)+1; S._mq = {ans: a*b+c}; return `${a} × ${b} + ${c} = ?`; }
function parentGate(then){
  S.afterParent = then || null;
  if(parentOn()){ runAfterParent(); return; }
  const note = `<div class="muted small" style="margin-top:10px">🔒 家长密码只是防止孩子误操作的轻量锁，并不是真正的安全保护。</div>`;
  if(!pinSet()){
    modal(`<h2>👨‍👩‍👧 设置家长密码</h2><div class="muted small">第一次进入家长模式，请设置 4 位数字密码。以后编辑奖励、标记已兑现、撤销兑换都需要它。</div>
      <div class="field"><label>新密码（4 位数字）</label><input class="pin" id="pin1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></div>
      <div class="field"><label>再输入一次</label><input class="pin" id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></div>
      <div id="pinMsg" class="small err"></div>
      <div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost grow" data-act="close">取消</button><button class="btn grow" data-act="pinset">设置并进入</button></div>
      <button class="linkbtn" data-act="pinmath">暂不设置，用算术题验证</button>${note}`);
  } else {
    modal(`<h2>🔒 家长模式</h2><div class="field"><label>请输入 4 位家长密码</label><input class="pin" id="pin1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></div>
      <div id="pinMsg" class="small err"></div>
      <div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost grow" data-act="close">取消</button><button class="btn grow" data-act="pinenter">进入</button></div>
      <button class="linkbtn" data-act="pinforgot">忘记密码？</button>${note}`);
  }
  setTimeout(()=>{ const i=$('#pin1'); if(i) i.focus(); }, 50);
}
function runAfterParent(){ const f = S.afterParent; S.afterParent = null; if(typeof f==='function') f(); else render(); }
function mathModal(hard){
  modal(`<h2>${hard?'🔑 重置家长密码':'🧮 家长验证'}</h2><div class="muted small">${hard?'请家长计算下面的题目，答对后可以重新设置密码。':'请家长计算：'}</div>
    <div style="font-size:26px;font-weight:800;text-align:center;margin:14px 0">${mathQ(hard)}</div>
    <input class="ans" id="mathAns" type="text" inputmode="numeric" autocomplete="off" placeholder="答案">
    <div id="pinMsg" class="small err"></div>
    <div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost grow" data-act="close">取消</button><button class="btn grow" data-act="${hard?'pinreset':'pinmathok'}">确定</button></div>`);
  setTimeout(()=>{ const i=$('#mathAns'); if(i) i.focus(); }, 50);
}
const isLeapPin = v => /^\d{4}$/.test(v);

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
    ${(()=>{ const L=levelInfo(); return `<button class="lvline" data-act="metab" data-v="badge"><span class="lvtag">Lv${L.lv}</span><b>${L.title}</b><span class="lvbar"><i style="width:${Math.round(L.pct*100)}%"></i></span><span class="small">${L.next?`再得 ${L.toNext} 分升级`:'已满级'}</span></button>`; })()}
    <div class="stats3">
      <div class="stat"><b>${st}</b><span>连续打卡(天)</span></div>
      <button class="stat" data-act="shop"><b>${D.spend||0}</b><span>可用积分 ›</span></button>
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
  const aw = awardKind(key, isReview);
  const ses = { key, award: aw.kind, factor: aw.factor, mode: isReview?'review':'normal', queue: queue||null, stepIdx:0, tries:0, results:[], elapsed:0, overtime:false, phase:'answer', fb:null, draft:'', sel:null, points:0, startedAt:Date.now(), lastAct:0, idleDone:false, remind:null, spokenSteps:{} };
  S.session = ses;
  if(initAnalysis(ses, f.pack, f.q) && D.settings.showAnalysis!==false && !NO_AN) ses.stage = 'analysis';
  const r = (sessionQCount===0 || Math.random()<0.5) ? remind('start') : null; sessionQCount++;
  go('play');
  if(aw.kind==='same') setTimeout(()=>toast(SAME_DAY_NOTE), 300);
  say([r, ses.stage==='analysis' ? null : autoStepSpeech(f.q, 0)]); // 在点击事件内同步调用；审题阶段不自动朗读，满足浏览器“需用户手势”的限制
}
/* ========== 审题分析 ========== */
const NO_AN = /[?&]analysis=0\b/.test(location.search); /* 自动化测试用：?analysis=0 跳过审题阶段 */
function normAnalysis(a){
  if(!a || typeof a!=='object') return null;
  const arr = x => Array.isArray(x) ? x : (x ? [x] : []);
  const known = arr(a.known).map(k => typeof k==='string' ? {text:k, hidden:false, why:''} : (k && k.text ? {text:String(k.text), hidden:!!k.hidden, why:String(k.why||'')} : null)).filter(Boolean);
  const associations = arr(a.associations).map(s => s && (s.recall||s.trigger) ? {trigger:String(s.trigger||''), recall:String(s.recall||''), latex:String(s.latex||''), why:String(s.why||'')} : null).filter(Boolean);
  const thinkingPath = arr(a.thinkingPath).map(x=>String(x||'')).filter(Boolean);
  const pitfalls = arr(a.pitfalls).map(x=>String(x||'')).filter(Boolean);
  const goal = String(a.goal||'');
  if(!known.length && !associations.length && !thinkingPath.length && !pitfalls.length && !goal) return null;
  return {known, goal, associations, thinkingPath, pitfalls};
}
/* 题目的审题分析；若内置题包被旧版本覆盖（无分析），用内置版本的分析补上 */
function qAnalysis(pack, q){
  if(q.analysis) return q.analysis;
  const b = BUILTINS.find(x=>x.id===pack.id); const bq = b && b.questions.find(x=>String(x.id)===String(q.id));
  return bq && bq.analysis ? bq.analysis : null;
}
function seededShuffle(list, seed){ let h = 0; for(const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; const a = list.slice(); for(let i=a.length-1;i>0;i--){ h = Math.imul(h ^ (h>>>13), 0x5bd1e995) >>> 0; const j = h % (i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
/* “看到这个，你会想到什么？”：正确项 = 第一条联想；干扰项来自同题包其他联想/公式名称 */
function buildQuiz(pack, q, an){
  const first = an.associations[0]; if(!first || !first.recall) return null;
  const right = first.recall, own = new Set(an.associations.map(s=>s.recall));
  const pool = [];
  allPacks().forEach(p=>p.questions.forEach(x=>{ const a = qAnalysis(p,x); if(a) a.associations.forEach(s=>{ if(s.recall && !own.has(s.recall)) pool.push(s.recall); }); (x.formulas||[]).forEach(f=>{ if(f.name && !own.has(f.name)) pool.push(f.name); }); }));
  const same = [...new Set(pool.filter(r=>r!==right))];
  const fromPack = same.filter(r=>pack.questions.some(x=>{ const a=qAnalysis(pack,x); return a && a.associations.some(s=>s.recall===r); }));
  const pick = seededShuffle(fromPack.length>=3 ? fromPack : same, q.id+'|'+right).slice(0,3);
  if(pick.length<2) return null;
  return {trigger:first.trigger, right, opts: seededShuffle([right, ...pick], 'o|'+q.id), choice:null, ok:null};
}
function initAnalysis(ss, pack, q){
  const an = qAnalysis(pack, q); if(!an) return false;
  ss.an = {reveal: 0, quiz: buildQuiz(pack, q, an), quizDone: false, seen: false};
  return true;
}
function leaveAnalysis(){
  const ss = S.session; if(!ss) return; const f = findQ(ss.key); const first = !ss.an || !ss.an.seen;
  ss.stage = null; if(ss.an) ss.an.seen = true; hush(); render(); window.scrollTo(0,0);
  if(first && f && !ss.results.length) say([autoStepSpeech(f.q, ss.stepIdx)]);
}
const goalTxt = g => String(g).replace(/^求[:：]?\s*/,'');
function knownCard(k, i){
  return `<div class="kcard ${k.hidden?'hid':''} pop"><span class="kn">${i+1}</span><div class="grow">${k.hidden?'<span class="htag">🕵️ 隐藏条件</span> ':''}${tex(k.text)}${k.hidden&&k.why?`<div class="why">💡 ${tex(k.why)}</div>`:''}</div></div>`;
}
function assocList(an){ return an.associations.map(s=>`<div class="assoc"><div class="tr">👀 看到：${tex(s.trigger)}</div><div class="rc">💭 想到：<b>${tex(s.recall)}</b></div>${s.latex?`<div class="ltx">${texBlock(s.latex)}</div>`:''}${s.why?`<div class="why">${tex(s.why)}</div>`:''}</div>`).join(''); }
function pathList(an){ return `<ol class="tpath">${an.thinkingPath.map(t=>`<li>${tex(t)}</li>`).join('')}</ol>`; }
function pitBox(an){ return an.pitfalls.length ? `<div class="pitbox"><b>⚠️ 易错点</b><ul>${an.pitfalls.map(t=>`<li>${tex(t)}</li>`).join('')}</ul></div>` : ''; }
/* 完整（静态）分析：用于结果页回顾 */
function analysisFull(an){
  return `<div class="anblk"><div class="anh">① 已知条件</div>${an.known.map(knownCard).join('')}${an.goal?`<div class="angoal">🎯 求：${tex(goalTxt(an.goal))}</div>`:''}</div>
    ${an.associations.length?`<div class="anblk"><div class="anh">② 联想定理 / 公式</div>${assocList(an)}</div>`:''}
    ${an.thinkingPath.length?`<div class="anblk"><div class="anh">③ 解题思路</div>${pathList(an)}</div>`:''}${pitBox(an)}`;
}
/* 做题前的互动审题阶段 */
function vAnalysis(q, an, ss){
  const A = ss.an, nK = an.known.length, all = A.reveal>=nK, Z = A.quiz;
  const quizOpen = all && (!Z || A.quizDone);
  const back = ss.stepIdx>0 || ss.results.length ? `回到第 ${ss.stepIdx+1} 步 →` : '开始做题 →';
  let h = `<div class="card anal" id="anal"><div class="row between"><h3 style="margin:0">🔍 审题分析</h3><button class="btn sm ghost" data-act="anskip">${ss.an.seen?'返回做题':'直接做题'} ›</button></div>
    <div class="muted small" style="margin:4px 0 10px">先想清楚“知道什么、要求什么、该想到什么”，再动笔。</div>
    <div class="anblk"><div class="anh">① 已知条件 <span class="muted small">${Math.min(A.reveal,nK)}/${nK}</span><span class="grow"></span>${all?spk('ak','已知条件'):''}</div>
    ${an.known.slice(0, A.reveal).map(knownCard).join('')}
    ${!all?`<div class="row" style="gap:8px;margin-top:8px"><button class="btn sm" data-act="anext">${A.reveal?'下一个条件 ▸':'看第一个条件 ▸'}</button><button class="linkbtn" style="margin:0" data-act="anall">全部显示</button></div>`:''}
    ${all&&an.goal?`<div class="angoal pop">🎯 求：${tex(goalTxt(an.goal))}</div>`:''}</div>`;
  if(all && Z){
    h += `<div class="anblk"><div class="anh">② 看到这个，你会想到什么？<span class="grow"></span>${A.quizDone?spk('aa','联想'):''}</div>
      <div class="qtrig">题目里有：${tex(Z.trigger)}</div>
      <div class="opts small">${Z.opts.map((o,i)=>{ let c=''; if(A.quizDone){ if(o===Z.right) c='right'; else if(Z.choice===i) c='wrong'; } return `<button class="opt ${c}" data-act="anq" data-v="${i}" ${A.quizDone?'disabled':''}><span class="k">${String.fromCharCode(65+i)}</span><span class="grow">${tex(o)}</span></button>`; }).join('')}</div>
      ${!A.quizDone?`<button class="linkbtn" data-act="anq" data-v="-1">我还想不到，直接看看</button>`:`<div class="fb ${Z.ok?'ok':'hint'} pop"><b class="t">${Z.ok?'✅ 想得对！'+(Z.pts?` <span class="chip ok">+${Z.pts} 积分</span>`:''):'💡 应该联想到：'+tex(Z.right)}</b></div>${assocList(an)}`}</div>`;
  } else if(all && an.associations.length){
    h += `<div class="anblk"><div class="anh">② 联想定理 / 公式<span class="grow"></span>${spk('aa','联想')}</div>${assocList(an)}</div>`;
  }
  if(quizOpen){
    if(an.thinkingPath.length) h += `<div class="anblk pop"><div class="anh">③ 解题思路<span class="grow"></span>${spk('ap','解题思路')}</div>${pathList(an)}</div>`;
    if(an.pitfalls.length) h += `<div class="pop">${pitBox(an).replace('<b>⚠️ 易错点</b>', `<div class="row between"><b>⚠️ 易错点</b>${spk('aw','易错点')}</div>`)}</div>`;
    h += `<button class="btn block" data-act="anstart" style="margin-top:14px">${back}</button>`;
  }
  return h + `</div>`;
}
/* 固定原题下方的小提示：求什么 + 隐藏条件（审题后显示） */
function analysisSummary(an){
  const hid = an.known.filter(k=>k.hidden);
  return `<div class="osum">${an.goal?`<span>🎯 ${tex(an.goal)}</span>`:''}${hid.length?`<span class="hs">🕵️ ${hid.map(k=>tex(k.text)).join('；')}</span>`:''}</div>`;
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
  const an = qAnalysis(pack, q); const inAn = !!(an && ss.an && ss.stage==='analysis' && ss.phase!=='done');
  const anBtn = an && ss.phase!=='done' && !inAn ? `<button class="anbtn" data-act="anopen" aria-label="审题分析">🔍 审题</button>` : '';
  const orig = `<div class="card orig"><div class="ohead"><div class="lab grow">原题 · ${q.knowledgePoints.map(esc).join(' · ')}</div>${anBtn}${spk('orig','原题')}<button class="pintgl" data-act="pintoggle" aria-expanded="${col?'false':'true'}">${col?'展开 ▾':'收起 ▴'}</button></div><div class="obody" id="obody">${tex(q.original)}</div>${an && ss.an && ss.an.seen && !inAn && ss.phase!=='done' ? analysisSummary(an) : ''}</div>`;
  /* 原题（含计时器、🔊）固定在上方；步骤在下方随页面滚动。iPad 横屏改为左右两栏。 */
  const pin = `<div class="pin ${col?'collapsed':''}" id="pin">${head}${orig}</div>`;
  const wrap = (right) => `<div class="playgrid">${pin}<div class="stepspane" id="stepspane"><div id="remind">${remindHTML()}</div>${right}<div class="card markcard">${markRow}</div></div></div>`;
  const dots = `<div class="stepdots">${q.steps.map((s,i)=>`<i class="${ss.results[i]?ss.results[i].status:(i===ss.stepIdx&&ss.phase!=='done'?'cur':'')}"></i>`).join('')}</div>`;
  const done = ss.results.map((r,i)=> (i<ss.stepIdx || ss.phase==='done') ? `<div class="donestep"><span class="b ${r.status==='missed'?'bad':'ok'}">${r.status==='missed'?'!':'✓'}</span><div class="grow"><div class="muted small">第 ${i+1} 步</div>${tex(q.steps[i].prompt)}<div class="small" style="margin-top:4px">答案：<b>${tex(answerText(q.steps[i]))}</b></div></div></div>` : '').join('');
  if(inAn) return wrap(vAnalysis(q, an, ss));
  if(ss.phase==='done') return wrap(dots + vResult(q, ss) + (an?`<details class="card anrev"><summary style="font-weight:700;cursor:pointer">🔍 审题分析回顾</summary>${analysisFull(an)}</details>`:'') + `<details class="card"><summary style="font-weight:700;cursor:pointer">查看全部步骤</summary>${done}</details>`);
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
    if(F.kind==='ok') fb = `<div class="fb ok pop"><b class="t row between"><span>✅ ${esc(F.msg)} ${F.pts && ss.factor===1?`<span class="chip ok">+${F.pts} 积分</span>`:''}</span>${st.explanation?spk('exp','解析'):''}</b>${st.explanation?tex(st.explanation):''}</div>`;
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
    ${r.ptsNote?`<div class="ptsnote ${r.ptsKind==='same'?'same':''}">${r.ptsKind==='same'?'💡':r.ptsKind==='review'?'🌱':'🔁'} ${esc(r.ptsNote)}</div>`:''}
    ${r.newBadges.length?`<div class="fb ok">🏅 ${r.newBadges.map(e=>esc(evLabel(e))).join('、')}</div>`:''}
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
  if(ss.stage==='analysis'){ ss.lastAct = ss.elapsed; return; } /* 审题时间不计入限时 */
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
  /* 防刷分 */
  const aw = awardKind(ss.key, mode==='review'); const basePts = pts; let bonus = 0, ptsNote = '';
  if(aw.kind==='review'){ if(!missed && !overtime){ bonus = 10; pts += 10; ptsNote = '巩固复习零失误，额外奖励 +10'; } }
  else if(aw.kind==='same'){ pts = 0; ptsNote = SAME_DAY_NOTE; }
  else if(aw.kind==='later'){ pts = Math.round(basePts*0.3); ptsNote = `重做旧题获得 30% 积分（原本 ${basePts} 分）`; }
  D.attempts.push({key:ss.key, packId:pack.id, qid:q.id, ts:Date.now(), date:t, kps:q.knowledgePoints.slice(), difficulty:q.difficulty, stepsTotal, stepsOk, missed, overtime, timeUsed, limit:q.timeLimitSec, stars, points:pts, basePoints:basePts, award:aw.kind, mode});
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
  D.points += pts; D.spend = (D.spend||0) + pts;
  let autoChk = false; if(!D.checkins[t]){ D.checkins[t] = Date.now(); autoChk = true; }
  const goalBefore = r.goalDone;
  const g = goalInfo(); if(g.done && !goalBefore){ r.goalDone = true; }
  const newBadges = checkBadges();
  save();
  ss.result = {stars, missed, stepsOk, stepsTotal, overtime, timeUsed, points:pts, ptsKind:aw.kind, ptsNote, newBadges, reviewNote};
  ss.phase = 'done';
  render(); window.scrollTo({top:0, behavior:'smooth'});
  confetti(stars===3 ? 220 : 140);
  hush(); const fr = remind('finish'); if(fr){ refreshRemind(); say([fr]); }
  setTimeout(()=>{
    if(g.done && !goalBefore){ toast('🎯 今日目标达成！给自己鼓个掌 👏'); confetti(160); }
    else if(autoChk) toast(`🔥 已自动打卡，连续 ${streak()} 天！`);
  }, 900);
  if(newBadges.length) setTimeout(()=>{ if(S.view==='play') celebrate(newBadges); }, 1700);
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
  const fm = new Map(), am = new Map(), methods = [];
  allPacks().forEach(p=>p.questions.forEach(q=>{
    q.formulas.forEach(f=>{ const id = f.name+'|'+f.latex; const c = fm.get(id) || {type:'f', id:'f'+hash(id), name:f.name, latex:f.latex, tip:f.tip, kps:new Set()}; q.knowledgePoints.forEach(k=>c.kps.add(k)); fm.set(id,c); });
    const an = qAnalysis(p, q); if(an) an.associations.forEach(s=>{ if(!s.recall) return; const id = s.trigger+'|'+s.recall; const c = am.get(id) || {type:'a', id:'a'+hash(id), trigger:s.trigger, recall:s.recall, latex:s.latex, why:s.why, kps:new Set()}; q.knowledgePoints.forEach(k=>c.kps.add(k)); am.set(id,c); });
    if(q.method) methods.push({type:'m', id:'m'+hash(p.id+q.id), name:stripTex(q.original).slice(0,40), original:q.original, method:q.method, kps:new Set(q.knowledgePoints)});
  }));
  return {f:[...fm.values()], m:methods, a:[...am.values()]};
}
function vFormulas(){
  const {f,m,a} = collectCards(); const wm = weakMap();
  const list = S.fTab==='f' ? f : S.fTab==='a' ? a : m;
  const allKp = [...new Set([...f,...m,...a].flatMap(c=>[...c.kps]))].sort((a,b)=>(wm[b]||0)-(wm[a]||0));
  const score = c => Math.max(0,...[...c.kps].map(k=>wm[k]||0));
  const shown = list.filter(c=>S.fKp==='全部' || c.kps.has(S.fKp)).sort((a,b)=>score(b)-score(a));
  return `<div class="topbar"><h1>🧠 公式速记</h1></div>
  <div class="seg"><button class="${S.fTab==='f'?'on':''}" data-act="ftab" data-v="f">📐 公式卡 (${f.length})</button><button class="${S.fTab==='m'?'on':''}" data-act="ftab" data-v="m">🧭 思路卡 (${m.length})</button><button class="${S.fTab==='a'?'on':''}" data-act="ftab" data-v="a">🔗 联想卡 (${a.length})</button></div>
  <div class="filter">${['全部',...allKp].map(k=>`<button class="${S.fKp===k?'on':''}" data-act="fkp" data-v="${esc(k)}">${(wm[k]||0)>0.15?'🔥':''}${esc(k)}</button>`).join('')}</div>
  <div class="muted small" style="margin:0 4px 8px">点卡片翻面 · 🔥 = 你的薄弱知识点，已排在前面</div>
  <div class="fgrid">${shown.length?shown.map(c=>{
    const weak = score(c)>0.15;
    return `<div class="flip ${S.flipped[c.id]?'on':''}" data-act="flip" data-v="${c.id}"><div class="in">
      <div class="f ${c.type==='m'?'m':c.type==='a'?'a':''}"><div class="chips" style="justify-content:center">${[...c.kps].map(k=>`<span class="chip">${esc(k)}</span>`).join('')}${weak?'<span class="chip hot">🔥 薄弱</span>':''}</div>
        <div class="nm">${c.type==='f'?esc(c.name):c.type==='a'?'看到这个，想到什么？':'这道题怎么想？'}</div>${c.type==='a'?`<div class="atrig">${tex(c.trigger)}</div>`:''}${c.type==='m'?`<div class="small muted" style="max-height:56px;overflow:hidden">${tex(c.original)}</div>`:''}<div class="tap">👆 点击翻面</div></div>
      <div class="bk">${c.type==='f'?`<div class="ttl">${esc(c.name)}</div><div class="ltx">${texBlock(c.latex)}</div><div class="muted small">💡 ${tex(c.tip)}</div>`
        :c.type==='a'?`<div class="ttl a">💭 ${tex(c.recall)}</div>${c.latex?`<div class="ltx">${texBlock(c.latex)}</div>`:''}<div class="muted small">${tex(c.why)}</div>`
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
  const badgeSec = vBadges() + `
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
  const setSec = `<div class="card"><h3>📖 学习方式</h3>${tg('showAnalysis','做题前显示审题分析','先看已知条件、隐藏条件、该联想的定理和解题思路，再分步做题；随时可点原题旁的「🔍 审题」')}</div>` + voiceSec + `<div class="card"><h3>🎨 外观主题</h3>
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
  return `<div class="topbar"><h1>🙋 ${esc(D.settings.nickname)}</h1><span class="sp"></span><button class="chip" data-act="shop">💰 ${D.spend||0} 可用</button><span class="chip">⭐ ${totalStars()}</span></div>
  <div class="seg"><button class="${S.meTab==='weak'?'on':''}" data-act="metab" data-v="weak">📊 薄弱</button><button class="${S.meTab==='badge'?'on':''}" data-act="metab" data-v="badge">🏅 成就</button><button class="${S.meTab==='shop'?'on':''}" data-act="metab" data-v="shop">🎁 兑换</button><button class="${S.meTab==='set'?'on':''}" data-act="metab" data-v="set">⚙️ 设置</button></div>
  ${S.meTab==='weak'?weakSec:S.meTab==='badge'?badgeSec:S.meTab==='shop'?vShop():setSec}`;
}

/* ========== 视图：成就 ========== */
function progBar(pct){ return `<div class="tprog"><i style="width:${Math.max(0,Math.min(100,Math.round(pct*100)))}%"></i></div>`; }
function vBadges(){
  const L = levelInfo();
  const lvCard = `<div class="card lvcard"><div class="row" style="gap:12px"><div class="lvbig">Lv${L.lv}</div><div class="grow"><b style="font-size:18px">${L.title}</b><div class="muted small">累计积分 ${D.points||0}${L.next?` · 距 Lv${L.lv+1} ${LEVELS[L.lv][1]} 还差 ${L.toNext} 分`:' · 已达到最高等级'}</div>${progBar(L.pct)}</div></div>
    <div class="lvlist">${LEVELS.map(([p,t],i)=>`<span class="${i+1<=L.lv?'on':''}">Lv${i+1} ${t}<small>${p}</small></span>`).join('')}</div></div>`;
  const tiered = TIERED.map(b=>{
    const v = b.val(), lv = D.tiers[b.id]||0, cur = Math.max(lv, tierOf(b,v));
    const next = b.th[cur], prev = cur ? b.th[cur-1] : 0;
    const pct = next ? v/next : 1;
    return `<div class="badge tb ${cur?'got t'+cur:'lock'}"><div class="e">${b.e}</div><div class="n">${b.n}</div>
      <div class="tier">${cur?TIER_NAMES[cur-1]:'未解锁'}</div>${progBar(pct)}
      <div class="d">${next?`${Math.min(v,next)}/${next} ${b.unit} → ${TIER_NAMES[cur]}`:`${v} ${b.unit} · 已满级`}</div></div>`;
  }).join('');
  const one = ONEOFF.map(b=>{ const got = !!D.badges[b.id];
    return `<div class="badge ${got?'got':'lock'}"><div class="e">${b.e}</div><div class="n">${b.n}${b.id==='zero' && (D.zeroCount||0)>1?` ×${D.zeroCount}`:''}</div><div class="d">${got?'已获得 '+dstr(new Date(D.badges[b.id])).slice(5):b.d}</div></div>`; }).join('');
  const ks = kpSteps(); const kps = packKps();
  const kpRows = kps.map(kp=>{ const i = kpMedalInfo(ks[kp]); const lv = Math.max(D.kpMedals[kp]||0, i.lv);
    const goalN = lv>=1 ? 30 : 10, goalA = lv>=1 ? 90 : 80;
    return {kp, lv, i, html:`<div class="kpm ${lv?'got t'+(lv+1):'lock'}"><div class="e">${lv>=2?'🏅':lv?'🎖️':'🔒'}</div><div class="grow"><b>${esc(lv?kpMedalName(kp,lv):kp+'小能手')}</b>
      <div class="muted small">${lv>=2?'已获得最高级「达人」':`练习 ${Math.min(i.n,goalN)}/${goalN} 步 · 近 20 步正确率 ${Math.round(i.acc*100)}%（需 ≥${goalA}%）`}${lv===1?` → 「${esc(kp)}达人」`:''}</div>${lv>=2?'':progBar(Math.min(i.n/goalN, 1)*0.5 + Math.min(i.acc/(goalA/100),1)*0.5)}</div></div>`};
  }).sort((a,b)=>b.lv-a.lv || b.i.n-a.i.n);
  const kpGot = kpRows.filter(x=>x.lv).length;
  return lvCard + `<div class="card"><h3>🏅 分级勋章 <span class="muted small">铜 → 银 → 金 → 钻石</span></h3><div class="badges">${tiered}</div></div>
  <div class="card"><h3>🎗️ 纪念徽章</h3><div class="badges">${one}</div></div>
  <div class="card"><h3>🎖️ 专项勋章 <span class="muted small">${kpGot}/${kps.length}</span></h3><div class="muted small" style="margin-bottom:8px">某个知识点练满 10 步、最近 20 步正确率 ≥80% 得「小能手」；练满 30 步且 ≥90% 升级为「达人」。</div><div class="kpgrid">${(S.kpAll?kpRows:kpRows.filter((x,i)=>x.lv || i<kpGot+6)).map(x=>x.html).join('')||'<div class="muted small">导入题包后这里会出现各知识点的专项勋章</div>'}</div>
    ${kpRows.length>kpGot+6?`<button class="linkbtn" data-act="kpall">${S.kpAll?'收起':`查看全部 ${kps.length} 个知识点 ▾`}</button>`:''}</div>`;
}
/* ========== 视图：积分兑换 ========== */
function vShop(){
  const P = parentOn(); const sp = D.spend||0; const L = levelInfo();
  const st = {pending:['待兑现','warn'], done:['已兑现','ok'], refunded:['已撤销','']};
  const rewards = D.rewards.map(rw=>{ const can = sp>=rw.cost;
    return `<div class="reward"><div class="re">${esc(rw.e)}</div><div class="grow"><b>${esc(rw.n)}</b><div class="muted small">💰 ${rw.cost} 积分</div>
      ${!can?progBar(sp/rw.cost):''}</div>
      ${P?`<button class="btn sm ghost" data-act="rwedit" data-v="${esc(rw.id)}">编辑</button><button class="btn sm danger" data-act="rwdel" data-v="${esc(rw.id)}">删除</button>`
         :`<button class="btn sm ${can?'':'ghost'}" data-act="redeem" data-v="${esc(rw.id)}" ${can?'':'aria-disabled="true"'}>${can?'兑换':`还差 ${rw.cost-sp}`}</button>`}</div>`; }).join('');
  const hist = D.redeems.map(r=>`<div class="item rdi"><div class="ic">${esc(r.e)}</div><div class="grow"><div class="tt small">${esc(r.n)}</div><div class="muted small">${r.date} · ${r.cost} 积分${r.status==='done'&&r.doneTs?` · ${dstr(new Date(r.doneTs)).slice(5)} 兑现`:''}</div></div>
      <span class="chip ${st[r.status][1]}">${st[r.status][0]}</span>
      ${P && r.status==='pending'?`<button class="btn sm" data-act="rddone" data-v="${esc(r.id)}">已兑现</button>`:''}${P && r.status!=='refunded'?`<button class="btn sm ghost" data-act="rdundo" data-v="${esc(r.id)}">撤销</button>`:''}</div>`).join('');
  return `<div class="hero shophero"><div class="stats3">
      <div class="stat"><b>${sp}</b><span>可用积分</span></div>
      <div class="stat"><b>${D.points||0}</b><span>累计积分</span></div>
      <div class="stat"><b>Lv${L.lv}</b><span>${L.title}</span></div></div>
    <div class="note">可用积分用来兑换奖励；累计积分只增不减，决定等级和勋章。</div></div>
  <div class="card list"><h3>🎁 奖励 <span class="grow"></span>${P?`<button class="btn sm" data-act="rwadd">＋ 添加奖励</button>`:''}</h3>${rewards||'<div class="muted small">还没有奖励，请家长添加</div>'}</div>
  <div class="card list"><h3>📜 兑换记录 <span class="muted small">${D.redeems.filter(r=>r.status==='pending').length} 个待兑现</span></h3>${hist||'<div class="muted small">还没有兑换过，攒够积分就来换吧！</div>'}</div>
  <div class="card parentcard"><div class="row" style="gap:10px"><div class="grow"><b>👨‍👩‍👧 家长模式 ${P?'<span class="chip ok">已开启</span>':''}</b><div class="muted small">编辑/删除奖励、标记已兑现、撤销兑换（退回积分）需要家长密码。密码只是防误操作的轻量锁，不是真正的安全保护。</div></div>
    <button class="btn sm ${P?'ghost':''}" data-act="parent">${P?'退出':'🔒 进入'}</button></div></div>`;
}
function rewardModal(id){
  const rw = id ? D.rewards.find(x=>x.id===id) : null;
  modal(`<h2>${rw?'✏️ 编辑奖励':'＋ 添加奖励'}</h2>
    <div class="row" style="gap:10px"><div class="field" style="width:84px"><label>图标</label><input type="text" id="rwE" maxlength="4" value="${esc(rw?rw.e:'🎁')}" style="text-align:center;font-size:22px"></div>
    <div class="field grow"><label>名称</label><input type="text" id="rwN" maxlength="24" value="${esc(rw?rw.n:'')}" placeholder="例如：周末去公园"></div></div>
    <div class="field"><label>需要积分</label><input type="number" id="rwC" min="1" max="100000" inputmode="numeric" value="${rw?rw.cost:100}"></div>
    <div id="rwMsg" class="small err"></div>
    <div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost grow" data-act="close">取消</button><button class="btn grow" data-act="rwsave" data-v="${rw?esc(rw.id):''}">保存</button></div>`);
}
window.__mqTest = { levelInfo: p=>levelInfo(p), awardKind: (k,r)=>awardKind(k,r), pinHash: p=>pinHash(p), parentOn: ()=>parentOn() };

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
  anext(){ const ss=S.session; if(!ss||!ss.an) return; ss.an.reveal++; render(); scrollBelowPin($('#anal .kcard:last-of-type')||$('#anal'),'nearest'); },
  anall(){ const ss=S.session; if(!ss||!ss.an) return; ss.an.reveal=999; render(); },
  anq(d){ const ss=S.session; const Z=ss&&ss.an&&ss.an.quiz; if(!Z||ss.an.quizDone) return; const i=+d.v; Z.choice=i; Z.ok = i>=0 && Z.opts[i]===Z.right; Z.pts = Z.ok ? 2 : 0; if(Z.ok){ ss.points += 2; } ss.an.quizDone=true; render(); if(Z.ok) confetti(40);
    setTimeout(()=>scrollBelowPin($('#anal .assoc')||$('#anal'),'nearest'),30); },
  anskip(){ leaveAnalysis(); },
  anstart(){ leaveAnalysis(); },
  anopen(){ const ss=S.session; if(!ss) return; if(!ss.an){ const f=findQ(ss.key); if(!f || !initAnalysis(ss, f.pack, f.q)) return; } hush(); ss.an.reveal=999; if(ss.an.quiz && !ss.an.quizDone && ss.an.seen) ss.an.quizDone=true; ss.stage='analysis'; render(); scrollBelowPin($('#anal'),'top'); },
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
  checkin(){ const t=today(); if(D.checkins[t]) return; D.checkins[t]=Date.now(); const nb=checkBadges(); save(); render(); confetti(90); toast(`🔥 打卡成功！已连续 ${streak()} 天`); if(nb.length) setTimeout(()=>celebrate(nb), 900); },
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
    else if(['ak','aa','ap','aw'].includes(d.w)){ const an = qAnalysis(f.pack, q); if(an) say([MQVoiceTexts.forQuestion(Object.assign({}, q, {analysis: an}), d.w)]); }
  },
  hush(){ hush(); },
  closeremind(){ if(S.session) S.session.remind = null; refreshRemind(); },
  vset(d){ D.settings[d.k] = !D.settings[d.k]; save(); if(d.k==='voice' && !D.settings.voice) hush(); render(); },
  vrate(d){ D.settings.rate = d.v; save(); render(); say([MQVoiceTexts.EXTRA.ratePreview]); },
  vtest(){ say([MQVoiceTexts.EXTRA.test]); },
  ftab(d){ S.fTab=d.v; render(); },
  fkp(d){ S.fKp=d.v; if(S.view!=='formulas'){ go('formulas'); } else render(); },
  flip(d,el){ S.flipped[d.v]=!S.flipped[d.v]; el.classList.toggle('on'); },
  kpall(){ S.kpAll=!S.kpAll; render(); },
  metab(d){ S.meTab=d.v; if(S.view!=='me') go('me'); else render(); },
  shop(){ S.meTab='shop'; if(S.view!=='me') go('me'); else { render(); window.scrollTo(0,0); } },
  redeem(d){ const rw = D.rewards.find(x=>x.id===d.v); if(!rw) return; if((D.spend||0) < rw.cost){ toast(`还差 ${rw.cost-(D.spend||0)} 分，继续加油！`); return; }
    modal(`<h2>🎁 确认兑换</h2><div style="text-align:center;margin:10px 0"><div style="font-size:52px">${esc(rw.e)}</div><b style="font-size:18px">${esc(rw.n)}</b><div class="muted">需要 <b>${rw.cost}</b> 积分 · 兑换后剩余 ${(D.spend||0)-rw.cost} 分</div></div><div class="row" style="gap:10px"><button class="btn ghost grow" data-act="close">再想想</button><button class="btn grow" data-act="doredeem" data-v="${esc(rw.id)}">确定兑换</button></div>`); },
  doredeem(d){ const rw = D.rewards.find(x=>x.id===d.v); if(!rw || (D.spend||0) < rw.cost){ closeModal(); return; }
    D.spend -= rw.cost; D.redeems.unshift({id:'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), rid:rw.id, e:rw.e, n:rw.n, cost:rw.cost, ts:Date.now(), date:today(), status:'pending'});
    save(); closeModal(); render(); confetti(120); toast('🎁 兑换成功！找家长兑现吧'); hush(); say([MQVoiceTexts.CELEBRATE.redeem]); },
  parent(){ if(parentOn()){ S.parentUntil = 0; render(); toast('已退出家长模式'); return; } parentGate(()=>{ render(); toast('👨‍👩‍👧 已进入家长模式（10 分钟内有效）'); }); },
  pinset(){ const a=$('#pin1').value.trim(), b=$('#pin2').value.trim(); if(!isLeapPin(a)){ $('#pinMsg').textContent='请输入 4 位数字'; return; } if(a!==b){ $('#pinMsg').textContent='两次输入不一致'; return; }
    try{ localStorage.setItem(PIN_KEY, pinHash(a)); }catch(e){} enterParent(); closeModal(); runAfterParent(); },
  pinenter(){ const a=$('#pin1').value.trim(); let h=''; try{ h=localStorage.getItem(PIN_KEY)||''; }catch(e){} if(pinHash(a)!==h){ $('#pinMsg').textContent='密码不对，再试一次'; $('#pin1').value=''; return; } enterParent(); closeModal(); runAfterParent(); },
  pinmath(){ mathModal(false); },
  pinmathok(){ if(parseInt($('#mathAns').value,10)!==S._mq.ans){ $('#pinMsg').textContent='答案不对'; return; } enterParent(); closeModal(); runAfterParent(); },
  pinforgot(){ mathModal(true); },
  pinreset(){ if(parseInt($('#mathAns').value,10)!==S._mq.ans){ $('#pinMsg').textContent='答案不对'; return; } try{ localStorage.removeItem(PIN_KEY); }catch(e){} const f=S.afterParent; parentGate(f); },
  rwedit(d){ parentGate(()=>rewardModal(d.v)); },
  rwadd(){ parentGate(()=>rewardModal(null)); },
  rwsave(d){ const e=($('#rwE').value.trim()||'🎁').slice(0,4), n=$('#rwN').value.trim().slice(0,24), c=parseInt($('#rwC').value,10);
    if(!n){ $('#rwMsg').textContent='请填写奖励名称'; return; } if(!(c>=1 && c<=100000)){ $('#rwMsg').textContent='积分需在 1 ~ 100000 之间'; return; }
    if(d.v){ const rw=D.rewards.find(x=>x.id===d.v); if(rw) Object.assign(rw,{e,n,cost:c}); } else D.rewards.push({id:'r'+Date.now().toString(36), e, n, cost:c});
    save(); closeModal(); render(); toast('✅ 奖励已保存'); },
  rwdel(d){ parentGate(()=>{ const rw=D.rewards.find(x=>x.id===d.v); if(!rw) return; if(!confirm(`删除奖励「${rw.n}」吗？（兑换记录会保留）`)) { render(); return; } D.rewards=D.rewards.filter(x=>x.id!==d.v); save(); closeModal(); render(); toast('已删除'); }); },
  rddone(d){ parentGate(()=>{ const r=D.redeems.find(x=>x.id===d.v); if(r && r.status==='pending'){ r.status='done'; r.doneTs=Date.now(); save(); } render(); toast('✅ 已标记为已兑现'); }); },
  rdundo(d){ parentGate(()=>{ const r=D.redeems.find(x=>x.id===d.v); if(!r || r.status==='refunded'){ render(); return; } if(!confirm(`撤销这次兑换并退回 ${r.cost} 积分吗？`)){ render(); return; } r.status='refunded'; r.refundTs=Date.now(); D.spend=(D.spend||0)+r.cost; save(); render(); toast(`↩️ 已撤销，退回 ${r.cost} 积分`); }); },
  savesettings(){ D.settings.nickname = ($('#setName').value.trim()||'小数学家').slice(0,12); D.settings.goalNew = Math.max(0,Math.min(30,parseInt($('#setGoal').value)||0)); D.settings.goalReview = $('#setRev').checked; save(); render(); toast('✅ 设置已保存'); },
  export(){ const txt = JSON.stringify({app:'mathquest', version:1, exportedAt:new Date().toISOString(), data:D}, null, 2); download(`数学闯关岛备份-${today()}.json`, txt);
    modal(`<h2>⬇️ 导出备份</h2><div class="muted small">已尝试下载文件。如果手机上没有下载成功，可以复制下面的内容保存到备忘录。</div><textarea class="code" readonly style="margin-top:10px">${esc(txt)}</textarea><div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost grow" data-act="copybk">📋 复制</button><button class="btn grow" data-act="close">完成</button></div>`); S._bk=txt; },
  copybk(){ copyText(S._bk||''); },
  importbk(){ modal(`<h2>⬆️ 导入备份</h2><div class="small err">导入会覆盖当前设备上的全部学习记录。</div><textarea class="code" id="bkText" placeholder="粘贴备份 JSON" style="margin-top:10px"></textarea><div class="row" style="margin-top:8px"><label class="btn sm ghost" style="cursor:pointer">📂 选择备份文件<input type="file" id="bkFile" accept=".json,.txt,application/json" hidden></label></div><div id="bkMsg" class="small" class="small err" style="margin-top:8px"></div><div class="row" style="gap:10px;margin-top:12px"><button class="btn ghost grow" data-act="close">取消</button><button class="btn grow" data-act="dobk">导入</button></div>`);
    $('#bkFile').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ $('#bkText').value=r.result; }; r.readAsText(f,'utf-8'); }); },
  dobk(){ try{ const o = extractJSON($('#bkText').value); const data = o && o.app==='mathquest' ? o.data : o; if(!data || !Array.isArray(data.attempts) || !data.settings) throw new Error('不是有效的备份文件');
      if(!confirm('确定用备份覆盖当前数据吗？')) return; D = Object.assign(defData(), data); D.tierInit = data.tierInit; migrate(); save(); if(D.settings && D.settings.theme){ try{ localStorage.setItem(THEME_KEY, D.settings.theme); }catch(e){} applyTheme(D.settings.theme); } closeModal(); go('home'); toast('✅ 备份已恢复'); }
    catch(e){ $('#bkMsg').textContent='❌ '+e.message; } },
  reset(){ if(!confirm('确定清空所有学习数据吗？导入的题包、做题记录、徽章都会被删除。')) return; if(!confirm('真的确定吗？此操作无法撤销。')) return; localStorage.removeItem(KEY); load(); migrate(); S.session=null; go('home'); toast('已清空，重新出发吧！'); },
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
window.addEventListener('storage', e=>{ if(e.key===KEY){ load(); migrate(); render(); } });
window.__mqKatexReady = () => render();
const __migN = migrate();
render();
if(__migN) setTimeout(()=>toast(`🏅 已根据以往的学习记录点亮 ${__migN} 项成就，去「我的 → 成就」看看吧`), 700);
})();
