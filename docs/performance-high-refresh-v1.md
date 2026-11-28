# High refresh performance pass 1

Baseline: fc7a94ad1c61c3c805d1f5727b295e3977699273. No change to selected resolution, draw distance, active light budget, particle detail or asset quality.

- Replace the 33 ms effect-only rendering timer with coalesced requestAnimationFrame. Static scenes still render on demand; background tabs do not request continuous animation.
- Stop submitting inactive local and carried lights to Three.js shaders; keep all selected active lights and their existing shadow settings. Select the best lights with bounded top-k comparisons instead of sorting the whole source array.
- Reuse the per-frame object ID map; use direct group/fog lookups instead of repeated linear searches.
- Keep the static collision list separate from dynamic actor deltas. Actor-only requests no longer rebuild and compare a Map of all static obstacles.
- Generate the same 24 trail samples only for detailed visible projectiles, reusing their point buffers. Existing external queue callers retain eager trails by default.
- Seed the IndexedDB deletion baseline after opening a save, including first saves without a prior load.

Run npm ci and npm test, then npm run benchmark. Compare on the same map, viewpoint, resolution and quality. Measure frame intervals, p95, CPU and GPU separately on a real high-refresh display; no FPS improvement is claimed without hardware measurements. More invasive chunk/geometry/vision changes should follow in separate PRs.

## Cave lighting and independent point-light budgets

Keep all exposed emissive voxels rather than truncating globally to 128 near actors. Cache sources intersecting the resident region; use the eight existing direct-light slots independently from the two/four 256px point-shadow maps. Extra slots favor visible light volumes. Selection uses height as well as XY distance, preserves the stable anchor and slot identities, and does not select shadow owners from camera yaw. Voxel and placed emitters choose a face with sampled free clearance, including implicit ground and nearby rotated blocks; ties prefer horizontal faces or the underside, except lava prefers its top. Surface-mounted lamps use their mounting face. Hidden or buried emitters are excluded. Extra unshadowed lamps can illuminate through nearby partitions. More than eight overlapping sources still require selection; clustered/baked lighting is not implemented. More direct lights add shader work even with an unchanged shadow budget. Hardware performance and browser rendering require validation.

## Omnidirectional emitters and spatial light LOD

The tactical visibility sampler keeps the exposed-face sample, while the WebGL light for each luminous block is now at its actual center. A custom point-distance shadow shader discards only the emitter volume containing the light; the same block still casts shadows from other lamps and the sun. Direct and shadow budgets remain eight/two/four; remaining resident sources illuminate standard materials through a compact world-space grid of local diffuse point contributions, not through additional cube shadow passes. Each cell evaluates up to 16 detailed sources and accumulates the excess into low-frequency diffuse energy. This removes the global eight-light cutoff for standard surfaces, not all possible quality limits. The grid is rebuilt only when the effective overflow sources change, not on camera yaw. Native shadow maps use 256 pixels near the viewer and 128 at distance with 28/36-case hysteresis. Extra spatial lights lack individual shadow and specular calculations and may leak through partitions; extreme overlap uses approximate diffuse energy. Tactical visibility remains on the original indexed sampler. Browser shader/pixel tests and actual hardware performance are required before claiming a 240 Hz gain.

## Extended shadow quality distance

Point-shadow LOD now drops from 256 to 128 pixels only beyond 128 cells (previously 36) and returns to 256 below 96 cells (previously 28). The usual 80-cell render region keeps full-resolution point shadows. Shadow-owner selection has an eight-cell retention advantage instead of two for local shadow slots; the anchor retains its current valid source across small score changes as well. Native point light counts, two/four-shadow budgets, actual light radii, and solar shadow coverage remain unchanged. The change trades somewhat higher shadow rasterization cost at distance for visual stability, and cannot give individual shadow maps to every simultaneously visible emitter. Hardware measurements remain necessary.
