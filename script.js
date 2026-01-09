const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";

// ===== 表示 =====
function renderDisplay() {
  if (!expression) {
    display.innerHTML = "";
    return;
  }

  const tex = expression
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ");

  display.innerHTML = `$${tex}$`;
  MathJax.typesetPromise([display]);
}

// ===== 入力 =====
function insert(value) {
  expression += value;
  renderDisplay();
}

function deleteOne() {
  expression = expression.slice(0, -1);
  renderDisplay();
}

function clearAll() {
  expression = "";
  history.textContent = "";
  renderDisplay();
}

// ===== 演算子 =====
function operator(op) {
  if (!expression && op !== "-") return;

  if (/[+\-*/]$/.test(expression)) {
    expression = expression.slice(0, -1) + op;
  } else {
    expression += op;
  }
  renderDisplay();
}

// ===== 小数点 =====
function appendDot() {
  const parts = expression.split(/[+\-*/]/);
  const last = parts[parts.length - 1];
  if (last.includes(".")) return;

  expression += last === "" ? "0." : ".";
  renderDisplay();
}

// ===== パーセント =====
function percent() {
  const match = expression.match(/(\d+\.?\d*)$/);
  if (!match) return;

  const num = match[1];
  const result = Number(num) / 100;
  expression =
    expression.slice(0, -num.length) + result;

  renderDisplay();
}

// ===== 計算 =====
function calculate() {
  let expr = expression;
  if (/[+\-*/]$/.test(expr)) {
    expr = expr.slice(0, -1);
  }

  try {
    const result = eval(expr);
    history.textContent += `${expr} = ${result}\n`;
    expression = String(result);
    renderDisplay();
  } catch {
    expression = "Error";
    renderDisplay();
  }
}
