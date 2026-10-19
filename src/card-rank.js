/* 公式速记卡片排序：按“最近 14 天涉及频次”（越近权重越高），无练习记录时按最新试卷中的出现次数 */
var MQCardRank = (function(){
  const WINDOW = 14, MIN_W = 0.3;
  const W = { practice: 2, miss: 3, mark: 2.5, appear: 0.5, kpShare: 0.25 };
  const FALLBACK_MIN = 3;   // 14 天内练习/标记少于 3 次 → 视为“几乎没有练习记录”
  const dnum = s => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s||'')); return m ? Date.UTC(+m[1], +m[2]-1, +m[3]) / 864e5 : NaN; };
  const daysBetween = (from, to) => Math.round(dnum(to) - dnum(from));
  const pad = n => String(n).padStart(2,'0');
  const tsDay = ts => { const d = new Date(ts); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
  /* 衰减：今天 1.0，线性降到第 14 天 0.3，更早忽略 */
  function decay(days){ if(!isFinite(days)) return 0; if(days < 0) days = 0; if(days > WINDOW) return 0; return 1 - (1 - MIN_W) * days / WINDOW; }
  const fw = s => String(s||'').replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g,' ');
  function normLatex(s){
    return fw(s).replace(/\\(left|right|displaystyle|limits)\b/g,'').replace(/\\[dt]frac/g,'\\frac').replace(/\\[,;:! ]/g,'')
      .replace(/\\iff\b|⇔/g,'\\Leftrightarrow').replace(/\\neq\b|≠/g,'\\ne').replace(/\\geq\b|≥/g,'\\ge').replace(/\\leq\b|≤/g,'\\le').replace(/\\times\b|×/g,'\\times').replace(/[−–]/g,'-')
      .replace(/\s+/g,'').replace(/\{(\\?[A-Za-z0-9])\}/g,'$1').replace(/^\$+|\$+$/g,'');
  }
  const normText = s => fw(s).replace(/\$/g,'').replace(/[\s，。、：:,.；;！!？?“”"'（）()]/g,'').toLowerCase();
  function packDay(p){
    let best = /^\d{4}-\d{1,2}-\d{1,2}/.test(p.date||'') ? String(p.date).slice(0,10) : '';
    if(p.importedAt){ const d = tsDay(p.importedAt); if(!best || dnum(d) > dnum(best)) best = d; }
    return best;
  }
  /* opts: {packs, attempts, marks, review, today, analysisOf(p,q), isMiss(v)} */
  function build(opts){
    const packs = opts.packs || [], today = opts.today, isMiss = opts.isMiss || (v => v==='wrong' || v==='skip');
    const anOf = opts.analysisOf || ((p,q) => q.analysis || null);
    const qk = (p,q) => p.id + '::' + q.id;
    const qinfo = new Map();   // key → {pack, q, act:[{days,w}], appear:[{days,w}]}
    const pday = new Map();
    packs.forEach(p => { pday.set(p.id, packDay(p)); p.questions.forEach(q => qinfo.set(qk(p,q), {p, q, act:[], appear:[]})); });
    // 试卷初始结果 ❌/⭕：日期取复习队列中记录的标记日期，否则取题包日期；同时让题包的“最近标记日”变新
    Object.keys(opts.marks || {}).forEach(k => {
      const it = qinfo.get(k); if(!it) return;
      const r = (opts.review || {})[k]; const d = r && r.src === 'mark' && r.added ? r.added : pday.get(it.p.id);
      if(d && dnum(d) > dnum(pday.get(it.p.id) || '1970-01-01')) pday.set(it.p.id, d);
      if(isMiss(opts.marks[k])) it.act.push({days: daysBetween(d, today), w: W.mark, kind:'mark'});
    });
    (opts.attempts || []).forEach(a => { const it = qinfo.get(a.key); if(!it) return; it.act.push({days: daysBetween(a.date || tsDay(a.ts), today), w: (a.missed || a.overtime) ? W.miss : W.practice, kind:'practice'}); });
    qinfo.forEach(it => { const d = pday.get(it.p.id); if(d) it.appear.push({days: daysBetween(d, today), w: W.appear, kind:'appear'}); });
    // 最新试卷：题包日期（导入日 / 试卷日期 / 最近标记日）最大的那一天的所有题包
    let newestDay = ''; pday.forEach(d => { if(d && (!newestDay || dnum(d) > dnum(newestDay))) newestDay = d; });
    const newestIds = new Set(); pday.forEach((d,id) => { if(d && d === newestDay) newestIds.add(id); });
    let totalAct = 0; qinfo.forEach(it => it.act.forEach(e => { if(decay(e.days) > 0) totalAct++; }));
    let mode = totalAct < FALLBACK_MIN ? 'fallback' : 'recent', extraAct = 0;

    const fm = new Map(), am = new Map(), methods = []; let order = 0;
    const addVar = (c, latex, n) => { if(!latex) return; const k = normLatex(latex); const v = c.variants.find(x => x.k === k); if(v) v.n += n; else c.variants.push({k, latex, n}); };
    const touch = (c, it) => { const key = qk(it.p, it.q); if(!c.qs.includes(key)) c.qs.push(key); it.q.knowledgePoints.forEach(k => c.kps.add(k)); };
    qinfo.forEach(it => {
      const {p, q} = it;
      (q.formulas || []).forEach(f => {
        // 同一公式：规范化后的 LaTeX 相同，或名称相同，都合并成一张卡
        const lk = normLatex(f.latex), nk = normText(f.name); if(!lk && !nk) return;
        let c = (lk && fm.get('L:'+lk)) || (nk && fm.get('N:'+nk)), c2 = (nk && fm.get('N:'+nk));
        if(c && c2 && c2 !== c){ // 两张已有卡片被这条公式连起来 → 合并
          c2.qs.forEach(k => { if(!c.qs.includes(k)) c.qs.push(k); }); c2.kps.forEach(k => c.kps.add(k)); c2.variants.forEach(v => addVar(c, v.latex, v.n));
          fm.forEach((v,k) => { if(v === c2) fm.set(k, c); }); c.order = Math.min(c.order, c2.order);
        }
        if(!c){ c = {type:'f', key: lk ? 'L:'+lk : 'N:'+nk, name:f.name, latex:f.latex, tip:f.tip, kps:new Set(), qs:[], variants:[], order:order++}; }
        if(lk) fm.set('L:'+lk, c); if(nk) fm.set('N:'+nk, c);
        if(!c.tip && f.tip) c.tip = f.tip; addVar(c, f.latex, 1); touch(c, it);
      });
      const an = anOf(p, q);
      if(an && an.associations) an.associations.forEach(s => {
        if(!s.recall) return; const key = normText(s.recall); if(!key) return;
        let c = am.get(key); if(!c){ c = {type:'a', key, trigger:s.trigger, triggers:[], recall:s.recall, latex:s.latex, why:s.why, kps:new Set(), qs:[], order:order++}; am.set(key, c); }
        if(s.trigger && !c.triggers.includes(s.trigger)) c.triggers.push(s.trigger); if(!c.latex && s.latex) c.latex = s.latex; if(!c.why && s.why) c.why = s.why; touch(c, it);
      });
      if(q.method) methods.push({type:'m', key:qk(p,q), original:q.original, method:q.method, kps:new Set(q.knowledgePoints), qs:[qk(p,q)], order:order++});
    });
    const score = (c, kpShare) => {
      let s = 0, a7 = 0, a14 = 0, nw = 0;
      c.qs.forEach(k => { const it = qinfo.get(k);
        it.act.forEach(e => { const d = decay(e.days); if(d > 0){ s += e.w * d; a14++; if(e.days <= 7) a7++; } });
        it.appear.forEach(e => { s += e.w * decay(e.days); });
        if(newestIds.has(it.p.id)) nw++; });
      (c.extra || []).forEach(e => { const d = decay(e.days); if(d > 0){ s += e.w * d; a14++; if(e.days <= 7) a7++; } });
      if(kpShare){ // 思路卡：同知识点的其它题被练习，也算轻度涉及
        qinfo.forEach((it, k) => { if(c.qs.includes(k) || !it.q.knowledgePoints.some(x => c.kps.has(x))) return;
          it.act.forEach(e => { s += W.kpShare * e.w * decay(e.days); }); });
      }
      c.score = Math.round(s * 1000) / 1000; c.act7 = a7; c.act14 = a14; c.newest = nw; c.total = c.qs.length;
      c.badge = a7 ? '近7天 ×' + a7 : a14 ? '近14天 ×' + a14 : (nw ? '新试卷 ×' + nw : '');
      return c;
    };
    const fcards = [...new Set(fm.values())];
    fcards.forEach(c => { const vs = c.variants.slice().sort((x,y) => y.n - x.n); if(vs.length){ c.latex = vs[0].latex; } c.alt = vs.slice(1).map(v => v.latex); delete c.variants; });
    // 记忆练习答错：算作该公式卡的一次“做错的练习”
    (opts.drills || []).forEach(e => { if(e.ok) return; const c = (e.latex && fm.get('L:' + normLatex(e.latex))) || (e.name && fm.get('N:' + normText(e.name))); if(!c) return;
      const days = daysBetween(e.date, today); (c.extra = c.extra || []).push({days, w: W.miss, kind:'drill'}); if(decay(days) > 0) extraAct++; });
    if(extraAct && mode === 'fallback' && totalAct + extraAct >= FALLBACK_MIN) mode = 'recent';
    const f = fcards.map(c => score(c)), a = [...am.values()].map(c => score(c)), m = methods.map(c => score(c, true));
    return {f: rank(f, mode), a: rank(a, mode), m: rank(m, mode), mode, newestIds:[...newestIds], newestDay, totalAct: totalAct + extraAct};
  }
  function cmpFreq(mode){
    return mode === 'fallback'
      ? (x,y) => (y.newest - x.newest) || (y.score - x.score) || (y.total - x.total) || (x.order - y.order)
      : (x,y) => (y.score - x.score) || (y.newest - x.newest) || (y.total - x.total) || (x.order - y.order);
  }
  function rank(cards, mode){ return cards.slice().sort(cmpFreq(mode)); }
  return { build, rank, decay, normLatex, normText, packDay, daysBetween, W, WINDOW, FALLBACK_MIN };
})();
if(typeof module !== 'undefined') module.exports = MQCardRank;
