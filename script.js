const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";
let cursorIndex = 0;

// カーソル位置を特定するための見えないマーカー
const MARKER = 'ᴥ';

function toTeX(expr) {
  return expr
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ")
    .replace(/%/g, "\\% ")
    // n乗根 (例: 3ⁿ√8)
    .replace(/([\d.ᴥ]+)ⁿ√([\d.ᴥ]*)/g, "\\sqrt[$1]{$2}")
    // 3乗根
    .replace(/∛([\d.ᴥ]*)/g, "\\sqrt[3]{$1}")
    // ルート
    .replace(/√([\d.ᴥ]*)/g, "\\sqrt{$1}")
    // べき乗 (例: ^2, ^3, ^y)
    .replace(/\^([\d.ᴥ]*)/g, "^{$1}");
}

function renderDisplay() {
  // 数式の中にカーソルマーカーを埋め込んでからTeXに一括変換する（屋根が途切れない魔法）
  const exprWithCursor = expression.slice(0, cursorIndex) + MARKER + expression.slice(cursorIndex);
  let tex = toTeX(exprWithCursor);

  // マーカーを「青色の太い縦線」のTeXコマンドに置換
  tex = tex.replace(MARKER, '{\\color{#007aff}{\\mathbf{|}}}');

  display.innerHTML = `<span>$${tex}$</span>`;

  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([display]).catch((err) => console.log("MathJax error:", err));
  }
}

function calculate() {
  let expr = expression;
  if (/[+\-*/^√∛]$/.test(expr)) expr = expr.slice(0, -1);
  if (!expr) return;

  try {
    // 記号をJavaScriptのMath関数に翻訳して計算する
    let evalExpr = expr
      .replace(/([\d.]+)%/g, '($1/100)')
      .replace(/([\d.]+)ⁿ√([\d.]+)/g, 'Math.pow($2, 1/$1)') // 3ⁿ√8 -> 8の(1/3)乗
      .replace(/∛([\d.]+)/g, 'Math.cbrt($1)')               // 3乗根
      .replace(/√([\d.]+)/g, 'Math.sqrt($1)')               // ルート
      .replace(/\^/g, '**');                                // べき乗 (2^3 -> 2**3)
    
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

/* ===== 入力操作 ===== */
function insert(value) {
  expression = expression.slice(0, cursorIndex) + value + expression.slice(cursorIndex);
  cursorIndex += value.length;
  renderDisplay();
}

function deleteOne() {
  if (cursorIndex > 0) {
    expression = expression.slice(0, cursorIndex - 1) + expression.slice(cursorIndex);
    cursorIndex--;
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
  // history.innerHTML = "";  ← この1行を削除（または先頭に//をつけて無効化）します
  renderDisplay();
}

/* ===== 演算子・小数点 ===== */
function operator(op) {
  if (expression.length === 0 && op !== '-') return;
  const lastChar = expression[cursorIndex - 1];
  if (/[+\-*/]/.test(lastChar)) {
    expression = expression.slice(0, cursorIndex - 1) + op + expression.slice(cursorIndex);
  } else {
    insert(op);
    return;
  }
  renderDisplay();
}

// %ボタンの処理（直前が数字の時だけ入力可能）
function insertPercent() {
  const beforeText = expression.slice(0, cursorIndex);
  if (/[\d.]$/.test(beforeText)) {
    insert('%');
  }
}

// +/- ボタンの処理（カーソル直前の数字の符号を反転させる）
function toggleSign() {
  const beforeText = expression.slice(0, cursorIndex);
  const afterText = expression.slice(cursorIndex);
  
  // カーソル直前の「数字（マイナスが付いている場合も含む）」を探す
  const match = beforeText.match(/(^|[+\-*/])(-?)([\d.]+)$/);
  
  if (match) {
    const minus = match[2]; // "-" または "" (空文字)
    const num = match[3];   // 数字部分
    
    // 置き換える文字数を計算
    const replaceLength = minus.length + num.length;
    const prefix = beforeText.slice(0, beforeText.length - replaceLength);
    
    if (minus === "-") {
      // マイナスを外す
      expression = prefix + num + afterText;
      cursorIndex -= 1;
    } else {
      // マイナスを付ける
      expression = prefix + "-" + num + afterText;
      cursorIndex += 1;
    }
    renderDisplay();
  }
}

function appendDot() {
  const beforeText = expression.slice(0, cursorIndex);
  const parts = beforeText.split(/[+\-*/]/);
  const lastNum = parts[parts.length - 1];
  if (lastNum.includes(".")) return;
  insert(lastNum === "" ? "0." : ".");
}

// 初期化
renderDisplay();

// ==========================================
// キーボード入力への対応（かな入力対応版）
// ==========================================
document.addEventListener('keydown', function(event) {
  let key = event.key;

  // 【追加】全角の数字や記号（１、＋、＝ など）を、半角に自動変換する
  key = key.replace(/[０-９．＋－＊／＝％]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });

  // 【追加】日本語キーボード特有の文字を、計算用の記号に強制翻訳する
  const keyMap = {
    'ー': '-',  // 長音符をマイナスに
    '−': '-',   // 全角マイナスを半角マイナスに
    '×': '*',   
    '÷': '/',   
    '。': '.',  // 句点を小数点に
    '、': '.',  // 読点を小数点に
    '・': '/'   // め のキー（中黒）を割り算に
  };
  if (keyMap[key]) {
    key = keyMap[key];
  }

  // --- 以下は判定処理 ---
  // 数字キー (0-9)
  if (/^[0-9]$/.test(key)) {
    insert(key);
  }
  // 演算子 (+, -, *, /)
  else if (key === '+' || key === '-' || key === '*' || key === '/') {
    operator(key);
  }
  // 小数点
  else if (key === '.') {
    appendDot();
  }
  else if (key === '^') {
    insert('^');
  }
  // イコール、Enterキー (計算実行)
  else if (key === 'Enter' || key === '=') {
    event.preventDefault(); // Enterでボタンが押されるのを防ぐ
    calculate();
  }
  // Backspaceキー (1文字削除)
  else if (key === 'Backspace') {
    deleteOne();
  }
  // Escapeキー (オールクリア: AC)
  else if (key === 'Escape') {
    clearAll();
  }
  // パーセント (%)
  else if (key === '%') {
    insertPercent();
  }
  // 左右の矢印キー (カーソル移動)
  else if (key === 'ArrowLeft') {
    moveCursor('left');
  }
  else if (key === 'ArrowRight') {
    moveCursor('right');
  }
});
