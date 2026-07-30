import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.name !== 'manifest.sha256') files.push(path);
  }
  return files;
}

for (const phase of ['P00', 'P01']) {
  const directory = join(repositoryRoot, 'evidence', phase);
  const files = (await collectFiles(directory)).sort();
  const lines = [];
  for (const file of files) {
    const hash = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
    lines.push(`${hash}  ${relative(directory, file)}`);
  }
  await writeFile(join(directory, 'manifest.sha256'), `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote evidence/${phase}/manifest.sha256 with ${lines.length} entries.`);
}
