"""Pure battery policy shared with the root-owned shutdown guard."""
import math


def valid(percent, voltage):
    return all(isinstance(v, (int, float)) and math.isfinite(v) for v in (percent, voltage)) and 0 <= percent <= 100 and 2.5 <= voltage <= 4.5


def critical(percent, voltage):
    return valid(percent, voltage) and (voltage <= 3.35 or (percent <= 8 and voltage <= 3.6))


def runtime_minutes(samples):
    """Estimate time to the 15% reserve, never to an assumed zero cutoff."""
    if len(samples) < 11:
        return None
    first, last = samples[0], samples[-1]
    elapsed = (last['time'] - first['time']) / 60
    drop = first['percent'] - last['percent']
    if elapsed < 10 or drop < 1 or any(b['percent'] - a['percent'] > .3 for a, b in zip(samples, samples[1:])):
        return None
    return max(0, round((last['percent'] - 15) * elapsed / drop))


class ShutdownPolicy:
    def __init__(self):
        self.low_since = None

    def update(self, percent, voltage, now, external_power=None):
        if external_power is True or not critical(percent, voltage):
            self.low_since = None
            return None
        if self.low_since is None:
            self.low_since = now
        # 30 seconds sustained low readings, then a 60-second countdown.
        elapsed = now - self.low_since
        return None if elapsed < 30 else max(0, math.ceil(90 - elapsed))
