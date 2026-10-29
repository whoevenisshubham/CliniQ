export const sessionChangeKey='cliniq-session-change';
// A random nonce is the entire cross-tab payload: no identity, token or content.
export function announceSessionChange(){try{localStorage.setItem(sessionChangeKey,crypto.randomUUID());}catch{/* Current-tab navigation still clears its document. */}}
export function listenForSessionChanges(onChange:()=>void){const listener=(event:StorageEvent)=>{if(event.key===sessionChangeKey&&event.newValue)onChange();};window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener);}
export function reloadSessionDocument(){window.location.reload();}
export function replaceSessionDocument(target:string){window.location.replace(target);}
