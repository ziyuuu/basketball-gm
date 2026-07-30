import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageRoots = ['apps', 'packages'];
const manifests = [];

for (const packageRoot of packageRoots) {
  const directory = new URL(`../${packageRoot}/`, import.meta.url);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestUrl = new URL(`../${packageRoot}/${entry.name}/package.json`, import.meta.url);
    const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
    manifests.push({
      directory: `${packageRoot}/${entry.name}`,
      manifest,
    });
  }
}

const byName = new Map(manifests.map((entry) => [entry.manifest.name, entry]));
const graph = new Map();
const errors = [];

for (const entry of manifests) {
  const allDependencies = {
    ...entry.manifest.dependencies,
    ...entry.manifest.devDependencies,
  };
  const workspaceDependencies = Object.keys(allDependencies).filter((name) => byName.has(name));
  graph.set(entry.manifest.name, workspaceDependencies);
}

const visiting = new Set();
const visited = new Set();

function visit(name, path) {
  if (visiting.has(name)) {
    errors.push(`Package cycle: ${[...path, name].join(' -> ')}`);
    return;
  }
  if (visited.has(name)) return;
  visiting.add(name);
  for (const dependency of graph.get(name) ?? []) visit(dependency, [...path, name]);
  visiting.delete(name);
  visited.add(name);
}

for (const name of graph.keys()) visit(name, []);

const domain = byName.get('@sunny-court/domain');
if (!domain) {
  errors.push('Missing @sunny-court/domain package.');
} else {
  const dependencies = Object.keys(domain.manifest.dependencies ?? {});
  const forbiddenDependencies = dependencies.filter(
    (name) =>
      name === 'react' ||
      name.includes('persistence') ||
      name.includes('indexeddb') ||
      name.includes('openai') ||
      name.includes('anthropic') ||
      name.includes('llm') ||
      name.includes('ui-'),
  );
  if (forbiddenDependencies.length > 0) {
    errors.push(`Domain has forbidden dependencies: ${forbiddenDependencies.join(', ')}`);
  }
}

async function collectFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await collectFiles(path)));
    else if (/\.(ts|tsx)$/.test(entry.name)) result.push(path);
  }
  return result;
}

const productionRoots = ['apps', 'packages'].map((name) => join(root, name));
const forbiddenProductionPatterns = [
  /\bOPENAI_API_KEY\b/,
  /\bANTHROPIC_API_KEY\b/,
  /\bDEEPSEEK_API_KEY\b/,
  /from ['"]openai['"]/,
  /from ['"]@anthropic-ai\//,
];

for (const productionRoot of productionRoots) {
  for (const file of await collectFiles(productionRoot)) {
    const source = await readFile(file, 'utf8');
    for (const pattern of forbiddenProductionPatterns) {
      if (pattern.test(source)) {
        errors.push(`Forbidden model/key pattern ${pattern} in ${relative(root, file)}`);
      }
    }
  }
}

if (domain) {
  const domainSource = join(root, 'packages/domain/src');
  const forbiddenDomainPatterns = [
    /from ['"]react/,
    /from ['"]node:/,
    /\bdocument\b/,
    /\bwindow\b/,
    /\bindexedDB\b/,
    /@sunny-court\/persistence/,
    /@sunny-court\/ui-/,
  ];
  for (const file of await collectFiles(domainSource)) {
    const source = await readFile(file, 'utf8');
    for (const pattern of forbiddenDomainPatterns) {
      if (pattern.test(source)) {
        errors.push(`Forbidden domain pattern ${pattern} in ${relative(root, file)}`);
      }
    }
  }
}

const requiredFiles = [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'CONTRIBUTING.md',
  'SCOPE_LEDGER.md',
  'docs/EXECUTION_PLAN_P00_P01.md',
  'docs/adr/0001-monorepo-and-boundaries.md',
  'docs/adr/0002-persistence.md',
  'docs/adr/0003-ui-state.md',
  'evidence/templates/gate-report.md',
];

for (const file of requiredFiles) {
  try {
    await readFile(join(root, file), 'utf8');
  } catch {
    errors.push(`Missing required governance file: ${file}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Boundary check passed: ${manifests.length} packages/apps, no cycles, domain isolated, model/key scan clean.`,
  );
}
