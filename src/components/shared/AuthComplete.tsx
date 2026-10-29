"use client";
import {useEffect,useRef} from 'react';
import {announceSessionChange,replaceSessionDocument} from '@/lib/client/session-events';

// The server derives target from the verified principal and exact return allowlist.
export function AuthComplete({target}:{target:string}){
 const started=useRef(false);
 useEffect(()=>{if(started.current)return;started.current=true;announceSessionChange();replaceSessionDocument(target);},[target]);
 return <main><h1>Sign-in confirmed</h1><p>Opening your authorized workspace.</p><a href={target}>Continue to your workspace</a></main>;
}
