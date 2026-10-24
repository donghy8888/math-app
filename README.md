# 无痛快乐学数学

初中数学闯关练习小工具。访问：https://donghy8888.github.io/math-app/

## 朗读（普通话）

内置题目使用预先录制的普通话录音（`audio/`，微软 zh-CN-XiaoxiaoNeural），不依赖设备上的系统语音，因此在系统默认粤语的 iPad 上也会读普通话。iPad Safari 上需要先点一下屏幕（任意按钮）才会开始出声。

为新题包生成录音：`node tools/gen-audio.js packs/新题包.json`（需要 edge-tts 和 ffmpeg），详见 [SCHEMA.md](SCHEMA.md)。
