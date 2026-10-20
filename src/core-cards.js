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
      ]}
  ];
})();
if(typeof module !== 'undefined') module.exports = MQCore;
