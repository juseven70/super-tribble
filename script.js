const display = document.getElementById("display");
const history = document.getElementById("history");

function appendValue(value) {
  display.value += value;
}

function operator(op) {
  if (display.value === "") return;

  history.textContent += display.value + op + "\n";
  display.value = "";
}

function deleteOne() {
  display.value = display.value.slice(0, -1);
}

function clearAll() {
  display.value = "";
  history.textContent = "";
}

function calculate() {
  let expression = history.textContent.replace(/\n/g, "") + display.value;

  display.value = eval(expression);
  history.textContent = "";
}
function appendDot() {
  if (display.value.includes(".")) return;
  if (display.value === "") {
    display.value = "0.";
  } else {
    display.value += ".";
  }
}

function percent() {
  if (display.value === "") return;
  display.value = String(Number(display.value) / 100);
}
