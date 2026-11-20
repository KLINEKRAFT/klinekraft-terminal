import { Info } from "./Info";
import { useState } from "react";

export function calculate(expression: string): number {
  const normalized = expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/\s/g, "");
  if (
    !normalized ||
    normalized.length > 200 ||
    /[^0-9.+*/()%\-]/.test(normalized)
  )
    throw Error("Enter an arithmetic expression.");
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
    while (tokens[cursor] === "%") {
      cursor++;
      value /= 100;
    }
    return value;
  }
  function product(): number {
    let value = atom();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const operator = tokens[cursor++];
      const right = atom();
      if (operator === "/" && right === 0)
        throw Error("Cannot divide by zero.");
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
  if (!Number.isFinite(result))
    throw Error("Result is outside the supported range.");
  // 15 significant digits removes float noise (0.1 + 0.2) without rounding
  // large whole numbers: 999999999999 + 2 must be 1000000000001.
  return Number(result.toPrecision(15));
}

export function Calculator() {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<
    { expression: string; result: string }[]
  >(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("klinekraft.calculator.history") || "[]",
      );
      return Array.isArray(saved)
        ? saved
            .filter(
              (item) =>
                typeof item?.expression === "string" &&
                typeof item?.result === "string",
            )
            .slice(0, 8)
        : [];
    } catch {
      return [];
    }
  });
  function evaluate() {
    try {
      const answer = String(calculate(expression));
      setResult(answer);
      setError("");
      const next = [{ expression, result: answer }, ...history].slice(0, 8);
      setHistory(next);
      try {
        localStorage.setItem(
          "klinekraft.calculator.history",
          JSON.stringify(next),
        );
      } catch {
        setError("Calculated, but history could not be saved in this browser.");
      }
    } catch (failure) {
      setError((failure as Error).message);
      setResult("");
    }
  }
  function press(key: string) {
    setError("");
    if (key === "=") {
      evaluate();
      return;
    }
    // After "=", an operator continues from the answer (2+3 = then ×4 = 20)
    // and a digit starts a new calculation, like a desk calculator.
    const continuing = result !== "" && key !== "AC" && key !== "⌫";
    const operator = ["÷", "×", "−", "-", "+", "%", "*", "/"].includes(key);
    setResult("");
    setExpression((value) =>
      key === "AC"
        ? ""
        : key === "⌫"
          ? value.slice(0, -1)
          : ((continuing ? (operator ? result : "") : value) + key).slice(
              0,
              200,
            ),
    );
  }
  return (
    <section className="calculator" aria-label="Calculator">
      <div className="calculator-machine">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            evaluate();
          }}
        >
          <label htmlFor="calculation">Expression</label>
          <input
            id="calculation"
            value={expression}
            maxLength={200}
            placeholder="0"
            autoComplete="off"
            onChange={(event) => {
              setExpression(event.target.value);
              setResult("");
              setError("");
            }}
          />
          <output aria-live="polite">{error || result || "0"}</output>
        </form>
        <div className="calculator-keys">
          {[
            "AC",
            "(",
            ")",
            "⌫",
            "7",
            "8",
            "9",
            "÷",
            "4",
            "5",
            "6",
            "×",
            "1",
            "2",
            "3",
            "−",
            "0",
            ".",
            "%",
            "+",
            "=",
          ].map((key) => (
            <button
              key={key}
              className={key === "=" ? "calculator-equals" : ""}
              aria-label={
                key === "⌫" ? "Backspace" : key === "AC" ? "Clear" : key
              }
              onClick={() => press(key)}
            >
              {key}
            </button>
          ))}
        </div>
        <Info label="Calculator help">
          <p>
            % divides a number by 100. Enter calculates. Click a history entry
            to reuse it.
          </p>
        </Info>
      </div>
      <aside className="calculator-history">
        <h2>History</h2>

        {history.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              setExpression(item.expression);
              setResult(item.result);
              setError("");
            }}
          >
            <span>{item.expression}</span>
            <strong>= {item.result}</strong>
          </button>
        ))}
      </aside>
    </section>
  );
}
