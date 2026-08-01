import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const packageRoots = ['apps', 'packages'];
const legacyPackages = [
  '@sunny-court/domain',
  '@sunny-court/application',
  '@sunny-court/persistence',
  '@sunny-court/persistence-node',
  '@sunny-court/persistence-indexeddb',
];
const sourceExtensions = new Set(['.ts', '.tsx', '.mjs']);

function normalizedPath(path) {
  return path.replaceAll('\\', '/');
}

function relativePath(root, path) {
  return normalizedPath(relative(root, path));
}

function isSourceFile(path) {
  return sourceExtensions.has(extname(path));
}

function isProductionSource(path) {
  return isSourceFile(path) && !/\.(test|spec)\.(ts|tsx|mjs)$/.test(path);
}

async function collectFiles(directory) {
  const result = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return result;
    throw error;
  }

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await collectFiles(path)));
    else if (isSourceFile(path)) result.push(path);
  }
  return result;
}

function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) specifiers.add(specifier);
    }
  }
  return [...specifiers];
}

function packageNameForSpecifier(specifier, byName) {
  return [...byName.keys()]
    .sort((left, right) => right.length - left.length)
    .find((name) => specifier === name || specifier.startsWith(`${name}/`));
}

function isLegacySpecifier(file, specifier) {
  if (specifier.includes('/legacy-p01')) return true;
  if (!specifier.startsWith('.')) return false;
  return normalizedPath(resolve(dirname(file), specifier)).includes('/legacy-p01');
}

function isV2Path(path) {
  const normalized = normalizedPath(path);
  return (
    normalized.startsWith('packages/content-p02/src/') ||
    /\/src\/(?:game|match|v2)(?:\/|$)/.test(normalized) ||
    /(?:^|[-_.])v2(?:[-_.]|$)/.test(normalized.split('/').at(-1) ?? '')
  );
}

function isV2Specifier(root, file, specifier) {
  if (
    specifier === '@sunny-court/content-p02' ||
    specifier.startsWith('@sunny-court/content-p02/')
  ) {
    return true;
  }
  if (!specifier.startsWith('.')) return /(?:^|[-_.])v2(?:[-_.]|$)/.test(specifier);
  return isV2Path(relativePath(root, resolve(dirname(file), specifier)));
}

function isApplicationOrPersistenceSpecifier(specifier) {
  return /^@sunny-court\/(?:application|persistence(?:-node|-indexeddb)?)(?:\/|$)/.test(specifier);
}

function isSunnyCourtPackageSpecifier(specifier) {
  return specifier.startsWith('@sunny-court/');
}

function checkCycles(graph, errors) {
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
}

async function readManifests(root) {
  const manifests = [];
  for (const packageRoot of packageRoots) {
    const directory = join(root, packageRoot);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const packageDirectory = join(directory, entry.name);
      const manifestPath = join(packageDirectory, 'package.json');
      try {
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        manifests.push({
          directory: `${packageRoot}/${entry.name}`,
          manifest,
          packageDirectory,
        });
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
        throw error;
      }
    }
  }
  return manifests;
}

function declaredWorkspaceDependencies(manifest, byName) {
  const allDependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  return new Set(Object.keys(allDependencies).filter((name) => byName.has(name)));
}

function packageForFile(file, manifests) {
  return manifests.find(
    (entry) => file === entry.packageDirectory || file.startsWith(`${entry.packageDirectory}/`),
  );
}

