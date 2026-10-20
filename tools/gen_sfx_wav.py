# 离线渲染兜底音效（与 sfx.js 合成音色相近）→ src/sfxwav.js（data: URI，8-bit 16kHz 单声道）
import math, random, struct, base64, io, wave
SR=16000
def N(s): return 440*2**(s/12)
def buf(sec): return [0.0]*int(SR*sec)
def bell(b, f, t, dur, g, partial=True, glide=None, att=0.008):
    i0=int(t*SR)
    for k in range(int((dur+0.05)*SR)):
        tt=k/SR; i=i0+k
        if i>=len(b): break
        env = (tt/att) if tt<att else math.exp(-6.9*(tt-att)/max(0.01,dur-att))
        ff = f*(glide**min(1,tt/(dur*0.6)) if glide else 1)
        v = math.sin(2*math.pi*ff*tt)
        if partial: v += 0.22*math.sin(4*math.pi*f*tt)*math.exp(-6.9*tt/(dur*0.5))
        b[i] += g*env*v
def chime():
    b=buf(0.7); [bell(b,f,0.01+k*0.075,0.55 if k==1 else 0.32,0.9) for k,f in enumerate([N(15),N(19)])]; return b
def fanfare():
    b=buf(2.1); arp=[N(-9),N(-5),N(-2),N(3),N(7),N(10)]
    for k,f in enumerate(arp): bell(b,f,0.02+k*0.085,0.42,0.65)
    tc=0.02+len(arp)*0.085+0.02
    for f in [N(3),N(7),N(10),N(15)]: bell(b,f,tc,1.15,0.38,att=0.02)
    return b
def levelup():
    b=buf(2.0)
    for k in range(8): bell(b,N(-9+[0,2,4,5,7,9,11,12][k]),0.02+k*0.055,0.25,0.5,partial=False)
    t2=0.02+8*0.055+0.05
    for f in [N(3),N(10),N(15)]: bell(b,f,t2,0.5,0.45)
    for f in [N(5),N(12),N(17),N(22)]: bell(b,f,t2+0.22,1.3,0.34,att=0.015)
    return b
def slice_():
    random.seed(1); b=buf(0.2); y1=y2=0
    for i in range(len(b)):
        tt=i/SR; env=min(1,tt/0.03)*math.exp(-8*max(0,tt-0.03)); x=random.uniform(-1,1)
        a=0.3+0.5*tt/0.2; y1=y1+a*(x-y1); y2=y2+a*(y1-y2); b[i]=(y1-y2)*2.5*env
    return b
def soft():
    b=buf(0.3); bell(b,N(-14),0.005,0.22,0.55,partial=False,glide=0.85,att=0.01); return b
def wav(b):
    m=max(1e-6,max(abs(x) for x in b)); io_=io.BytesIO(); w=wave.open(io_,'wb'); w.setnchannels(1); w.setsampwidth(1); w.setframerate(SR)
    w.writeframes(bytes(int(128+127*0.9*x/m) for x in b)); w.close(); return 'data:audio/wav;base64,'+base64.b64encode(io_.getvalue()).decode()
out={'chime':chime(),'fanfare':fanfare(),'levelup':levelup(),'slice':slice_(),'soft':soft()}
open('src/sfxwav.js','w').write('/* 自动生成：python3 tools/gen_sfx_wav.py —— Web Audio 恢复失败时的兜底音效 */\nvar MQSfxWav = '+ '{'+','.join(f'"{k}":"{wav(v)}"' for k,v in out.items())+'};\n')
