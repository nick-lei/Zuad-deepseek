import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { delimiter } from 'node:path';

export async function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}` } });
    let output = '', errors = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { errors += data; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(output) : reject(new Error(`${command} exited with ${code}\n${output}\n${errors}`)));
  });
}

export async function npm(args, cwd) {
  const candidates = [process.env.npm_execpath];
  for (const directory of [dirname(process.execPath), ...(process.env.PATH || '').split(delimiter)]) {
    candidates.push(join(directory, 'node_modules/npm/bin/npm-cli.js'), join(directory, '../lib/node_modules/npm/bin/npm-cli.js'));
  }
  for (const cli of candidates.filter(Boolean)) {
    if (!cli.endsWith('.js') || !await access(cli).then(() => true, () => false)) continue;
    return run(process.execPath, [cli, ...args], cwd);
  }
  throw new Error('npm CLI was not found. Install Node.js with npm before building or installing the plugin.');
}
