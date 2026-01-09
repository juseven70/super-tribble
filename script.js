// ===== 要素取得 =====
const display = document.getElementById("display");
const history = document.getElementById("history");

// ===== 基本ユーティリティ =====
function getText() {
  return display.textContent;
}

function setText(text) {
  display.textContent = text;
  placeCursorToEnd();
}

function placeCursorToEnd() {
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(display);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ===== 入力系 =====
function insert(value) {
  display.focus();
  document.execCommand("insertText", false, value);
}

function deleteOne() {
  display.focus();
  document.execCommand("delete");
}

function clearAll() {
  setText("");
  history.textContent = "";
}

// ===== カーソル移動 =====
function moveLeft() {
  display.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  if (range.startOffset === 0) return;

  range.setStart(range.startContainer, range.startOffset - 1);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function moveRight() {
  display.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  const len = display.textContent.length;
  if (range.startOffset >= len) return;

  range.setStart(range.startContainer, range.startOffset + 1);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ===== 演算子 =====
function operator(op) {
  const text = getText();
  if (!text && op !== "-") return;

  if (/[+\-*/]$/.test(text)) {
    setText(text.slice(0, -1) + op);
  } else {
    insert(op);
  }
}

// ===== 小数点 =====
function appendDot() {
  const text = getText();
  const parts = text.split(/[+\-*/]/);
  const last = parts[parts.length - 1];

  if (last.includes(".")) return;

  if (last === "") {
    insert("0.");
  } else {
    insert(".");
  }
}

// ===== パーセント =====
function percent() {
  const text = getText();
  const match = text.match(/(\d+\.?\d*)$/);
  if (!match) return;

  const num = match[1];
  const result = Number(num) / 100;

  setText(
    text.slice(0, -num.length) + result
  );
}

// ===== 計算 =====
function calculate() {
  let expr = getText();
  if (!expr) return;

  if (/[+\-*/]$/.test(expr)) {
    expr = expr.slice(0, -1);
  }

  try {
    const result = eval(expr);
    history.textContent += `${expr} = ${result}\n`;
    setText(String(result));
  } catch {
    setText("Error");
  }
}

// ===== 初期フォーカス =====
display.focus();
placeCursorToEnd();
