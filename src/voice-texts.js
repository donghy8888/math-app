/* ========== 需要朗读的固定文本（App 与 tools/gen-audio.js 共用，保证录音能对上） ========== */
var MQVoiceTexts = (function(){
var REMIND = {
  start:['先拿出草稿纸和笔，我们一步一步来。','深呼吸，坐端正，准备好草稿纸，我们开始吧。','别着急，先把题目完整读一遍，再动笔。','草稿纸准备好了吗？边想边写，思路会更清楚。','静下心来，一步一步走，你一定可以的。'],
  calc:['在草稿纸上算一算再填。','这一步要计算，先在草稿纸上写下来哦。','慢慢算，每一步都写清楚，就不容易出错。','算完可以再验算一遍，更放心。','把算式列在草稿纸上，再填答案。'],
  wrong:['没关系，深呼吸一下，静下心再想想。','错了也没关系，看看提示，换个角度试试。','别着急，回到题目里找找关键条件。','放松一下肩膀，我们再来一次。','每个错误都在帮你变得更厉害，再试试看。'],
  idle:['不着急，把题目再读一遍，圈出关键条件。','卡住了也很正常，看看已知条件里有什么线索。','试着在草稿纸上画个图，或者列个式子。','想不出来的话，可以先回忆一下相关的公式。','停下来深呼吸，再从题目的第一句话开始读。'],
  overtime:['时间到了也没关系，慢慢来，把它做完最重要。','不用着急，弄懂比做得快更重要。','超时没关系，静下心，按自己的节奏来。','别有压力，一步一步做完就是胜利。','时间只是参考，我们稳稳地做完它。'],
  finish:['真棒！记得检查一下草稿纸上的计算。','完成啦！回头看看哪一步最关键。','做得好！把这道题的思路在心里复述一遍吧。','辛苦啦，休息一下眼睛，看看远处。','太好了！草稿纸上的过程也可以再检查一遍哦。']
};
var EXTRA = { ratePreview:'这是现在的语速。我们一步一步来，你一定可以的。', test:'你好，我会陪你一起做题。比如：$\\sqrt{3}$，$x^2$，$\\dfrac{3}{4}$，$|x|\\le 2$。' };
function answerText(st){
  if(st.type==='choice'){
    var opts = st.options||[], a = st.answer, i = -1;
    if(typeof a==='number') i = a; else { var s = String(a==null?'':a).trim(); if(/^[A-Ha-h]$/.test(s)) i = s.toUpperCase().charCodeAt(0)-65; else { i = opts.indexOf(s); if(i<0 && /^\d+$/.test(s)) i = +s; } }
    return (i>=0 && i<opts.length) ? String.fromCharCode(65+i)+'. '+opts[i] : String(a);
  }
  return String(st.answer);
}
/* 审题分析朗读文本（ak 已知+求 / aa 联想 / ap 思路 / aw 易错点）；同时兼容原始 JSON 与校验后的格式 */
var CN = ['一','二','三','四','五','六','七','八','九','十'];
function trimEnd(t){ return String(t==null?'':t).replace(/[。；;，,\s]+$/,''); }
function analysisText(a, kind){
  if(!a) return '';
  if(kind==='ak'){
    var ks = (a.known||[]).map(function(k){ var t = trimEnd(typeof k==='string' ? k : (k && k.text)); if(!t) return ''; if(k && k.hidden) t = '隐藏条件：'+t+(k.why ? '，因为'+trimEnd(k.why) : ''); return t; }).filter(Boolean);
    return (ks.length ? '已知：'+ks.join('；')+'。' : '') + (a.goal ? '要求的是：'+trimEnd(a.goal)+'。' : '');
  }
  if(kind==='aa') return (a.associations||[]).map(function(s){ return s ? '看到'+trimEnd(s.trigger)+'，想到'+trimEnd(s.recall)+(s.latex ? '：$'+s.latex+'$' : '')+'。'+(s.why ? trimEnd(s.why)+'。' : '') : ''; }).join('');
  if(kind==='ap'){ var p = (a.thinkingPath||[]).map(trimEnd).filter(Boolean); return p.length ? '解题思路：'+p.map(function(t,i){ return '第'+(CN[i]||(i+1))+'步，'+t+'。'; }).join('') : ''; }
  if(kind==='aw'){ var w = (a.pitfalls||[]).map(trimEnd).filter(Boolean); return w.length ? '易错点：'+w.join('；')+'。' : ''; }
  return '';
}
var ANALYSIS_KINDS = ['ak','aa','ap','aw'];
/* kind: prompt | hint | exp | orig | method | ak | aa | ap | aw */
function forQuestion(q, kind, idx){
  var st = q.steps && q.steps[idx];
  if(kind==='prompt') return st ? st.prompt : '';                         // 只读引导小问题，不读选项
  if(kind==='hint') return st ? '提示：'+st.hint : '';
  if(kind==='exp') return st ? '正确答案是：'+answerText(st)+'。'+(st.explanation ? '解析：'+st.explanation : '') : '';
  if(kind==='orig') return '原题：'+q.original;
  if(kind==='method') return q.method ? '解题思路：'+q.method : '';
  if(ANALYSIS_KINDS.indexOf(kind)>=0) return analysisText(q.analysis, kind);
  return '';
}
function allForPack(pack){
  var out = [];
  (pack.questions||[]).forEach(function(q){
    out.push(forQuestion(q,'orig'), forQuestion(q,'method'));
    if(q.analysis) ANALYSIS_KINDS.forEach(function(k){ out.push(forQuestion(q,k)); });
    (q.steps||[]).forEach(function(st,i){ out.push(forQuestion(q,'prompt',i), forQuestion(q,'hint',i), forQuestion(q,'exp',i)); });
  });
  return out.filter(Boolean);
}
/* 勋章 / 升级庆祝语（固定文本，已预录普通话） */
var CELEBRATE = {
  tier: ['恭喜你！获得了一枚铜牌勋章，继续加油！', '太厉害了！你的勋章升级到银牌啦！', '了不起！你拿到了金牌勋章！', '哇，钻石勋章！你真是太棒了！'],
  badge: '恭喜你获得新勋章！坚持下去，会越来越棒！',
  kp: '恭喜你获得专项勋章！这个知识点你已经掌握得很好了！',
  level: '恭喜升级！你的数学等级又提高了！',
  redeem: '兑换成功！快去找爸爸妈妈领取奖励吧！'
};
function fixed(){ var out = []; Object.keys(REMIND).forEach(function(k){ out = out.concat(REMIND[k]); }); out.push(EXTRA.ratePreview, EXTRA.test); out = out.concat(CELEBRATE.tier, [CELEBRATE.badge, CELEBRATE.kp, CELEBRATE.level, CELEBRATE.redeem]); return out; }
return { analysisText: analysisText, ANALYSIS_KINDS: ANALYSIS_KINDS, REMIND: REMIND, EXTRA: EXTRA, CELEBRATE: CELEBRATE, answerText: answerText, forQuestion: forQuestion, allForPack: allForPack, fixed: fixed };
})();
if(typeof module!=='undefined') module.exports = MQVoiceTexts;
