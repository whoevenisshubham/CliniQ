"use client";
import {createContext,useContext,type ReactNode} from 'react';
import type {UserRole} from '@/lib/types';
export type WorkspaceUser={id:string;name:string;email:string;role:UserRole;avatar_url?:string};
const Identity=createContext<WorkspaceUser|null>(null);
// Display context only. Every request still resolves server identity and applies SQL policy.
export function WorkspaceIdentity({user,children}:{user:WorkspaceUser;children:ReactNode}){
 return <Identity.Provider value={user}>{children}</Identity.Provider>;
}
export function useWorkspaceIdentity(){return useContext(Identity);}
