import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const container = 'supabase_db_cliniq-v2-m1-isolated';
export function localConfiguration() {
  const raw = execFileSync(process.execPath, [path.join(root, 'node_modules/supabase/dist/supabase.js'), 'status', '--workdir', 'tests/infra', '--output', 'json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DO_NOT_TRACK: '1' } });
  const config = JSON.parse(raw);
  const url = new URL(config.API_URL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '54321') throw new Error('Refusing non-isolated Supabase endpoint');
  const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
  if (info.Name !== '/' + container || info.Config.Labels['com.supabase.cli.project'] !== 'cliniq-v2-m1-isolated') throw new Error('Unexpected local database identity');
  return config;
}
export function sql(text) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: text, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
}
