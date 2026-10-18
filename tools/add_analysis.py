# 把 tools/analysis_*.py 中写好的「审题分析」写入内置题包（可重复运行）
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from analysis_demo import DEMO
from analysis_g8a import G8A
from analysis_g8b import G8B
root = os.path.join(os.path.dirname(__file__), '..')
def apply(path, table):
    p = json.load(open(os.path.join(root, path), encoding='utf-8'))
    miss = []
    for q in p['questions']:
        a = table.get(q['id'])
        if a: q['analysis'] = a
        else: miss.append(q['id'])
    json.dump(p, open(os.path.join(root, path), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(path, 'questions', len(p['questions']), 'missing', miss)
apply('demo-pack.json', DEMO)
apply('packs/grade8-unit2.json', {**G8A, **G8B})
