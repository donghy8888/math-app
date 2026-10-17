/* ========== 语音：数学转口语 + Web Speech 朗读引擎 ========== */
var MQSpeech = (function(){
'use strict';
var SYM_OP = {times:'乘',cdot:'乘',div:'除以',pm:'正负',mp:'负正',le:'小于等于',leq:'小于等于',leqslant:'小于等于',ge:'大于等于',geq:'大于等于',geqslant:'大于等于',
  ne:'不等于',neq:'不等于',lt:'小于',gt:'大于',approx:'约等于',equiv:'恒等于',Rightarrow:'，推出，',Longrightarrow:'，推出，',implies:'，推出，',Leftrightarrow:'，等价于，',
  therefore:'所以',because:'因为',in:'属于',notin:'不属于',parallel:'平行于',perp:'垂直于',sim:'相似于',cong:'全等于',to:'到',rightarrow:'到',colon:'比'};
var SYM_ATOM = {pi:'派',angle:'角',triangle:'三角形',circ:'度',degree:'度',cdots:'……',ldots:'……',dots:'……',infty:'无穷大',square:'方框',Box:'方框',
  Delta:'德尔塔',delta:'德尔塔',alpha:'阿尔法',beta:'贝塔',gamma:'伽马',theta:'西塔',lambda:'兰姆达',mu:'缪',odot:'圆',sin:'sin',cos:'cos',tan:'tan',
  prime:'撇',checkmark:'对',star:'星'};
var TEXT_CMDS = {text:1,mathrm:1,textbf:1,mathbf:1,operatorname:1,mbox:1,textrm:1,mathit:1,textit:1,boldsymbol:1};
var ACCENT = {dot:'',ddot:'',overline:'',bar:'',underline:'',hat:'',vec:'向量',overrightarrow:'向量',widehat:'弧',overset:''};
var COMPOUND = /加|减|乘|除以/;
function wrapC(x){ return COMPOUND.test(x) ? '括号'+x+'括号' : x; }
function A(s){ return {k:'a', s:s}; }
function O(s){ return {k:'o', s:s}; }
function join(items){ return items.map(function(x){ return x.s; }).join(''); }
function supWord(content){
  var c = String(content).trim();
  if(c==='2') return '的平方'; if(c==='3') return '的立方';
  if(c==='\\circ' || c==='°' || c==='o') return '度'; if(c==='\\prime' || c==="'") return '撇';
  return '的' + latex(c) + '次方';
}
function latex(src){
  src = String(src||'').replace(/\\left|\\right|\\big|\\Big|\\displaystyle/g,'').replace(/\\[dt]frac/g,'\\frac').replace(/\\(?:quad|qquad)/g,' ');
  var i = 0, n = src.length;
  function ws(){ while(i<n && /\s/.test(src[i])) i++; }
  function rawGroup(){ ws(); if(src[i]!=='{'){ var ch = src[i]||''; if(ch==='\\'){ var m=/^\\([a-zA-Z]+|.)/.exec(src.slice(i)); i+=m[0].length; return m[0]; } i++; return ch; }
    var d=0, s=i; for(; i<n; i++){ if(src[i]==='{') d++; else if(src[i]==='}'){ d--; if(d===0){ i++; return src.slice(s+1,i-1); } } } return src.slice(s+1); }
  function groupSpeech(){ return latex(rawGroup()); }
  function one(){ var tmp=[]; ws(); var guard=0; while(i<n && !tmp.some(function(x){return x.k==='a';}) && guard++<20) step(tmp, null); return join(tmp); }
  function cmd(name, out){
    if(name==='frac'){ var a=groupSpeech(), b=groupSpeech(); out.push(A(wrapC(b)+'分之'+wrapC(a))); return; }
    if(name==='sqrt'){ ws(); var k=''; if(src[i]==='['){ var e=src.indexOf(']',i); k=src.slice(i+1,e); i=e+1; }
      var r=groupSpeech(); out.push(A((k? (k.trim()==='3'?'三次':latex(k)+'次') : '')+(COMPOUND.test(r)?'根号下'+r+'，':'根号'+r))); return; }
    if(TEXT_CMDS[name]){ out.push(A(plain(rawGroup()))); return; }
    if(name in ACCENT){ out.push(A(ACCENT[name]+groupSpeech())); return; }
    if(name==='begin'){ rawGroup(); out.push(O('，')); return; }
    if(name==='end'){ rawGroup(); return; }
    if(name==='\\'){ out.push(O('；')); return; }
    if(name==='%'){ var p=out.pop(); out.push(A('百分之'+(p?p.s:''))); return; }
    if(name==='|'){ out.push(O('')); return; }
    if(SYM_OP[name]){ out.push(O(SYM_OP[name])); return; }
    if(SYM_ATOM[name]){ if(name==='circ'||name==='degree'){ var l=out.pop(); out.push(A((l?l.s:'')+'度')); } else out.push(A(SYM_ATOM[name])); return; }
    /* 其它未知命令（含 \, \; \! 等）静默忽略 */
  }
  function step(out, stop){
    var c = src[i];
    if(/\s/.test(c)){ i++; return; }
    if(c==='\\'){ var m=/^\\([a-zA-Z]+|.)/.exec(src.slice(i)); i+=m[0].length; cmd(m[1], out); return; }
    if(c==='{'){ i++; var r=seq('}'); i++; out.push(A(join(r))); return; }
    if(c==='}'){ i++; return; }
    if(c==='^'){ i++; ws(); var g; if(src[i]==='{') g=rawGroup(); else if(src[i]==='\\'){ var mm=/^\\([a-zA-Z]+|.)/.exec(src.slice(i)); i+=mm[0].length; g=mm[0]; } else { g=src[i]; i++; }
      var last=out.pop(); out.push(A((last?last.s:'')+supWord(g))); return; }
    if(c==='_'){ i++; var sub=latex(rawGroup()); var l2=out.pop(); out.push(A((l2?l2.s:'')+sub)); return; }
    if(c==='('||c==='['||c==='（'){ i++; var close=c==='('?')':c==='['?']':'）'; var inner=seq(close); i++;
      var simple = inner.length===1 && inner[0].k==='a' || (inner.length===2 && inner[0].s==='负' && inner[1].k==='a');
      out.push(A(simple ? join(inner) : '括号'+join(inner)+'括号')); return; }
    if(c==='|'){ i++; var ab=seq('|'); i++; out.push(A(join(ab)+'的绝对值')); return; }
    if(c==='/'){ i++; var nx=one(); var pv=out.pop(); out.push(A(nx+'分之'+(pv?pv.s:''))); return; }
    if(/[0-9.]/.test(c)){ var mn=/^[0-9]+(?:\.[0-9]*)?|^\.[0-9]*/.exec(src.slice(i)); i+=mn[0].length; out.push(A(mn[0])); return; }
    if(c==='+'){ i++; out.push(O('加')); return; }
    if(c==='-'||c==='−'||c==='－'){ i++; var lt=out[out.length-1]; out.push(O(!lt||lt.k==='o' ? '负' : '减')); return; }
    if(c==='='){ i++; out.push(O('等于')); return; }
    if(c==='<'){ i++; out.push(O('小于')); return; }
    if(c==='>'){ i++; out.push(O('大于')); return; }
    if(c===','||c==='，'){ i++; out.push(O('，')); return; }
    if(c===';'||c==='；'){ i++; out.push(O('；')); return; }
    if(c===':'){ i++; out.push(O('比')); return; }
    if(c==='&'){ i++; out.push(O(' ')); return; }
    if(c==='%'){ i++; var pp=out.pop(); out.push(A('百分之'+(pp?pp.s:''))); return; }
    if(c==='!'){ i++; return; }
    if(c==='*'){ i++; out.push(O('乘')); return; }
    if(c==="'"){ i++; var lp=out.pop(); out.push(A((lp?lp.s:'')+'撇')); return; }
    var u = UNI[c]; if(u){ i++; u(out); return; }
    if(stop && c===stop){ return; }
    if(c===')'||c===']'||c==='）'){ i++; return; }
    if(/[a-zA-Z]/.test(c)){ var ml=/^[a-zA-Z]+/.exec(src.slice(i)); i+=ml[0].length; out.push(A(ml[0])); return; }
    var mo=/^[^\\{}^_()[\]|/0-9.+\-−=<>,，;；:&%!*'a-zA-Z\s√²³≤≥≠±×÷·π∠△°]+/.exec(src.slice(i));
    if(mo){ i+=mo[0].length; out.push(A(mo[0])); } else { i++; }
  }
  var UNI = {
    '√': function(out){ var r=one(); out.push(A('根号'+r)); },
    '²': function(out){ var l=out.pop(); out.push(A((l?l.s:'')+'的平方')); },
    '³': function(out){ var l=out.pop(); out.push(A((l?l.s:'')+'的立方')); },
    '°': function(out){ var l=out.pop(); out.push(A((l?l.s:'')+'度')); },
    '≤': function(out){ out.push(O('小于等于')); }, '≥': function(out){ out.push(O('大于等于')); }, '≠': function(out){ out.push(O('不等于')); },
    '±': function(out){ out.push(O('正负')); }, '×': function(out){ out.push(O('乘')); }, '÷': function(out){ out.push(O('除以')); }, '·': function(out){ out.push(O('乘')); },
    'π': function(out){ out.push(A('派')); }, '∠': function(out){ out.push(A('角')); }, '△': function(out){ out.push(A('三角形')); }
  };
  function seq(stop){ var out=[]; while(i<n){ if(stop && src[i]===stop) break; step(out, stop); } return out; }
  return join(seq(null));
}
function plain(t){
  var s = String(t||'');
  s = s.replace(/\*\*([^*]+)\*\*/g,'$1');
  s = s.replace(/[（(][\s\u3000]*[）)]/g,'（空）').replace(/_{2,}|＿{2,}/g,'（横线）');
  s = s.replace(/[−－]/g,'-');
  s = s.replace(/√\s*(\d+(?:\.\d+)?|[a-zA-Z]|\([^)]*\)|（[^）]*）)/g, function(m,a){ return '根号'+a.replace(/^[（(]|[）)]$/g,''); });
  s = s.replace(/\|([^|\n]{1,16})\|/g,'$1的绝对值');
  s = s.replace(/(^|[^0-9.])(-?)(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?![0-9])/g, function(m,p,neg,a,b){ return p+(neg?'负':'')+b+'分之'+a; });
  s = s.replace(/([0-9a-zA-Z)）])\s*(\^\s*2|²)/g,'$1的平方').replace(/([0-9a-zA-Z)）])\s*(\^\s*3|³)/g,'$1的立方').replace(/\^\s*\{?(-?\w+)\}?/g,'的$1次方');
  s = s.replace(/(^|[\s（(，,：:=、])-(?=\s*[0-9a-zA-Z(（])/g,'$1负');
  s = s.replace(/([0-9a-zA-Z)）方])\s*-\s*(?=[0-9a-zA-Z(（根])/g,'$1减').replace(/([0-9a-zA-Z)）方])\s*\+\s*(?=[0-9a-zA-Z(（根])/g,'$1加');
  s = s.replace(/≤/g,'小于等于').replace(/≥/g,'大于等于').replace(/≠/g,'不等于').replace(/±/g,'正负').replace(/×/g,'乘').replace(/÷/g,'除以').replace(/·/g,'乘')
       .replace(/π/g,'派').replace(/∠/g,'角').replace(/△/g,'三角形').replace(/°/g,'度').replace(/\s*[→⇒]\s*/g,'，').replace(/∵/g,'因为').replace(/∴/g,'所以')
       .replace(/\s*=\s*/g,'等于').replace(/\s*<\s*/g,'小于').replace(/\s*>\s*/g,'大于').replace(/\*/g,'乘');
  return s;
}
function toSpeech(str){
  var parts = String(str==null?'':str).split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  var out = parts.map(function(p){
    if(/^\$\$[\s\S]+\$\$$/.test(p)) return latex(p.slice(2,-2));
    if(/^\$[^$]+\$$/.test(p)) return latex(p.slice(1,-1));
    return plain(p);
  }).join('');
  out = out.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu,'').replace(/[\\{}$^_]/g,'').replace(/[ \t]+/g,' ').replace(/\n+/g,'。').replace(/([，；。])\s*[，；]+/g,'$1').replace(/^[，；\s]+/,'').trim();
  return out;
}

/* ---------- 文本哈希（与 tools/gen-audio.js 一致，用于查找预录音频） ---------- */
function hash(text){
  var h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995, t = String(text);
  for(var k=0;k<t.length;k++){ var c = t.charCodeAt(k); h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0; h2 ^= c; h2 = Math.imul(h2, 0x5bd1e995) >>> 0; h2 = (h2 ^ (h2 >>> 13)) >>> 0; }
  return ('0000000'+h1.toString(16)).slice(-8) + ('0000000'+h2.toString(16)).slice(-8).slice(0,4);
}

/* ---------- 朗读引擎：优先播放内置普通话录音，其次系统普通话语音 ---------- */
var hasWin = typeof window!=='undefined';
var synth = (hasWin && window.speechSynthesis && typeof window.SpeechSynthesisUtterance!=='undefined') ? window.speechSynthesis : null;
var audioOK = hasWin && typeof window.Audio!=='undefined';
var voice = null, token = 0, pending = 0, listeners = [], lastText = '', voicesReady = false, voiceWaiters = [];
var clips = {}, audioBase = 'audio/', audioEl = null, noticeCb = null;
var NON_MANDARIN = /粤|粵|廣東|广东|cantonese|yue|台灣|台湾|臺灣|taiwan|香港|hong\s?kong|\bhk\b|\btw\b|sin-?ji|mei-?jia|tracy|danny|hiugaai|hiumaan|wanlung|hsiaochen|hsiaoyu|yating|zhiwei|yunjhe/i;
var PREFERRED = /tingting|ting-ting|婷婷|xiaoxiao|晓晓|yunxi|云希|google\s*普通话|huihui|慧慧|kangkang|康康|yaoyao|瑶瑶|li-?mu|yu-?shu|yunyang|xiaoyi/i;
function isMandarinCN(v){
  var lang = String(v.lang||'').replace(/_/g,'-').toLowerCase();
  if(['zh-cn','cmn-cn','zh-hans-cn','cmn-hans-cn','cmn-hans'].indexOf(lang)<0) return false;
  return !NON_MANDARIN.test(String(v.name||'')) && !/yue|zh-hk|zh-tw/i.test(String(v.voiceURI||''));
}
function scoreVoice(v){
  if(!isMandarinCN(v)) return -1; /* 只接受中国大陆普通话（zh-CN），排除粤语、台湾/香港口音 */
  var name = String(v.name||''), s = 100;
  if(PREFERRED.test(name)) s += 20;
  if(/natural|online|neural|enhanced|premium|高音质/i.test(name)) s += 10;
  if(/普通话|mandarin|china|中国/i.test(name)) s += 6;
  if(v.localService) s += 2;
  return s;
}
function allVoices(){ if(!synth) return []; try{ return synth.getVoices() || []; }catch(e){ return []; } }
function pickVoice(){
  var vs = allVoices(); if(vs.length) voicesReady = true;
  var best = null, bs = -1; vs.forEach(function(v){ var sc = scoreVoice(v); if(sc>bs){ bs = sc; best = v; } });
  voice = bs>=0 ? best : null;
  if(voicesReady){ var w = voiceWaiters; voiceWaiters = []; w.forEach(function(f){ f(); }); }
  return voice;
}
/* 声音列表常常是异步加载的：首次 getVoices() 为空，voiceschanged 稍后才触发 */
function whenVoices(timeout){
  return new Promise(function(res){
    if(!synth){ res(); return; } pickVoice(); if(voicesReady){ res(); return; }
    var done = false; var fin = function(){ if(done) return; done = true; pickVoice(); res(); };
    voiceWaiters.push(fin); setTimeout(fin, timeout || 1500);
  });
}
if(synth){ pickVoice(); try{ synth.addEventListener ? synth.addEventListener('voiceschanged', pickVoice) : (synth.onvoiceschanged = pickVoice); }catch(e){} }
function notify(){ listeners.forEach(function(f){ try{ f(pending>0); }catch(e){} }); }
function chunks(text){
  var out = []; String(text).split(/(?<=[。！？；!?;])/).forEach(function(seg){
    seg = seg.trim(); if(!seg || !/[\p{L}\p{N}]/u.test(seg)) return;
    while(seg.length>110){ var cut = seg.lastIndexOf('，',110); if(cut<30) cut = 110; out.push(seg.slice(0,cut+1)); seg = seg.slice(cut+1); }
    if(seg) out.push(seg);
  }); return out;
}
var SILENCE = 'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/84TAAAAAAAAAAAAASW5mbwAAAA8AAAAJAAADSABQUFBQUFBQUFBQUGZmZmZmZmZmZmZmfHx8fHx8fHx8fHySkpKSkpKSkpKSkqioqKioqKioqKiovr6+vr6+vr6+vr7U1NTU1NTU1NTU1Orq6urq6urq6urq//////////////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAPwAAAAAAAAA0hZokIuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/8zTEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/8zTEOwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/8zTEdgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/8zTEsQAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/8zTExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVX/8zTExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8zTExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8zTExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8zTExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
var unlocked = false;
function getAudio(){ if(!audioEl && audioOK){ audioEl = new Audio(); audioEl.preload = 'auto'; audioEl.setAttribute('playsinline',''); audioEl.setAttribute('webkit-playsinline',''); } return audioEl; }
/* iPad/iPhone Safari：必须在用户手势里对“同一个” audio 元素调用一次 play()，之后换 src 再播放才不会被拦截。
   首次点击时（捕获阶段，早于业务处理）播放一段 0.15 秒静音；之后所有录音都复用这个已解锁的元素。 */
function unlock(){
  if(unlocked || !audioOK) return; unlocked = true;
  var a = getAudio(); if(pending>0) return; /* 已经在播放真实录音（同一次点击里），无需再解锁 */
  try{ a.muted = false; a.src = SILENCE; var pr = a.play(); if(pr && pr.catch) pr.catch(function(err){ if(!err || err.name!=='AbortError') unlocked = false; }); }catch(e){ unlocked = false; }
}
function clipUrl(spoken){ var h = hash(spoken); return clips[h] ? audioBase + h + '.mp3' : null; }
function stop(){
  token++; pending = 0; lastText = '';
  if(synth){ try{ synth.cancel(); }catch(e){} }
  if(audioEl){ try{ audioEl.onended = audioEl.onerror = null; if(String(audioEl.src).slice(0,5)!=='data:') audioEl.pause(); }catch(e){} } /* 不打断正在进行的静音解锁 */
  notify();
}
/* opts: rate(TTS 语速), playbackRate(录音倍速), voiceName(用户指定的系统声音；为空=内置普通话) */
function speak(texts, opts){
  opts = opts || {};
  var list = [].concat(texts).filter(Boolean).map(function(t){ return opts.raw ? String(t) : toSpeech(t); }).filter(function(t){ return t && t.trim(); });
  if(!list.length) return false;
  var joined = list.join('|');
  if(joined===lastText && pending>0) return true; /* 同一段话正在播放时不重复排队 */
  var userVoice = null;
  if(opts.voiceName){ allVoices().forEach(function(v){ if(v.name===opts.voiceName) userVoice = v; }); }
  var useClips = !opts.voiceName && audioOK;
  var items = list.map(function(t){ return {text:t, url: useClips ? clipUrl(t) : null}; });
  var ttsVoice = userVoice || (pickVoice(), voice);
  /* 没有录音、也没有普通话系统语音时宁可不读，避免设备默认的粤语/台湾腔 */
  items = items.filter(function(it){ if(it.url) return true; if(!synth) return false; if(ttsVoice) return true; if(noticeCb) noticeCb('nomandarin'); return false; });
  if(!items.length){ return false; }
  var busy = pending>0 || (synth && (synth.speaking || synth.pending));
  stop(); var my = token; lastText = joined; pending = items.length; notify();
  var next = function(i){
    if(my!==token) return;
    if(i>=items.length){ pending = 0; lastText = ''; notify(); return; }
    pending = items.length - i;
    var it = items[i], advanced = false;
    var go = function(){ if(advanced || my!==token) return; advanced = true; next(i+1); };
    if(it.url){
      var a = getAudio();
      var fallback = function(){ if(advanced || my!==token) return; try{ a.pause(); }catch(e){} if(synth && ttsVoice){ advanced = true; tts(it.text, function(){ next(i+1); }); } else go(); };
      a.onended = go; a.onerror = fallback;
      try{ a.src = it.url; a.playbackRate = opts.playbackRate || 1; a.defaultPlaybackRate = opts.playbackRate || 1;
        var pr = a.play(); if(pr && pr.catch) pr.catch(function(err){ if(err && err.name==='AbortError') return; fallback(); }); }catch(e){ fallback(); }
      setTimeout(function(){ if(!advanced && my===token && a.paused && !a.currentTime) fallback(); }, 7000); /* 加载失败的保险 */
      setTimeout(go, 90000);
    } else {
      advanced = true; tts(it.text, function(){ next(i+1); });
    }
  };
  function tts(text, cb){
    var parts = chunks(text), left = parts.length; if(!left){ cb(); return; }
    var run = function(){
      if(my!==token) return;
      parts.forEach(function(p){
        var u = new SpeechSynthesisUtterance(p);
        u.lang = 'zh-CN'; if(ttsVoice) u.voice = ttsVoice;   /* 始终普通话 */
        u.rate = opts.rate || 0.9; u.pitch = 1; u.volume = 1;
        var fired = false;
        var done = function(){ if(fired || my!==token) return; fired = true; left--; if(!left) cb(); };
        u.onend = done; u.onerror = done;
        setTimeout(done, 6000 + p.length*450/(opts.rate||0.9)); /* 看门狗只推进状态，绝不重新朗读 */
        try{ synth.speak(u); }catch(e){ done(); }
      });
      /* 不调用 resume()：在 iOS Safari / 安卓 Chrome 上它可能让已取消的语句重新播放 */
    };
    /* 安卓 Chrome 在 cancel() 后立即 speak() 偶尔会重放被取消的语句，因此刚才在播放时稍等再说 */
    if(busy){ busy = false; setTimeout(run, 150); } else run();
  }
  next(0);
  return true;
}
function addClips(list){ (list||[]).forEach(function(h){ clips[h] = 1; }); }
return { toSpeech: toSpeech, latex: latex, plain: plain, hash: hash, supported: !!synth || audioOK, ttsSupported: !!synth, audioSupported: audioOK,
  speak: speak, stop: stop, unlock: unlock, isUnlocked: function(){ return unlocked; }, whenVoices: whenVoices, addClips: addClips, hasClip: function(t){ return !!clipUrl(toSpeech(t)); }, clipCount: function(){ return Object.keys(clips).length; },
  setAudioBase: function(b){ audioBase = b; }, onNotice: function(f){ noticeCb = f; },
  hasMandarin: function(){ pickVoice(); return !!voice; }, voicesLoaded: function(){ return voicesReady; },
  voices: function(){ return allVoices().map(function(v){ return {name:v.name, lang:v.lang, mandarin:isMandarinCN(v)}; }); },
  isSpeaking: function(){ return pending>0; }, onChange: function(f){ listeners.push(f); }, voiceName: function(){ pickVoice(); return voice ? voice.name+' ('+voice.lang+')' : ''; }, pickVoice: pickVoice };
})();
if(typeof module!=='undefined') module.exports = MQSpeech;
