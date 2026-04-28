const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";
let cursorIndex = 0;
const MARKER = 'ᴥ'; // カーソル位置計算用の内部マーカー

// 表示用のTeX変換（順番を整理して衝突を防止）
// 表示用のTeX変換（指数表記の表示崩れを完全に修正）
// 表示用のTeX変換（πと虚数に対応）
function toTeX(expr) {
  let tex = expr
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ")
    .replace(/%/g, "\\% ")
    .replace(/π/g, "\\pi "); // πを綺麗なTeX記号に

  // √の中にマイナスや i、π が入っても屋根が伸びるように強化
  tex = tex.replace(/([\d.ᴥ]+)ⁿ√([\d.ᴥiπ]*)/g, "\\sqrt[$1]{$2}")
           .replace(/∛([\d.ᴥiπ]*)/g, "\\sqrt[3]{$1}")
           .replace(/√(-?[\d.ᴥiπ]*)/g, "\\sqrt{$1}");

  tex = tex.replace(/\^([\d.ᴥiπ]*)/g, "^{$1}");
  tex = tex.replace(/e\+?(-?[\dᴥ]+)/g, " \\times 10^{$1}");
  return tex;
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

// 計算エンジンの入れ替え
function calculate() {
  let expr = expression;
  if (/[+\-*/^√∛]$/.test(expr)) expr = expr.slice(0, -1);
  if (!expr) return;

  try {
    // 記号をmath.jsが理解できる形に翻訳
    let evalExpr = expr
      .replace(/([\d.]+)%/g, '($1/100)')
      .replace(/π/g, 'pi')
      .replace(/([\d.]+)ⁿ√([\d.i]+)/g, 'nthRoot($2, $1)')
      .replace(/∛([\d.i]+)/g, 'cbrt($1)')
      .replace(/√(-?[\d.i]+)/g, 'sqrt($1)'); // √-9 のようなマイナスも許容

    // 【魔法】JavaScript標準のevalではなく、math.jsのevaluateを使う！
    let result = math.evaluate(evalExpr);
    
    // 計算結果を文字列に変換（複素数も "3 + 4i" のように自動フォーマットされます）
    let resultStr = math.format(result, { precision: 12 });
    
    // 結果のスペースを詰める (例: "3 + 4i" -> "3+4i")
    resultStr = resultStr.replace(/ /g, '');

    const line = document.createElement("div");
    line.innerHTML = `$${toTeX(expr)} = ${toTeX(resultStr)}$`;
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
