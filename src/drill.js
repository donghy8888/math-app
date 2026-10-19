/* 公式速记 · 记忆练习：公式挖空、名称/公式配对、条件判断、快速小练习；间隔复习；每日积分上限 */
var MQDrill = (function(){
  const CR = typeof MQCardRank !== 'undefined' ? MQCardRank : require('./card-rank.js');
  const R = String.raw;
  /* ---------- 手写的公式挖空：[[正确答案§干扰项1§干扰项2§干扰项3]]；去掉挖空标记后必须等于 forms 中的某个完整公式 ---------- */
  const DEFS = [
    {id:'disc', name:'根的判别式', kp:'一元二次方程', names:['根的判别式','判别式'], forms:[R`\Delta=b^2-4ac`],
      cloze:[R`\Delta=b^2-[[4§2§1§8]]ac`, R`\Delta=[[b^2§b§2b§a^2]]-4ac`, R`\Delta=[[b^2§2b§b§-b^2]]-[[4ac§2ac§ac§4a]]`],
      tip:'二次项系数不为零，判别式先算清：b方减4ac', say:'根的判别式：德尔塔等于b的平方减4ac。'},
    {id:'disccase', name:'判别式与根的情况', kp:'一元二次方程', names:['根的判别式','判别式'],
      forms:[R`\Delta>0\Leftrightarrow\text{方程有两个不相等的实数根}`, R`\Delta=0\Leftrightarrow\text{方程有两个相等的实数根}`, R`\Delta<0\Leftrightarrow\text{方程没有实数根}`],
      cloze:[R`\Delta[[>§<§=§\ge]]0\Leftrightarrow\text{方程有两个不相等的实数根}`, R`\Delta[[=§>§<§\ne]]0\Leftrightarrow\text{方程有两个相等的实数根}`, R`\Delta[[<§>§=§\ge]]0\Leftrightarrow\text{方程没有实数根}`],
      tip:'大于零两不等，等于零两相等，小于零没实根', say:'德尔塔大于0，方程有两个不相等的实数根；德尔塔等于0，有两个相等的实数根；德尔塔小于0，没有实数根。'},
    {id:'quaddef', name:'一元二次方程定义', kp:'一元二次方程', names:['一元二次方程定义','一元二次方程的定义'], forms:[R`ax^2+bx+c=0\ (a\ne0)`],
      cloze:[R`ax^2+bx+c=0\ (a[[\ne§=§>§\ge]]0)`, R`ax^[[2§1§3§0]]+bx+c=0\ (a\ne0)`],
      tip:'二次项系数不为零，二次方程才成立', say:'一元二次方程的一般形式：a x的平方加b x加c等于0，其中a不等于0。'},
    {id:'qformula', name:'求根公式', kp:'一元二次方程', names:['求根公式','公式法'], forms:[R`x=\dfrac{-b\pm\sqrt{b^2-4ac}}{2a}\ (b^2-4ac\ge0)`],
      cloze:[R`x=\dfrac{-b\pm\sqrt{b^2-4ac}}{[[2a§a§2§4a]]}\ (b^2-4ac\ge0)`, R`x=\dfrac{[[-b§b§-2b§2b]]\pm\sqrt{b^2-4ac}}{2a}\ (b^2-4ac\ge0)`,
        R`x=\dfrac{-b\pm\sqrt{b^2-4ac}}{2a}\ (b^2-4ac[[\ge§>§\le§<]]0)`, R`x=\dfrac{-b\pm\sqrt{b^2-[[4ac§2ac§ac§4a]]}}{[[2a§a§2§4a]]}\ (b^2-4ac\ge0)`],
      tip:'负b加减根号下，b方减4ac，全部除以2a；用前先看判别式', say:'求根公式：x等于2a分之负b加减根号下b的平方减4ac，条件是b的平方减4ac大于等于0。'},
    {id:'sqsum', name:'完全平方公式', kp:'乘法公式', names:['完全平方公式'], forms:[R`(a\pm b)^2=a^2\pm2ab+b^2`],
      cloze:[R`(a\pm b)^2=a^2\pm[[2ab§ab§4ab§a^2b^2]]+b^2`, R`(a\pm b)^2=a^2\pm2ab+[[b^2§2b§b§-b^2]]`, R`(a\pm b)^2=[[a^2§2a§a§a^2b^2]]\pm[[2ab§ab§4ab§a^2b^2]]+b^2`],
      tip:'首平方，尾平方，首尾两倍在中央', say:'完全平方公式：a加减b的平方，等于a的平方加减2ab加b的平方。'},
    {id:'sqdiff', name:'平方差公式', kp:'乘法公式', names:['平方差公式','平方差因式分解'], forms:[R`(a+b)(a-b)=a^2-b^2`],
      cloze:[R`(a+b)(a-b)=a^2[[-§+§\times§\div]]b^2`, R`(a+b)(a-b)=[[a^2-b^2§a^2+b^2§(a-b)^2§a^2-2ab+b^2]]`],
      tip:'两数和乘两数差，等于两数平方差', say:'平方差公式：a加b乘a减b，等于a的平方减b的平方。'},
    {id:'sqrtabs', name:'二次根式的性质', kp:'二次根式', names:['二次根式的性质','绝对值的平方'], forms:[R`\sqrt{a^2}=|a|`],
      cloze:[R`\sqrt{a^2}=[[|a|§a§-a§\pm a]]`],
      tip:'根号下平方，开出绝对值；再看正负去掉绝对值', say:'根号下a的平方，等于a的绝对值。'},
    {id:'sqrtsq', name:'算术平方根的平方', kp:'二次根式', names:['有理化因式'], forms:[R`(\sqrt a)^2=a\ (a\ge0)`],
      cloze:[R`(\sqrt a)^2=[[a§|a|§-a§a^2]]\ (a\ge0)`, R`(\sqrt a)^2=a\ (a[[\ge§>§\le§\ne]]0)`],
      tip:'先有根号才平方，a 必须非负', say:'根号a的平方等于a，条件是a大于等于0。'},
    {id:'sqrtmean', name:'二次根式有意义的条件', kp:'二次根式', names:['有意义条件','二次根式有意义的条件'], forms:[R`\sqrt a\ \text{有意义}\Leftrightarrow a\ge0`],
      cloze:[R`\sqrt a\ \text{有意义}\Leftrightarrow a[[\ge§>§\le§\ne]]0`],
      tip:'被开方数要非负，大于等于零别漏“等”', say:'根号a有意义，等价于a大于等于0。'},
    {id:'sqrtmul', name:'二次根式乘除', kp:'二次根式', names:['二次根式乘除'], forms:[R`\sqrt a\cdot\sqrt b=\sqrt{ab}\ (a\ge0,b\ge0)`, R`\dfrac{\sqrt a}{\sqrt b}=\sqrt{\dfrac ab}\ (a\ge0,b>0)`],
      cloze:[R`\sqrt a\cdot\sqrt b=[[\sqrt{ab}§\sqrt{a+b}§ab§\sqrt a+\sqrt b]]\ (a\ge0,b\ge0)`, R`\dfrac{\sqrt a}{\sqrt b}=\sqrt{\dfrac ab}\ (a\ge0,b[[>§\ge§<§\ne]]0)`],
      tip:'乘除可以合根号，分母那个要大于零', say:'根号a乘根号b等于根号ab，a、b都大于等于0；根号a除以根号b等于根号b分之a，a大于等于0，b大于0。'},
    {id:'ration', name:'分母有理化', kp:'二次根式', names:['分母有理化','化去分母'], forms:[R`\dfrac{1}{\sqrt a}=\dfrac{\sqrt a}{a}\ (a>0)`, R`\dfrac{1}{\sqrt a+\sqrt b}=\dfrac{\sqrt a-\sqrt b}{a-b}\ (a\ge0,b\ge0,a\ne b)`],
      cloze:[R`\dfrac{1}{\sqrt a}=\dfrac{[[\sqrt a§a§1§\sqrt{2a}]]}{a}\ (a>0)`, R`\dfrac{1}{\sqrt a+\sqrt b}=\dfrac{\sqrt a[[-§+§\times§\div]]\sqrt b}{a-b}\ (a\ge0,b\ge0,a\ne b)`,
        R`\dfrac{1}{\sqrt a+\sqrt b}=\dfrac{\sqrt a-\sqrt b}{[[a-b§a+b§\sqrt a-\sqrt b§(a-b)^2]]}\ (a\ge0,b\ge0,a\ne b)`],
      tip:'分母有根号，乘它的有理化因式：和配差，差配和', say:'分母有理化：根号a分之1等于a分之根号a；根号a加根号b分之1，等于a减b分之根号a减根号b。'},
    {id:'simplest', name:'最简二次根式', kp:'二次根式', names:['最简二次根式'], forms:[String.raw`\text{被开方数不含}\text{分母}\text{，不含}\text{能开尽方的因数}`],
      cloze:[String.raw`\text{被开方数不含}[[\text{分母}§\text{字母}§\text{负号}§\text{奇数}]]\text{，不含}\text{能开尽方的因数}`,
        String.raw`\text{被开方数不含}\text{分母}\text{，不含}[[\text{能开尽方的因数}§\text{质因数}§\text{偶数因数}§\text{字母因数}]]`],
      tip:'一看分母二看方：根号里没分母、没有能开方的因数', say:'最简二次根式：被开方数不含分母，也不含能开得尽方的因数。'},
    {id:'shift', name:'移位规律', kp:'二次根式', names:['移位规律'], forms:[R`\sqrt{100a}=10\sqrt a\ (a\ge0)`],
      cloze:[R`\sqrt{100a}=[[10§100§50§\sqrt{10}]]\sqrt a\ (a\ge0)`],
      tip:'被开方数小数点移两位，平方根小数点移一位', say:'根号下100a等于10倍根号a。被开方数的小数点移动两位，平方根的小数点移动一位。'},
    {id:'negin', name:'负因式移入根号', kp:'二次根式', names:['负因式移入根号'], forms:[R`a<0,\ m\ge0\Rightarrow a\sqrt m=-\sqrt{a^2m}`],
      cloze:[R`a<0,\ m\ge0\Rightarrow a\sqrt m=[[-\sqrt{a^2m}§\sqrt{a^2m}§\sqrt{-a^2m}§-\sqrt{am}]]`],
      tip:'负号留在根号外，只把正的部分平方后移进去', say:'a小于0时，a根号m等于负的根号下a的平方m。'},
    {id:'estimate', name:'估算', kp:'二次根式', names:['估算'], forms:[R`k^2<m<(k+1)^2\Rightarrow k<\sqrt m<k+1`],
      cloze:[R`k^2<m<(k+1)^2\Rightarrow k<\sqrt m<[[k+1§k^2§2k§k+2]]`],
      tip:'夹在两个相邻平方数之间，根号就夹在两个相邻整数之间', say:'如果k的平方小于m小于k加1的平方，那么k小于根号m小于k加1。'},
    {id:'factor', name:'因式分解法', kp:'一元二次方程', names:['因式分解法','十字相乘'], forms:[R`AB=0\Rightarrow A=0\ \text{或}\ B=0`],
      cloze:[R`AB=0\Rightarrow A=0\ [[\text{或}§\text{且}§\text{和}§\text{则}]]\ B=0`, R`AB=[[0§1§A§B]]\Rightarrow A=0\ \text{或}\ B=0`],
      tip:'右边化成零，左边分解成乘积，每个因式等于零', say:'因式分解法：如果A乘B等于0，那么A等于0或B等于0。'},
    {id:'complete', name:'配方法', kp:'一元二次方程', names:['配方法','配方'], forms:[R`x^2+px=q\Rightarrow\left(x+\dfrac p2\right)^2=q+\dfrac{p^2}{4}`],
      cloze:[R`x^2+px=q\Rightarrow\left(x+[[\dfrac p2§p§2p§\dfrac p4]]\right)^2=q+\dfrac{p^2}{4}`, R`x^2+px=q\Rightarrow\left(x+\dfrac p2\right)^2=q+[[\dfrac{p^2}{4}§\dfrac{p^2}{2}§p^2§\dfrac p2]]`],
      tip:'配方：两边同时加上一次项系数一半的平方', say:'配方法：x的平方加p x等于q，配成x加二分之p的平方，等于q加四分之p的平方。'},
    {id:'direct', name:'直接开平方法', kp:'一元二次方程', names:['直接开平方法','平方根'], forms:[R`(x+m)^2=n\ (n\ge0)\Rightarrow x+m=\pm\sqrt n`],
      cloze:[R`(x+m)^2=n\ (n\ge0)\Rightarrow x+m=[[\pm\sqrt n§\sqrt n§-\sqrt n§n^2]]`, R`(x+m)^2=n\ (n[[\ge§>§\le§<]]0)\Rightarrow x+m=\pm\sqrt n`],
      tip:'开平方，别忘正负两个根', say:'直接开平方法：x加m的平方等于n，n大于等于0时，x加m等于正负根号n。'},
    {id:'rootdef', name:'方程的根', kp:'一元二次方程', names:['方程的根'], forms:[String.raw`x_0\ \text{是根}\Leftrightarrow ax_0^2+bx_0+c=0`],
      cloze:[String.raw`x_0\ \text{是根}\Leftrightarrow ax_0^2+bx_0+c=[[0§1§x_0§a]]`, String.raw`x_0\ \text{是根}\Leftrightarrow [[ax_0^2+bx_0+c§ax^2+bx+c§a+b+c§x_0]]=0`],
      tip:'是根就代入，代入就成立', say:'x0是方程a x平方加b x加c等于0的根，等价于把x0代入方程，等式成立。'},
    {id:'coefsum', name:'系数和与根', kp:'一元二次方程', names:['系数和与根','系数和'], forms:[R`a+b+c=0\Leftrightarrow x=1\ \text{是}\ ax^2+bx+c=0\ \text{的根}`, R`a-b+c=0\Leftrightarrow x=-1\ \text{是}\ ax^2+bx+c=0\ \text{的根}`],
      cloze:[R`a+b+c=0\Leftrightarrow x=[[1§-1§0§2]]\ \text{是}\ ax^2+bx+c=0\ \text{的根}`, R`a-b+c=0\Leftrightarrow x=[[-1§1§0§-2]]\ \text{是}\ ax^2+bx+c=0\ \text{的根}`],
      tip:'系数相加得零，1 是根；正负交替得零，−1 是根', say:'a加b加c等于0，x等于1是方程的根；a减b加c等于0，x等于负1是方程的根。'},
    {id:'abs', name:'绝对值', kp:'实数', names:['绝对值'], forms:[R`|a|=\begin{cases}a,&a\ge0\\-a,&a<0\end{cases}`],
      cloze:[R`|a|=\begin{cases}a,&a\ge0\\[[-a§a§0§\dfrac1a]],&a<0\end{cases}`, R`|a|=\begin{cases}a,&a[[\ge§\le§<§\ne]]0\\-a,&a<0\end{cases}`],
      tip:'正数和零的绝对值是本身，负数的绝对值是相反数', say:'a大于等于0时，a的绝对值等于a；a小于0时，a的绝对值等于负a。'},
    {id:'nonneg', name:'非负数', kp:'实数', names:['非负数'], forms:[R`a^2\ge0,\ |a|\ge0,\ \sqrt a\ge0\ (a\ge0)`],
      cloze:[R`a^2[[\ge§>§\le§<]]0,\ |a|\ge0,\ \sqrt a\ge0\ (a\ge0)`, R`a^2\ge0,\ |a|\ge0,\ \sqrt a[[\ge§>§\le§\ne]]0\ (a\ge0)`],
      tip:'平方、绝对值、算术平方根都非负；几个非负数和为零，每个都为零', say:'a的平方、a的绝对值、根号a都大于等于0。'},
    {id:'pythag', name:'勾股定理', kp:'勾股定理', names:['勾股定理'], forms:[R`a^2+b^2=c^2\ (c\ \text{为斜边})`],
      cloze:[R`a^2+b^2=[[c^2§c§2c§(a+b)^2]]\ (c\ \text{为斜边})`],
      tip:'两直角边平方和，等于斜边的平方', say:'勾股定理：两条直角边的平方和等于斜边的平方。'},
    {id:'rate', name:'增长率 / 降低率', kp:'一元二次方程', names:['降低率公式','增长率公式'], forms:[R`a(1-x)^n=b\ (\text{降低率}\ x)`, R`a(1+x)^n=b\ (\text{增长率}\ x)`],
      cloze:[R`a(1[[-§+§\times§\div]]x)^n=b\ (\text{降低率}\ x)`, R`a(1+x)^[[n§2§x§b]]=b\ (\text{增长率}\ x)`],
      tip:'增长 1+x，降低 1−x；变化 n 次就是 n 次方', say:'降低率公式：a乘1减x的n次方等于b；增长率是1加x。'},
    {id:'zeropow', name:'零指数幂', kp:'实数', names:['零指数幂'], forms:[R`a^0=1\ (a\ne0)`],
      cloze:[R`a^0=[[1§0§a§-1]]\ (a\ne0)`, R`a^0=1\ (a[[\ne§>§=§\ge]]0)`],
      tip:'任何不为零的数的零次方都等于 1', say:'a的0次方等于1，a不等于0。'},
    {id:'ineq3', name:'不等式性质 3', kp:'不等式', names:['不等式性质 3','不等式的性质'], forms:[R`a<b,\ c<0\Rightarrow ac>bc`],
      cloze:[R`a<b,\ c<0\Rightarrow ac[[>§<§=§\le]]bc`],
      tip:'两边乘除同一个负数，不等号要变向', say:'如果a小于b，c小于0，那么ac大于bc。'}
  ];
  /* ---------- 条件判断（对 / 错），重点练“隐藏条件” ---------- */
  const TF = [
    {id:'t1', say:'根号下a的平方等于a，对所有实数a都成立',  def:'sqrtabs', hidden:1, text:R`$\sqrt{a^2}=a$ 对所有实数 $a$ 都成立`, ans:false, why:R`只有 $a\ge0$ 时才成立；$a<0$ 时 $\sqrt{a^2}=-a$。正确写法是 $\sqrt{a^2}=|a|$。`},
    {id:'t2', say:'根号a的平方，也就是先开方再平方，等于a，对所有实数a都成立',  def:'sqrtsq', hidden:1, text:R`$(\sqrt a)^2=a$ 对所有实数 $a$ 都成立`, ans:false, why:R`$a<0$ 时 $\sqrt a$ 没有意义，所以要求 $a\ge0$。`},
    {id:'t3', def:'disccase', text:R`$\Delta>0$ 时，一元二次方程有两个不相等的实数根`, ans:true, why:R`$\Delta>0$ 两个不相等实根；$\Delta=0$ 两个相等实根；$\Delta<0$ 没有实根。`},
    {id:'t4', def:'disccase', text:R`$\Delta=0$ 时，一元二次方程没有实数根`, ans:false, why:R`$\Delta=0$ 时有两个相等的实数根；$\Delta<0$ 才没有实数根。`},
    {id:'t5', def:'disccase', text:R`$\Delta\ge0$ 时，一元二次方程有实数根`, ans:true, why:R`$\Delta\ge0$ 包含“两个不等实根”和“两个相等实根”两种情况。`},
    {id:'t6', def:'quaddef', hidden:1, text:R`$ax^2+bx+c=0$ 一定是一元二次方程，不需要任何条件`, ans:false, why:R`必须 $a\ne0$；$a=0$ 时就不是二次方程了。`},
    {id:'t7', def:'quaddef', hidden:1, text:R`方程 $(m-1)x^2+2x+1=0$ 有两个不相等的实数根，只要 $\Delta>0$ 就够了`, ans:false, why:R`还要二次项系数 $m-1\ne0$，答案要把 $m\ne1$ 一起写上。`},
    {id:'t8', def:'qformula', text:R`用求根公式前，要先把方程化成一般形式 $ax^2+bx+c=0$`, ans:true, why:R`化成一般形式才能找准 $a$、$b$、$c$（连同符号）。`},
    {id:'t9', def:'qformula', hidden:1, text:R`$b^2-4ac<0$ 时，也可以用求根公式求出实数根`, ans:false, why:R`$b^2-4ac<0$ 时根号下是负数，方程没有实数根。`},
    {id:'t10', def:'sqrtmean', hidden:1, text:R`$\sqrt{x}$ 有意义的条件是 $x>0$`, ans:false, why:R`应为 $x\ge0$，$x=0$ 时 $\sqrt0=0$ 也有意义。`},
    {id:'t11', say:'根号x分之1，也就是1除以根号x，有意义的条件是x大于0',  def:'sqrtmean', hidden:1, text:R`$\dfrac{1}{\sqrt x}$ 有意义的条件是 $x>0$`, ans:true, why:R`被开方数 $x\ge0$，又因为在分母上不能为 0，所以 $x>0$。`},
    {id:'t12', def:'sqrtmul', hidden:1, text:R`$\sqrt a\cdot\sqrt b=\sqrt{ab}$ 要求 $a\ge0$ 且 $b\ge0$`, ans:true, why:R`例如 $\sqrt{(-2)\times(-8)}=4$，但 $\sqrt{-2}$、$\sqrt{-8}$ 都没有意义。`},
    {id:'t13', say:'根号a除以根号b等于根号下b分之a，其中b可以等于0',  def:'sqrtmul', hidden:1, text:R`$\dfrac{\sqrt a}{\sqrt b}=\sqrt{\dfrac ab}$ 中 $b$ 可以等于 $0$`, ans:false, why:R`$b$ 在分母上，必须 $b>0$。`},
    {id:'t14', def:'sqsum', text:R`$(a+b)^2=a^2+b^2$`, ans:false, why:R`漏了中间项：$(a+b)^2=a^2+2ab+b^2$。`},
    {id:'t15', def:'sqsum', text:R`$(a-b)^2=a^2-2ab+b^2$`, ans:true, why:R`首平方，尾平方，首尾两倍在中央，符号跟着中间走。`},
    {id:'t16', def:'sqdiff', text:R`$(x+2)(x-2)=x^2-4$`, ans:true, why:R`平方差公式：$(a+b)(a-b)=a^2-b^2$，$2^2=4$。`},
    {id:'t17', def:'simplest', text:R`$\sqrt{12}$ 是最简二次根式`, ans:false, why:R`$12=4\times3$，含能开得尽方的因数 4，$\sqrt{12}=2\sqrt3$。`},
    {id:'t18', def:'simplest', text:R`$\sqrt{\dfrac12}$ 是最简二次根式`, ans:false, why:R`被开方数含分母，$\sqrt{\dfrac12}=\dfrac{\sqrt2}{2}$。`},
    {id:'t19', def:'simplest', text:R`$\sqrt6$ 是最简二次根式`, ans:true, why:R`$6=2\times3$，没有分母，也没有能开得尽方的因数。`},
    {id:'t20', def:'factor', text:R`若 $(x-1)(x+3)=0$，则 $x=1$ 且 $x=-3$`, ans:false, why:R`应该是 $x=1$ **或** $x=-3$，一个 $x$ 不能同时等于两个数。`},
    {id:'t21', def:'direct', hidden:1, text:R`方程 $x^2=4$ 的解是 $x=2$`, ans:false, why:R`漏了负根：$x=\pm2$。`},
    {id:'t22', def:'coefsum', text:R`若 $a+b+c=0$，则 $x=1$ 是方程 $ax^2+bx+c=0\ (a\ne0)$ 的根`, ans:true, why:R`把 $x=1$ 代入，左边正好是 $a+b+c=0$。`},
    {id:'t23', def:'nonneg', text:R`对所有实数 $a$，都有 $a^2\ge0$`, ans:true, why:R`任何实数的平方都是非负数。`},
    {id:'t24', def:'ineq3', hidden:1, text:R`不等式两边同时乘一个负数，不等号方向不变`, ans:false, why:R`乘（或除以）负数，不等号方向要改变。`},
    {id:'t25', def:'zeropow', hidden:1, text:R`$0^0=1$`, ans:false, why:R`零指数幂要求底数不为 0，$0^0$ 没有意义。`},
    {id:'t26', say:'若a小于0，则a乘根号3等于根号下3a的平方',  def:'negin', hidden:1, text:R`若 $a<0$，则 $a\sqrt3=\sqrt{3a^2}$`, ans:false, why:R`$a<0$ 时 $a\sqrt3$ 是负数，应为 $a\sqrt3=-\sqrt{3a^2}$。`},
    {id:'t27', def:'abs', hidden:1, text:R`$|a|=a$ 对所有实数 $a$ 都成立`, ans:false, why:R`$a<0$ 时 $|a|=-a$。`}
  ];
  /* ---------- 小工具 ---------- */
  function mulberry(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  function shuffle(rng, arr){ const a = arr.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while(b){ [a, b] = [b, a % b]; } return a; };
  const pad = n => String(n).padStart(2, '0');
  function addDays(ds, n){ const [y, m, d] = ds.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
  function hashStr(s){ let h = 0x811c9dc5; for(const c of String(s)){ h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0; } return h.toString(16); }
  /* 多项式：[a,b,c] → "2x^2-3x+1" */
  function poly(cs, v){ v = v || 'x'; const n = cs.length - 1; let s = '';
    cs.forEach((c, i) => { if(!c) return; const p = n - i; const abs = Math.abs(c); const body = p === 0 ? String(abs) : (abs === 1 ? '' : abs) + v + (p > 1 ? '^' + p : '');
      s += (c < 0 ? '-' : (s ? '+' : '')) + body; });
    return s || '0'; }
  const lin = (v, c) => c === 0 ? v : v + (c > 0 ? '-' + c : '+' + (-c));   // v − c
  /* ---------- 挖空 ---------- */
  const BL = /\[\[([\s\S]+?)\]\]/g;
  function parseCloze(t){ const blanks = []; t.replace(BL, (m, body) => { const p = body.split('§'); blanks.push({ans: p[0], dis: p.slice(1)}); return m; }); return {t, blanks, full: t.replace(BL, (m, body) => body.split('§')[0])}; }
  /* fills[j]: 已填 latex 或 null；marks[j]: 'ok' | 'bad' | 'now' | '' */
  const COLORS = {ok:'#2e8b57', bad:'#d0453f'};
  function clozeLatex(t, fills, marks){ let j = -1;
    return t.replace(BL, () => { j++; const f = fills && fills[j], m = marks && marks[j];
      if(f != null && f !== '') return '{\\boxed{' + (COLORS[m] ? '\\color{' + COLORS[m] + '}{' + f + '}' : f) + '}}';
      const lab = (fills && fills.length > 1) ? ['①','②','③'][j] || '?' : '?';
      return '{\\boxed{\\,\\text{' + lab + '}\\,}}'; }); }
  /* 自动挖空（没有手写定义的公式）：只挖关系符号或单独的整数，且公式较短、结构简单 */
  const RELS = ['\\ge', '>', '\\le', '<', '\\ne', '='];
  function autoCloze(latex, rng){
    const s = String(latex || '');
    if(!s || s.length > 70 || /\\(text|begin|underbrace|cdots|ldots|quad|mathbb|Rightarrow|Leftrightarrow|iff|to)\b/.test(s) || !/=|\\ge|\\le|\\ne|[<>]/.test(s)) return null;
    const cands = [];
    let m, cmdEnd = -1; const re = /\\[a-zA-Z]+|\d+/g;   // 不用后行断言，兼容旧版 Safari
    while((m = re.exec(s))){ const tok = m[0];
      if(tok[0] === '\\'){ cmdEnd = m.index + tok.length; if(/^\\(ge|le|ne)$/.test(tok)) cands.push({i: m.index, tok}); continue; }
      if(m.index === cmdEnd) continue;                        // 例如 \frac12 里的 12：不挖
      if(s[m.index - 1] === '^' && tok.length > 1) continue;
      cands.push({i: m.index, tok}); }
    // 等号左右各至少要有内容；每个关系符号只在非首尾位置
    const rel = cands.filter(c => !/^\d/.test(c.tok)), num = cands.filter(c => /^\d/.test(c.tok));
    const c = rel.length ? pick(rng, rel) : num.length ? pick(rng, num) : null; if(!c) return null;
    let dis;
    if(/^\d/.test(c.tok)){ const n = +c.tok; dis = [...new Set([n + 1, n > 1 ? n - 1 : n + 2, n * 2 === n ? n + 3 : n * 2, n + 2].map(String))].filter(x => x !== c.tok).slice(0, 3); }
    else { const pref = {'\\ge':['>','\\le','\\ne'], '\\le':['<','\\ge','\\ne'], '\\ne':['=','>','\\ge']}[c.tok]; dis = pref; }
    return s.slice(0, c.i) + '[[' + [c.tok, ...dis].join('§') + ']]' + s.slice(c.i + c.tok.length);
  }
  /* ---------- 快速小练习（随机参数） ---------- */
  const RT = ['2','3','5','6','7'];
  const radTex = (k, m) => (k === 1 ? '' : k) + '\\sqrt{' + m + '}';
  function fracRad(num, m, den){ // num·√m / den，已约分
    const g = gcd(num, den); num /= g; den /= g; const top = (num === 1 ? '' : num) + '\\sqrt{' + m + '}';
    return den === 1 ? top : '\\dfrac{' + top + '}{' + den + '}'; }
  const GENS = [
    {id:'g_disc', def:'disc', make(rng){ const a = pick(rng, [1,1,2,3]), b = ri(rng, -6, 6) || 4, c = ri(rng, -6, 6);
      const d = b*b - 4*a*c; return {kind:'num', prompt:R`方程 $${poly([a,b,c])}=0$ 的判别式 $\Delta=$ ？`, answer:String(d), params:{a,b,c},
        explain:R`$a=${a}$，$b=${b}$，$c=${c}$，$\Delta=b^2-4ac=${b<0?'('+b+')':b}^2-4\times${a}\times${c<0?'('+c+')':c}=${d}$`}; }},
    {id:'g_count', def:'disccase', make(rng){ const want = pick(rng, ['gt','eq','lt']); let a, b, c, d, n = 0;
      do { if(want === 'eq'){ const k = ri(rng, -4, 4) || 2; a = pick(rng,[1,1,4]); const r = a === 4 ? 2 : 1; b = 2*r*k; c = k*k; } else { a = pick(rng,[1,1,2]); b = ri(rng, -6, 6); c = ri(rng, -6, 6); }
        d = b*b - 4*a*c; n++; } while(!(want === 'gt' ? d > 0 : want === 'eq' ? d === 0 : d < 0) && n < 200);
      if(!(want === 'gt' ? d > 0 : want === 'eq' ? d === 0 : d < 0)){ a = 1; b = 2; c = want === 'gt' ? -3 : want === 'eq' ? 1 : 5; d = b*b - 4*a*c; }
      const opts = ['两个不相等的实数根','两个相等的实数根','没有实数根']; const right = d > 0 ? 0 : d === 0 ? 1 : 2;
      return {kind:'choice', prompt:R`方程 $${poly([a,b,c])}=0$ 的根的情况是？`, opts, right, params:{a,b,c},
        explain:R`$\Delta=${b<0?'('+b+')':b}^2-4\times${a}\times${c<0?'('+c+')':c}=${d}$，${d>0?'大于 0':d===0?'等于 0':'小于 0'}，所以${opts[right]}。`}; }},
    {id:'g_simp', def:'simplest', make(rng){ const k = ri(rng, 2, 5), m = +pick(rng, RT), n = k*k*m;
      const right = radTex(k, m); const cand = [radTex(m, k), radTex(k + 1, m), radTex(2*k, m), radTex(k, 2*m), radTex(k*k, m), '\\sqrt{' + n + '}'];
      const val = s => evalRad(s); const opts = [right]; for(const c of cand){ if(opts.length >= 4) break; if(!opts.includes(c) && Math.abs(val(c) - val(right)) > 1e-9) opts.push(c); }
      const sh = shuffle(rng, opts); return {kind:'choice', math:1, prompt:R`化简 $\sqrt{${n}}=$ ？`, opts:sh, right:sh.indexOf(right), params:{n},
        explain:R`$${n}=${k*k}\times${m}$，$\sqrt{${n}}=\sqrt{${k*k}}\times\sqrt{${m}}=${right}$`}; }},
    {id:'g_ration', def:'ration', make(rng){ const a = ri(rng, 1, 6), m = +pick(rng, RT); const right = fracRad(a, m, m);
      const cand = [fracRad(a, m, 1), fracRad(1, m, a), '\\dfrac{' + a + '}{' + m + '}', fracRad(a, m, 2*m), fracRad(m, m, a)].filter(Boolean);
      const opts = [right]; for(const c of cand){ if(opts.length >= 4) break; if(!opts.includes(c) && Math.abs(evalRad(c) - evalRad(right)) > 1e-9) opts.push(c); }
      const sh = shuffle(rng, opts); return {kind:'choice', math:1, prompt:R`分母有理化：$\dfrac{${a}}{\sqrt{${m}}}=$ ？`, opts:sh, right:sh.indexOf(right), params:{a, m},
        explain:(()=>{ const raw = R`\dfrac{${a===1?'':a}\sqrt{${m}}}{${m}}`; return R`分子分母同乘 $\sqrt{${m}}$：$${raw}${raw===right?'':'='+right}$`; })()}; }},
    {id:'g_expand', def:'sqsum', make(rng){ const p = (ri(rng, 1, 9)) * pick(rng, [1, -1]); const ask = pick(rng, ['mid', 'last']);
      const sq = R`(x${p > 0 ? '+' : ''}${p})^2`;
      return ask === 'mid' ? {kind:'num', prompt:R`用完全平方公式：$${sq}=x^2+\square x+${p*p}$，$\square=$ ？`, answer:String(2*p), params:{p, ask}, explain:R`中间项是首尾两倍：$2\times x\times(${p})=${2*p}x$`}
        : {kind:'num', prompt:R`用完全平方公式：$${sq}=x^2${2*p > 0 ? '+' : ''}${2*p}x+\square$，$\square=$ ？`, answer:String(p*p), params:{p, ask}, explain:R`尾平方：$(${p})^2=${p*p}$`}; }},
    {id:'g_sqrtabs', def:'sqrtabs', make(rng){ if(rng() < 0.5){ const a = -ri(rng, 2, 9); return {kind:'num', prompt:R`$\sqrt{(${a})^2}=$ ？`, answer:String(-a), params:{a}, explain:R`$\sqrt{a^2}=|a|$，$|${a}|=${-a}$（不是 $${a}$）`}; }
      const c = ri(rng, 1, 6); const opts = shuffle(rng, [c + '-x', 'x-' + c, '\\pm(x-' + c + ')', 'x+' + c]); const right = opts.indexOf(c + '-x');
      return {kind:'choice', math:1, prompt:R`当 $x<${c}$ 时，$\sqrt{(x-${c})^2}=$ ？`, opts, right, params:{c}, explain:R`$\sqrt{(x-${c})^2}=|x-${c}|$，而 $x-${c}<0$，所以等于 $-(x-${c})=${c}-x$`}; }},
    {id:'g_mul', def:'sqrtmul', make(rng){ const [a, b] = pick(rng, [[2,8],[3,12],[2,18],[5,20],[3,27],[2,32],[6,24],[7,28],[5,45],[8,18],[2,50],[3,48]]);
      return {kind:'num', prompt:R`$\sqrt{${a}}\times\sqrt{${b}}=$ ？`, answer:String(Math.round(Math.sqrt(a*b))), params:{a, b}, explain:R`$\sqrt a\cdot\sqrt b=\sqrt{ab}=\sqrt{${a*b}}=${Math.round(Math.sqrt(a*b))}$`}; }},
    {id:'g_factor', def:'factor', make(rng){ let r1 = ri(rng, -6, 6), r2 = ri(rng, -6, 6); if(r1 === r2) r2 = r1 + ri(rng, 1, 4);
      const big = Math.max(r1, r2), small = Math.min(r1, r2);
      return {kind:'num', prompt:R`解方程 $${poly([1, -(r1 + r2), r1*r2])}=0$，较大的根 $x=$ ？`, answer:String(big), params:{r1, r2},
        explain:R`因式分解：$${small===0?'x':'('+lin('x', small)+')'}${big===0?'x':'('+lin('x', big)+')'}=0$，所以 $x=${small}$ 或 $x=${big}$`}; }},
    {id:'g_complete', def:'complete', make(rng){ const h = ri(rng, 1, 6) * pick(rng, [1, -1]);
      return {kind:'num', prompt:R`配方：$x^2${2*h > 0 ? '+' : ''}${2*h}x+\square=(x${h > 0 ? '+' : ''}${h})^2$，$\square=$ ？`, answer:String(h*h), params:{h}, explain:R`加上一次项系数一半的平方：$\left(\dfrac{${2*h}}{2}\right)^2=${h*h}$`}; }},
    {id:'g_quaddef', def:'quaddef', make(rng){ const k = ri(rng, -5, 5), b = ri(rng, 1, 5), c = ri(rng, -5, 5) || 1;
      const lead = k === 0 ? 'mx^2' : '(' + lin('m', k) + ')x^2';
      return {kind:'num', prompt:R`若 $${lead}+${b}x${c > 0 ? '+' : ''}${c}=0$ 是关于 $x$ 的一元二次方程，则 $m\ne$ ？`, answer:String(k), params:{k}, explain:R`二次项系数不能为 0：$${k === 0 ? 'm' : lin('m', k)}\ne0$，所以 $m\ne${k}$`}; }},
    {id:'g_mean', def:'sqrtmean', make(rng){ const c = ri(rng, -5, 6) || 2;
      return {kind:'num', prompt:R`若 $\sqrt{${lin('x', c)}}$ 有意义，则 $x\ge$ ？`, answer:String(c), params:{c}, explain:R`被开方数非负：$${lin('x', c)}\ge0$，所以 $x\ge${c}$`}; }},
    {id:'g_sqdiff', def:'sqdiff', make(rng){ const p = ri(rng, 2, 9);
      return {kind:'num', prompt:R`$(x+${p})(x-${p})=x^2-\square$，$\square=$ ？`, answer:String(p*p), params:{p}, explain:R`平方差公式：$x^2-${p}^2=x^2-${p*p}$`}; }},
    {id:'g_qformula', def:'qformula', make(rng){ let r1 = ri(rng, -5, 6), r2 = ri(rng, -5, 6); if(r1 === r2) r2 = r1 + 2; const s = r1 + r2, p = r1*r2, d = s*s - 4*p;
      return {kind:'num', prompt:R`用求根公式解 $${poly([1, -s, p])}=0$：$x=\dfrac{${s}\pm\sqrt{\square}}{2}$，$\square=$ ？`, answer:String(d), params:{s, p},
        explain:R`$a=1$，$b=${-s}$，$c=${p}$，$b^2-4ac=${s*s}-${4*p < 0 ? '('+4*p+')' : 4*p}=${d}$`}; }}
  ];
  /* 小型求值器（只认 k√m、k√m/d、a/b、整数），用于生成干扰项与测试 */
  function evalRad(s){ s = String(s); let m;
    if((m = /^(-?\d*)\\sqrt\{(\d+)\}$/.exec(s))) return (m[1] === '' ? 1 : m[1] === '-' ? -1 : +m[1]) * Math.sqrt(+m[2]);
    if((m = /^\\dfrac\{(\d*)\\sqrt\{(\d+)\}\}\{(\d+)\}$/.exec(s))) return (m[1] === '' ? 1 : +m[1]) * Math.sqrt(+m[2]) / +m[3];
    if((m = /^\\dfrac\{(-?\d+)\}\{(\d+)\}$/.exec(s))) return +m[1] / +m[2];
    if(/^-?\d+$/.test(s)) return +s; return NaN; }
  /* ---------- 卡片 ↔ 定义 ---------- */
  const N = s => CR.normText(s), L = s => CR.normLatex(s);
  function defsForCard(c){ if(!c) return []; const n = N(c.name), l = L(c.latex); return DEFS.filter(d => d.names.some(x => N(x) === n) || (l && d.forms.some(f => L(f) === l))); }
  const defById = id => DEFS.find(d => d.id === id);
  function target(c, def){ const ds = c ? defsForCard(c) : [def]; const d = def || ds[0] || null;
    return {fid: d ? 'd:' + d.id : 'c:' + hashStr(c.key || c.name), def: d, defs: d ? (def ? [def] : ds) : [], card: c || null, name: d && !c ? d.name : c.name, latex: c && c.latex ? c.latex : (d ? d.forms[0] : ''), tip: d ? d.tip : ''}; }
  /* ---------- 题目生成 ---------- */
  function makeCloze(T, rng, avoid, valid){
    let src = null, full = null;
    if(T.def){ const list = T.defs.flatMap(d => d.cloze.map(t => ({t, d}))); const fresh = list.filter(x => !(avoid || []).includes(x.t)); const x = fresh.length ? pick(rng, fresh) : null; if(x){ src = x.t; T = Object.assign({}, T, {def: x.d}); } }
    else { src = autoCloze(T.latex, rng); if(src && valid && !valid(clozeLatex(src, [], [])) ) src = null; if(src && (avoid || []).includes(src)) src = null; }
    if(!src) return null; const P = parseCloze(src); full = P.full;
    return {type:'cloze', fid: T.fid, name: T.def ? T.def.name : T.name, card: cardRef(T), t: src, blanks: P.blanks.map(b => ({ans: b.ans, tiles: shuffle(rng, [b.ans, ...b.dis])})), full, tip: T.def ? T.def.tip : '', say: T.def ? fbSpeech(T.def) : '', auto: !T.def};
  }
  function cardRef(T){ return T.card ? {key: T.card.key, name: T.card.name, latex: T.card.latex} : T.def ? {key: 'd:' + T.def.id, name: T.def.name, latex: T.def.forms[0]} : null; }
  function makeTF(T, rng, avoid){ const ids = T.defs.map(d => d.id); const list = TF.filter(t => ids.includes(t.def) && !(avoid || []).includes(t.id)); if(!list.length) return null; const t = pick(rng, list.filter(x => x.hidden).length && rng() < 0.6 ? list.filter(x => x.hidden) : list); const d = defById(t.def);
    return {type:'tf', fid: 'd:' + d.id, name: d.name, card: cardRef(T), tfid: t.id, text: t.text, ans: t.ans, why: t.why, full: d.forms[0], tip: d.tip, say: t.say || t.text, fsay: fbSpeech(d)}; }
  function makeGen(T, rng, avoidGen){ const ids = T.defs.map(d => d.id); const list = GENS.filter(g => ids.includes(g.def)); if(!list.length) return null; const fresh = list.filter(g => g.id !== avoidGen); const g = pick(rng, fresh.length ? fresh : list); const d = defById(g.def);
    return Object.assign({type:'gen', gen: g.id, fid: 'd:' + d.id, name: d.name, card: cardRef(T), full: d.forms[0], tip: d.tip, fsay: fbSpeech(d)}, g.make(rng)); }
  function makeMatch(T, rng, pool, dir){
    const me = {name: T.def && !T.card ? T.def.name : T.name, latex: T.latex};
    const others = pool.filter(c => N(c.name) !== N(me.name) && L(c.latex) !== L(me.latex) && c.latex && c.latex.length < 90);
    const uniq = []; others.forEach(c => { if(!uniq.some(u => N(u.name) === N(c.name) || L(u.latex) === L(c.latex))) uniq.push(c); });
    if(uniq.length < 3) return null;
    const kps = T.card && T.card.kps ? [...T.card.kps] : [];
    const near = uniq.filter(c => c.kps && [...c.kps].some(k => kps.includes(k))), far = uniq.filter(c => !near.includes(c));
    const dis = shuffle(rng, near).slice(0, 2).concat(shuffle(rng, far)).slice(0, 3);
    if(dis.length < 3) dis.push(...shuffle(rng, near).filter(c => !dis.includes(c)).slice(0, 3 - dis.length));
    dir = dir || (rng() < 0.5 ? 'f2n' : 'n2f');
    const opts = shuffle(rng, [me, ...dis.slice(0, 3)]);
    return {type:'match', dir, fid: T.fid, name: me.name, card: cardRef(T), prompt: dir === 'f2n' ? me.latex : me.name, opts: opts.map(o => dir === 'f2n' ? o.name : o.latex), right: opts.indexOf(me), full: me.latex, tip: T.tip || '', say: T.def ? fbSpeech(T.def) : ''};
  }
  const fbSpeech = d => d.say + (d.tip ? '口诀：' + d.tip + '。' : '');
  /* 一组练习：o = {cards:[已按近期高频+薄弱排好的公式卡], sr, today, rng, single:card, n, valid(latex)} */
  function buildSession(o){
    const rng = o.rng || Math.random, n = o.n || 8, today = o.today, sr = o.sr || {}, cards = o.cards || [];
    const pool = cards.map(c => ({name: c.name, latex: c.latex, kps: c.kps})).concat(DEFS.filter(d => !cards.some(c => defsForCard(c).includes(d))).map(d => ({name: d.name, latex: d.forms[0], kps: new Set([d.kp])})));
    const items = [], seen = {cloze: [], tf: []};
    const push = it => { if(!it) return false; items.push(it); if(it.type === 'cloze') seen.cloze.push(it.t); if(it.type === 'tf') seen.tf.push(it.tfid); return true; };
    if(o.single){
      const T = target(o.single); const want = ['cloze', 'match', 'tf', 'cloze', 'gen', 'tf', 'gen', 'cloze'];
      for(const ty of want){ if(items.length >= 6) break; const it = ty === 'cloze' ? makeCloze(T, rng, seen.cloze, o.valid) : ty === 'tf' ? (T.def ? makeTF(T, rng, seen.tf) : null) : ty === 'gen' ? (T.def ? makeGen(T, rng, (items.filter(x => x.type === 'gen').pop() || {}).gen) : null) : makeMatch(T, rng, pool, items.some(x => x.type === 'match' && x.dir === 'f2n') ? 'n2f' : null);
        if(it && it.type === 'cloze' && items.some(x => x.type === 'cloze' && x.t === it.t)) continue; push(it); }
      if(items.length < 3){ const m2 = makeMatch(T, rng, pool, items.some(x => x.dir === 'f2n') ? 'n2f' : 'f2n'); push(m2); }
      return items;
    }
    // 目标公式：今日待记 → 近期高频/薄弱 → 其它手写定义
    const tg = [], has = f => tg.some(x => x.fid === f);
    const due = Object.keys(sr).filter(f => sr[f].due && sr[f].due <= today).sort((a, b) => sr[a].due.localeCompare(sr[b].due));
    due.forEach(f => { let T = null; if(f.startsWith('d:')){ const d = defById(f.slice(2)); if(!d) return; const c = cards.find(c => defsForCard(c).includes(d)); T = c ? target(c, d) : target(null, d); } else { const c = cards.find(c => 'c:' + hashStr(c.key || c.name) === f); if(c) T = target(c); } if(T && !has(T.fid) && tg.length < 4) tg.push(T); });
    const ranked = []; cards.forEach(c => { const T = target(c); if(!has(T.fid) && !ranked.some(x => x.fid === T.fid)) ranked.push(T); });
    DEFS.forEach(d => { const f = 'd:' + d.id; if(!has(f) && !ranked.some(x => x.fid === f)) ranked.push(target(null, d)); });
    const top = ranked.slice(0, 12); const want = Math.max(0, 5 - tg.length);
    for(let k = 0; k < want && top.length; k++){ // 越靠前越容易被选中
      const w = top.map((x, i) => 1 / (i + 1)), sum = w.reduce((a, b) => a + b, 0); let r = rng() * sum, i = 0; while(r > w[i] && i < w.length - 1){ r -= w[i]; i++; }
      tg.push(top.splice(i, 1)[0]); }
    const plan = ['cloze', 'tf', 'gen', 'cloze', 'match', 'gen', 'tf', 'cloze'].slice(0, n);
    while(plan.length < n) plan.push(pick(rng, ['cloze', 'tf', 'gen', 'match']));
    const used = new Map(tg.map(t => [t.fid, 0]));
    const backup = ranked.filter(t => t.def);
    for(const ty of plan){
      const order = tg.slice().sort((a, b) => used.get(a.fid) - used.get(b.fid));
      let it = null;
      for(const T of order){ it = ty === 'cloze' ? makeCloze(T, rng, seen.cloze, o.valid) : ty === 'tf' ? makeTF(T, rng, seen.tf) : ty === 'gen' ? makeGen(T, rng, (items.filter(x => x.type === 'gen').pop() || {}).gen) : makeMatch(T, rng, pool);
        if(it){ used.set(T.fid, used.get(T.fid) + 1); break; } }
      if(!it && (ty === 'tf' || ty === 'gen')){ for(const T of shuffle(rng, backup.slice(0, 15))){ it = ty === 'tf' ? makeTF(T, rng, seen.tf) : makeGen(T, rng, (items.filter(x => x.type === 'gen').pop() || {}).gen); if(it) break; } }
      if(!it){ for(const T of order){ it = makeCloze(T, rng, seen.cloze, o.valid) || makeMatch(T, rng, pool); if(it) break; } }
      push(it);
    }
    return items;
  }
  /* 答错的题：本组稍后再问一次（换一种挖法 / 换一组数） */
  function retryOf(it, rng, ctx){
    rng = rng || Math.random; let r = null;
    if(it.type === 'cloze'){ const d = DEFS.find(x => 'd:' + x.id === it.fid); const others = d ? d.cloze.filter(t => t !== it.t) : []; const t = others.length ? pick(rng, others) : it.t; const P = parseCloze(t); r = Object.assign({}, it, {t, full: P.full, blanks: P.blanks.map(b => ({ans: b.ans, tiles: shuffle(rng, [b.ans, ...b.dis])}))}); }
    else if(it.type === 'gen'){ const g = GENS.find(x => x.id === it.gen); r = Object.assign({}, it, g.make(rng)); }
    else if(it.type === 'match'){ const sh = shuffle(rng, it.opts.map((o, i) => ({o, ok: i === it.right}))); r = Object.assign({}, it, {opts: sh.map(x => x.o), right: sh.findIndex(x => x.ok)}); }
    else r = Object.assign({}, it);
    r.retry = true; return r;
  }
  /* ---------- 间隔复习（每个公式） ---------- */
  const INT = [1, 3, 7, 14, 30];
  function schedule(sr, fid, ok, today){
    const e = sr[fid] || {level: 0, n: 0, wrong: 0}; e.n++; e.last = today;
    if(ok){ e.level = Math.min(e.level + 1, INT.length); e.due = addDays(today, INT[e.level - 1]); }
    else { e.level = 0; e.wrong++; e.due = today; }
    sr[fid] = e; return e;
  }
  /* 一组内同一公式只按第一次结果升级；先错后对 → 明天再复习 */
  function record(sr, done, fid, ok, today){
    const st = done[fid];
    if(!st){ schedule(sr, fid, ok, today); done[fid] = ok ? 'ok' : 'wrong'; }
    else if(st === 'wrong' && ok){ sr[fid].due = addDays(today, 1); done[fid] = 'fixed'; }
    else if(st !== 'wrong' && !ok){ schedule(sr, fid, false, today); done[fid] = 'wrong'; }
    return sr[fid];
  }
  const dueList = (sr, today) => Object.keys(sr || {}).filter(f => sr[f].due && sr[f].due <= today);
  /* ---------- 积分：每题首答对 +2，每天最多 30 分 ---------- */
  const PTS = 2, CAP = 30;
  function grant(st, today, pts){ if(!st.pday || st.pday.date !== today) st.pday = {date: today, n: 0}; const g = Math.max(0, Math.min(pts, CAP - st.pday.n)); st.pday.n += g; return g; }
  function speechTexts(){ return DEFS.map(fbSpeech).concat(TF.map(t => t.say || t.text)); }
  return {DEFS, TF, GENS, parseCloze, clozeLatex, autoCloze, evalRad, poly, defsForCard, buildSession, retryOf, schedule, record, dueList, grant, addDays, mulberry, speechTexts, fbSpeech, hashStr, INT, PTS, CAP};
})();
if(typeof module !== 'undefined') module.exports = MQDrill;
