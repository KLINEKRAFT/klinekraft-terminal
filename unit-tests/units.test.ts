import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conversions,
  convertFields,
  convertUnit,
  formatUnitValue,
  parseUnitInput,
  switchQuantity,
} from "../frontend/src/units.ts";

const show = (
  id: Parameters<typeof convertUnit>[0],
  value: number,
  from: "us" | "metric",
) => formatUnitValue(convertUnit(id, value, from));

test("temperature uses the exact Fahrenheit/Celsius relationship", () => {
  assert.equal(show("temperature", 32, "us"), "0");
  assert.equal(show("temperature", 212, "us"), "100");
  assert.equal(show("temperature", 98.6, "us"), "37");
  assert.equal(show("temperature", -40, "us"), "-40");
  assert.equal(show("temperature", 100, "metric"), "212");
  assert.equal(show("temperature", -40, "metric"), "-40");
  assert.equal(show("temperature", 0, "metric"), "32");
});

test("linear conversions use exact legal factors", () => {
  assert.equal(show("distance", 1, "us"), "1.609344");
  assert.equal(show("distance", 1.609344, "metric"), "1");
  assert.equal(show("distance", 100, "metric"), "62.13711922");
  assert.equal(show("length", 1, "us"), "0.3048");
  assert.equal(show("length", 1, "metric"), "3.280839895");
  assert.equal(show("short-length", 1, "us"), "2.54");
  assert.equal(show("short-length", 30.48, "metric"), "12");
  assert.equal(show("volume", 1, "us"), "3.785411784");
  assert.equal(show("volume", 3.785411784, "metric"), "1");
  assert.equal(show("weight", 1, "us"), "0.45359237");
  assert.equal(show("weight", 1, "metric"), "2.204622622");
  assert.equal(show("speed", 60, "us"), "96.56064");
  assert.equal(show("speed", 100, "metric"), "62.13711922");
  assert.equal(show("small-weight", 1, "us"), "28.34952313");
  assert.equal(show("small-weight", 16, "us"), "453.59237");
});

test("every conversion round-trips and lists U.S. units first", () => {
  assert.deepEqual(
    conversions.map((c) => `${c.us.symbol}/${c.metric.symbol}`),
    ["°F/°C", "mi/km", "ft/m", "in/cm", "gal/L", "lb/kg", "mph/km/h", "oz/g"],
  );
  for (const { id } of conversions)
    for (const value of [0, 1, 12.5, -3, 1234567])
      assert.equal(
        Number(show(id, convertUnit(id, value, "us"), "metric")),
        value,
        id,
      );
});

test("input parsing accepts partial typing without inventing numbers", () => {
  assert.equal(parseUnitInput("12"), 12);
  assert.equal(parseUnitInput("-4.5"), -4.5);
  assert.equal(parseUnitInput(".5"), 0.5);
  assert.equal(parseUnitInput("3."), 3);
  assert.equal(parseUnitInput("1,000"), 1000);
  assert.equal(parseUnitInput(""), null);
  assert.equal(parseUnitInput("-"), null);
  assert.equal(parseUnitInput("."), null);
  assert.equal(parseUnitInput("abc"), null);
  assert.equal(parseUnitInput("1e5"), null);
  assert.equal(formatUnitValue(NaN), "");
  assert.equal(formatUnitValue(-0), "0");
  assert.equal(formatUnitValue(0.1 + 0.2), "0.3");
});

test("switching quantity re-converts from the side the person typed", () => {
  // Typed 100 on the metric side of temperature: U.S. shows the derived 212.
  const typedMetric = convertFields("temperature", "metric", "100");
  assert.deepEqual(typedMetric, { us: "212", metric: "100" });
  // Switching to distance keeps the typed 100 (now km), not the derived 212.
  assert.deepEqual(switchQuantity("distance", typedMetric, "metric"), {
    us: "62.13711922",
    metric: "100",
  });
  // Typed on the U.S. side, the U.S. number carries over.
  const typedUs = convertFields("temperature", "us", "212");
  assert.deepEqual(switchQuantity("distance", typedUs, "us"), {
    us: "212",
    metric: "341.180928",
  });
  // Incomplete or empty input clears the other side instead of inventing 0.
  assert.deepEqual(convertFields("temperature", "us", "-"), {
    us: "-",
    metric: "",
  });
  assert.deepEqual(switchQuantity("weight", { us: "", metric: "" }, "metric"), {
    us: "",
    metric: "",
  });
});
