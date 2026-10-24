import {DeferredWorkspace} from '@/components/shared/DeferredWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <DeferredWorkspace allowed={['admin']} title="Deployment settings" reason="Provider and hosted configuration require verified account access and reviewed operational changes."/>;}
