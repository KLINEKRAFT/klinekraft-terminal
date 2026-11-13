import { useState } from "react";

export function calculate(expression: string): number {
  const normalized = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s/g, "");
  if (!normalized || normalized.length > 200 || /[^0-9.+*/()%\-]/.test(normalized)) throw Error("Enter an arithmetic expression.");
  const tokens = normalized.match(/(?:\d*\.\d+|\d+\.?\d*)|[+*/()%\-]/g) ?? [];
  if (tokens.join("") !== normalized) throw Error("Check the number format.");
  let cursor = 0;
  function atom(): number {
    const token = tokens[cursor++];
    if (token === "+") return atom();
    if (token === "-") return -atom();
    let value: number;
    if (token === "(") {
      value = sum();
      if (tokens[cursor++] !== ")") throw Error("Close the parentheses.");
    } else {
      if (!token || !/^\d*\.?\d/.test(token)) throw Error("Enter a number.");
      value = Number(token);
    }
    while (tokens[cursor] === "%") { cursor++; value /= 100; }
    return value;
  }
  function product(): number {
    let value = atom();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const operator = tokens[cursor++];
      const right = atom();
      if (operator === "/" && right === 0) throw Error("Cannot divide by zero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const operator = tokens[cursor++];
      const right = product();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }
  const result = sum();
  if (cursor !== tokens.length) throw Error("Check the expression.");
  if (!Number.isFinite(result)) throw Error("Result is outside the supported range.");
  return Number(result.toPrecision(12));
}

export function Calculator() {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{ expression: string; result: string }[]>([]);
  function evaluate() {
    try {
      const answer = String(calculate(expression));
      setResult(answer);
      setError("");
      setHistory((previous) => [{ expression, result: answer }, ...previous].slice(0, 8));
    } catch (failure) { setError((failure as Error).message); setResult(""); }
  }
  function press(key: string) {
    setError("");
    if (key === "=") { evaluate(); return; }
    setResult("");
    setExpression((value) => key === "AC" ? "" : key === "⌫" ? value.slice(0, -1) : (value + key).slice(0, 200));
  }
  return <section className="calculator" aria-label="Calculator">
    <div className="calculator-machine">
      <form onSubmit={(event) => { event.preventDefault(); evaluate(); }}>
        <label htmlFor="calculation">Expression</label>
        <input id="calculation" value={expression} maxLength={200} placeholder="0" autoComplete="off"
          onChange={(event) => { setExpression(event.target.value); setResult(""); setError(""); }} />
        <output aria-live="polite">{error || result || "0"}</output>
      </form>
      <div className="calculator-keys">
        {["AC", "(", ")", "⌫", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "%", "+", "="].map((key) =>
          <button key={key} className={key === "=" ? "calculator-equals" : ""}
            aria-label={key === "⌫" ? "Backspace" : key === "AC" ? "Clear" : key} onClick={() => press(key)}>{key}</button>)}
      </div>
      <p className="organizer-caption">% divides a number by 100. Enter calculates.</p>
    </div>
    <aside className="calculator-history">
      <h2>Recent calculations</h2>
      {!history.length && <p>Your calculations will appear here.</p>}
      {history.map((item, index) => <button key={index} onClick={() => { setExpression(item.expression); setResult(item.result); setError(""); }}>
        <span>{item.expression}</span><strong>= {item.result}</strong>
      </button>)}
    </aside>
  </section>;
}
