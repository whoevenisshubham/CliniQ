import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['admin']} title="Account administration" reason="Role and account changes require explicit privileged procedures."/>;}
