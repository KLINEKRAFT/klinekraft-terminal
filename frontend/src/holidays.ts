// US federal holidays and common observances. Federal dates/observance: OPM.
export function usHolidays(year: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const add = (d: Date, name: string) => {
    (out[key(d)] ??= []).push(name);
  };
  const fixed = (
    y: number,
    m: number,
    d: number,
    name: string,
    federal = true,
  ) => {
    const date = new Date(y, m - 1, d);
    add(date, name);
    if (federal && [0, 6].includes(date.getDay())) {
      const observed = new Date(date);
      observed.setDate(d + (date.getDay() === 6 ? -1 : 1));
      add(observed, `${name} (observed)`);
    }
  };
  const nth = (m: number, dow: number, n: number) =>
    new Date(
      year,
      m - 1,
      1 + ((dow - new Date(year, m - 1, 1).getDay() + 7) % 7) + (n - 1) * 7,
    );
  fixed(year, 1, 1, "New Year’s Day");
  fixed(year + 1, 1, 1, "New Year’s Day");
  add(nth(1, 1, 3), "Martin Luther King Jr. Day");
  add(nth(2, 1, 3), "Washington’s Birthday");
  const memorial = new Date(year, 5, 0);
  memorial.setDate(memorial.getDate() - ((memorial.getDay() + 6) % 7));
  add(memorial, "Memorial Day");
  fixed(year, 6, 19, "Juneteenth");
  fixed(year, 7, 4, "Independence Day");
  add(nth(9, 1, 1), "Labor Day");
  add(nth(10, 1, 2), "Columbus Day / Indigenous Peoples’ Day");
  fixed(year, 11, 11, "Veterans Day");
  add(nth(11, 4, 4), "Thanksgiving");
  fixed(year, 12, 25, "Christmas Day");
  fixed(year, 2, 14, "Valentine’s Day", false);
  fixed(year, 3, 17, "St. Patrick’s Day", false);
  fixed(year, 10, 31, "Halloween", false);
  add(nth(5, 0, 2), "Mother’s Day");
  add(nth(6, 0, 3), "Father’s Day");
  fixed(year, 12, 31, "New Year’s Eve", false);
  // Gregorian Easter (Meeus/Jones/Butcher).
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  add(new Date(year, month - 1, day), "Easter");
  return out;
}
