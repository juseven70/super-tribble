const display = document.getElementById("display");
const history = document.getElementById("history");

let expression = "";
let cursorIndex = 0;

function toTeX(expr) {
  return expr
    .replace(/\*/g, "\\times ")
    .replace(/\//g, "\\div ")
    .replace(/%/g, "\\% "); // % の変換を追加
}

function renderDisplay() {
  const before = expression.slice(0, cursorIndex);
  const after = expression.slice(cursorIndex);
  
  let texBefore = toTeX(before);
  let texAfter = toTeX(after);

  // --- 追加部分：MathJaxのレイアウト崩れ（ガタつき）防止 ---
  // カーソルの位置で数式が2つに分断されるため、演算子が単独の記号として扱われ
  // 左右のスペースが詰まってしまう現象を防ぎます。
  // 切断面に演算子がある場合は、見えない空の要素 `{}` を補います。
  if (/[+\-*/]$/.test(before)) {
    texBefore += "{}";
  }
  if (/^[+\-*/]/.test(after)) {
    texAfter = "{}" + texAfter;
  }
  // -----------------------------------------------------

  const htmlBefore = texBefore ? `$${texBefore}$` : "";
  const htmlAfter = texAfter ? `$${texAfter}$` : "";
  const cursorHtml = '<span class="cursor"></span>';

  display.innerHTML = `<span>${htmlBefore}</span>${cursorHtml}<span>${htmlAfter}</span>`;

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

// %ボタンの処理（直前が数字の時だけ入力可能）
function insertPercent() {
  const beforeText = expression.slice(0, cursorIndex);
  if (/[\d.]$/.test(beforeText)) {
    insert('%');
  }
}

// +/- ボタンの処理（カーソル直前の数字の符号を反転させる）
function toggleSign() {
  const beforeText = expression.slice(0, cursorIndex);
  const afterText = expression.slice(cursorIndex);
  
  // カーソル直前の「数字（マイナスが付いている場合も含む）」を探す
  const match = beforeText.match(/(^|[+\-*/])(-?)([\d.]+)$/);
  
  if (match) {
    const minus = match[2]; // "-" または "" (空文字)
    const num = match[3];   // 数字部分
    
    // 置き換える文字数を計算
    const replaceLength = minus.length + num.length;
    const prefix = beforeText.slice(0, beforeText.length - replaceLength);
    
    if (minus === "-") {
      // マイナスを外す
      expression = prefix + num + afterText;
      cursorIndex -= 1;
    } else {
      // マイナスを付ける
      expression = prefix + "-" + num + afterText;
      cursorIndex += 1;
    }
    renderDisplay();
  }
}

function appendDot() {
  const beforeText = expression.slice(0, cursorIndex);
  const parts = beforeText.split(/[+\-*/]/);
  const lastNum = parts[parts.length - 1];
  if (lastNum.includes(".")) return;
  insert(lastNum === "" ? "0." : ".");
}

/* ===== 計算実行 ===== */
/* ===== 計算実行（精度修正版） ===== */
function calculate() {
  let expr = expression;
  // 末尾に演算子がある場合は削除して計算
  if (/[+\-*/]$/.test(expr)) expr = expr.slice(0, -1);
  if (!expr) return;

  try {
    // 1. 計算を実行
    let result = eval(expr);

    // 2. 小数点誤差を修正
    // 12桁程度で丸めてから数値に戻すことで、末尾の「...9999」や「...0001」を取り除きます。
    // parseFloatを使うと、丸めた後の余計な「0」も消してくれます。
    result = parseFloat(result.toPrecision(12));

    // 履歴に追加
    const line = document.createElement("div");
    line.innerHTML = `$${toTeX(expr)} = ${toTeX(String(result))}$`;
    history.appendChild(line);
    
    if (window.MathJax) MathJax.typesetPromise([line]);

    // ディスプレイを更新
    expression = String(result);
    cursorIndex = expression.length; // 計算後はカーソルを末尾へ
    renderDisplay();
  } catch {
    expression = "Error";
    cursorIndex = 0;
    renderDisplay();
  }
}
// 初期化
renderDisplay();
