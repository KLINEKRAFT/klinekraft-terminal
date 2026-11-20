# Local Shackleton latency — November 19, 2026

Deployed a shorter local system prompt, omitted empty JSON fields and unused
image metadata, and moved the question after reference context so repeated
source prefixes can reuse llama.cpp's existing prompt cache. Source excerpt
limits and citation IDs are unchanged. Cloud context retains its fields.
Health/emergency source restrictions, historical-source labeling, untrusted
reference handling and diagnostic timestamps/units remain in the local prompt.

The model remains Qwen3-4B-Instruct-2507 Q4_K_M. Generation uses three CPU
threads; prompt evaluation uses four. Four generation threads were tested and
rejected because output throughput fell to about 1.96 tokens/s. No model
download, quantization change, automatic cloud fallback or overclock was added.

## Measurements

A fixed Compass article and question were used with prompt caching disabled
for cold benchmarks. Deterministic generation used temperature 0; full
production API follow-up used its normal temperature 0.2.

| Test | Prompt tokens | Prompt time | Generated tokens | Generation time | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original, 3/3 threads | 519 | 38.07 s | 65 | 25.22 s | 63.32 s |
| Intermediate compact, 4/4 | 398 | 27.18 s | 80 (cut off by benchmark cap) | 40.28 s | 67.52 s |
| Final compact, 3/4 | 405 | 28.24 s | 80 (complete) | 25.44 s | 53.73 s |

The final cold example was about 15% faster than the same-session baseline.
An earlier offline field test took 73.3 seconds, under different system load.
A production API follow-up about magnetic versus true north, reusing the same
article, completed in 12.2 seconds with a working local citation. It was a
shorter question/answer; this is not a controlled cold/warm speedup percentage.

These are small-sample observations, not a universal latency guarantee. Longer
questions, documents, chat history, other system load, or an unloaded model can
still take substantially longer. The model sometimes exceeds requested
sentence counts; output brevity and factual quality remain evaluation targets.
No throttling was reported during the measurements.

Validation: 28 offline/knowledge backend tests passed, including a new compact
prompt test preserving reference text, citation IDs and diagnostic data.
The production backend and local AI service were restarted and a real local
API request succeeded. No frontend build was needed.
