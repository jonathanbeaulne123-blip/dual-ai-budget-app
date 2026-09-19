/** RPC result values may carry a non-enumerable runtime disposal capability.
 * Materialize data before closed-schema decoding; never relax HTTP input checks. */
export function guestRpcData<T>(value:T):T {
 const dispose=(Symbol as unknown as {dispose:symbol}).dispose;
 const descriptor=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,dispose):undefined;
 try{return structuredClone(value);}finally{if(descriptor&&'value' in descriptor&&typeof descriptor.value==='function')descriptor.value.call(value);}
}
