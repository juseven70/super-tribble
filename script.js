const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";
let cursorIndex = 0;
const MARKER = 'ᴥ'; // カーソル位置計算用の内部マーカー

// 表示用のTeX変換（順番を整理して衝突を防止）
// 表示用のTeX変換（指数表記の表示崩れを完全に修正）
function toTeX(expr) {
  let tex = expr
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ")
    .replace(/%/g, "\\% ");

  // 1. ルート系を先に変換
  tex = tex.replace(/([\d.ᴥ]+)ⁿ√([\d.ᴥ]*)/g, "\\sqrt[$1]{$2}")
           .replace(/∛([\d.ᴥ]*)/g, "\\sqrt[3]{$1}")
           .replace(/√([\d.ᴥ]*)/g, "\\sqrt{$1}");

  // 2. べき乗 (^) を変換
  tex = tex.replace(/\^([\d.ᴥ]*)/g, "^{$1}");

  // 3. 【重要修正】指数表記 (e+99) を 10^{99} に変換
  // ^ を付け忘れていたのを修正し、カーソルマーカー(ᴥ)が含まれていても反応するようにしました
  tex = tex.replace(/e\+?(-?[\dᴥ]+)/g, " \\times 10^{$1}");

  return tex;
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

function toggleSign() {
  const before = expression.slice(0, cursorIndex);
  const after = expression.slice(cursorIndex);
  const match = before.match(/(^|[+\-*/])(-?)([\d.]+)$/);
  if (match) {
    const minus = match[2];
    const num = match[3];
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

function calculate() {
  let expr = expression;
  if (/[+\-*/^√∛]$/.test(expr)) expr = expr.slice(0, -1);
  if (!expr) return;

  try {
    let evalExpr = expr
      .replace(/([\d.]+)%/g, '($1/100)')
      .replace(/([\d.]+)ⁿ√([\d.]+)/g, 'Math.pow($2, 1/$1)')
      .replace(/∛([\d.]+)/g, 'Math.cbrt($1)')
      .replace(/√([\d.]+)/g, 'Math.sqrt($1)')
      .replace(/\^/g, '**');
    
    let result = eval(evalExpr);
    result = parseFloat(result.toPrecision(12));

    const line = document.createElement("div");
    line.innerHTML = `$${toTeX(expr)} = ${toTeX(String(result))}$`;
    history.appendChild(line);
    if (window.MathJax) MathJax.typesetPromise([line]);

    expression = String(result);
    cursorIndex = expression.length;
    renderDisplay();
  } catch {
    expression = "Error";
    cursorIndex = 0;
    renderDisplay();
  }
}

// キーボード & かな入力対応
document.addEventListener('keydown', function(e) {
  let k = e.key;
  k = k.replace(/[０-９．＋－＊／＝％]/g, s => String.fromCharCode(s.charCodeAt(0)-0xFEE0));
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
});

renderDisplay();
