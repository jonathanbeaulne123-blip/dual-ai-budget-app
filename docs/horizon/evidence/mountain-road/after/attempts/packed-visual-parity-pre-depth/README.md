# Retained pre-depth-fix comparison

These are intermediate frozen-bundle SwiftShader comparisons, not final world or device acceptance. Both bundles received identical saved world and terrain hashes reported in each summary. The theme matrix used the three poses in `actual-poses.json`; the corrected lamp close view includes an actual resident Lakeside lamp.

The 72 theme/tier/time/mode/pose pairs completed without page or shader errors. All 36 color-only pairs are pixel-exact. Of the 36 pairs rendered with directional shadows, one Classic/lite/night grove frame differs by one channel level at eight of 268,800 pixels; all others are exact. No pixel tolerance was introduced.

The original helper called the shadow color-attachment readback “depth”. That wording in these historical summaries is superseded: `readRenderTargetPixels` reads the RGBA color attachment, not the actual depth texture used by Three revision185 PCF shadows. Ordinary lamps used BasicDepthPacking; the initial packed lamp implementation used RGBADepthPacking. The three full-tier smoke images have identical non-clear masks. The saved decoding report accounts for every 557 changed color-attachment pixels within the old 8-bit quantization bin. It does not establish equality of the actual depth texture.

The source now preserves Three’s ordinary MeshDepthMaterial defaults. A separate fresh comparison follows that repair; these earlier results remain unchanged. All source/served bundle identities and PNGs are retained here. Uncompressed RGBA buffers remain in the named local /tmp run directories and are not tracked. Frozen served bundles retain the exact appended diagnostic used for these runs.
