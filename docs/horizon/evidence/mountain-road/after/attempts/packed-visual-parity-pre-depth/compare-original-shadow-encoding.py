#!/usr/bin/env python3
"""Pure byte/source audit of the retained mixed-encoding parity smoke.
No world imports, GL, image processing libraries, or acceptance threshold.
The readback is the shadow target COLOR attachment, not its depthTexture.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math

DENOMINATOR = 255 * 256 ** 3
HALF_BASIC_BIN_NUMERATOR = 256 ** 3 // 2
CLEAR = b'\xff\xff\xff\xff'


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


def packed_numerator(rgba):
    # Exact installed Three unpackRGBAToDepth(byte / 255), expressed as one
    # integer numerator. Do NOT apply this to BasicDepthPacking grayscale.
    return 255 * ((rgba[0] << 16) + (rgba[1] << 8) + rgba[2]) + rgba[3]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture_dir', type=Path)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    directory = args.capture_dir.resolve()
    summary_path = directory / 'summary.json'
    summary = json.loads(summary_path.read_text())
    source_paths = {
        'packing': args.root / 'node_modules/three/src/renderers/shaders/ShaderChunk/packing.glsl.js',
        'depthFragment': args.root / 'node_modules/three/src/renderers/shaders/ShaderLib/depth.glsl.js',
        'defaultDepth': args.root / 'node_modules/three/src/materials/MeshDepthMaterial.js',
        'shadowMap': args.root / 'node_modules/three/src/renderers/webgl/WebGLShadowMap.js',
        'oldServed': directory / 'old-served.js',
        'newServed': directory / 'new-served.js',
    }
    source = {key: path.read_text() for key, path in source_paths.items()}
    for expected in (
        'const float UnpackDownscale = 255. / 256.;',
        'const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );',
        'const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );',
        'return dot( v, UnpackFactors4 );',
    ):
        if expected not in source['packing']:
            raise RuntimeError('Installed depth decoder changed: ' + expected)
        if expected not in source['oldServed'] or expected not in source['newServed']:
            raise RuntimeError('Served bundles do not contain the verified decoder')
    if 'this.depthPacking = BasicDepthPacking;' not in source['defaultDepth']:
        raise RuntimeError('Installed ordinary depth default changed')
    if '_depthMaterial = new MeshDepthMaterial()' not in source['shadowMap']:
        raise RuntimeError('Installed renderer ordinary depth path changed')
    if 'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );' not in source['depthFragment']:
        raise RuntimeError('Installed BasicDepthPacking definition changed')
    if 'const lampDepth =' in source['oldServed']:
        raise RuntimeError('Old served fixture no longer uses ordinary lamp depth')
    if 'const lampDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });' not in source['newServed']:
        raise RuntimeError('This audit is only for the retained pre-fix mixed-encoding captures')
    # The helper is deliberately fenced to the known readback, not a guessed
    # raw depth format. Current Three samples the separate depthTexture.
    for key in ('oldServed', 'newServed'):
        if 'renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,a)' not in source[key]:
            raise RuntimeError('Shadow readback source changed')
    report = {
        'status': 'complete',
        'captureDirectory': str(directory),
        'captureSummarySha256': sha_bytes(summary_path.read_bytes()),
        'scriptSha256': sha_bytes(Path(__file__).read_bytes()),
        'sourceProof': {key: {'path': str(source_paths[key]), 'sha256': sha_bytes(value.encode())} for key, value in source.items()},
        'threeVersion': json.loads((args.root / 'node_modules/three/package.json').read_text())['version'],
        'worldSha256': summary['worldSha256'],
        'terrainSha256': summary['terrainSha256'],
        'method': {
            'target': 'shadow.map COLOR attachment readRenderTargetPixels RGBA8, not shadow.map.depthTexture',
            'clearRgba': [255, 255, 255, 255],
            'maskRule': 'Any channel differs from the source-established all-white clear sentinel; exact per-pixel mask comparison.',
            'rgbaDecoder': '(255 * (R * 65536 + G * 256 + B) + A) / (255 * 16777216)',
            'rgbaDecoderMeaning': 'Exact real-arithmetic evaluation of installed unpackRGBAToDepth on normalized RGBA8 bytes; not a simulation of GPU floating-point evaluation.',
            'ordinaryLampDepth': 'BasicDepthPacking: grayscale 1-z, normalized RGBA8. Centre estimate z=1-R/255, half-bin=0.5/255.',
            'packedLampDepth': 'RGBADepthPacking in this retained pre-fix fixture. Existing plant custom-depth code remains RGBA on both sides.',
            'classification': 'Changed old grayscale/opaque texels are checked against the source-identified Basic-to-RGBA encoding hypothesis; no object-ID attribution is inferred from color alone.',
            'intervalCheck': 'Exact integer rational comparison against the old 8-bit grayscale quantization bin; this is encoding compatibility, not a geometry or depth acceptance tolerance.',
            'requestedShadowType': 'PCFSoftShadowMap',
            'installedEffectiveShadowType': 'PCFShadowMap (installed WebGLShadowMap translates the deprecated requested type)',
        },
        'cases': [],
        'limits': [
            'These existing files cannot establish exact equality of the actual sampled depthTexture.',
            'Do not decode the old ordinary-lamp grayscale values with unpackRGBAToDepth.',
            'Equal nonclear counts alone would be insufficient: this audit compares their exact masks.',
            'An unchanged RGBA color-attachment pixel can still conceal depth differences below its packing precision; BasicDepthPacking has only eight-bit color precision.',
            'The mixed-encoding difference is not evidence of an ULP-only delta. Actual depth delta is unavailable from these captures.',
            'The original lamp-close camera was later found to target a nonresident fixture; the corrected V03.lamp.17 pose is outside this retained smoke.',
            'Finite frozen Classic/full/day smoke only; no exhaustive theme, time, wind, device or complete live-world parity claim.',
        ],
    }
    for case in summary['cases']:
        if not case.get('shadow'):
            continue
        key = case['key']
        old_path, new_path = [directory / (key + '.' + suffix + '.shadow.rgba') for suffix in ('old', 'new')]
        old, new = old_path.read_bytes(), new_path.read_bytes()
        if len(old) != len(new) or len(old) % 4:
            raise RuntimeError('Unpaired or invalid raw buffers: ' + key)
        pixels = len(old) // 4
        width = math.isqrt(pixels)
        if width * width != pixels or pixels != case['shadow']['totalPixels']:
            raise RuntimeError('Unexpected shadow size: ' + key)
        old_nonclear = new_nonclear = mask_mismatch = changed = channels = classified = unexpected = 0
        max_centre_delta = max_bin_excess = 0
        max_witness = None
        unexpected_witnesses = []
        mask_witnesses = []
        for at in range(0, len(old), 4):
            a, b = old[at:at+4], new[at:at+4]
            old_on, new_on = a != CLEAR, b != CLEAR
            old_nonclear += old_on
            new_nonclear += new_on
            if old_on != new_on:
                mask_mismatch += 1
                if len(mask_witnesses) < 8:
                    mask_witnesses.append({'pixelIndex': at // 4, 'xyFromBottom': [at // 4 % width, at // 4 // width], 'old': list(a), 'new': list(b)})
            if a == b:
                continue
            changed += 1
            channels += sum(x != y for x, y in zip(a, b))
            if old_on and new_on and a[0] == a[1] == a[2] and a[3] == 255:
                classified += 1
                old_centre = (255 - a[0]) * 256 ** 3
                new_value = packed_numerator(b)
                delta = abs(new_value - old_centre)
                max_bin_excess = max(max_bin_excess, delta - HALF_BASIC_BIN_NUMERATOR)
                if delta > max_centre_delta:
                    max_centre_delta = delta
                    max_witness = {
                        'pixelIndex': at // 4, 'xyFromBottom': [at // 4 % width, at // 4 // width],
                        'old': list(a), 'new': list(b),
                        'oldBasicCentreDepth': old_centre / DENOMINATOR,
                        'newRgbaDecodedDepth': new_value / DENOMINATOR,
                        'absoluteCentreDifference': delta / DENOMINATOR,
                        'oldBasicBinHalfWidth': HALF_BASIC_BIN_NUMERATOR / DENOMINATOR,
                        'withinOldBasicQuantizationBin': delta <= HALF_BASIC_BIN_NUMERATOR,
                    }
            else:
                unexpected += 1
                if len(unexpected_witnesses) < 8:
                    unexpected_witnesses.append({'pixelIndex': at // 4, 'old': list(a), 'new': list(b)})
        computed = (changed, channels, old_nonclear, new_nonclear)
        logged = tuple(case['shadow'][name] for name in ('differingPixels', 'differingChannels', 'oldNonClearPixels', 'newNonClearPixels'))
        if computed != logged:
            raise RuntimeError('Readback no longer matches retained summary: ' + key)
        report['cases'].append({
            'key': key, 'width': width, 'height': width, 'bytesPerBuffer': len(old), 'pixelsPerBuffer': pixels,
            'oldRawSha256': sha_bytes(old), 'newRawSha256': sha_bytes(new),
            'differingPixels': changed, 'differingChannels': channels,
            'oldNonClearPixels': old_nonclear, 'newNonClearPixels': new_nonclear,
            'exactNonClearMask': mask_mismatch == 0, 'maskMismatchPixels': mask_mismatch, 'maskMismatchWitnesses': mask_witnesses,
            'changedPixelsCompatibleWithBasicToRgbaHypothesis': classified,
            'unclassifiedChangedPixels': unexpected, 'unclassifiedWitnesses': unexpected_witnesses,
            'maximumDecodedCentreDifference': max_centre_delta / DENOMINATOR,
            'oldBasicQuantizationHalfBin': HALF_BASIC_BIN_NUMERATOR / DENOMINATOR,
            'maximumExcessBeyondOldBasicBin': max_bin_excess / DENOMINATOR,
            'allClassifiedChangesWithinOldBasicBin': max_bin_excess == 0,
            'maximumWitness': max_witness,
            'actualDepthTextureMaximumDifference': None,
            'colorRasterExactInOriginalSummary': case['color']['exactEqual'],
        })
    report['conclusion'] = {
        'exactMasksForAllCases': all(c['exactNonClearMask'] for c in report['cases']),
        'allChangedPixelsCompatibleWithKnownEncodingChange': all(c['unclassifiedChangedPixels'] == 0 and c['allClassifiedChangesWithinOldBasicBin'] for c in report['cases']),
        'actualDepthTextureEquality': 'unavailable',
        'safeClaim': 'For these retained smoke views, shadow color-attachment nonclear masks match exactly; every changed texel is compatible with the known grayscale-to-RGBA material encoding change. Actual depthTexture equality remains unmeasured.',
    }
    destination = args.out or directory / 'decoded-shadow-comparison.json'
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(destination), 'cases': [{k: c[k] for k in ('key','pixelsPerBuffer','differingPixels','maskMismatchPixels','maximumDecodedCentreDifference','maximumExcessBeyondOldBasicBin')} for c in report['cases']], 'conclusion': report['conclusion']}, indent=2))


if __name__ == '__main__':
    main()
