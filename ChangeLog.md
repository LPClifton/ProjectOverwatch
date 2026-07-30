Project Overwatch v0.4.4

Release Date: July 28, 2026

Added

* Independent Weather Radar overlay control.
* Radar intelligently refreshes from the newest available RainViewer frame when restored.
* Improved radar lifecycle management.

Improved

* Radar animation pauses when the Weather Radar overlay is hidden.
* Reduced unnecessary background processing while the radar layer is disabled.
* Cleaner separation between radar display logic and overlay control.
* Continued refinement of the diagnostics logging.

Fixed

* Corrected initialWarningsLoaded variable inconsistency.
* Fixed radar layer cleanup behavior.
* Eliminated invalid radar frame (-1) initialization bug.
* Verified Weather Radar, Lightning, and NWS overlays continue to operate together correctly.
* Confirmed automatic removal of expired NWS alerts during live testing.

Status

🟢 Stable

Recommended for continued real-world driving and weather testing.

Release Date: July 29, 2026

Added

Context Bar

Fixed 

PS Status, Accuracy, Zoom

Stable
