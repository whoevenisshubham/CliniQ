import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['research','admin']} title="Epidemiology" reason="No authorized aggregate dataset or validated epidemiological computation is connected."/>;}
