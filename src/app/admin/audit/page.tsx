import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['admin']} title="Audit review" reason="Privileged audit review requires a scoped reader and accepted access boundaries."/>;}
