# Original brand assets

- `klinekraft_terminal_logo@5x.png`: complete logo supplied by Klinekraft. The sidebar displays optimized copies of this artwork, preserving the symbol, lettering, spacing, colors and aspect ratio.
- `klinekraft_logo_geometric.png`: original standalone symbol, retained for favicon and application icon generation.

Regenerate from the repository root:

```sh
npm run brand:import -- assets/brand/klinekraft_logo_geometric.png
npm run brand:lockup -- "assets/brand/klinekraft_terminal_logo@5x.png"
```

Both originals are preserved unchanged. No tracing or reconstructed typography is used for the active sidebar logo.
