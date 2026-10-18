# 题包（Question Pack）JSON 格式说明

「数学闯关岛」通过导入 **题包 JSON** 来添加新题目。典型流程：

1. 家长给试卷拍照；
2. 把照片和下方的 **AI 提示词** 一起发给 AI 助手；
3. AI 返回 JSON 后，在 App 中点 **📥 导入题包**，粘贴文本或选择 `.json` 文件即可。

App 能自动去掉 AI 回复里外层的 ```` ```json ```` 代码块，也能截取第一个 `{` 到最后一个 `}` 之间的内容。

## 顶层结构

可以导入以下任意一种：

- 单个题包对象 `{ title, date, questions }`
- 题包数组 `[ {...}, {...} ]`
- `{ "packs": [ ... ] }`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 否 | 题包唯一 ID。省略时根据 title+date+题目自动生成。再次导入**相同 id** 会覆盖（更新）原题包。 |
| `title` | string | 建议 | 题包名称，例如“七年级上 期中测试” |
| `date` | string | 建议 | `YYYY-MM-DD` |
| `questions` | Question[] | **是** | 至少 1 道题 |

### 其它字段

题包里未在本文档列出的字段（例如 `source`、`childPerformance`）在导入时会被**忽略并丢弃**，不会写入本地存储，也不会用来生成任何做题记录或“初始对错”标记。孩子试卷上的原始对错请在 App 里由家长手动标记（题包页 →「📝 批量标记」）。

如果导入的题包 `id` 与内置题包相同（例如 `grade8-unit2-2026-10-17`），会作为该内置题包的**更新版本**覆盖显示，做题记录与标记保持不变；在题包页可「恢复为内置版本」。

## Question（题目）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 建议 | 题包内唯一，例如 `"q1"`。做题记录用 `题包id::题目id` 关联，**更新题包时请保持 id 不变**。 |
| `original` | string | **是** | 完整原题。数学式子写在 `$...$` 中（LaTeX），`$$...$$` 为独立公式行 |
| `knowledgePoints` | string[] | 建议 | 知识点，如 `["一元一次方程"]`，用于薄弱项统计和公式筛选。省略时为 `["综合"]` |
| `difficulty` | 1-5 | 建议 | 难度；≥4 的题无失误完成可得「攻克难题」徽章。默认 2 |
| `timeLimitSec` | number | 建议 | 限时（秒）。超过显示“超时”但可以继续做。默认 180 |
| `steps` | Step[] | **是** | 引导步骤，建议 2-4 步 |
| `finalAnswer` | string | 建议 | 最终答案（可含 LaTeX） |
| `formulas` | Formula[] | 否 | 用到的公式，会出现在「公式速记」卡片中 |
| `method` | string | 建议 | 解题思路总结，会生成「思路卡」 |
| `analysis` | Analysis | 否（推荐） | 审题分析：已知/隐藏条件/联想/思路/易错点，做题前以「🔍 审题分析」展示。没有此字段的题包照常可用 |

## Step（引导步骤）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `prompt` | string | **是** | 小问题，可含 LaTeX |
| `type` | `"choice"` \| `"number"` \| `"text"` | 建议 | 省略时：有 options 视为 choice，否则 text |
| `options` | string[] | choice 必填 | 选项文字（可含 LaTeX），显示为 A/B/C/D |
| `answer` | string \| number | **是** | choice：`"A"`/`"B"`…、0 起始的下标、或选项原文；number：如 `"7"`、`"-1/2"`、`"4.8"`；text：如 `"4x+5"` |
| `acceptable` | string[] | 否 | 其它可接受的答案写法 |
| `hint` | string | 建议 | 第 1 次答错时显示 |
| `explanation` | string | 建议 | 答对后或 2 次答错后显示 |

### 答案判定规则（容错）

- 自动去除首尾和中间空格，全角字符转半角（`３／４` → `3/4`），`−`/`–` 视为减号，`×`、`·` 视为乘号，`²`/`³` 视为 `^2`/`^3`；
- **number**：按数值比较，`3/4`、`0.75`、`75%` 互相等价；`x=7` 会去掉前面的 `x=`；末尾常见单位（cm、米、度…）会被忽略；支持 `√2`、`2√3`；若标准答案是无限小数（如 `1/3`），输入保留 ≥2 位且四舍五入正确的小数也算对（`0.33`）；
- **text**：规范化后比较字符串（忽略空格、大小写、`$`、`4*x` 与 `4x` 视为相同、`y=` 前缀可省略），两边都能解析成数字时也按数值比较。交换律等其它等价形式请写进 `acceptable`；
- **choice**：比较选项下标。

## Analysis（审题分析，可选）

教孩子“怎么想”：先看清已知（特别是**隐藏条件**），想到该用的定理/公式，再形成解题思路。

| 字段 | 类型 | 说明 |
|---|---|---|
| `known` | (string \| Known)[] | 已知条件，逐个揭示。字符串 = 普通已知 |
| `goal` | string | 要求什么（显示为「🎯 求：…」，也会固定在原题下方） |
| `associations` | Association[] | “看到 → 想到”。**第一条**用于「看到这个，你会想到什么？」小测（干扰项自动取自题包里其它联想/公式名称）；全部联想还会成为「公式速记 → 🔗 联想卡」 |
| `thinkingPath` | string[] | 有序的解题思路，编号显示 |
| `pitfalls` | string[] | 易错点，显示在提醒框中 |

Known：`{"text": "条件", "hidden": true, "why": "为什么是隐藏条件"}`，`hidden: true` 会带「🕵️ 隐藏条件」标签。

Association：`{"trigger": "题目特征", "recall": "定理/公式/方法", "latex": "可选，不加 $", "why": "为什么想到、有什么用"}`。

所有字符串都可含 `$...$` LaTeX。字段缺失或格式不对时会被忽略，不影响导入。

- 设置「做题前显示审题分析」（默认开启）；审题阶段不计时，可点「直接做题」跳过，做题时随时点原题旁「🔍 审题」重新打开；
- 小测答对 +2 积分（同样受“当天重做 0 分 / 之后 30%”规则约束）；
- 分析内容的录音只在点 🔊 时播放，不会自动朗读；
- 维护脚本：`tools/analysis_*.py` 存放内置题包的分析内容，`python3 tools/add_analysis.py` 把它写回 `demo-pack.json` 和 `packs/grade8-unit2.json`。

## Formula（公式）

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 公式名称 |
| `latex` | string | LaTeX 公式，**不要**加 `$` |
| `tip` | string | 记忆要点（可含 `$...$`） |

> 注意：JSON 字符串中的反斜杠必须写两次，例如 `"\\frac{1}{2}"`、`"90^\\circ"`。

## 完整示例

```json
{
  "title": "示例题包 · 初一初二综合练习",
  "date": "2026-10-17",
  "questions": [
    {
      "id": "d3",
      "original": "在 $\\mathrm{Rt}\\triangle ABC$ 中，$\\angle C=90^\\circ$，两条直角边 $AC=6$，$BC=8$。求斜边 $AB$ 上的高 $CD$ 的长。",
      "knowledgePoints": [
        "勾股定理",
        "三角形面积"
      ],
      "difficulty": 3,
      "timeLimitSec": 180,
      "steps": [
        {
          "prompt": "先用勾股定理求斜边：$AB=$ ？",
          "type": "number",
          "answer": "10",
          "hint": "$AB^2=AC^2+BC^2=36+64$。",
          "explanation": "$AB=\\sqrt{6^2+8^2}=\\sqrt{100}=10$。（$6,8,10$ 是常见勾股数）"
        },
        {
          "prompt": "用两条直角边求 $\\triangle ABC$ 的面积：$S=$ ？",
          "type": "number",
          "answer": "24",
          "hint": "直角三角形面积 = 两直角边乘积的一半。",
          "explanation": "$S=\\dfrac12\\times6\\times8=24$。"
        },
        {
          "prompt": "同一个三角形的面积也等于 $\\dfrac12\\times AB\\times CD$。所以 $CD=$ ？（可填小数或分数）",
          "type": "number",
          "answer": "4.8",
          "acceptable": [
            "24/5"
          ],
          "hint": "$\\dfrac12\\times10\\times CD=24$，解这个方程。",
          "explanation": "$CD=\\dfrac{2S}{AB}=\\dfrac{48}{10}=4.8$。这就是“等面积法”。"
        }
      ],
      "finalAnswer": "$CD=4.8$",
      "formulas": [
        {
          "name": "勾股定理",
          "latex": "a^2+b^2=c^2",
          "tip": "只适用于直角三角形，$c$ 是斜边。"
        },
        {
          "name": "直角三角形斜边上的高",
          "latex": "h=\\dfrac{ab}{c}",
          "tip": "等面积法：两直角边之积 = 斜边 × 斜边上的高。"
        }
      ],
      "method": "先用勾股定理求斜边，再用“等面积法”：同一个三角形用两种底和高表示面积，列等式求高。"
    },
    {
      "id": "d5",
      "original": "先化简，再求值：$(x+2)^2-(x+1)(x-1)$，其中 $x=-\\dfrac{1}{2}$。",
      "knowledgePoints": [
        "整式乘法",
        "乘法公式"
      ],
      "difficulty": 3,
      "timeLimitSec": 200,
      "steps": [
        {
          "prompt": "用完全平方公式展开：$(x+2)^2=$ ？",
          "type": "choice",
          "options": [
            "$x^2+4x+4$",
            "$x^2+4$",
            "$x^2+2x+4$",
            "$x^2+4x+2$"
          ],
          "answer": "A",
          "hint": "$(a+b)^2=a^2+2ab+b^2$，中间项是 $2\\cdot x\\cdot 2$。",
          "explanation": "$(x+2)^2=x^2+2\\cdot x\\cdot2+2^2=x^2+4x+4$。千万别漏掉中间项！"
        },
        {
          "prompt": "用平方差公式：$(x+1)(x-1)=$ ？（例如输入 x^2-1 或 x²-1）",
          "type": "text",
          "answer": "x^2-1",
          "acceptable": [
            "-1+x^2"
          ],
          "hint": "$(a+b)(a-b)=a^2-b^2$。",
          "explanation": "$(x+1)(x-1)=x^2-1^2=x^2-1$。"
        },
        {
          "prompt": "相减并化简：$(x^2+4x+4)-(x^2-1)=$ ？",
          "type": "text",
          "answer": "4x+5",
          "acceptable": [
            "5+4x"
          ],
          "hint": "去括号时，减号后面的括号里每一项都要变号：$-(x^2-1)=-x^2+1$。",
          "explanation": "$x^2+4x+4-x^2+1=4x+5$。"
        },
        {
          "prompt": "代入 $x=-\\dfrac12$，求值：$4x+5=$ ？",
          "type": "number",
          "answer": "3",
          "hint": "$4\\times\\left(-\\dfrac12\\right)=-2$。",
          "explanation": "$4\\times\\left(-\\dfrac12\\right)+5=-2+5=3$。"
        }
      ],
      "finalAnswer": "化简得 $4x+5$，当 $x=-\\dfrac12$ 时，原式 $=3$",
      "formulas": [
        {
          "name": "完全平方公式",
          "latex": "(a\\pm b)^2=a^2\\pm2ab+b^2",
          "tip": "口诀：首平方，尾平方，二倍乘积放中央。"
        },
        {
          "name": "平方差公式",
          "latex": "(a+b)(a-b)=a^2-b^2",
          "tip": "两数和乘两数差，等于它们的平方差。"
        }
      ],
      "method": "“先化简再求值”一定要先化简到最简形式再代入，计算量最小。展开时注意减号后面的括号要整体变号。"
    }
  ]
}
```

（App 内置的完整 5 题示例题包见 `demo-pack.json`。）

## 给 AI 助手的提示词（App 中也可一键复制）

```
请你扮演初中数学老师。我会发给你一张试卷照片，请识别其中的数学题，并为每道题设计“分步引导”，然后只输出一个 JSON（不要输出其他文字），格式如下：
{
  "title": "试卷名称",
  "date": "YYYY-MM-DD",
  "questions": [
    {
      "id": "q1",
      "original": "完整原题，数学式子用 $...$ 包裹的 LaTeX，例如 $3(x-2)=2x+1$",
      "knowledgePoints": ["知识点，如 一元一次方程"],
      "difficulty": 1到5的整数,
      "timeLimitSec": 建议用时秒数,
      "steps": [
        {
          "prompt": "一个小的引导问题",
          "type": "choice 或 number 或 text",
          "options": ["仅 choice 需要，选项文字"],
          "answer": "正确答案（choice 填 A/B/C/D；number 填数字或分数如 -1/2；text 填简短式子如 4x+5）",
          "acceptable": ["其它可接受的写法，可省略"],
          "hint": "答错时给的温和提示，不直接说答案",
          "explanation": "这一步的详细解析"
        }
      ],
      "finalAnswer": "最终答案",
      "formulas": [{"name": "公式名称", "latex": "LaTeX 公式（不加 $）", "tip": "记忆要点"}],
      "method": "解题思路总结",
      "analysis": {
        "known": ["题目直接给出的条件（可含 $...$）", {"text": "题目没明说但必须用到的条件", "hidden": true, "why": "为什么藏着这个条件"}],
        "goal": "要求什么",
        "associations": [{"trigger": "题目里的关键词/特征", "recall": "应该联想到的定理/公式/方法", "latex": "可选，LaTeX 公式（不加 $）", "why": "为什么会想到它、它有什么用"}],
        "thinkingPath": ["第一步怎么想", "第二步怎么想", "……直到得出答案并检验"],
        "pitfalls": ["容易犯的错误"]
      }
    }
  ]
}
要求：
1. 每道题拆成 2~4 个步骤，每步只考一个小点，答案尽量是一个数字、一个选项或很短的式子；
2. 优先用 number 或 choice 类型，text 类型请在 acceptable 里列出常见等价写法；
3. JSON 字符串里的反斜杠要写成两个，例如 "\\frac{1}{2}"；
4. 看不清的题请在 original 里注明“（看不清，已按推测补全）”；
5. analysis 用来教孩子“怎么想”：known 逐条列出已知，**隐藏条件（如二次项系数≠0、被开方数≥0、分母≠0、绝对值/平方非负、根要检验等）必须单独写成 {"hidden": true} 并说明 why**；associations 写“看到什么→想到什么”，第一条要是最关键的联想；thinkingPath 3~5 条，按顺序说清“先想什么、再想什么”；pitfalls 写最常见的失分点。若题目数据本身有问题（如代入后分母为 0），也写进 pitfalls。
```

## 学习进度备份格式（供参考）

「我的 → 设置 → 导出备份」得到 `{ "app": "mathquest", "version": 1, "exportedAt": "...", "data": { settings, packs, attempts, review, checkins, points, badges, daily } }`。它和题包是两种不同的文件，请在「导入备份」里导入。

---

## 内置普通话录音（`audio/`）

为了让任何设备（包括系统默认是粤语声音的 iPad / 安卓）都读**普通话**，内置题目的朗读使用预先录好的 MP3，而不是系统语音。

- 声音：微软 `zh-CN-XiaoxiaoNeural`（普通话），语速 -10%，单声道 24 kHz / 24 kbps MP3。
- 文件名：`audio/<hash>.mp3`。`hash` 是“朗读文本”（经过 `MQSpeech.toSpeech` 把公式转成中文读法以后的文本）的 48 位哈希（12 位十六进制）。
- 清单：`audio/manifest.json` = `{voice, rate, kbps, generated, clips: {hash: 朗读文本}}`。构建时清单会内嵌进 `index.html`；网页版还会再拉一次 `audio/manifest.json`，所以后来补生成的录音不必重新构建也能生效。
- 覆盖内容：每道题每一步的题目提示、提示、答案+解析、原题、解题思路，所有鼓励语（每类 5 条），以及试听语句。
- 播放规则：只用一个 `<audio>` 元素。iPad Safari 上第一次点击屏幕时会用它播放一段 0.15 秒静音来“解锁”，之后所有录音（包括计时器触发的提醒）都复用这个元素，不会被自动播放策略拦截。每段只播一次；切换步骤会立即停止上一段。
- 没有录音的文本（例如新导入的题包）才回退到系统语音，而且只使用普通话（zh-CN）声音；设备上没有普通话声音时宁可不读，并提示一次如何下载。

### 为新题包生成录音

需要 Node.js、`edge-tts`（`pip install edge-tts`）和 `ffmpeg`。

```bash
# 为所有内置题包 + 固定语句生成（已存在的文件会跳过）
node tools/gen-audio.js

# 只为某个新题包生成
node tools/gen-audio.js packs/新题包.json

# 可选参数
#   --voice zh-CN-XiaoxiaoNeural   只能是 zh-CN-* 普通话声音
#   --rate -10%                    语速
#   --kbps 24                      码率
#   --out audio                    输出目录
#   --analysis-kbps 16             审题分析录音的码率（文字多，默认更低码率）
#   --only-prompts                 只生成步骤题目提示（体积更小）
```

生成后把 `audio/` 目录（含新的 `manifest.json`）和 `index.html` 一起上传即可；网页版会自动识别新录音。
