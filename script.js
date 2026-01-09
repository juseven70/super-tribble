// script.js

const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";
let cursorIndex = 0; // カーソルの位置（0なら先頭、expression.lengthなら末尾）

/* ===== 共通：TeX変換 ===== */
function toTeX(expr) {
  return expr
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ");
}

/* ===== ディスプレイ表示（重要） ===== */
function renderDisplay() {
  display.innerHTML = "";

  // expressionをカーソル位置で分割
  const before = expression.slice(0, cursorIndex);
  const after = expression.slice(cursorIndex);

  // MathJaxの中でカーソルを表現するために \class を利用
  // ※ MathJaxの \class を使うために \text{} を活用
  const texBefore = toTeX(before);
  const texAfter = toTeX(after);
  
  // カーソル部分をHTMLとして別途挿入するために一時的なマークをつける
  const cursorHtml = '<span class="cursor"></span>';
  
  const container = document.createElement("div");
  container.className = "mjx-cursor-container";
  
  // TeX全体をレンダリング。カーソルは左右のTeXの間に配置。
  // 注意：数式が分断されると不自然な場合があるため、全体を一つの $ $ で囲む工夫が必要。
  // ここではシンプルに左右に分けて表示します。
  display.innerHTML = `<span>$${texBefore}$</span>${cursorHtml}<span>$${texAfter}$</span>`;

  if (window.MathJax) {
    MathJax.typesetPromise([display]);
  }
}

/* ===== 入力（カーソル位置に挿入） ===== */
function insert(value) {
  expression = expression.slice(0, cursorIndex) + value + expression.slice(cursorIndex);
  cursorIndex += value.length;
  renderDisplay();
}

/* ===== 削除（カーソルの左を消す） ===== */
function deleteOne() {
  if (cursorIndex > 0) {
    expression = expression.slice(0, cursorIndex - 1) + expression.slice(cursorIndex);
    cursorIndex--;
    renderDisplay();
  }
}

function clearAll() {
  expression = "";
  cursorIndex = 0;
  history.innerHTML = "";
  renderDisplay();
}

/* ===== 演算子 ===== */
function operator(op) {
  // 基本はinsertと同じだが、連続入力を防ぐロジック
  const beforeChar = expression[cursorIndex - 1];
  if (/[+\-*/]/.test(beforeChar)) {
    // 直前が演算子なら置換
    expression = expression.slice(0, cursorIndex - 1) + op + expression.slice(cursorIndex);
  } else {
    insert(op);
    return; // insert内でrenderするのでここで終了
  }
  renderDisplay();
}

/* ===== 小数点 ===== */
function appendDot() {
  // カーソルがある箇所の数値ブロックに既にドットがあるか判定
  const beforeText = expression.slice(0, cursorIndex);
  const lastNum = beforeText.split(/[+\-*/]/).pop();
  
  if (lastNum.includes(".")) return;
  insert(lastNum === "" ? "0." : ".");
}

/* ===== パーセント ===== */
function percent() {
  // カーソル直前の数値を100で割る（簡易版）
  const beforeText = expression.slice(0, cursorIndex);
  const match = beforeText.match(/(\d+\.?\d*)$/);
  if (!match) return;

  const num = match[1];
  const result = String(Number(num) / 100);

  expression = expression.slice(0, cursorIndex - num.length) + result + expression.slice(cursorIndex);
  cursorIndex = cursorIndex - num.length + result.length;
  renderDisplay();
}

/* ===== 計算 ===== */
function calculate() {
  let expr = expression;
  if (/[+\-*/]$/.test(expr)) expr = expr.slice(0, -1);

  try {
    const result = eval(expr);
    const line = document.createElement("div");
    line.innerHTML = `$${toTeX(expr)} = ${toTeX(String(result))}$`;
    history.appendChild(line);

    if (window.MathJax) MathJax.typesetPromise([line]);

    expression = String(result);
    cursorIndex = expression.length; // 計算後は末尾に
    renderDisplay();
  } catch {
    expression = "Error";
    cursorIndex = 0;
    renderDisplay();
  }
}

// キーボードの矢印キーでカーソル移動できるようにする
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    if (cursorIndex > 0) cursorIndex--;
    renderDisplay();
  } else if (e.key === "ArrowRight") {
    if (cursorIndex < expression.length) cursorIndex++;
    renderDisplay();
  }
});

// 初期表示
renderDisplay();

// script.js に追加

/**
 * カーソル位置を左右に移動させる
 * @param {string} direction - 'left' または 'right'
 */
function moveCursor(direction) {
  if (direction === 'left') {
    if (cursorIndex > 0) {
      cursorIndex--;
    }
  } else if (direction === 'right') {
    if (cursorIndex < expression.length) {
      cursorIndex++;
    }
  }
  renderDisplay(); // 再描画してカーソル位置を反映
}
