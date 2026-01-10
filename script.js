const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";
let cursorIndex = 0;

/* ===== 共通：TeX変換 ===== */
function toTeX(expr) {
  return expr
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ");
}

/* ===== ディスプレイ表示（カーソル対応） ===== */
/* ===== ディスプレイ表示（ドルマーク修正版） ===== */
/* ===== ディスプレイ表示（不具合修正版） ===== */
function renderDisplay() {
  // 1. カーソルより前後の文字列を取得
  const before = expression.slice(0, cursorIndex);
  const after = expression.slice(cursorIndex);

  // 2. それぞれをTeX形式に変換
  const texBefore = toTeX(before);
  const texAfter = toTeX(after);

  // 3. HTMLを組み立て
  // 内容が空でも $ $ で囲まずにカーソルを表示し、
  // 内容がある時だけ $ $ で囲むように「三項演算子」を使います
  const htmlBefore = texBefore ? `$${texBefore}$` : "";
  const htmlAfter = texAfter ? `$${texAfter}$` : "";
  const cursorHtml = '<span class="cursor"></span>';

  // 画面を更新（ここが実行されれば必ずカーソルは出ます）
  display.innerHTML = `<span>${htmlBefore}</span>${cursorHtml}<span>${htmlAfter}</span>`;

  // 4. MathJaxに数式の描画を依頼（エラーが出ないよう安全に実行）
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([display]).catch((err) => {
      console.log("MathJax error:", err);
    });
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
  history.innerHTML = "";
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

function appendDot() {
  const beforeText = expression.slice(0, cursorIndex);
  const parts = beforeText.split(/[+\-*/]/);
  const lastNum = parts[parts.length - 1];
  if (lastNum.includes(".")) return;
  insert(lastNum === "" ? "0." : ".");
}

/* ===== 計算実行 ===== */
function calculate() {
  let expr = expression;
  if (/[+\-*/]$/.test(expr)) expr = expr.slice(0, -1);
  if (!expr) return;

  try {
    const result = eval(expr);
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

// 初期化
renderDisplay();
