import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['research','admin']} title="Research workspace" reason="No de-identified research export or epidemiological analysis is connected."/>;}
