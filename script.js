
const display = document.getElementById("display");
const history = document.getElementById("history");

function insert(value) {
  const text = getText();
  display.value =
    text.slice(0, cursor) + value + text.slice(cursor);
  cursor++;
  render();
}

let cursor = 0;

function appendDot() {
  const text = getText();
  const left = text.slice(0, cursor);
  const right = text.slice(cursor);

  const parts = left.split(/[+\-*/]/);
  const last = parts[parts.length - 1];

  if (last.includes(".")) return;

  const value =
    last === "" ? "0." : ".";

  display.value = left + value + right;
  cursor += value.length;
  render();
}

function operator(op) {
  const text = getText();
  const left = text.slice(0, cursor);
  const right = text.slice(cursor);

  if (left === "" && op !== "-") return;

  if (/[+\-*/]$/.test(left)) {
    display.value = left.slice(0, -1) + op + right;
  } else {
    display.value = left + op + right;
  }

  cursor++;
  render();
}

function percent() {
  const text = getText();
  const left = text.slice(0, cursor);
  const right = text.slice(cursor);

  const match = left.match(/(\d+\.?\d*)$/);
  if (!match) return;

  const num = match[1];
  const result = Number(num) / 100;

  display.value =
    left.slice(0, -num.length) +
    result +
    right;

  cursor =
    left.length - num.length + String(result).length;

  render();
}

function deleteOne() {
  if (cursor === 0) return;

  const text = getText();
  display.value =
    text.slice(0, cursor - 1) + text.slice(cursor);
  cursor--;
  render();
}

function clearAll() {
  display.value = "";
  cursor = 0;
  history.textContent = "";
  render();
}

function calculate() {
  let expression = getText();

  if (/[+\-*/]$/.test(expression)) {
    expression = expression.slice(0, -1);
  }

  try {
    const result = eval(expression);

    history.textContent += `${expression} = ${result}\n`;

    display.value = String(result);
    cursor = display.value.length;
    render();
  } catch {
    display.value = "Error";
    cursor = 0;
    render();
  }
}

function render() {
  display.value = getText();
  updateCursorPosition();
}

function moveLeft() {
  if (cursor > 0) cursor--;
  render();
}

function moveRight() {
  if (cursor < getText().length) cursor++;
  render();
}

const fakeCursor = document.getElementById("fake-cursor");

function updateCursorPosition() {
  const charWidth = 12; 
  fakeCursor.style.right =
    (getText().length - cursor) * charWidth + 8 + "px";
}

render();