async function runBoundaryCheck(root, { fixture = false } = {}) {
  const manifests = await readManifests(root);
  const byName = new Map(manifests.map((entry) => [entry.manifest.name, entry]));
  const errors = [];
  const graph = new Map();
  const declaredDependencies = new Map();

  for (const entry of manifests) {
    const declared = declaredWorkspaceDependencies(entry.manifest, byName);
    declaredDependencies.set(entry.manifest.name, declared);
    graph.set(entry.manifest.name, new Set(declared));
  }

  const sourceFiles = [];
  for (const entry of manifests) {
    const packageSources = await collectFiles(join(entry.packageDirectory, 'src'));
    sourceFiles.push(...packageSources.filter(isProductionSource));
  }

  const sources = [];
  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    const imports = extractImportSpecifiers(source);
    sources.push({ file, source, imports, path: relativePath(root, file) });

    const owner = packageForFile(file, manifests);
    if (!owner) continue;
    for (const specifier of imports) {
      const dependency = packageNameForSpecifier(specifier, byName);
      if (!dependency || dependency === owner.manifest.name) continue;
      graph.get(owner.manifest.name)?.add(dependency);
      if (!declaredDependencies.get(owner.manifest.name)?.has(dependency)) {
        errors.push(
          `Undeclared workspace dependency: ${owner.manifest.name} imports ${dependency} in ${relativePath(root, file)}.`,
        );
      }
    }
  }

  checkCycles(graph, errors);

  const domain = byName.get('@sunny-court/domain');
  if (!domain) {
    if (!fixture) errors.push('Missing @sunny-court/domain package.');
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

  const forbiddenProductionPatterns = [
    /\bOPENAI_API_KEY\b/,
    /\bANTHROPIC_API_KEY\b/,
    /\bDEEPSEEK_API_KEY\b/,
    /from ['"]openai['"]/,
    /from ['"]@anthropic-ai\//,
  ];
  for (const entry of sources) {
    for (const pattern of forbiddenProductionPatterns) {
      if (pattern.test(entry.source)) {
        errors.push(`Forbidden model/key pattern ${pattern} in ${entry.path}`);
      }
    }
  }

  if (domain) {
    const domainSources = sources.filter((entry) => entry.path.startsWith('packages/domain/src/'));
    const forbiddenDomainPatterns = [
      /from ['"]react/,
      /from ['"]node:/,
      /\bdocument\b/,
      /\bwindow\b/,
      /\bindexedDB\b/,
      /@sunny-court\/persistence/,
      /@sunny-court\/ui-/,
    ];
    for (const entry of domainSources) {
      for (const pattern of forbiddenDomainPatterns) {
        if (pattern.test(entry.source)) {
          errors.push(`Forbidden domain pattern ${pattern} in ${entry.path}`);
        }
      }
    }
  }

  for (const entry of sources) {
    const isLegacySource = entry.path.includes('/legacy-p01/');
    const isCoreSource = entry.path.startsWith('packages/domain/src/core/');
    const isMatchSource = entry.path.startsWith('packages/domain/src/match/');
    const isV2Source = isV2Path(entry.path);
    const isWebSource = entry.path.startsWith('apps/web/src/');
    const isCliSource = entry.path.startsWith('apps/sim-cli/src/');

    if (isLegacySource) {
      for (const specifier of entry.imports) {
        if (isSunnyCourtPackageSpecifier(specifier) && !specifier.endsWith('/legacy-p01')) {
          errors.push(
            `Legacy source must use an explicit /legacy-p01 package import: ${entry.path} -> ${specifier}.`,
          );
        }
        if (isV2Specifier(root, entry.file, specifier)) {
          errors.push(
            `Legacy source must not import future V2 production code: ${entry.path} -> ${specifier}.`,
          );
        }
      }
    }

    if (
      isCoreSource &&
      entry.imports.some((specifier) => isLegacySpecifier(entry.file, specifier))
    ) {
      errors.push(`Core must not import Legacy P01: ${entry.path}.`);
    }

    if (isV2Source && entry.imports.some((specifier) => isLegacySpecifier(entry.file, specifier))) {
      errors.push(`Future V2 production source must not import Legacy P01: ${entry.path}.`);
    }

    if (isMatchSource) {
      if (entry.imports.some(isApplicationOrPersistenceSpecifier)) {
        errors.push(`domain/match must not import application or persistence: ${entry.path}.`);
      }
      if (
        entry.imports.some((specifier) => isLegacySpecifier(entry.file, specifier)) ||
        entry.source.includes('resolveCurrentWeek')
      ) {
        errors.push(`domain/match must not import a mutable GameState resolver: ${entry.path}.`);
      }
    }

    if (
      isWebSource &&
      entry.imports.some((specifier) =>
        /^@sunny-court\/(?:application|domain|persistence(?:-node|-indexeddb)?)(?:\/|$)/.test(
          specifier,
        ),
      )
    ) {
      errors.push(
        `Web must not import application/domain/persistence production code: ${entry.path}.`,
      );
    }

    if (
      isCliSource &&
      entry.source.includes('resolveCurrentWeek') &&
      entry.imports.some((specifier) => /^@sunny-court\/domain(?:\/|$)/.test(specifier))
    ) {
      errors.push(`Production CLI must not call a domain state-change resolver: ${entry.path}.`);
    }
  }

  const web = byName.get('@sunny-court/web');
  if (web) {
    const webDependencies = Object.keys({
      ...web.manifest.dependencies,
      ...web.manifest.devDependencies,
    });
    const forbiddenWebDependencies = webDependencies.filter((name) =>
      /^@sunny-court\/(?:application|domain|persistence(?:-node|-indexeddb)?)(?:\/|$)/.test(name),
    );
    if (forbiddenWebDependencies.length > 0) {
      errors.push(
        `Web has forbidden production dependencies: ${forbiddenWebDependencies.join(', ')}.`,
      );
    }
  }

  for (const packageName of legacyPackages) {
    const entry = byName.get(packageName);
    if (!entry) {
      if (!fixture) errors.push(`Missing required Legacy package: ${packageName}.`);
      continue;
    }
    if (entry.manifest.exports?.['./legacy-p01'] !== './src/legacy-p01/index.ts') {
      errors.push(`Missing exact ./legacy-p01 export for ${packageName}.`);
    }
    const rootIndex = join(entry.packageDirectory, 'src', 'index.ts');
    try {
      const source = await readFile(rootIndex, 'utf8');
      const executable = source.replace(/^\s*\/\/.*$/gm, '').replaceAll(/\s+/g, '');
      if (executable !== "export*from'./legacy-p01/index.js';") {
        errors.push(
          `Root compatibility entrypoint must be a thin Legacy re-export: ${relativePath(root, rootIndex)}.`,
        );
      }
    } catch {
      errors.push(`Missing root compatibility entrypoint for ${packageName}.`);
    }
  }

  if (!fixture) {
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
  }

  return { errors, manifests };
}

const fixtureFlagIndex = process.argv.indexOf('--fixture');
const fixturePath = fixtureFlagIndex >= 0 ? process.argv[fixtureFlagIndex + 1] : undefined;
if (fixtureFlagIndex >= 0 && !fixturePath) {
  throw new Error('--fixture requires a directory path.');
}

const root = fixturePath ? resolve(process.cwd(), fixturePath) : repositoryRoot;
const { errors, manifests } = await runBoundaryCheck(root, { fixture: fixturePath !== undefined });

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Boundary check passed: ${manifests.length} packages/apps, no cycles, domain isolated, Legacy/V2 boundaries enforced.`,
  );
}
