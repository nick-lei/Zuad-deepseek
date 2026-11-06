import { cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { buildPlatforms } from './build-platforms.mjs';
import { npm, run } from './npm.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const artifacts = join(root, 'dist/artifacts');
const outputs = await buildPlatforms();
await mkdir(artifacts, { recursive: true });
const packed = JSON.parse(await npm(['pack', '--ignore-scripts', '--json', '--pack-destination', artifacts], root));
const stableDsh = 'dsh-plugin-zuad-media.tgz';
await cp(join(artifacts, packed[0].filename), join(artifacts, stableDsh));
const files = [packed[0].filename, stableDsh];
for (const { platform, version, directory } of outputs) {
  const filename = `zuad-media-${platform}-${version}.tar.gz`;
  await run('tar', ['-czf', join(artifacts, filename), '-C', directory, '.'], root);
  files.push(filename);
}
const checksums = await Promise.all(files.map(async file => `${createHash('sha256').update(await readFile(join(artifacts, file))).digest('hex')}  ${file}`));
await writeFile(join(artifacts, 'SHA256SUMS'), checksums.join('\n') + '\n');
console.log(JSON.stringify({ directory: artifacts, files: [...files, 'SHA256SUMS'] }, null, 2));
