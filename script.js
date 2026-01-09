const display = document.getElementById("display");
const history = document.getElementById("history");

function insert(value) {
  const text = display.value.replace("|", "");
  display.value =
    text.slice(0, cursor) + value + text.slice(cursor);
  cursor++;
  render();
}

function operator(op) {
 if (display.value === "") return;

  // 記号が連続しないように
  if (/[+\-*/]$/.test(display.value)) {
    display.value = display.value.slice(0, -1);
  }

  display.value += op;

  // ★計算途中では履歴を表示しない
  history.textContent = "";
  }

  display.value += op;
}

function appendDot() {
  // 最後の数字に . がなければOK
  const parts = display.value.split(/[+\-*/]/);
  if (parts[parts.length - 1].includes(".")) return;

  if (display.value === "" || /[+\-*/]$/.test(display.value)) {
    display.value += "0.";
  } else {
    display.value += ".";
  }
}

function percent() {
  const parts = display.value.split(/[+\-*/]/);
  const last = parts.pop();
  if (last === "") return;

  const result = Number(last) / 100;
  display.value =
    parts.join("") + (parts.length ? "" : "") + result;
}

function deleteOne() {
  display.value = display.value.slice(0, -1);
}

function clearAll() {
  display.value = "";
  history.textContent = "";
}

function calculate() {
  let expression = display.value;

  // 最後が記号なら削除
  if (/[+\-*/]$/.test(expression)) {
    expression = expression.slice(0, -1);
  }

  try {
    const result = eval(expression);

    // 履歴に「式 = 結果」
    history.textContent += `${expression} = ${result}\n`;

    // 表示は結果だけ
    display.value = result;
  } catch {
    display.value = "Error";
  }
}

let cursor = 0;

function render() {
  const text = display.value;
  display.value =
    text.slice(0, cursor) + "|" + text.slice(cursor);
}
function moveLeft() {
  if (cursor > 0) cursor--;
  render();
}

function moveRight() {
  if (cursor < display.value.replace("|", "").length) cursor++;
  render();
}
function deleteOne() {
  if (cursor === 0) return;

  const text = display.value.replace("|", "");
  display.value =
    text.slice(0, cursor - 1) + text.slice(cursor);
  cursor--;
  render();
}
