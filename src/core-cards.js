/* 内置「补充」核心公式：试卷里还没出现过、但八年级必须掌握的内容（来源标为「补充」，不按试卷频次埋没）。
   结构与题目分析相同：formulas → 公式卡，associations → 联想卡，methods → 思路卡。数学已用 sympy 验算。 */
var MQCore = (function(){
  const R = String.raw;
  return [
    {id:'vieta', title:'补充', kps:['一元二次方程','韦达定理（根与系数的关系）'],
      formulas:[
        {name:'韦达定理（根与系数的关系）', latex:R`x_1+x_2=-\dfrac{b}{a},\ x_1x_2=\dfrac{c}{a}`, tip:R`前提：$ax^2+bx+c=0$ 中 $a\ne0$ 且 $\Delta=b^2-4ac\ge0$（有实数根）`},
        {name:'两根的平方和', latex:R`x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2`, tip:'和的平方，减去两倍积'},
        {name:'两根的倒数和', latex:R`\dfrac{1}{x_1}+\dfrac{1}{x_2}=\dfrac{x_1+x_2}{x_1x_2}`, tip:'通分：分子是两根之和，分母是两根之积（积不为 0）'},
        {name:'两根之差的平方', latex:R`(x_1-x_2)^2=(x_1+x_2)^2-4x_1x_2`, tip:'和的平方，减去四倍积'},
        {name:'已知两根构造方程', latex:R`x^2-(x_1+x_2)x+x_1x_2=0`, tip:'一次项系数是“负的两根之和”，常数项是“两根之积”'}
      ],
      associations:[
        {trigger:R`看到 $x_1+x_2$、$x_1x_2$，或关于两根的对称式（如 $x_1^2+x_2^2$、$\dfrac1{x_1}+\dfrac1{x_2}$）`, recall:'韦达定理：用两根之和、两根之积来表示', latex:R`x_1+x_2=-\dfrac{b}{a},\ x_1x_2=\dfrac{c}{a}`, why:'不用解方程求出两根，直接代入和与积，计算更简单'},
        {trigger:'已知方程的一个根，求另一个根', recall:'用两根之积（或之和）求另一个根', latex:R`x_1x_2=\dfrac{c}{a}`, why:R`例如 $x^2+kx-6=0$ 有一根是 $2$：$2\cdot x_2=-6$，所以 $x_2=-3$`},
        {trigger:'已知两个根，写出一元二次方程', recall:'构造方程：x² − (两根之和)x + 两根之积 = 0', latex:R`x^2-(x_1+x_2)x+x_1x_2=0`, why:R`例如两根为 $2$、$-3$：$x^2+x-6=0$`},
        {trigger:'两根同号、异号，或两根都是正数', recall:'看 Δ、两根之积、两根之和的符号', latex:R`\text{两正根}\Leftrightarrow\Delta\ge0,\ x_1x_2>0,\ x_1+x_2>0`, why:R`异号：$x_1x_2<0$；同号：$x_1x_2>0$；两负根：$x_1x_2>0,\ x_1+x_2<0$（都要 $\Delta\ge0$）`},
        {trigger:'用韦达定理求出了参数的值', recall:'回头检验：a ≠ 0 且 Δ ≥ 0（易错点！）', latex:R`a\ne0,\ \Delta=b^2-4ac\ge0`, why:'不满足的值会让方程没有实数根或不是一元二次方程，必须舍去'}
      ],
      methods:[
        {original:R`已知 $x_1,x_2$ 是方程 $x^2-3x-4=0$ 的两个根，求 $x_1^2+x_2^2$ 的值。`,
          method:R`① $\Delta=9+16=25>0$；② $x_1+x_2=3,\ x_1x_2=-4$；③ $x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2=9+8=17$`},
        {original:R`已知方程 $x^2+kx-6=0$ 的一个根是 $2$，求另一个根及 $k$ 的值。`,
          method:R`① 积：$2x_2=-6$，得 $x_2=-3$；② 和：$2+(-3)=-k$，得 $k=1$`},
        {original:R`关于 $x$ 的方程 $x^2-2(m-1)x+m^2=0$ 有两个实数根 $x_1,x_2$，且 $x_1^2+x_2^2=8$，求 $m$。`,
          method:R`① 韦达：$x_1+x_2=2(m-1),\ x_1x_2=m^2$；② $4(m-1)^2-2m^2=8$，得 $m=2\pm\sqrt6$；③ 检验 $\Delta=-8m+4\ge0$ 即 $m\le\dfrac12$，所以 $m=2-\sqrt6$`}
      ]},

    {id:'completing-square', title:'补充', kps:['一元二次方程','配方法'],
      formulas:[
        {name:'配方法', latex:R`x^2+px=\left(x+\dfrac{p}{2}\right)^2-\dfrac{p^2}{4}`, tip:'加上再减去一次项系数一半的平方；二次项系数不是 1 时先提出去。'},
        {name:'配方求最值', latex:R`ax^2+bx+c=a\left(x+\dfrac{b}{2a}\right)^2+\dfrac{4ac-b^2}{4a}`, tip:'a>0 有最小值；a<0 有最大值；最值在对称轴处取得。'}
      ],
      associations:[
        {trigger:'题目要求“用配方法”解方程', recall:'移项 → 加一半平方 → 开平方', latex:R`(x+m)^2=n`, why:'配方法把方程化成完全平方，再直接开平方'},
        {trigger:'二次三项式求最大/最小值', recall:'配方，看开口方向', latex:R`a\left(x-h\right)^2+k`, why:'配方后一眼看出顶点与最值'}
      ],
      methods:[
        {original:R`用配方法解 $x^2-4x+2=0$。`,
          method:R`① $x^2-4x=-2$；② 加 4：$(x-2)^2=2$；③ $x=2\pm\sqrt2$`},
        {original:R`求 $2x^2-x-1$ 的最值。`,
          method:R`① $a=2>0$，有最小值；② 配方 $2(x-\frac14)^2-\frac98$；③ 最小值 $-\frac98$（$x=\frac14$）`}
      ]},
    {id:'discriminant', title:'补充', kps:['一元二次方程','根的判别式'],
      formulas:[
        {name:'根的判别式', latex:R`\Delta=b^2-4ac`, tip:'Δ>0 两不等实根；Δ=0 两相等实根；Δ<0 无实根。'},
        {name:'求根公式', latex:R`x=\dfrac{-b\pm\sqrt{\Delta}}{2a}\ (\Delta\ge0)`, tip:'先化一般式，找准 a,b,c（连同符号），先算 Δ。'}
      ],
      associations:[
        {trigger:'问“有几个实数根 / 能否达到某值”', recall:'算判别式 Δ', latex:R`\Delta=b^2-4ac`, why:'根的个数由 Δ 的符号决定；应用题“能否达到”常化为方程看 Δ'},
        {trigger:'含参数的方程要有两个不相等实根', recall:'Δ>0，还要 a≠0', latex:R`\Delta>0,\ a\ne0`, why:'别漏掉二次项系数不为 0'}
      ],
      methods:[
        {original:R`$x^2-2x+4-m=0$ 有两个不相等实根，求 $m$。`,
          method:R`① $\Delta=4-4(4-m)>0$；② $4m>12$；③ $m>3$`},
        {original:R`日盈利方程 $\Delta=-200<0$，日盈利能否达到 3300？`,
          method:R`$\Delta<0$ 无实数解 → 不能达到`}
      ]},
    {id:'tonggen', title:'补充', kps:['一元二次方程','同根方程'],
      formulas:[
        {name:'同根方程（定义）', latex:R`\text{两方程有且只有一个公共实根}`, tip:'先分别求出两方程的根，再看交集是否恰有一个元素。'},
        {name:'邻根方程（定义）', latex:R`|x_1-x_2|=1`, tip:'|x1-x2|=√Δ/|a|；常用来列关于参数的方程。'}
      ],
      associations:[
        {trigger:'题目定义“同根方程”', recall:'分别求根 → 找唯一公共根', why:'新定义题先翻译成“公共根恰好一个”'},
        {trigger:'题目定义“邻根方程”', recall:'两根之差的绝对值为 1', latex:R`|x_1-x_2|=\dfrac{\sqrt{\Delta}}{|a|}=1`, why:'用判别式表示差，再解参数'}
      ],
      methods:[
        {original:R`判断 $(x-1)^2=16$ 与 $x^2-4x-5=0$ 是否同根方程。`,
          method:R`① 根为 $5,-3$ 与 $5,-1$；② 公共根只有 $5$ → 是`},
        {original:R`$x^2-3x+2=0$ 与 $x^2-m=0$ 是同根方程，求 $m$。`,
          method:R`① 根 $1,2$；② 恰交一个：$m=1$ 或 $m=4$`}
      ]},
    {id:'area-max', title:'补充', kps:['一元二次方程','面积最值'],
      formulas:[
        {name:'靠墙围栏面积', latex:R`S=x(c-kx)`, tip:'用材料总长（记得减门洞）表示另一边，得到关于一边的二次函数。'},
        {name:'二次函数顶点最值', latex:R`S=-a(x-h)^2+k`, tip:'配方看顶点；还要检验是否在实际约束（墙长、门宽）内。'}
      ],
      associations:[
        {trigger:'靠墙围矩形 + 求最大面积', recall:'列 S=x(…)，配方求顶点', why:'材料一定时面积是二次函数'},
        {trigger:'有门洞的围栏', recall:'用料 = 各边长 − 门宽总和', why:'门洞不用材料，列方程时要减掉'}
      ],
      methods:[
        {original:R`木条 14m 靠墙（墙 10m），AB、BC 各留 1m 门，求最大面积。`,
          method:R`① $y=16-2x$，$S=16x-2x^2$；② 配方顶点 $x=4,S=32$；③ 检验 $y=8\le10$`}
      ]}

  ];
})();
if(typeof module !== 'undefined') module.exports = MQCore;
