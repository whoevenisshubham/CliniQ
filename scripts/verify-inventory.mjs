import {readFileSync} from 'node:fs';
import path from 'node:path';
import {root,localConfiguration,sql} from './local-supabase.mjs';
if(process.argv[2]!=='--local-synthetic')throw new Error('Explicit --local-synthetic required');
localConfiguration();
// Inventory can include deployment-sensitive function definitions. Verify its
// execution here without printing/storing SQL results or credentials in CI logs.
const result=sql(readFileSync(path.join(root,'scripts/hosted-schema-inventory.sql'),'utf8'));
if(!result.length)throw new Error('Inventory returned no evidence');
console.log(JSON.stringify({readOnlyInventory:'passed against verified isolated project',rawInventoryPublished:false}));
