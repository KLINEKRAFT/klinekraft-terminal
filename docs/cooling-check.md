# Cooling check — November 13, 2026

A bounded four-process CPU load test was stopped at 50 seconds after reaching 79.3°C.
Samples rose through 70.5°C (5 s), 74.9°C (20 s), 77.65°C (35–40 s), and 79.3°C (50 s).
The test checked every five seconds and stopped when a sample reached 78°C or any
throttling/undervoltage flags appeared. `get_throttled` remained `0x0` throughout.
Subsequent ordinary-load readings returned to roughly 67–68°C.

No fan RPM sensor or cooling device was exposed under sysfs. This does not establish
that a fan is absent: a fan powered from a fixed supply may not report RPM. Physical
fan operation, airflow, and heatsink contact need checking. This result does not
establish steady-state thermal safety for sustained GoldenEye or other heavy loads;
there is limited headroom before thermal throttling. No firmware, clock or fan GPIO
settings were changed.

## Fan detection repaired

The user confirmed the fan is attached to the Pi 5 four-pin FAN socket and was not
spinning. Firmware boot logs reported `RPM 0, max RPM 0`; no fan controller was
registered. Applying the standard `sudo dtparam cooling_fan=on` at runtime registered
`pwmfan`, exposed the RPM sensor and started the fan. The user confirmed it was
spinning; measured RPM was 4441 initially and over 6100 under load.

The setting `dtparam=cooling_fan=on` was also added under `[all]` in
`/boot/firmware/config.txt`. The original file is preserved as
`/boot/firmware/config.txt.before-klinekraft-fan`. No reboot was needed for the live
fix. Persistence is configured but still needs confirmation after the next normal
reboot. This enables the standard automatic fan curve; it does not pin a GPIO or
force a constant fan speed.

With the controller running, the repeat four-core test completed all 120 seconds.
Peak temperature was 73.25°C and the final sample was 71.05°C, with `throttled=0x0`
throughout. This is a short synthetic-load check, not a long gaming endurance test.
