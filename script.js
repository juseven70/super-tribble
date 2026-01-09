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
function renderDisplay() {
  const before = expression.slice(0, cursorIndex);
  const after = expression.slice(cursorIndex);

  const texBefore = toTeX(before);
  const texAfter = toTeX(after);
  const cursorHtml = '<span class="cursor"></span>';
  
  // カーソルを挟んで表示。空の場合は空文字をMathJaxに渡さないよう工夫
  display.innerHTML = `<span>$${texBefore}$</span>${cursorHtml}<span>$${texAfter}$</span>`;

  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([display]);
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
