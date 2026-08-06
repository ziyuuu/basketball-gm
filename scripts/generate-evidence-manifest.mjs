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

const allowedPhases = new Set(['P00', 'P01', 'P01-M1', 'P02']);
const phaseFlagIndex = process.argv.indexOf('--phase');
const requestedPhase = phaseFlagIndex >= 0 ? process.argv[phaseFlagIndex + 1] : undefined;
if (phaseFlagIndex >= 0 && (!requestedPhase || !allowedPhases.has(requestedPhase))) {
  throw new Error(
    `--phase must be followed by one of ${[...allowedPhases].join(', ')}; received ${requestedPhase ?? '<missing>'}.`,
  );
}
const phases = requestedPhase ? [requestedPhase] : ['P00', 'P01'];

for (const phase of phases) {
  const directory = join(repositoryRoot, 'evidence', phase);
  const files = (await collectFiles(directory)).sort();
  const lines = [];
  for (const file of files) {
    const content = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const hash = createHash('sha256')
      .update(content)
      .digest('hex');
    lines.push(`${hash}  ${relative(directory, file).replace(/\\/g, '/')}`);
  }
  await writeFile(join(directory, 'manifest.sha256'), `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote evidence/${phase}/manifest.sha256 with ${lines.length} entries.`);
}
