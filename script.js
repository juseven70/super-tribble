const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";

/* ===== 共通：TeX変換 ===== */
function toTeX(expr) {
  return expr
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ");
}

/* ===== ディスプレイ表示 ===== */
function renderDisplay() {
  if (!expression) {
    display.innerHTML = "";
    return;
  }

  display.innerHTML = `$${toTeX(expression)}$`;

  if (window.MathJax) {
    MathJax.typesetPromise([display]);
  }
}

/* ===== 入力 ===== */
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
  history.innerHTML = "";
  renderDisplay();
}

/* ===== 演算子 ===== */
function operator(op) {
  if (!expression && op !== "-") return;

  if (/[+\-*/]$/.test(expression)) {
    expression = expression.slice(0, -1) + op;
  } else {
    expression += op;
  }
  renderDisplay();
}

/* ===== 小数点 ===== */
function appendDot() {
  const parts = expression.split(/[+\-*/]/);
  const last = parts[parts.length - 1];

  if (last.includes(".")) return;

  expression += last === "" ? "0." : ".";
  renderDisplay();
}

/* ===== パーセント ===== */
function percent() {
  const match = expression.match(/(\d+\.?\d*)$/);
  if (!match) return;

  const num = match[1];
  const result = Number(num) / 100;

  expression =
    expression.slice(0, -num.length) + result;

  renderDisplay();
}

/* ===== 計算 & 履歴（TeX） ===== */
function calculate() {
  let expr = expression;

  if (/[+\-*/]$/.test(expr)) {
    expr = expr.slice(0, -1);
  }

  try {
    const result = eval(expr);

    const texExpr = toTeX(expr);
    const texResult = toTeX(String(result));

    const line = document.createElement("div");
    line.innerHTML = `$${texExpr} = ${texResult}$`;

    history.appendChild(line);

    if (window.MathJax) {
      MathJax.typesetPromise([line]);
    }

    expression = String(result);
    renderDisplay();
  } catch {
    expression = "Error";
    renderDisplay();
  }
}
