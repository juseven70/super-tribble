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
