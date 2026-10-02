import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ['index.html', 'cadastro.html', 'baixar.html', 'styles.css']) {
  await cp(path.join(root, file), path.join(output, file));
}
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
await mkdir(path.join(output, 'vendor'), { recursive: true });
await cp(
  path.join(root, 'node_modules/fflate/esm/browser.js'),
  path.join(output, 'vendor/fflate.js'),
);

console.log(`Site estático preparado em ${output}`);
