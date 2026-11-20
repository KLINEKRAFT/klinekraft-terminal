import { ArrowLeftRight } from "lucide-react";
import { Info } from "./Info";
import { useState } from "react";
import {
  conversions,
  convertUnit,
  formatUnitValue,
  parseUnitInput,
  type ConversionId,
  type Side,
} from "../units";

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

const conversionKey = "klinekraft.calculator.conversion";

function UnitConverter() {
  const [id, setId] = useState<ConversionId>(() => {
    try {
      const saved = localStorage.getItem(conversionKey);
      if (conversions.some((c) => c.id === saved)) return saved as ConversionId;
    } catch {
      /* Remembering the last quantity is only a convenience. */
    }
    return "temperature";
  });
  const [values, setValues] = useState<Record<Side, string>>({
    us: "",
    metric: "",
  });
  const conversion = conversions.find((c) => c.id === id)!;
  function type(side: Side, text: string, quantity: ConversionId = id) {
    const other: Side = side === "us" ? "metric" : "us";
    const number = parseUnitInput(text);
    setValues({
      [side]: text,
      [other]:
        number === null ? "" : formatUnitValue(convertUnit(quantity, number, side)),
    } as Record<Side, string>);
  }
  function choose(next: ConversionId) {
    setId(next);
    try {
      localStorage.setItem(conversionKey, next);
    } catch {
      /* Keep working without remembering the choice. */
    }
    // Keep the U.S. number the person typed and convert it in the new quantity.
    if (values.us || !values.metric) type("us", values.us, next);
    else type("metric", values.metric, next);
  }
  return (
    <section className="k-card unit-converter" aria-labelledby="converter-title">
      <div className="unit-converter-head">
        <h2 className="k-eyebrow" id="converter-title">
          Convert
        </h2>
        <select
          className="k-select"
          aria-label="Quantity"
          value={id}
          onChange={(event) => choose(event.target.value as ConversionId)}
        >
          {conversions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} · {c.us.symbol} ↔ {c.metric.symbol}
            </option>
          ))}
        </select>
      </div>
      <div className="unit-pair">
        {(["us", "metric"] as const).map((side, index) => (
          <div className="unit-side" key={side}>
            {index === 1 && (
              <ArrowLeftRight
                className="unit-swap"
                size={20}
                aria-hidden="true"
              />
            )}
            <label className="unit-field">
              <span className="sr-only">{conversion[side].name}</span>
              <input
                className="k-field"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={values[side]}
                onChange={(event) => type(side, event.target.value)}
              />
              <span className="unit-symbol" aria-hidden="true">
                {conversion[side].symbol}
              </span>
            </label>
          </div>
        ))}
      </div>
      <p className="unit-rule">{conversion.rule}</p>
    </section>
  );
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
        <div className="calculator-info">
          <Info label="Calculator help">
            <p>
              % divides a number by 100. Enter calculates. Tap a history entry
              to reuse it.
            </p>
          </Info>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            evaluate();
          }}
        >
          <label htmlFor="calculation" className="sr-only">
            Expression
          </label>
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
          <output aria-live="polite" data-error={error ? "true" : undefined}>
            {error || result || "0"}
          </output>
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
              type="button"
              className={
                key === "="
                  ? "calculator-equals"
                  : /[0-9.]/.test(key)
                    ? "calculator-digit"
                    : "calculator-op"
              }
              aria-label={
                key === "⌫" ? "Backspace" : key === "AC" ? "Clear" : key
              }
              onClick={() => press(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="calculator-side">
        <UnitConverter />
        <section className="k-card calculator-history" aria-labelledby="calculator-history-title">
          <h2 className="k-eyebrow" id="calculator-history-title">
            History
          </h2>
          {history.length ? (
            <ol>
              {history.map((item, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => {
                      setExpression(item.expression);
                      setResult(item.result);
                      setError("");
                    }}
                  >
                    <span>{item.expression}</span>
                    <strong>= {item.result}</strong>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p>Results you calculate appear here.</p>
          )}
        </section>
      </div>
    </section>
  );
}
