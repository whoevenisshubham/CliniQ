import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['research','admin']} title="Case repository" reason="No consented, de-identified case repository is connected. Research membership does not grant access to identifiable clinical records."/>;}
