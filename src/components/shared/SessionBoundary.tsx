"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {listenForSessionChanges,reloadSessionDocument} from '@/lib/client/session-events';
export function SessionBoundary({children}:{children:ReactNode}){
 const [hidden,setHidden]=useState(false);
 useEffect(()=>{let changing=false;return listenForSessionChanges(()=>{if(changing)return;changing=true;flushSync(()=>setHidden(true));reloadSessionDocument();});},[]);
 return hidden?<main role="status"><h1>Session changed</h1><p>Private content has been hidden while your session is checked.</p><a href="/login">Sign in again</a></main>:children;
}
