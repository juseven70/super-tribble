const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";
let cursorIndex = 0;
const MARKER = 'ᴥ'; // カーソル位置計算用の内部マーカー

// ==========================================
// S⇔D (小数/記号) モードの切り替え
// ==========================================
let isExactMode = false; // デフォルトは小数モード

function toggleMode() {
  isExactMode = !isExactMode;
  const btn = document.getElementById("modeBtn");
  if (isExactMode) {
    btn.style.background = "#34c759"; // オン(記号モード)の時は緑色に光る
    btn.style.color = "#fff";
  } else {
    btn.style.background = "#d1d1d6"; // オフ(小数モード)の時は元のグレー
    btn.style.color = "#000";
  }
}

// ==========================================
// 【真・完全版】表示用のTeX変換（eの暴走バグを修正！）
// ==========================================
function toTeX(expr) {
  if (!expr) return "";

  let tex = expr;

  // 1. まず一番最初に「指数表記 (例: 1.2e+10)」の e を安全に変換する
  tex = tex.replace(/([\d.])e\+?(-?[\dᴥ]+)/g, "$1 \\times 10^{$2}");

  // 2. 次に、数学の変数や関数を変換する
  // （ここで先に e などを変換しておけば、後で作る \times の中の e が壊れません！）
  tex = tex.replace(/pi/g, "\\pi ")
           .replace(/π/g, "\\pi ")
           .replace(/e/g, "e ")
           .replace(/ln\(/g, "\\ln(")
           .replace(/log_\{10\}\(/g, "\\log_{10}(");

  // 3. その後で、計算記号をTeXの美しいコマンドに変換する
  tex = tex.replace(/\*/g, "\\times ")
           .replace(/\//g, "\\div ")
           .replace(/%/g, "\\% ");

  // 4. ルート・累乗の変換
  tex = tex.replace(/([\d.ᴥ]+)ⁿ√([\d.ᴥijkπe ]*)/g, "\\sqrt[$1]{$2}")
           .replace(/∛(-?[\d.ᴥijkπe ]*)/g, "\\sqrt[3]{$1}")
           .replace(/√(-?[\d.ᴥijkπe ]*)/g, "\\sqrt{$1}");
  tex = tex.replace(/\^([\d.ᴥijkπe ]*)/g, "^{$1}");
  
  // 5. 【掛け算記号の賢い隠しロジック】
  // ※数字同士 (7×6) は隠さず、数字と文字 (2π) の間だけ綺麗に隠します
  tex = tex.replace(/(\d)\s*\\times\s*([a-z\\]|\()/g, "$1$2");
  tex = tex.replace(/([a-z\)])\s*\\times\s*([\d\\a-z]|\()/g, "$1$2");

  return tex;
}

// 記号モード用に計算結果の文字列を整える
function formatExact(str) {
  return str.replace(/ /g, '').replace(/\*/g, '×').replace(/pi/g, 'π').replace(/sqrt\(/g, '√(');
}

// ==========================================
// 【自作】四元数 (Quaternion) コンパイラ＆エンジン
// ==========================================
// ==========================================
// 【自作】四元数 (Quaternion) エンジン (Nerdamer統合版)
// ==========================================
class Q {
  constructor(w, x, y, z) {
    // 全ての係数をnerdamerオブジェクトとして保持（文字列として受け取ってパース）
    this.w = nerdamer(String(w || 0));
    this.x = nerdamer(String(x || 0));
    this.y = nerdamer(String(y || 0));
    this.z = nerdamer(String(z || 0));
  }
  add(q) { 
    return new Q(this.w.add(q.w), this.x.add(q.x), this.y.add(q.y), this.z.add(q.z)); 
  }
  sub(q) { 
    return new Q(this.w.subtract(q.w), this.x.subtract(q.x), this.y.subtract(q.y), this.z.subtract(q.z)); 
  }
  mul(q) {
    // 四元数の乗算（ハミルトン積）をnerdamerの数式として定義
    return new Q(
      this.w.multiply(q.w).subtract(this.x.multiply(q.x)).subtract(this.y.multiply(q.y)).subtract(this.z.multiply(q.z)),
      this.w.multiply(q.x).add(this.x.multiply(q.w)).add(this.y.multiply(q.z)).subtract(this.z.multiply(q.y)),
      this.w.multiply(q.y).subtract(this.x.multiply(q.z)).add(this.y.multiply(q.w)).add(this.z.multiply(q.x)),
      this.w.multiply(q.z).add(this.x.multiply(q.y)).subtract(this.y.multiply(q.x)).add(this.z.multiply(q.w))
    );
  }
  // ※div, ln, exp等は、現状Nerdamerでの厳密解保持が複雑なため、必要に応じて後ほど拡張
  div(s) { // スカラー除算のみ簡易実装
    let divisor = nerdamer(String(s.w || s));
    return new Q(this.w.divide(divisor), this.x.divide(divisor), this.y.divide(divisor), this.z.divide(divisor));
  }
}

// 構文解析器 (Tokenizer & RPN Evaluator)
function tokenize(expr) {
  let tokens = [], i = 0, lastType = null;
  function addMul() {
    if (!lastType) return;
    if (lastType==='NUM' || lastType==='VAR' || lastType==='RPAREN') tokens.push({type:'OP', val:'*'});
  }
  while(i < expr.length) {
    let char = expr[i];
    if (char === ' ' || char === 'ᴥ') { i++; continue; }
    if (/[0-9.]/.test(char)) {
      addMul();
      let num = '';
      while(i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push({type:'NUM', val: parseFloat(num)});
      lastType = 'NUM'; continue;
    }
    if (expr.slice(i).startsWith('log_{10}')) { addMul(); tokens.push({type:'FN', val:'log_{10}'}); i+=8; lastType='FN'; continue; }
    if (expr.slice(i).startsWith('ln')) { addMul(); tokens.push({type:'FN', val:'ln'}); i+=2; lastType='FN'; continue; }
    if (expr.slice(i).startsWith('ⁿ√')) { tokens.push({type:'OP', val:'ⁿ√'}); i+=2; lastType='OP'; continue; }
    if (char==='√' || char==='∛') { addMul(); tokens.push({type:'FN', val:char}); i++; lastType='FN'; continue; }
    if (/[ijkπe]/.test(char)) {
      addMul();
      tokens.push({type:'VAR', val: char === 'π' ? 'pi' : char});
      lastType = 'VAR'; i++; continue;
    }
    if (/[+\-*/^]/.test(char)) {
      if (char === '-' && (!lastType || lastType==='LPAREN' || lastType==='OP')) tokens.push({type:'UNARY', val:'-'});
      else if (char !== '+') tokens.push({type:'OP', val:char});
      lastType = 'OP'; i++; continue;
    }
    if (char === '(') { addMul(); tokens.push({type:'LPAREN', val:'('}); lastType = 'LPAREN'; i++; continue; }
    if (char === ')') { tokens.push({type:'RPAREN', val:')'}); lastType = 'RPAREN'; i++; continue; }
    i++;
  }
  return tokens;
}

function evaluateQ(expr) {
  let tokens = tokenize(expr);
  let output = [], stack = [];
  const prec = {'+':1, '-':1, '*':2, '/':2, 'ⁿ√':3, '^':4, 'UNARY':5};
  for(let t of tokens) {
    if(t.type==='NUM') evalStack.push(new Q(t.val.toString(),0,0,0));
    else if(t.type==='VAR') {
      if(t.val==='i') evalStack.push(new Q(0,1,0,0));
      else if(t.val==='j') evalStack.push(new Q(0,0,1,0));
      else if(t.val==='k') evalStack.push(new Q(0,0,0,1));
      else if(t.val==='e') evalStack.push(new Q('e',0,0,0));
      else if(t.val==='pi') evalStack.push(new Q('pi',0,0,0));
    }
    else if(t.type==='RPAREN') {
      while(stack.length && stack[stack.length-1].type!=='LPAREN') output.push(stack.pop());
      stack.pop();
      if(stack.length && stack[stack.length-1].type==='FN') output.push(stack.pop());
    }
  }
  while(stack.length) output.push(stack.pop());
  
  let evalStack = [];
  for(let t of output) {
    if(t.type==='NUM') evalStack.push(new Q(t.val,0,0,0));
    else if(t.type==='VAR') {
      if(t.val==='i') evalStack.push(new Q(0,1,0,0));
      else if(t.val==='j') evalStack.push(new Q(0,0,1,0));
      else if(t.val==='k') evalStack.push(new Q(0,0,0,1));
      else if(t.val==='e') evalStack.push(new Q(Math.E,0,0,0));
      else if(t.val==='pi') evalStack.push(new Q(Math.PI,0,0,0));
    }
    else if(t.type==='UNARY') { let a = evalStack.pop(); evalStack.push(new Q(-a.w, -a.x, -a.y, -a.z)); }
    else if(t.type==='FN') {
      let a = evalStack.pop();
      if(t.val==='√') evalStack.push(a.pow(new Q(0.5)));
      if(t.val==='∛') evalStack.push(a.pow(new Q(1/3)));
      if(t.val==='ln') evalStack.push(a.ln());
      if(t.val==='log_{10}') evalStack.push(a.ln().div(new Q(Math.LN10)));
    }
    else if(t.type==='OP') {
      let b = evalStack.pop(), a = evalStack.pop();
      if(t.val==='+') evalStack.push(a.add(b));
      if(t.val==='-') evalStack.push(a.sub(b));
      if(t.val==='*') evalStack.push(a.mul(b)); // ←ココ！四元数の非可換乗算が走る！
      if(t.val==='/') evalStack.push(a.div(b));
      if(t.val==='^') evalStack.push(a.pow(b));
      if(t.val==='ⁿ√') evalStack.push(b.pow(new Q(1).div(a)));
    }
  }
  return evalStack[0];
}

function formatQ(q) {
  // S/Dモードに応じて、1つの係数をどう文字列化するか決める関数
  function formatCoeff(n) {
    if (isExactMode) {
      return n.toTeX(); // Sモード: 分数やルートのTeX形式
    } else {
      // Dモード: 小数評価（精度12桁）
      let num = parseFloat(n.evaluate().text());
      return parseFloat(num.toPrecision(12)).toString();
    }
  }

  let wv = formatCoeff(q.w), xv = formatCoeff(q.x), yv = formatCoeff(q.y), zv = formatCoeff(q.z);
  let p = [];

  // 実部wの処理（wが0でない、または全てが0の時）
  if (wv !== "0" || (xv === "0" && yv === "0" && zv === "0")) p.push(wv);

  function fmt(val, sym) {
    if (val === "0") return null;
    let sign = val.startsWith('-') ? "-" : "+";
    let absVal = val.startsWith('-') ? val.substring(1) : val;
    // 係数が1の時は表示を省略（例: 1i → i）
    let displayVal = (absVal === "1") ? "" : absVal;
    return { sign: sign, str: displayVal + sym };
  }

  let terms = [fmt(xv, 'i'), fmt(yv, 'j'), fmt(zv, 'k')].filter(t => t);
  let res = p.length > 0 ? p[0] : "";

  for (let t of terms) {
    if (res === "") res = (t.sign === "-" ? "-" : "") + t.str;
    else res += t.sign + t.str;
  }
  return res || "0";
} 

// ==========================================
// 計算実行（内部データと見た目を完全に分離）
// ==========================================
function calculate() {
  let expr = expression;
  if (/[+\-*/^√∛]$/.test(expr)) expr = expr.slice(0, -1);
  if (!expr) return;

  try {
    let resultStr = ""; // 次の計算に使う用（2*pi）
    let texResult = ""; // 履歴に表示する用（2\pi）
    
    if (expr.includes('j') || expr.includes('k')) {
      let q = evaluateQ(expr);
      resultStr = formatQ(q).replace(/ /g, '').replace(/×/g, '*'); // 内部用に戻す
      texResult = toTeX(resultStr);
    } 
    else if (isExactMode) {
      let nExpr = expr
        .replace(/([\d.]+)%/g, '($1/100)')
        .replace(/π/g, 'pi')
        .replace(/([\d.]+)ⁿ√([\d.ie]+)/g, '($2)^(1/$1)')
        .replace(/∛(-?[\d.ie]+)/g, '($1)^(1/3)')
        .replace(/√(-?[\d.ie]+)/g, 'sqrt($1)')
        .replace(/ln\(/g, 'log(')
        .replace(/log_\{10\}\(/g, 'log10(');

      let nResult = nerdamer(nExpr);
      
      // 【重要】resultStrは「次も計算できる形式(2*pi)」で保存する
      resultStr = nResult.toString(); 
      // texResultはNerdamerの綺麗なTeXを使う
      texResult = nResult.toTeX();
    } 
    else {
      let evalExpr = expr
        .replace(/([\d.]+)%/g, '($1/100)')
        .replace(/π/g, 'pi')
        .replace(/([\d.]+)ⁿ√([\d.ie]+)/g, 'nthRoot($2, $1)')
        .replace(/∛(-?[\d.ie]+)/g, 'cbrt($1)')
        .replace(/√(-?[\d.ie]+)/g, 'sqrt($1)')
        .replace(/ln\(/g, 'log(')
        .replace(/log_\{10\}\(/g, 'log10(');

      let result = math.evaluate(evalExpr);
      resultStr = math.format(result, { precision: 12 }).replace(/ /g, '');
      texResult = toTeX(resultStr);
    }

  
    const line = document.createElement("div");
    line.innerHTML = `$${toTeX(expr)} = ${texResult}$`;
    
    if (window.MathJax) {
      mathjaxQueue = mathjaxQueue.then(() => {
        return MathJax.typesetPromise([line]).then(() => {
          history.appendChild(line);
          history.scrollTop = history.scrollHeight; // ついでに履歴を一番下まで自動スクロール！
        });
      });
    } else {
      history.appendChild(line);
    }

    // 次の入力用に resultStr (2*pi形式) をセット
    expression = resultStr;
    cursorIndex = expression.length;
    renderDisplay();
  } catch(e) {
    console.log(e);
    expression = "Error";
    cursorIndex = 0;
    renderDisplay();
  }
}

// +/-ボタンの強化（ i や π の符号も反転できるように）
function toggleSign() {
  const before = expression.slice(0, cursorIndex);
  const after = expression.slice(cursorIndex);
  const match = before.match(/(^|[+\-*/])(-?)([\d.]*i?|π)$/);
  if (match) {
    const minus = match[2];
    const num = match[3];
    if (!num && minus === "") return;
    const prefix = before.slice(0, before.length - (minus.length + num.length));
    if (minus === "-") {
      expression = prefix + num + after;
      cursorIndex--;
    } else {
      expression = prefix + "-" + num + after;
      cursorIndex++;
    }
    renderDisplay();
  }
}


// 画面描画
function renderDisplay() {
  const exprWithCursor = expression.slice(0, cursorIndex) + MARKER + expression.slice(cursorIndex);
  let tex = toTeX(exprWithCursor);

  // --- 修正ポイント：\kern を使ってカーソルの幅を完全に打ち消す ---
  // 左右に -0.15em（文字サイズの15%分マイナス）の隙間を設定し、幅をゼロにします。
  // （もし削りすぎたり足りなかったりした場合は、0.15 の数値を調整できます）
  tex = tex.replace(MARKER, '\\kern-0.15em{\\color{#007aff}{|}}\\kern-0.15em');

  display.innerHTML = `<span>$${tex}$</span>`;

  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([display]).catch(err => console.log(err));
  }
}

function insert(value) {
  expression = expression.slice(0, cursorIndex) + value + expression.slice(cursorIndex);
  cursorIndex += value.length;
  renderDisplay();
}

function deleteOne() {
  if (cursorIndex > 0) {
    const before = expression.slice(0, cursorIndex);
    const after = expression.slice(cursorIndex);
    if (before.endsWith('ⁿ√')) {
        expression = before.slice(0, -2) + after;
        cursorIndex -= 2;
    } else {
        expression = before.slice(0, -1) + after;
        cursorIndex--;
    }
    renderDisplay();
  }
}

function moveCursor(direction) {
  if (direction === 'left' && cursorIndex > 0) {
    cursorIndex--;
  } else if (direction === 'right' && cursorIndex < expression.length) {
    cursorIndex++;
  }
  renderDisplay();
}

function clearAll() {
  expression = "";
  cursorIndex = 0;
  renderDisplay();
}

function operator(op) {
  if (expression.length === 0 && op !== '-') return;
  const lastChar = expression[cursorIndex - 1];
  if (/[+\-*/]/.test(lastChar)) {
    expression = expression.slice(0, cursorIndex - 1) + op + expression.slice(cursorIndex);
  } else {
    insert(op);
  }
  renderDisplay();
}

function appendDot() {
  const parts = expression.slice(0, cursorIndex).split(/[+\-*/^√∛ⁿ]/);
  if (parts[parts.length - 1].includes(".")) return;
  insert(".");
}

function insertPercent() {
  if (/[\d.]$/.test(expression.slice(0, cursorIndex))) insert('%');
}

// 括弧を出力し、カーソルを内側に移動させる魔法
function insertParens() {
  expression = expression.slice(0, cursorIndex) + "()" + expression.slice(cursorIndex);
  cursorIndex += 1; // 1文字分だけ右に進む（＝括弧の内側に入る）
  renderDisplay();
}

// キーボード & かな入力対応（'e' を追加）
document.addEventListener('keydown', function(e) {
  let k = e.key;
  // 全角英数を半角に変換する処理に 'ｅ' (全角のe) を追加
  k = k.replace(/[０-９．＋－＊／＝％ｉｐｅ（）]/g, s => String.fromCharCode(s.charCodeAt(0)-0xFEE0));
  const map = {'ー':'-','−':'-','×':'*','÷':'/','。':'.','、':'.','・':'/'};
  if (map[k]) k = map[k];

  if (/^[0-9]$/.test(k)) insert(k);
  else if (/[+\-*/^]/.test(k)) operator(k);
  else if (k === '(' || k === ')') insert(k);
  else if (k === '.') appendDot();
  else if (k === 'Enter' || k === '=') { e.preventDefault(); calculate(); }
  else if (k === 'Backspace') deleteOne();
  else if (k === 'Escape') clearAll();
  else if (k === '%') insertPercent();
  else if (k === 'ArrowLeft') moveCursor('left');
  else if (k === 'ArrowRight') moveCursor('right');
  else if (k === 'i') insert('i'); 
  else if (k === 'j') insert('j'); // 追加！
  else if (k === 'k') insert('k'); // 追加！
  else if (k === 'p') insert('π'); 
  else if (k === 'e') insert('e'); 
});
