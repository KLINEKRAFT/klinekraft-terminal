// Unit conversions for the calculator's converter. U.S. customary units come
// first; every factor is the exact legal definition (NIST Handbook 44), so the
// only rounding is in formatUnitValue for display.

export type Side = "us" | "metric";

export type Conversion = {
  id: string;
  label: string;
  us: { symbol: string; name: string };
  metric: { symbol: string; name: string };
  /** Human-readable definition of the exact relationship. */
  rule: string;
};

export const conversions = [
  {
    id: "temperature",
    label: "Temperature",
    us: { symbol: "°F", name: "Fahrenheit" },
    metric: { symbol: "°C", name: "Celsius" },
    rule: "°C = (°F − 32) × 5/9",
  },
  {
    id: "distance",
    label: "Distance",
    us: { symbol: "mi", name: "Miles" },
    metric: { symbol: "km", name: "Kilometers" },
    rule: "1 mi = 1.609344 km",
  },
  {
    id: "length",
    label: "Length",
    us: { symbol: "ft", name: "Feet" },
    metric: { symbol: "m", name: "Meters" },
    rule: "1 ft = 0.3048 m",
  },
  {
    id: "short-length",
    label: "Short length",
    us: { symbol: "in", name: "Inches" },
    metric: { symbol: "cm", name: "Centimeters" },
    rule: "1 in = 2.54 cm",
  },
  {
    id: "volume",
    label: "Volume",
    us: { symbol: "gal", name: "Gallons (US)" },
    metric: { symbol: "L", name: "Liters" },
    rule: "1 US gal = 3.785411784 L",
  },
  {
    id: "weight",
    label: "Weight",
    us: { symbol: "lb", name: "Pounds" },
    metric: { symbol: "kg", name: "Kilograms" },
    rule: "1 lb = 0.45359237 kg",
  },
  {
    id: "speed",
    label: "Speed",
    us: { symbol: "mph", name: "Miles per hour" },
    metric: { symbol: "km/h", name: "Kilometers per hour" },
    rule: "1 mph = 1.609344 km/h",
  },
  {
    id: "small-weight",
    label: "Small weight",
    us: { symbol: "oz", name: "Ounces" },
    metric: { symbol: "g", name: "Grams" },
    rule: "1 oz = 28.349523125 g",
  },
] as const satisfies readonly Conversion[];

export type ConversionId = (typeof conversions)[number]["id"];

/** Metric units per one U.S. unit, for every linear conversion. */
const factors: Record<Exclude<ConversionId, "temperature">, number> = {
  distance: 1.609344,
  length: 0.3048,
  "short-length": 2.54,
  volume: 3.785411784,
  weight: 0.45359237,
  speed: 1.609344,
  "small-weight": 28.349523125,
};

/** Converts a value given on side `from` to the other side. */
export function convertUnit(
  id: ConversionId,
  value: number,
  from: Side,
): number {
  if (!Number.isFinite(value)) return NaN;
  if (id === "temperature")
    return from === "us" ? ((value - 32) * 5) / 9 : (value * 9) / 5 + 32;
  const factor = factors[id];
  if (factor === undefined) throw Error(`Unknown conversion: ${id}`);
  return from === "us" ? value * factor : value / factor;
}

/** Parses what a person typed; null for incomplete input like "-" or ".". */
export function parseUnitInput(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** Up to 10 significant digits, without float noise or trailing zeros. */
export function formatUnitValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toPrecision(10));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export type UnitValues = Record<Side, string>;

/**
 * The converter's two fields after a person types `text` on `side`: the typed
 * text is kept as-is and the other side shows the conversion (or nothing while
 * the input is incomplete).
 */
export function convertFields(
  id: ConversionId,
  side: Side,
  text: string,
): UnitValues {
  const other: Side = side === "us" ? "metric" : "us";
  const number = parseUnitInput(text);
  return {
    [side]: text,
    [other]:
      number === null ? "" : formatUnitValue(convertUnit(id, number, side)),
  } as UnitValues;
}

/**
 * The fields after switching quantity. The number the person last typed (on
 * `source`) is the one that carries over; the other side is recomputed, so a
 * typed 100 °C becomes 100 km, never the derived 212.
 */
export function switchQuantity(
  next: ConversionId,
  values: UnitValues,
  source: Side,
): UnitValues {
  return convertFields(next, source, values[source]);
}
