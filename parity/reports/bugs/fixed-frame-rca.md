# Root Cause Analysis: RViz Fixed Frame Parity Defect (Spec S3)

**Date:** 2026-10-16  
**Component:** RViz 3D Visualizer (`public/js/rviz.js`, `public/js/terminal-sim.js`, `public/js/tf-buffer.js`)  
**Specification:** `parity/reference/nav2_jazzy_spec.md` (Sections S1, S2, S3)  
**Test Suite:** `parity/e2e/fixed-frame.spec.ts` (8/8 initial test failures confirmed)

---

## 1. Executive Summary

In real ROS 2 Jazzy RViz (`rviz2`), **Global Options → Fixed Frame** is an editable combobox (`rviz_common::properties::TfFrameProperty`) backed by the TF2 buffer (`tf2_ros::Buffer`). It enumerates all known coordinate frames from both dynamic (`/tf`) and static (`/tf_static`) transforms, permits free text entry, defaults to `map`, reports standardized status diagnostics when an unknown frame is selected, and allows all visual displays to transform their geometry into the selected frame.

In the website baseline, the Fixed Frame control exhibited 8 distinct architectural flaws aligned with the 8 diagnosis causes in Spec S3. Consequently, interactive frame switching, free-text entry, transient-local static frame retention, and localStorage persistence failed in end-to-end testing.

---

## 2. Diagnosis Across the 8 Spec S3 Causes

### Cause 1: No Centralized Frame Registry (Static Frames Lost to Late Subscribers)
- **Observed Behavior:** Before launching a robot workspace, `window.__ros2lab.fixedFrame.options` only reported `["map"]`. When static transforms were published on `/tf_static` before RViz started, late-joining RViz instances did not observe them.
- **Root Cause:** TF transforms were stored in disparate ad-hoc structures (`edges()`, `S.extraEdges`, `S.model.links`) rather than an authoritative, centralized `TfBuffer` / `TfRegistry` implementing transient-local replay.
- **Reference Parity:** ROS 2 Jazzy uses `tf2_ros::Buffer` with a dynamic time cache (~10s) and a persistent static cache with infinite validity. Late subscribers to `/tf_static` receive latched messages.

### Cause 2: Options Rendered Once at Mount, Never Dynamically Refreshed
- **Observed Behavior:** The frame list did not refresh when new nodes or transforms appeared during runtime.
- **Root Cause:** The tree rows in `rviz.js` calculated `allFrames()` only when `renderTree()` was explicitly triggered. There was no subscription to `framesChanged` events or an interval refresh timer.
- **Reference Parity:** RViz2 refreshes `TfFrameProperty` frame lists periodically and when new transforms register in the TF tree.

### Cause 3: Controlled Component Without Two-Way Binding
- **Observed Behavior:** Changes made in tree editors did not consistently propagate between `sh.viz.fixedFrame`, `rvizConfig.globalOptions.fixedFrame`, and the rendering state.
- **Root Cause:** Value edits relied on transient closures (`commit(s)`) that did not bind bidirectionally to a single source of truth or dispatch change notifications to parent containers.
- **Reference Parity:** RViz properties are connected via Qt signals/slots (`changed()` / `setValue()`), ensuring immediate synchronization across visualization manager configs and display pipelines.

### Cause 4: Transient Editing DOM Lifecycle (`disabled`/`readonly`/`unmounted`)
- **Observed Behavior:** E2E tests searching for `[data-testid="fixed-frame"]` failed because no permanent `<input>` or combobox element existed in the DOM.
- **Root Cause:** `rviz.js` rendered the Fixed Frame row as a plain text `<span>`. An `<input>` was only instantiated on click/pointerdown after a timeout and immediately destroyed on blur.
- **Reference Parity:** A standard UI property tree requires accessible ARIA combobox elements (`role="combobox"`, `aria-autocomplete="list"`) with permanent existence and predictable interaction models.

### Cause 5: Overlay / Event Interception
- **Observed Behavior:** Pointer events could be occluded or swallowed by the Three.js WebGL canvas, modal dialogs, or tree splitter handles.
- **Root Cause:** Inadequate z-index layering and global event listeners on the viewer container occasionally prevented focus acquisition on inline tree editors.
- **Reference Parity:** RViz panels reside in dedicated Qt dock widgets with clear event capture boundaries separated from the Ogre/RenderWidget canvas.

### Cause 6: Plain `<select>` vs. Editable Free-Text Combobox
- **Observed Behavior:** Standard select controls reject arbitrary strings, preventing users from testing disconnected frames, custom transforms, or verifying error behavior.
- **Root Cause:** The property editor lacked a persistent editable combobox pattern allowing both dropdown selection and direct arbitrary string entry.
- **Reference Parity:** `TfFrameProperty` inherits from `EditableEnumProperty`, which allows selecting an existing item or typing any arbitrary frame name.

### Cause 7: Frame Name Normalization Deficiencies
- **Observed Behavior:** Frames with leading slashes (e.g. `/map` or `/odom`) resulted in mismatch errors during lookup and duplicate entries in lists.
- **Root Cause:** Several codepaths omitted `.replace(/^\//, '')` normalization prior to inserting or searching edges.
- **Reference Parity:** ROS 2 REP-105 and TF2 explicitly prohibit leading slashes in frame IDs. All frame lookups must strictly sanitize leading slashes.

### Cause 8: Displays Lacked FrameManager Transform Abstraction
- **Observed Behavior:** Displays directly accessed local `poses[frame]` dictionaries. When a transform was missing, displays failed silently or did not set standardized error messages.
- **Root Cause:** Absence of a centralized `FrameManager` to evaluate $T_{\text{target}\gets\text{source}}$ for every display, manage fixed frame changes, and update display status messages.
- **Reference Parity:** `rviz_common::FrameManager` is the single gateway through which all RViz displays query transforms. When $T$ fails, `FrameManager` formats exact error strings (`Could not transform from [X] to Fixed Frame [Y]`).

---

## 3. Remediation Architecture

To achieve 100% parity with Spec S3, the following core engine components are implemented:

1. **`FixedFrameCombobox` UI Component (`public/js/rviz.js`)**:
   - An accessible ARIA combobox (`role="combobox"`, `data-testid="fixed-frame"`, `aria-autocomplete="list"`, `aria-expanded`).
   - Supports selecting from enumerated frames and free-form typing.
   - Refreshes options dynamically on `framesChanged` events from `TfBuffer` and via a periodic 1 Hz fallback.
   - Persists user selection to `localStorage.getItem("ros2lab_fixed_frame_" + robotId)` and serializes to `.rviz` YAML config (`Global Options -> Fixed Frame`).

2. **Authoritative `FrameManager` (`public/js/frame-manager.js`)**:
   - Encapsulates transform queries between arbitrary frames and the current `fixedFrame`.
   - Formats exact ROS 2 Jazzy error strings:
     - `Fixed Frame [<frame>] does not exist` (when fixed frame is absent from TF).
     - `Could not transform from [<source>] to Fixed Frame [<target>]` (when display source frame cannot be resolved to fixed frame).
   - Updates `Global Status` and individual display statuses with correct severity levels (`ok`, `warn`, `error`).

3. **REP-105 URDF Bootstrap & Transient-Local `/tf_static` Replay (`public/js/tf-buffer.js`)**:
   - Automatically builds initial TF tree from the robot's URDF links and fixed joints.
   - Dynamic frames (`odom -> base_footprint`) added dynamically via odometry.
   - `map -> odom` is published ONLY when AMCL or SLAM is active; prior to that, `map` is disconnected.
   - Late-subscribing RViz instances receive all latched static transforms upon initialization.
