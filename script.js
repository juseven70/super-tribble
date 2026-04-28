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
// 計算結果のTeX表示を美しくする処理を追加
// ==========================================
function toTeX(expr) {
  let tex = expr
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ")
    .replace(/%/g, "\\% ")
    .replace(/π/g, "\\pi ")
    .replace(/e/g, "e ")
    .replace(/ln\(/g, "\\ln(")
    .replace(/log_\{10\}\(/g, "\\log_{10}(");

  tex = tex.replace(/([\d.ᴥ]+)ⁿ√([\d.ᴥiπe]*)/g, "\\sqrt[$1]{$2}")
           .replace(/∛(-?[\d.ᴥiπe]*)/g, "\\sqrt[3]{$1}")
           .replace(/√(-?[\d.ᴥiπe]*)/g, "\\sqrt{$1}");

  tex = tex.replace(/\^([\d.ᴥiπe]*)/g, "^{$1}");
  tex = tex.replace(/([\d.])e\+?(-?[\dᴥ]+)/g, "$1 \\times 10^{$2}");

  // 【追加】2×π などを 2π と表示して美しくする魔法
  tex = tex.replace(/\\times\s*\\pi/g, "\\pi ")
           .replace(/\\times\s*e/g, "e ")
           .replace(/\\times\s*\\sqrt/g, "\\sqrt");

  return tex;
}

// 記号モード用に計算結果の文字列を整える
function formatExact(str) {
  return str.replace(/ /g, '').replace(/\*/g, '×').replace(/pi/g, 'π').replace(/sqrt\(/g, '√(');
}

// ==========================================
// 【自作】四元数 (Quaternion) コンパイラ＆エンジン
// ==========================================
class Q {
  constructor(w, x, y, z) { this.w=w||0; this.x=x||0; this.y=y||0; this.z=z||0; }
  add(q) { return new Q(this.w+q.w, this.x+q.x, this.y+q.y, this.z+q.z); }
  sub(q) { return new Q(this.w-q.w, this.x-q.x, this.y-q.y, this.z-q.z); }
  mul(q) {
    return new Q(
      this.w*q.w - this.x*q.x - this.y*q.y - this.z*q.z,
      this.w*q.x + this.x*q.w + this.y*q.z - this.z*q.y,
      this.w*q.y - this.x*q.z + this.y*q.w + this.z*q.x,
      this.w*q.z + this.x*q.y - this.y*q.x + this.z*q.w
    );
  }
  div(q) {
    let n = q.w*q.w + q.x*q.x + q.y*q.y + q.z*q.z;
    if(n === 0) throw "Div by 0";
    return this.mul(new Q(q.w/n, -q.x/n, -q.y/n, -q.z/n));
  }
  norm() { return Math.sqrt(this.w*this.w + this.x*this.x + this.y*this.y + this.z*this.z); }
  vNorm() { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); }
  ln() {
    let n = this.norm(), vn = this.vNorm();
    if(vn === 0) return new Q(Math.log(n), 0,0,0);
    let angle = Math.acos(this.w / n);
    return new Q(Math.log(n), this.x/vn*angle, this.y/vn*angle, this.z/vn*angle);
  }
  exp() {
    let vn = this.vNorm(), expW = Math.exp(this.w);
    if(vn === 0) return new Q(expW, 0,0,0);
    let cosV = Math.cos(vn), sinV = Math.sin(vn);
    return new Q(expW*cosV, expW*this.x/vn*sinV, expW*this.y/vn*sinV, expW*this.z/vn*sinV);
  }
  pow(q) {
    if(this.norm() === 0) return new Q(0,0,0,0);
    return this.ln().mul(q).exp(); // a^b = exp(ln(a)*b)
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
    if(t.type==='NUM' || t.type==='VAR') output.push(t);
    else if(t.type==='FN' || t.type==='UNARY' || t.type==='LPAREN') stack.push(t);
    else if(t.type==='OP') {
      while(stack.length && stack[stack.length-1].type!=='LPAREN') {
        let top = stack[stack.length-1];
        if(top.type==='FN' || top.type==='UNARY' || prec[top.val] > prec[t.val] || (prec[top.val]===prec[t.val] && t.val!=='^')) output.push(stack.pop());
        else break;
      }
      stack.push(t);
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
  let p = [];
  let w = Math.abs(q.w)<1e-10 ? 0 : q.w, x = Math.abs(q.x)<1e-10 ? 0 : q.x;
  let y = Math.abs(q.y)<1e-10 ? 0 : q.y, z = Math.abs(q.z)<1e-10 ? 0 : q.z;
  
  if (w !== 0 || (x===0 && y===0 && z===0)) p.push(parseFloat(w.toPrecision(12)).toString());
  
  function fmt(val, sym) {
    if (val === 0) return null;
    let num = Math.abs(val) === 1 ? "" : parseFloat(Math.abs(val).toPrecision(12)).toString();
    return { sign: val > 0 ? "+" : "-", str: num + sym };
  }
  
  let terms = [fmt(x,'i'), fmt(y,'j'), fmt(z,'k')].filter(t => t);
  let res = p.length > 0 ? p[0] : "";
  
  for(let t of terms) {
    if (res === "") res = (t.sign === "-" ? "-" : "") + t.str;
    else res += t.sign + t.str;
  }
  return res || "0";
}

// ==========================================
// 【分岐】計算実行（三段構えのハイブリッドエンジン）
// ==========================================
function calculate() {
  let expr = expression;
  if (/[+\-*/^√∛]$/.test(expr)) expr = expr.slice(0, -1);
  if (!expr) return;

  try {
    let resultStr = "";
    let texResult = "";
    
    // ① 式に j または k が含まれている場合は「自作の四元数エンジン」
    if (expr.includes('j') || expr.includes('k')) {
      let q = evaluateQ(expr);
      resultStr = formatQ(q);
      texResult = toTeX(resultStr);
    } 
    // ② S⇔D（記号モード）がオンの場合は「Nerdamer」で代数計算！
    else if (isExactMode) {
      // Nerdamerが理解できる形に翻訳
      let nExpr = expr
        .replace(/([\d.]+)%/g, '($1/100)')
        .replace(/π/g, 'pi')
        .replace(/([\d.]+)ⁿ√([\d.ie]+)/g, '($2)^(1/$1)')
        .replace(/∛(-?[\d.ie]+)/g, '($1)^(1/3)')
        .replace(/√(-?[\d.ie]+)/g, 'sqrt($1)')
        .replace(/ln\(/g, 'log(')
        .replace(/log_\{10\}\(/g, 'log10(');

      try {
        let nResult = nerdamer(nExpr);
        // 代数的に解いた結果の「美しいTeX表現（分数やルート）」を直接取得！
        texResult = nResult.toTeX(); 
        
        // 次の計算に使うために、文字列を電卓の表示に戻す (例: 2*sqrt(2) -> 2×√2 )
        resultStr = nResult.toString()
          .replace(/\*/g, '×')
          .replace(/sqrt\(([^)]+)\)/g, '√$1')
          .replace(/pi/g, 'π');
      } catch (e) {
        // 対数などでNerdamerが処理しきれない特殊な場合は小数モードへ逃がす
        let evalExpr = nExpr.replace(/nthRoot/g, 'sqrt'); // 簡易退避
        let result = math.evaluate(evalExpr);
        resultStr = math.format(result, { precision: 12 }).replace(/ /g, '');
        texResult = toTeX(resultStr);
      }
    } 
    // ③ オフ（小数モード）の場合はこれまで通り「math.js」で数値計算
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

    // 履歴に計算結果を出力
    const line = document.createElement("div");
    line.innerHTML = `$${toTeX(expr)} = ${texResult}$`;
    history.appendChild(line);
    if (window.MathJax) MathJax.typesetPromise([line]);

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


// キーボード & かな入力対応（一番下にあるやつです。i と p を追加）
document.addEventListener('keydown', function(e) {
  let k = e.key;
  k = k.replace(/[０-９．＋－＊／＝％ｉｐ]/g, s => String.fromCharCode(s.charCodeAt(0)-0xFEE0));
  const map = {'ー':'-','−':'-','×':'*','÷':'/','。':'.','、':'.','・':'/'};
  if (map[k]) k = map[k];

  if (/^[0-9]$/.test(k)) insert(k);
  else if (/[+\-*/^]/.test(k)) operator(k);
  else if (k === '.') appendDot();
  else if (k === 'Enter' || k === '=') { e.preventDefault(); calculate(); }
  else if (k === 'Backspace') deleteOne();
  else if (k === 'Escape') clearAll();
  else if (k === '%') insertPercent();
  else if (k === 'ArrowLeft') moveCursor('left');
  else if (k === 'ArrowRight') moveCursor('right');
  else if (k === 'i') insert('i'); // キーボードの i で虚数
  else if (k === 'p') insert('π'); // キーボードの p で円周率
});

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
