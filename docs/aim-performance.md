# Creative aiming performance

The HUD identified a 4.6 ms peak in aiming while the display was running at 182 FPS. Native-refresh rendering is retained.

Use a finite ray segment for the active construction/tool reach. Apply conservative world-space bounds rejection even to small instanced batches and reject instance buckets beyond the local-space segment (including scaled transforms). Keep normal unlimited map picking and restore the shared Raycaster state after each query. For the construction preview, share exact relief/ground intersections between the world hit and frontmost object pick, retaining the existing nearest-hit and cutaway rules. Actual click actions still compute a fresh hit. No reduced preview cadence, graphics quality, or frame cap.

Compare aiming peaks and p95/worst frame intervals on the same map while spinning. The added tests check parity of the shared query, reach rejection, scaled instances, and that ray limits do not leak. Hardware gains are not claimed until measured.