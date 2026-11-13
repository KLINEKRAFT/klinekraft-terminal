# Resource monitor

Home shows CPU and used-memory sparklines plus aggregate network download/upload rates. System has larger CPU, memory and network charts, a read-only process table and expandable Hardware & sensors details. Existing btop remains available from Tools.

History is a rolling three-minute window of unique live snapshot timestamps, bounded to 61 points in browser memory. It survives section navigation, resets on reload or data-mode changes, and never backfills missing samples. Gaps of ten seconds or more break the line. Pausing freezes history; stale service data is labeled and not added. Preview does not fabricate history or process lists. A few seconds after launch the graph starts at its right edge; allow three minutes for a full trace.

CPU and memory chart scales are fixed at 0–100%. Memory means total minus available memory. Network charts share an adaptive scale, explicitly labeled in System. Rates use monotonic time and deltas from psutil per-interface counters; loopback is excluded, new interfaces require a baseline, and counter resets are clamped to zero. Multiple interfaces are aggregated; VPN/virtual interfaces can count traffic more than once. First-sample rates are unavailable, not zero. No internet request or network probe is required.

The cached process sample exposes at most twelve PID/name/CPU/RSS rows, ranked by CPU then RSS. CPU uses deltas of user+system time divided by elapsed time and logical core count, so it is a share of total machine capacity (unlike btop configurations where one busy core means 100%). A new process has no CPU estimate until its next sample; PID plus creation time identifies processes. Inaccessible processes are skipped. RSS includes shared pages and should not be summed as total RAM usage.

`GET /api/processes` requires the same local-client header as Files/Tools. No command lines, arguments, usernames or environments are returned. There are no kill, priority, or other process mutation actions. Process collection is part of the service's existing three-second worker loop; HTTP requests read cached results. The process view fetches only while System is mounted in live, unpaused mode.

Validation: backend tests for rate deltas, loopback exclusion, counter resets, PID reuse, unavailable metrics and endpoint guard; browser tests for live history and processes; live-service Chromium check at 1024×600. Hardware-specific behavior still depends on the Pi's available sensors and permissions.
