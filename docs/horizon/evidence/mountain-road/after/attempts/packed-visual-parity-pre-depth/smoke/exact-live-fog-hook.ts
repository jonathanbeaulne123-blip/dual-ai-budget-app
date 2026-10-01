const fogHooks=new WeakMap<THREE.Material,FogHook>();
/** One fog stage for land and cards: Three's fog, capped (horizon cards: 0.7), then a fade from the fog colour. */
function fogHook(material:THREE.Material,cap=1):FogHook{
  const existing=fogHooks.get(material);if(existing){existing.cap.value=cap;return existing;}
  const hook:FogHook={fade:{value:1},cap:{value:cap}},previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;fogHooks.set(material,hook);
  material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);shader.uniforms.uHorizonFade=hook.fade;shader.uniforms.uHorizonFogCap=hook.cap;
    shader.fragmentShader='uniform float uHorizonFade;\nuniform float uHorizonFogCap;\n'+shader.fragmentShader.replace('#include <fog_fragment>',`#ifdef USE_FOG
#ifdef FOG_EXP2
float horizonFogFactor=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
#else
float horizonFogFactor=smoothstep(fogNear,fogFar,vFogDepth);
#endif
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,min(horizonFogFactor,uHorizonFogCap));
gl_FragColor.rgb=mix(fogColor,gl_FragColor.rgb,uHorizonFade);
#endif`);};
  material.customProgramCacheKey=()=>`${previousKey.call(material)}|horizon-fog`;material.needsUpdate=true;return hook;
}