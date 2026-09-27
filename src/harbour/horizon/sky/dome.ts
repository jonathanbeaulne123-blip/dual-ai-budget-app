import * as THREE from 'three';

/**
 * R2-110 (review 2: "a flat fog wall with a ruled edge where the sea should be"; STYLE §1.8, NOT-THIS "fog"): the sky was
 * a SCREEN-SPACE gradient (scene.background, zenith at the top row, the sun-side horizon colour at the bottom), while the
 * sea slab and the land fade to the scene FOG colour by view depth. Where the fogged sea ended (the slab's edge, 1–2 km out,
 * or the far plane) the background row behind it was a different colour, so the sea read as an opaque band with a straight
 * top edge. The sky is now a dome in VIEW DIRECTION: below and at the horizon it is exactly the current fog colour, so the
 * fogged sea and the sky meet with no edge at any pitch; above it the gradient rises to the zenith by elevation angle
 * (`SKY_DOME.blend`), warmed toward the sun's azimuth as before. No light, no fog on the dome itself; it follows the camera.
 */
export const SKY_DOME = { radius: 4000, /** sin(elevation) over which the horizon colour gives way to the zenith. */ blend: .25, /** sin(elevation) of the away/sun band's top. */ band: .03 } as const;
export interface SkyDome { mesh: THREE.Mesh; update(colors: { zenith: string; horizonAway: string; horizonSun: string }, fogColor: string, sunDirection: readonly [number, number, number]): void; follow(camera: THREE.Camera): void; dispose(): void }
export function createSkyDome(): SkyDome {
  const uniforms = { uZenith: { value: new THREE.Color() }, uAway: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uBlend: { value: SKY_DOME.blend }, uBand: { value: SKY_DOME.band } };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uZenith; uniform vec3 uAway; uniform vec3 uSun; uniform vec3 uFog; uniform vec3 uSunDir; uniform float uBlend; uniform float uBand; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float up = max(d.y, 0.0);
        vec2 h = normalize(d.xz + vec2(1e-5)); vec2 s = normalize(uSunDir.xz + vec2(1e-5)); float toward = pow(max(dot(h, s), 0.0), 3.0);
        vec3 band = mix(uAway, uSun, toward);
        // At and below the horizon: the fog colour exactly (the fogged sea meets it with no edge).
        vec3 c = mix(uFog, band, smoothstep(0.0, uBand, up));
        c = mix(c, uZenith, smoothstep(uBand, uBlend, up));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_DOME.radius, 48, 24), material);
  mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.name = 'horizon.skyDome';
  return {
    mesh,
    update(colors, fogColor, sunDirection) { uniforms.uZenith.value.set(colors.zenith); uniforms.uAway.value.set(colors.horizonAway); uniforms.uSun.value.set(colors.horizonSun); uniforms.uFog.value.set(fogColor); uniforms.uSunDir.value.set(sunDirection[0], sunDirection[1], sunDirection[2]); },
    follow(camera) { mesh.position.copy(camera.position); },
    dispose() { mesh.geometry.dispose(); material.dispose(); },
  };
}
/** The dome's colour for a view direction (the shader's rule, for tests and probes). `up` = sin(elevation), `toward` ∈ [0,1]. */
export function skyDomeWeights(up: number, toward: number): { fog: number; band: number; zenith: number; sunShare: number } {
  const s = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const u = Math.max(0, up), toBand = s(0, SKY_DOME.band, u), toZenith = s(SKY_DOME.band, SKY_DOME.blend, u);
  return { fog: (1 - toBand) * (1 - toZenith), band: toBand * (1 - toZenith), zenith: toZenith, sunShare: toward ** 3 };
}
