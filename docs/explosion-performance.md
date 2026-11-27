# Explosion performance pass

Baseline: fb969f359876291c095f8e9a7a26e09892a770cf. No change to damage rules, per-impact removal cap, particle counts, visible effect geometry, shadows, resolution, or configured quality.

- Apply due destructive impacts in their original order, using a single editor history/save/refresh/invalidation for all hits due in one frame. Simultaneous impacts become one undo operation; individual impacts in different frames still have separate undo steps.
- Cache each recipe layer's normalized config rather than reconstructing it on every animation frame. Reject distant placed blocks using a conservative footprint bound.
- Allocate projectile flight and impact-only meshes separately; direct impacts no longer allocate a flight trail. Preserve the existing selected detail budgets and visual effects.
- Reuse the deterministic noise lattice and field for fire, smoke and ring sprites; halo requires no noise. Regression test compares every RGBA byte to the previous algorithm.
- Retain a bounded detached overflow instance buffer for subsequent bursts; reuse temporary colors and camera transforms, and hoist particle motion terms out of loops.
- Separate destructive impact, ambient VFX and explosion preparation phases in the HUD. WebGL submission remains separately timed.

Remaining work if measurements warrant it: GPU-side analytic billboard and fragment motion, asynchronous chunk rebuild after destruction, GPU timer queries and optical overdraw profiling. No guarantee of 240 FPS under every possible recipe or count. CI and hardware validation required.

## Local destruction invalidation

The measured 70–76 ms spikes were attributed to the combined occlusion stage, which also included liquid derivation and relief indexing. These three phases are now independently timed. Actual voxel and placed-block removals are recorded when committed. The existing occlusion index removes only these entries, and discards only affected sector variants using its reverse neighbor dependency lists. This applies when the cached map and revisions match the explicit impact transaction and placed-block elevations are absolute. Untracked edits, mode/slice changes and terrain-relative placed geometry retain a full rebuild fallback. The rest of terrain/relief generation still runs synchronously; no visual, damage or particle quality settings have changed.

## CPU relief plans and excavation walls

The next measured bottleneck was the 35–37 ms relief preparation phase. Store per-sector source cells, solid face plans and their signatures; on a verified destructive transaction with unchanged view window/mode/slice/image availability, rebuild only the affected sectors (including occlusion neighbors and removed placed-block centers). Keep excavation walls in independent sector batches, updating neighbor walls after ground removal. Unchanged glass/ice cell lists reuse their exact exterior shells. For untracked changes or altered view context, rebuild descriptors conservatively. Small maps keep their original material-batch split policy. New diagnostics: reliefSectorBuilds and reliefSectorHits. No reduced particle counts, visual detail or damage.

## Asynchronous solid sector preparation

Verified destructive edits in large MJ construction maps with a stable streaming window use a persistent module worker. The existing local occlusion cache stays authoritative. Only dirty source columns, their sparse metadata, nearby ground and active occlusion membership are cloned; the worker builds the same sector descriptors and face plans, then transfers Float32 instance matrices and bounding spheres. One in-flight job plus one latest replacement prevents unbounded queues. Revisions are accumulated across overlapping impacts, stale results discarded, and source object references rebound to the live map. Solid sectors are applied atomically, prioritized by distance, with a soft 1 ms / 256 KiB per-frame publication budget between sectors. Old solid geometry may remain visible briefly until replaced; destroyed instances are rejected by picking. Initial loads, changed view windows, untracked edits, cutaway, small maps and worker failures retain synchronous behavior. Liquid derivation, occlusion collection, ground updates, transparent shells, UI, persistence and actual WebGL buffer uploads are not yet all asynchronous. A single unusually dense sector can exceed the soft budget; native-refresh performance needs physical GPU testing. No graphics or damage reductions.
