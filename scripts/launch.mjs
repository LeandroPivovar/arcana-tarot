import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const logs = join(root, 'tmp', 'launcher');
mkdirSync(logs, { recursive: true });
const noBrowser = process.argv.includes('--no-browser');
const record = message => appendFileSync(join(logs, 'launcher.log'), `${new Date().toISOString()} ${message}\n`);

async function probe(url, isExpected) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!response.ok || !isExpected(await response.text())) throw new Error(`A porta de ${url} está ocupada por outro serviço.`);
    return true;
  } catch (error) {
    if (error.message.includes('outro serviço')) throw error;
    return false;
  }
}
const frontend = () => probe('http://127.0.0.1:5173/', text => /<title>Arcana/.test(text));
const backend = () => probe('http://127.0.0.1:3001/api/health', text => {
  try { const data = JSON.parse(text); return data.status === 'ok' && typeof data.aiConfigured === 'boolean'; } catch { return false; }
});
function start(name, args) {
  const out = openSync(join(logs, `${name}.log`), 'a');
  const err = openSync(join(logs, `${name}.error.log`), 'a');
  try {
    const child = spawn(process.execPath, args, { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', out, err] });
    child.on('error', error => appendFileSync(join(logs, 'launcher.log'), `${new Date().toISOString()} ${name}: ${error.message}\n`));
    child.unref();
  } finally { closeSync(out); closeSync(err); }
}
async function open(target) {
  // Let Windows resolve the default app without cmd.exe's nested quote rules.
  const command = `Start-Process -FilePath '${target.replaceAll("'", "''")}'`;
  await new Promise((resolve, reject) => {
    const child = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('O Windows não conseguiu abrir o navegador.')));
  });
}
try {
  record('Atalho acionado.');
  if (!existsSync(join(root, 'node_modules', 'vite', 'bin', 'vite.js'))) throw new Error('Dependências ausentes. Execute npm install na pasta do projeto.');
  const [frontReady, backReady] = await Promise.all([frontend(), backend()]);
  if (!backReady) start('backend', ['server/index.mjs']);
  if (!frontReady) start('frontend', ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '5173', '--strictPort']);
  const deadline = Date.now() + 30000;
  let ready = frontReady && backReady;
  while (!ready && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const status = await Promise.all([frontend(), backend()]);
    ready = status.every(Boolean);
  }
  if (!ready) throw new Error('A plataforma não iniciou em 30 segundos. Consulte os arquivos de log nesta pasta.');
  record('Frontend e API prontos em http://127.0.0.1:5173/.');
  if (!noBrowser) { await open('http://127.0.0.1:5173/'); record('Abertura do navegador solicitada ao Windows.'); }
  console.log('Arcana pronta em http://localhost:5173/');
} catch (error) {
  appendFileSync(join(logs, 'launcher.log'), `${new Date().toISOString()} ${error.message}\n`);
  if (!noBrowser) await open(join(logs, 'launcher.log')).catch(() => {});
  else console.error(error.message);
  process.exitCode = 1;
}
