import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['admin']} title="Administrative consultation access" reason="Administration does not automatically grant access to private clinical records."/>;}
