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
// 計算実行 (モードに応じて処理を分岐)
// ==========================================
function calculate() {
  let expr = expression;
  if (/[+\-*/^√∛]$/.test(expr)) expr = expr.slice(0, -1);
  if (!expr) return;

  try {
    let evalExpr = expr
      .replace(/([\d.]+)%/g, '($1/100)')
      .replace(/π/g, 'pi')
      .replace(/([\d.]+)ⁿ√([\d.ie]+)/g, 'nthRoot($2, $1)')
      .replace(/∛(-?[\d.ie]+)/g, 'cbrt($1)')
      .replace(/√(-?[\d.ie]+)/g, 'sqrt($1)')
      .replace(/ln\(/g, 'log(')
      .replace(/log_\{10\}\(/g, 'log10(');

    let resultStr = "";

    if (isExactMode) {
      // 【記号モード】math.simplify を使って代数的に整理する
      try {
        let simplified = math.simplify(evalExpr);
        resultStr = formatExact(simplified.toString());
      } catch (e) {
        // 対数など simplify で整理しきれないものは小数で出す
        resultStr = math.format(math.evaluate(evalExpr), { precision: 12 }).replace(/ /g, '');
      }
    } else {
      // 【小数モード】これまで通り強制的に数値計算する
      let result = math.evaluate(evalExpr);
      resultStr = math.format(result, { precision: 12 }).replace(/ /g, '');
    }

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
  else if (k === 'p') insert('π'); 
  else if (k === 'e') insert('e'); // キーボードの e でネイピア数
});
