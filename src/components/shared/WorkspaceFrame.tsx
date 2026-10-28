import type {ReactNode} from 'react';
import type {Principal} from '@/lib/server/auth/context';
import {WorkspaceIdentity} from './WorkspaceIdentity';
export function WorkspaceFrame({principal:p,children}:{principal:Principal;children:ReactNode}){
 return <WorkspaceIdentity key={p.id} user={{id:p.id,name:p.name,email:p.email,role:p.role,avatar_url:p.avatar_url}}>{children}</WorkspaceIdentity>;
}
