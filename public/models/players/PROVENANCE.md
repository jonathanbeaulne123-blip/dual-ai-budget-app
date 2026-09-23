# Playable character derivatives

Generated reproducibly from the two user-supplied ZIP deliveries by `scripts/harbour/build-playable-characters.mjs`. The source archives, original GLBs, previews, viewers and scripts are deliberately not copied here. Each derivative preserves its named supplied GLB hash in `manifest.json`, retains selected authored face/hair/headwear/torso surfaces, and excludes the static crossed legs and bent pocket arms so Hearth's neutral procedural biped can animate walk, run, jump, slide and emotes.

`viewer.html` is a self-contained local review artifact. Its renderer and the two compact generated GLBs are embedded as data, so it works from `file://` without a network request. The viewer-only payload is not requested by the Harbour runtime.

No household data, money, network request, or external service is used.
