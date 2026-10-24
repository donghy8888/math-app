#!/bin/sh
# 把各部分拼成单文件 index.html
cd "$(dirname "$0")"
{
  cat src/head.html
  printf '<script type="application/json" id="demo-pack">\n'; cat demo-pack.json; printf '</script>\n'
  printf '<script type="application/json" id="builtin-pack-2">\n'; python3 -c "import json,sys;d=json.load(open('packs/grade8-unit2.json'));d.pop('childPerformance',None);d.pop('source',None);sys.stdout.write(json.dumps(d,ensure_ascii=False).replace('</','<\\\\/'))"; printf '\n</script>\n'
  printf '<script type="application/json" id="builtin-pack-3">\n'; python3 -c "import json,sys;d=json.load(open('packs/grade8-week7.json'));d.pop('childPerformance',None);d.pop('source',None);sys.stdout.write(json.dumps(d,ensure_ascii=False).replace('</','<\\\\/'))"; printf '\n</script>\n'
  printf '<script type="application/json" id="builtin-pack-4">\n'; python3 -c "import json,sys;d=json.load(open('packs/grade8-ex21-5-4.json'));d.pop('childPerformance',None);d.pop('source',None);sys.stdout.write(json.dumps(d,ensure_ascii=False).replace('</','<\\\\/'))"; printf '\n</script>\n'
  printf '<script type="application/json" id="builtin-pack-5">\n'; python3 -c "import json,sys;d=json.load(open('packs/grade8-week8.json'));d.pop('childPerformance',None);d.pop('source',None);sys.stdout.write(json.dumps(d,ensure_ascii=False).replace('</','<\\\\/'))"; printf '\n</script>\n'
  printf '<script type="text/plain" id="ai-prompt">\n'; cat src/ai-prompt.txt; printf '</script>\n'
  printf '<script type="application/json" id="audio-manifest">'; if [ -f audio/manifest.json ]; then python3 -c "import json;print(json.dumps(sorted(json.load(open('audio/manifest.json'))['clips'].keys())))"; else printf '[]'; fi; printf '</script>\n'
  printf '<script>\n'; cat src/speech.js; printf '</script>\n'
  printf "<script>\n"; cat src/sfxwav.js; printf "</script>\n"
  printf '<script>\n'; cat src/sfx.js; printf '</script>\n'
  printf '<script>\n'; cat src/voice-texts.js; printf '</script>\n'
  printf "<script>\n"; cat src/core-cards.js; printf "</script>\n"
  printf '<script>\n'; cat src/card-rank.js; printf '</script>\n'
  printf '<script>\n'; cat src/drill.js; printf '</script>\n'
  printf '<script>\n'; cat src/jump.js; printf '</script>\n'
  printf '<script>\n'; cat src/app.js; printf '</script>\n'
  printf '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous" onload="window.__mqKatexReady&&window.__mqKatexReady()"></script>\n'
  printf '</body>\n</html>\n'
} > index.html
