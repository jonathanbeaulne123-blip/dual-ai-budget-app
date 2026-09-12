import {Capacitor,registerPlugin} from '@capacitor/core';
import {installNativeSupabaseAuth,readHearthAuthConfig} from '../auth/supabaseSession.ts';
import {createMemoryTokenStore,setGoogleTokenStore} from '../google/tokens.ts';
import {NativeWidgetController,type NativeWidgetPlugin} from './nativeWidget.ts';
import {NativeSessionStore} from './nativeSessionStore.ts';
import {NATIVE_AUTH_EVENT,NativeAuthController,type NativeAuthPlugin} from './nativeAuth.ts';
let controller:NativeAuthController|null=null;
let widget:NativeWidgetController|null=null;
let widgetPlugin:NativeWidgetPlugin|null=null;
export const nativeWidgetPlugin=()=>widgetPlugin;
export const nativeWidgetController=()=>widget;
let boot:Promise<void>|null=null;
export const nativeAuthController=()=>controller;
/** Call before mounting React. Importing this module never opens AR, a browser, or a provider. */
export function hydrateNativeAuthentication():Promise<void>{
  if(!Capacitor.isNativePlatform())return Promise.resolve();if(boot)return boot;
  boot=(async()=>{
    // Direct Google-suite connectors are separately gated. Never read/write their browser tokens natively.
    setGoogleTokenStore(createMemoryTokenStore());
    for (const key of Object.keys(window.localStorage)) {
      if (/^hearth:v1:(?:supabase-auth:(?:development|production)$|(?:development|production):(?:google|gcal):)/.test(key)) window.localStorage.removeItem(key);
    }
    const plugin=registerPlugin<NativeAuthPlugin & NativeWidgetPlugin>('HearthsideNative'),config=readHearthAuthConfig();
    // Install the fail-closed projection before awaiting anything or rendering the app.
    widgetPlugin=plugin;widget=new NativeWidgetController(plugin);
    const store=new NativeSessionStore(plugin,config?.supabaseUrl??'https://disabled.invalid',()=>widget!.clear());
    controller=new NativeAuthController(plugin,readHearthAuthConfig,fetch,Date.now,status=>{if(status.phase==='complete'){const path=controller?.takeReturnPath();if(path)window.history.replaceState({},'',path);}window.dispatchEvent(new CustomEvent(NATIVE_AUTH_EVENT,{detail:status}));});
    installNativeSupabaseAuth(store,controller);
    if((await plugin.authStorageVersion()).version!==2)throw new Error("Update the native companion for secure sign-in recovery.");
    await store.hydrate();
    await widget.enterScope(null);
    // Secure storage failures prevent mounting. Network/browser recovery errors are shown in-app,
    // while the local room and existing hydrated session remain usable.
    try{await controller.recover();}catch{/* status contains the recoverable failure; no token logging */}
    const resume=()=>{if(document.visibilityState==='visible')void controller?.recover().catch(()=>{});};
    document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
  })().catch(error=>{boot=null;throw error;});return boot;
}
