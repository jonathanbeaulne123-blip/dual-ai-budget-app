/** Consume a trusted Workers RPC return value, then pass the resulting plain DTO to its strict decoder.
 * Workers adds Symbol.dispose even to plain RPC return objects. Caller-authored documents do not get this exception.
 * See https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/
 */
export function consumeWorkspaceRpc<T>(result:T):T {
  const disposeSymbol=(Symbol as SymbolConstructor&{dispose?:symbol}).dispose;
  const disposer=typeof result==='object'&&result!==null&&disposeSymbol?Object.getOwnPropertyDescriptor(result,disposeSymbol)?.value:undefined;
  let nodes=0,characters=0;const seen=new Set<object>();
  function plain(value:unknown,depth=0):unknown{
    if(++nodes>20000||depth>30)throw new Error('INVALID_WORKSPACE_RPC');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('INVALID_WORKSPACE_RPC');return value;}
    if(typeof value==='string'){characters+=value.length;if(characters>2_100_000)throw new Error('INVALID_WORKSPACE_RPC');return value;}
    if(typeof value!=='object'||seen.has(value))throw new Error('INVALID_WORKSPACE_RPC');
    if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error('INVALID_WORKSPACE_RPC');
    seen.add(value);const descriptors=Object.getOwnPropertyDescriptors(value),out:Record<string,unknown>|unknown[]=Array.isArray(value)?[]:{};
    for(const key of Reflect.ownKeys(value)){
      const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
      if(key===disposeSymbol&&typeof descriptor.value==='function')continue;
      if(typeof key!=='string'||!('value'in descriptor))throw new Error('INVALID_WORKSPACE_RPC');
      if(Array.isArray(value)&&key==='length')continue;
      if(Array.isArray(value)&&!/^(0|[1-9][0-9]*)$/.test(key))throw new Error('INVALID_WORKSPACE_RPC');
      Object.defineProperty(out,key,{value:plain(descriptors[key]!.value,depth+1),enumerable:true,writable:true,configurable:true});
    }
    seen.delete(value);return out;
  }
  try{return plain(result) as T;}finally{if(typeof disposer==='function')disposer.call(result);}
}
