# Root Cause Analysis: RViz Fixed Frame (Spec S3)

**Date**: 2026-10-15  
**Component**: RViz2 Browser Emulation (`public/js/rviz.js`, `public/js/tf-buffer.js`)  

## Identified Causes (per Spec S3)
1. **No frame registry / static frames never seen**: Previous implementations only tracked dynamic `/tf` transforms and missed latched `/tf_static` messages or URDF-derived static frames.
2. **Options rendered once at mount, never refreshed**: Dropdowns / comboboxes populated at initialization without listening to `framesChanged` events or periodic 1-second refresh ticks.
3. **Controlled component without working `onChange`, or store overwrites value**: Local state desynchronized from `rvizConfig.globalOptions.fixedFrame`.
4. **Disabled / readonly / pointer-events:none**: CSS wrappers preventing user interaction.
5. **Overlay intercepting clicks**: Invisible floating panels or modals blocking pointer events on the combobox.
6. **Plain `<select>` element**: Restrictive native dropdown preventing custom frame names (free text entry required by `TfFrameProperty`).
7. **Name normalization mismatch**: Leading slashes (`/map` vs `map`) causing lookup failures.
8. **Renderer ignoring selected value**: Hardcoded `"map"` reference in display rendering loops.

## Solution Architecture
- **Combobox**: Replaced static `<select>` with an editable ARIA combobox (`data-testid="fixed-frame"`) supporting both dropdown selection and free-text entry.
- **FrameManager**: Centralized transform resolver managing static (`/tf_static`) and dynamic (`/tf`) buffers with authority tracking and automatic `framesChanged` event emission.
- **Error Handling**: Unknown frames trigger Global Status error messages matching real RViz behavior.
