import {createGodHost} from './god-runtime.js';
export {createGodHost,knowledge,HOST_PROMPT,buildGodInput,validateHostOutput,renderHostOutput,templateNarration} from './god-runtime.js';
const host=createGodHost();
export const narrate=state=>host.narrate(state);
export const getGodStatus=()=>host.status();
