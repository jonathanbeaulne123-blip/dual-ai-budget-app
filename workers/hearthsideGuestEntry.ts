import {handleHearthsideGuests} from './hearthsideGuests.ts';
import type {GuestEnv} from './hearthsideGuestTypes.ts';
export {HearthsideGuestRoom,HearthsideGuestCard,HearthsideGuestIndex} from './hearthsideGuests.ts';
/** Standalone assembly for local runtime tests and separately reviewed future binding integration. */
export default {async fetch(request:Request,env:GuestEnv){return await handleHearthsideGuests(request,env)??new Response('Not found',{status:404});}};
