# Explosion performance pass

Baseline: fb969f359876291c095f8e9a7a26e09892a770cf. No change to damage rules, per-impact removal cap, particle counts, visible effect geometry, shadows, resolution, or configured quality.

- Apply due destructive impacts in their original order, using a single editor history/save/refresh/invalidation for all hits due in one frame. Simultaneous impacts become one undo operation; individual impacts in different frames still have separate undo steps.
- Cache each recipe layer's normalized config rather than reconstructing it on every animation frame. Reject distant placed blocks using a conservative footprint bound.
- Allocate projectile flight and impact-only meshes separately; direct impacts no longer allocate a flight trail. Preserve the existing selected detail budgets and visual effects.
- Reuse the deterministic noise lattice and field for fire, smoke and ring sprites; halo requires no noise. Regression test compares every RGBA byte to the previous algorithm.
- Retain a bounded detached overflow instance buffer for subsequent bursts; reuse temporary colors and camera transforms, and hoist particle motion terms out of loops.
- Separate destructive impact, ambient VFX and explosion preparation phases in the HUD. WebGL submission remains separately timed.

Remaining work if measurements warrant it: GPU-side analytic billboard and fragment motion, asynchronous chunk rebuild after destruction, GPU timer queries and optical overdraw profiling. No guarantee of 240 FPS under every possible recipe or count. CI and hardware validation required.
