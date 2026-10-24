import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['admin']} title="Administrative analytics" reason="Aggregate metrics are unavailable until their sources and access contracts are accepted."/>;}
