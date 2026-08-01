import { readFile, readdir } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import ts from 'typescript';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const packageRoots = ['apps', 'packages'];
const legacyPackages = [
  '@sunny-court/domain',
  '@sunny-court/application',
  '@sunny-court/persistence',
  '@sunny-court/persistence-node',
  '@sunny-court/persistence-indexeddb',
];
const cliAllowedDomainValueImports = new Set([
  'CALENDAR_WEEKS_PER_RUN',
  'OPERATION_WEEKS_PER_RUN',
  'createInitialGame',
  'stableHash',
]);
const cliAllowedDomainTypeImports = new Set(['GameState']);
const matchAllowedCoreImports = new Set(['nextRngState', 'seedFromText']);
const dynamicLoaderSpecifiers = new Set(['module', 'node:module']);
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const legacyCompatibilityWrapperTargets = new Map([
  ['packages/domain/src/constants.ts', './legacy-p01/constants.js'],
  ['packages/domain/src/create-game.ts', './legacy-p01/create-game.js'],
  ['packages/domain/src/errors.ts', './legacy-p01/errors.js'],
  ['packages/domain/src/hash.ts', './legacy-p01/hash.js'],
  ['packages/domain/src/index.ts', './legacy-p01/index.js'],
  ['packages/domain/src/model-a.ts', './legacy-p01/model-a.js'],
  ['packages/domain/src/rng.ts', './legacy-p01/rng.js'],
  ['packages/domain/src/schemas.ts', './legacy-p01/schemas.js'],
  ['packages/domain/src/time.ts', './legacy-p01/time.js'],
  ['packages/application/src/index.ts', './legacy-p01/index.js'],
  ['packages/persistence/src/index.ts', './legacy-p01/index.js'],
  ['packages/persistence-node/src/index.ts', './legacy-p01/index.js'],
  ['packages/persistence-indexeddb/src/index.ts', './legacy-p01/index.js'],
]);
const legacyCompatibilityWrappers = new Set(legacyCompatibilityWrapperTargets.keys());
const legacyPackageDirectories = [
  'packages/domain/src/',
  'packages/application/src/',
  'packages/persistence/src/',
  'packages/persistence-node/src/',
  'packages/persistence-indexeddb/src/',
];
const nodePlatformSpecifiers = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => (name.startsWith('node:') ? name : `node:${name}`)),
]);

function normalizedPath(path) {
  return path.replaceAll('\\', '/');
}

function stripModuleSuffix(specifier) {
  const suffixIndex = specifier.search(/[?#]/);
  return suffixIndex > 0 ? specifier.slice(0, suffixIndex) : specifier;
}

function extractHtmlModuleScripts(html) {
  const scripts = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const attributes = match[1] ?? '';
    if (!/\btype\s*=\s*(?:"module"|'module'|module)(?:\s|$)/i.test(attributes)) continue;
    const sourceMatch = attributes.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    scripts.push({
      body: match[2] ?? '',
      source: sourceMatch?.[1] ?? sourceMatch?.[2] ?? sourceMatch?.[3],
    });
  }
  return scripts;
}

function relativePath(root, path) {
  return normalizedPath(relative(root, path));
}

function isSourceFile(path) {
  return sourceExtensions.has(extname(path));
}

function isProductionSource(path) {
  return isSourceFile(path) && !/\.(test|spec)\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(path);
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

function extractImportRecords(source, file) {
  const extension = extname(file);
  const scriptKind =
    extension === '.tsx'
      ? ts.ScriptKind.TSX
      : extension === '.jsx'
        ? ts.ScriptKind.JSX
        : ['.js', '.mjs', '.cjs'].includes(extension)
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const records = [];

  function addRecord(specifier, kind, bindings = []) {
    records.push({ specifier, kind, bindings });
  }

  for (const reference of sourceFile.referencedFiles) {
    addRecord(reference.fileName, 'reference-path');
  }
  for (const reference of sourceFile.typeReferenceDirectives) {
    addRecord(reference.fileName, 'reference-types');
  }

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      const bindings = [];
      const clause = statement.importClause;
      if (clause?.name) {
        bindings.push({
          imported: 'default',
          local: clause.name.text,
          typeOnly: clause.isTypeOnly,
        });
      }
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        bindings.push({
          imported: '*',
          local: clause.namedBindings.name.text,
          typeOnly: clause.isTypeOnly,
        });
      }
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          bindings.push({
            imported: (element.propertyName ?? element.name).text,
            local: element.name.text,
            typeOnly: clause.isTypeOnly || element.isTypeOnly,
          });
        }
      }
      addRecord(statement.moduleSpecifier.text, 'import', bindings);
      continue;
    }

    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteralLike(statement.moduleReference.expression)
    ) {
      addRecord(statement.moduleReference.expression.text, 'import-equals', [
        {
          imported: '*',
          local: statement.name.text,
          typeOnly: statement.isTypeOnly,
        },
      ]);
      continue;
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      const bindings = [];
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          bindings.push({
            imported: (element.propertyName ?? element.name).text,
            local: element.name.text,
            typeOnly: statement.isTypeOnly || element.isTypeOnly,
          });
        }
      } else {
        bindings.push({ imported: '*', local: '*', typeOnly: statement.isTypeOnly });
      }
      addRecord(statement.moduleSpecifier.text, 'export', bindings);
    }
  }

  const getBuiltinModuleFunctions = new Set();
  const processModuleObjects = new Set();
  for (const record of records) {
    if (record.kind !== 'import' || !['node:process', 'process'].includes(record.specifier)) {
      continue;
    }
    for (const binding of record.bindings) {
      if (binding.imported === 'getBuiltinModule') getBuiltinModuleFunctions.add(binding.local);
      if (['*', 'default'].includes(binding.imported)) processModuleObjects.add(binding.local);
    }
  }

  function visitCalls(node) {
    if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      addRecord(
        ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)
          ? argument.literal.text
          : undefined,
        'import-type',
      );
    }

    if (ts.isCallExpression(node)) {
      const callExpression = ts.skipParentheses(node.expression);
      const isDynamicImport = callExpression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(callExpression) && callExpression.text === 'require';
      const calledObject =
        ts.isPropertyAccessExpression(callExpression) ||
        ts.isElementAccessExpression(callExpression)
          ? ts.skipParentheses(callExpression.expression)
          : undefined;
      const calledProperty = ts.isPropertyAccessExpression(callExpression)
        ? callExpression.name.text
        : ts.isElementAccessExpression(callExpression) &&
            callExpression.argumentExpression &&
            ts.isStringLiteralLike(callExpression.argumentExpression)
          ? callExpression.argumentExpression.text
          : undefined;
      const isRequireResolve =
        calledObject !== undefined &&
        ts.isIdentifier(calledObject) &&
        calledObject.text === 'require' &&
        calledProperty === 'resolve';
      const isModuleRequire =
        calledObject !== undefined &&
        ts.isIdentifier(calledObject) &&
        calledObject.text === 'module' &&
        calledProperty === 'require';
      const isImportMetaGlob =
        calledObject !== undefined &&
        ts.isMetaProperty(calledObject) &&
        calledObject.keywordToken === ts.SyntaxKind.ImportKeyword &&
        ['glob', 'globEager'].includes(calledProperty ?? '');
      const isGetBuiltinModule =
        (ts.isIdentifier(callExpression) && getBuiltinModuleFunctions.has(callExpression.text)) ||
        (calledObject !== undefined &&
          ts.isIdentifier(calledObject) &&
          (calledObject.text === 'process' || processModuleObjects.has(calledObject.text)) &&
          calledProperty === 'getBuiltinModule');
      if (
        isDynamicImport ||
        isRequire ||
        isRequireResolve ||
        isModuleRequire ||
        isImportMetaGlob ||
        isGetBuiltinModule
      ) {
        const argument = node.arguments[0];
        addRecord(
          argument && ts.isStringLiteralLike(argument) ? argument.text : undefined,
          isDynamicImport
            ? 'dynamic-import'
            : isImportMetaGlob
              ? 'import-meta-glob'
              : isGetBuiltinModule
                ? 'get-builtin-module'
                : isRequireResolve
                  ? 'require-resolve'
                  : isModuleRequire
                    ? 'module-require'
                    : 'require',
        );
      }
    }
    ts.forEachChild(node, visitCalls);
  }
  visitCalls(sourceFile);

  return records;
}

function isThinWildcardReExport(source, file, expectedSpecifier) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.statements.length !== 1) return false;
  const [statement] = sourceFile.statements;
  return (
    statement !== undefined &&
    ts.isExportDeclaration(statement) &&
    !statement.isTypeOnly &&
    statement.exportClause === undefined &&
    statement.moduleSpecifier !== undefined &&
    ts.isStringLiteralLike(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === expectedSpecifier
  );
}

function packageNameForSpecifier(specifier, byName) {
  if (typeof specifier !== 'string') return undefined;
  const request = stripModuleSuffix(specifier);
  return [...byName.keys()]
    .sort((left, right) => right.length - left.length)
    .find((name) => request === name || request.startsWith(`${name}/`));
}

function isLegacySpecifier(file, specifier) {
  if (typeof specifier !== 'string') return false;
  if (legacyPackages.includes(specifier)) return true;
  if (specifier.includes('/legacy-p01')) return true;
  if (!specifier.startsWith('.')) return false;
  return normalizedPath(resolve(dirname(file), stripModuleSuffix(specifier))).includes(
    '/legacy-p01',
  );
}

function isV2Path(path) {
  const normalized = normalizedPath(path);
  return (
    normalized.startsWith('packages/content-p02/src/') ||
    normalized.startsWith('packages/content-schema/src/p02/') ||
    normalized.startsWith('apps/sim-cli/src/p02/') ||
    /apps\/sim-cli\/src\/p02[-_.]/.test(normalized) ||
    /\/src\/(?:game|match|v2|p02)(?:\/|$)/i.test(normalized) ||
    /(?:^|[-_.])(?:v2|p02)(?:[-_.]|$)/i.test(normalized.split('/').at(-1) ?? '')
  );
}

function isLegacyPath(path) {
  const normalized = normalizedPath(path);
  return /\/legacy-p01(?:\/|\.[^/]+$)/.test(normalized);
}

function isCorePath(path) {
  const normalized = normalizedPath(path);
  return (
    normalized.startsWith('packages/domain/src/core/') ||
    /packages\/domain\/src\/core\.[^/]+$/.test(normalized)
  );
}

function isApprovedCoreSource(path, fixture) {
  const normalized = normalizedPath(path);
  return fixture
    ? /packages\/domain\/src\/core\/rng-primitives\.[^/]+$/.test(normalized)
    : normalized === 'packages/domain/src/core/rng-primitives.ts';
}

function isMatchPath(path) {
  const normalized = normalizedPath(path);
  return (
    normalized.startsWith('packages/domain/src/match/') ||
    /packages\/domain\/src\/match\.[^/]+$/.test(normalized)
  );
}

function isV2ProductionPath(path) {
  const normalized = normalizedPath(path);
  if (isV2Path(normalized)) return true;
  if (!legacyPackageDirectories.some((directory) => normalized.startsWith(directory))) {
    return false;
  }
  return !(
    isLegacyPath(normalized) ||
    isCorePath(normalized) ||
    legacyCompatibilityWrappers.has(normalized)
  );
}

function isV2Specifier(root, file, specifier) {
  if (typeof specifier !== 'string') return false;
  if (
    specifier === '@sunny-court/content-p02' ||
    specifier.startsWith('@sunny-court/content-p02/')
  ) {
    return true;
  }
  if (!specifier.startsWith('.')) {
    return /(?:^|[-_.])(?:v2|p02)(?:[-_.]|$)/i.test(specifier);
  }
  return isV2Path(relativePath(root, resolve(dirname(file), stripModuleSuffix(specifier))));
}

function isApplicationOrPersistenceSpecifier(specifier) {
  return /^@sunny-court\/(?:application|persistence(?:-node|-indexeddb)?)(?:\/|$)/.test(specifier);
}

function isMatchMutableStateImport(root, file, record, fixture) {
  if (record.target) {
    const target = relativePath(root, record.target);
    if (isApprovedCoreSource(target, fixture)) {
      return !(
        record.kind === 'import' &&
        record.bindings.length > 0 &&
        record.bindings.every((binding) => matchAllowedCoreImports.has(binding.imported))
      );
    }
    return !isMatchPath(target);
  }

  const { specifier } = record;
  if (typeof specifier !== 'string') return true;
  if (specifier.startsWith('.')) {
    const target = relativePath(root, resolve(dirname(file), specifier));
    return !(isApprovedCoreSource(target, fixture) || isMatchPath(target));
  }
  if (specifier === '@sunny-court/domain') return true;
  if (!specifier.startsWith('@sunny-court/domain/')) return false;
  if (specifier === '@sunny-court/domain/core') {
    return !(
      record.kind === 'import' &&
      record.bindings.length > 0 &&
      record.bindings.every((binding) => matchAllowedCoreImports.has(binding.imported))
    );
  }
  return !(
    specifier === '@sunny-court/domain/match' || specifier.startsWith('@sunny-court/domain/match/')
  );
}

function isWebForbiddenImport(root, record) {
  if (
    typeof record.specifier === 'string' &&
    /^@sunny-court\/(?:application|domain|persistence(?:-node|-indexeddb)?)(?:\/|$)/.test(
      record.specifier,
    )
  ) {
    return true;
  }
  if (!record.target) return false;
  const target = relativePath(root, record.target);
  return /^packages\/(?:application|domain|persistence(?:-node|-indexeddb)?)\/src\//.test(target);
}

function isAllowedCliDomainImport(record) {
  if (record.specifier !== '@sunny-court/domain' || record.kind !== 'import') return false;
  if (record.bindings.length === 0) return false;
  return record.bindings.every((binding) =>
    binding.typeOnly
      ? cliAllowedDomainTypeImports.has(binding.imported)
      : cliAllowedDomainValueImports.has(binding.imported),
  );
}

function isSunnyCourtPackageSpecifier(specifier) {
  return specifier.startsWith('@sunny-court/');
}

function resolveSourceCandidate(candidate, sourceFileSet) {
  const extension = extname(candidate);
  const candidates = [candidate];
  if (!extension || sourceExtensions.has(extension)) {
    const base = extension ? candidate.slice(0, -extension.length) : candidate;
    for (const sourceExtension of sourceExtensions) {
      candidates.push(`${base}${sourceExtension}`);
    }
  }
  if (!extension) {
    for (const sourceExtension of sourceExtensions) {
      candidates.push(join(candidate, `index${sourceExtension}`));
    }
  }
  for (const sourceCandidate of candidates) {
    if (sourceFileSet.has(sourceCandidate)) return sourceCandidate;
  }
  for (const sourceCandidate of candidates) {
    if (isSourceFile(sourceCandidate) && ts.sys.fileExists(sourceCandidate)) return sourceCandidate;
  }
  return undefined;
}

function looksLikeRelativeSourceSpecifier(specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) return false;
  const extension = extname(stripModuleSuffix(specifier));
  return extension.length === 0 || sourceExtensions.has(extension);
}

function packageImportTarget(importsField, specifier) {
  const exact = importsField?.[specifier];
  if (typeof exact === 'string') return exact;
  if (exact !== undefined) return undefined;
  const matches = [];
  for (const [key, value] of Object.entries(importsField ?? {})) {
    const wildcardIndex = key.indexOf('*');
    if (wildcardIndex < 0) continue;
    const prefix = key.slice(0, wildcardIndex);
    const suffix = key.slice(wildcardIndex + 1);
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    const replacement = specifier.slice(prefix.length, specifier.length - suffix.length);
    matches.push({
      key,
      prefixLength: prefix.length,
      replacement,
      suffixLength: suffix.length,
      target: typeof value === 'string' ? value : undefined,
    });
  }
  matches.sort(
    (left, right) =>
      right.prefixLength - left.prefixLength ||
      right.suffixLength - left.suffixLength ||
      right.key.length - left.key.length,
  );
  const match = matches[0];
  return match?.target?.replaceAll('*', match.replacement);
}

function packageExportMatch(exportsField, exportKey) {
  if (typeof exportsField === 'string') {
    return exportKey === '.' ? { replacement: '', target: exportsField } : undefined;
  }
  if (!exportsField || typeof exportsField !== 'object') return undefined;
  const entries = Object.entries(exportsField);
  if (!entries.some(([key]) => key.startsWith('.'))) {
    return exportKey === '.' ? { replacement: '', target: exportsField } : undefined;
  }
  if (Object.hasOwn(exportsField, exportKey)) {
    return { replacement: '', target: exportsField[exportKey] };
  }
  const matches = [];
  for (const [key, target] of entries) {
    const wildcardIndex = key.indexOf('*');
    if (wildcardIndex < 0) continue;
    const prefix = key.slice(0, wildcardIndex);
    const suffix = key.slice(wildcardIndex + 1);
    if (!exportKey.startsWith(prefix) || !exportKey.endsWith(suffix)) continue;
    matches.push({
      key,
      prefixLength: prefix.length,
      replacement: exportKey.slice(prefix.length, exportKey.length - suffix.length),
      suffixLength: suffix.length,
      target,
    });
  }
  matches.sort(
    (left, right) =>
      right.prefixLength - left.prefixLength ||
      right.suffixLength - left.suffixLength ||
      right.key.length - left.key.length,
  );
  return matches[0];
}

function packageExportTarget(exportsField, exportKey) {
  const match = packageExportMatch(exportsField, exportKey);
  return typeof match?.target === 'string'
    ? match.target.replaceAll('*', match.replacement)
    : undefined;
}

function workspaceExportValue(specifier, byName) {
  const packageName = packageNameForSpecifier(specifier, byName);
  if (!packageName) return undefined;
  const targetPackage = byName.get(packageName);
  if (!targetPackage) return undefined;
  const exportKey = specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`;
  return packageExportMatch(targetPackage.manifest.exports, exportKey)?.target;
}

function workspaceFallbackEntrypoints(specifier, byName) {
  const packageName = packageNameForSpecifier(specifier, byName);
  if (!packageName || specifier !== packageName) return [];
  const manifest = byName.get(packageName)?.manifest;
  if (!manifest || manifest.exports !== undefined) return [];
  return [
    manifest.browser,
    manifest.module,
    manifest.main,
    manifest.types,
    manifest.typings,
  ].filter(
    (target, index, targets) => typeof target === 'string' && targets.indexOf(target) === index,
  );
}

function tsconfigPathTargets(paths, specifier) {
  const exact = paths[specifier];
  if (exact) return exact;
  const matches = [];
  for (const [key, targets] of Object.entries(paths)) {
    const wildcardIndex = key.indexOf('*');
    if (wildcardIndex < 0) continue;
    const prefix = key.slice(0, wildcardIndex);
    const suffix = key.slice(wildcardIndex + 1);
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    matches.push({
      key,
      prefixLength: prefix.length,
      replacement: specifier.slice(prefix.length, specifier.length - suffix.length),
      suffixLength: suffix.length,
      targets,
    });
  }
  matches.sort(
    (left, right) =>
      right.prefixLength - left.prefixLength ||
      right.suffixLength - left.suffixLength ||
      right.key.length - left.key.length,
  );
  const match = matches[0];
  return match?.targets.map((target) => target.replaceAll('*', match.replacement));
}

function readTsconfigResolution(root) {
  const configPath = join(root, 'tsconfig.json');
  if (!ts.sys.fileExists(configPath)) return { basePath: root, paths: {} };
  const diagnostics = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        diagnostics.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  return {
    baseUrl: parsed?.options.baseUrl,
    basePath: parsed?.options.pathsBasePath ?? parsed?.options.baseUrl ?? root,
    diagnostics,
    files: parsed?.fileNames ?? [],
    paths: parsed?.options.paths ?? {},
  };
}

function resolveTsconfigPathTarget(specifier, tsconfigResolution, sourceFileSet) {
  for (const target of tsconfigPathTargets(tsconfigResolution.paths, specifier) ?? []) {
    const resolved = resolveSourceCandidate(
      resolve(tsconfigResolution.basePath, target),
      sourceFileSet,
    );
    if (resolved) return resolved;
  }
  return undefined;
}

function resolveImportAlias(file, specifier, manifests, seen = new Set()) {
  if (typeof specifier !== 'string') return specifier;
  if (!specifier.startsWith('#')) return stripModuleSuffix(specifier);
  const resolutionKey = `${file}::${specifier}`;
  if (seen.has(resolutionKey)) return specifier;
  seen.add(resolutionKey);
  const owner = packageForFile(file, manifests);
  if (!owner) return specifier;
  const target = packageImportTarget(owner.manifest.imports, specifier);
  if (!target || target.startsWith('.')) return target ?? specifier;
  return resolveImportAlias(file, target, manifests, seen);
}

function resolveImportTarget(
  file,
  specifier,
  byName,
  manifests,
  sourceFileSet,
  tsconfigResolution,
  seen = new Set(),
) {
  if (typeof specifier !== 'string') return undefined;
  const request = specifier.startsWith('#') ? specifier : stripModuleSuffix(specifier);
  const resolutionKey = `${file}::${request}`;
  if (seen.has(resolutionKey)) return undefined;
  seen.add(resolutionKey);
  if (request.startsWith('.')) {
    return resolveSourceCandidate(resolve(dirname(file), request), sourceFileSet);
  }

  if (request.startsWith('#')) {
    const owner = packageForFile(file, manifests);
    if (!owner) return undefined;
    const target = packageImportTarget(owner.manifest.imports, request);
    if (!target) return undefined;
    if (target.startsWith('.')) {
      return resolveSourceCandidate(
        resolve(owner.packageDirectory, stripModuleSuffix(target)),
        sourceFileSet,
      );
    }
    return resolveImportTarget(
      file,
      target,
      byName,
      manifests,
      sourceFileSet,
      tsconfigResolution,
      seen,
    );
  }

  const tsconfigTarget = resolveTsconfigPathTarget(request, tsconfigResolution, sourceFileSet);
  if (tsconfigTarget) return tsconfigTarget;
  if (tsconfigResolution.baseUrl) {
    const baseUrlTarget = resolveSourceCandidate(
      resolve(tsconfigResolution.baseUrl, request),
      sourceFileSet,
    );
    if (baseUrlTarget) return baseUrlTarget;
  }

  const packageName = packageNameForSpecifier(request, byName);
  if (!packageName) return undefined;
  const targetPackage = byName.get(packageName);
  if (!targetPackage) return undefined;
  const exportKey = request === packageName ? '.' : `.${request.slice(packageName.length)}`;
  const exportsField = targetPackage.manifest.exports;
  const target = packageExportTarget(exportsField, exportKey);
  if (target) {
    return resolveSourceCandidate(resolve(targetPackage.packageDirectory, target), sourceFileSet);
  }
  if (exportsField === undefined && exportKey !== '.') {
    return resolveSourceCandidate(
      resolve(targetPackage.packageDirectory, request.slice(packageName.length + 1)),
      sourceFileSet,
    );
  }
  if (exportKey === '.' && exportsField === undefined) {
    const fallbackEntrypoints = workspaceFallbackEntrypoints(request, byName);
    if (fallbackEntrypoints.length === 1) {
      return resolveSourceCandidate(
        resolve(targetPackage.packageDirectory, fallbackEntrypoints[0]),
        sourceFileSet,
      );
    }
    if (fallbackEntrypoints.length > 1) return undefined;
    return resolveSourceCandidate(
      join(targetPackage.packageDirectory, 'src', 'index.ts'),
      sourceFileSet,
    );
  }
  return undefined;
}

function moduleReaches(start, graph, predicate) {
  const visited = new Set([start]);
  const pending = [...(graph.get(start) ?? [])];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    if (predicate(current)) return true;
    pending.push(...(graph.get(current) ?? []));
  }
  return false;
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
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
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
  const tsconfigResolution = readTsconfigResolution(root);
  for (const diagnostic of tsconfigResolution.diagnostics ?? []) {
    errors.push(`Unable to resolve tsconfig paths: ${diagnostic}`);
  }
  const graph = new Map();
  const declaredDependencies = new Map();

  for (const entry of manifests) {
    const declared = declaredWorkspaceDependencies(entry.manifest, byName);
    declaredDependencies.set(entry.manifest.name, declared);
    graph.set(entry.manifest.name, new Set(declared));
  }

  const sourceFiles = new Set(
    (tsconfigResolution.files ?? []).filter((file) => isSourceFile(file)),
  );
  for (const packageRoot of packageRoots) {
    const packageSources = await collectFiles(join(root, packageRoot));
    for (const file of packageSources) {
      if (normalizedPath(file).includes('/src/')) sourceFiles.add(file);
    }
  }

  const sourceFileSet = new Set(sourceFiles);
  const moduleGraph = new Map();
  const sources = [];
  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    const importRecords = extractImportRecords(source, file).map((record) => ({
      ...record,
      resolvedSpecifier: resolveImportAlias(file, record.specifier, manifests),
      tsconfigPathMatched:
        typeof record.specifier === 'string' &&
        tsconfigPathTargets(tsconfigResolution.paths, stripModuleSuffix(record.specifier)) !==
          undefined,
      target: resolveImportTarget(
        file,
        record.specifier,
        byName,
        manifests,
        sourceFileSet,
        tsconfigResolution,
      ),
    }));
    const imports = [
      ...new Set(
        importRecords
          .map((record) => record.specifier)
          .filter((specifier) => typeof specifier === 'string'),
      ),
    ];
    const production = isProductionSource(file);
    if (production) {
      sources.push({ file, source, imports, importRecords, path: relativePath(root, file) });
    }
    moduleGraph.set(
      file,
      new Set(
        importRecords.map((record) => record.target).filter((target) => target !== undefined),
      ),
    );

    if (!production) continue;
    const owner = packageForFile(file, manifests);
    if (!owner) continue;
    for (const record of importRecords) {
      const directDependency = packageNameForSpecifier(record.specifier, byName);
      const targetOwner = record.target ? packageForFile(record.target, manifests) : undefined;
      const dependency = directDependency ?? targetOwner?.manifest.name;
      if (!dependency || dependency === owner.manifest.name) continue;
      graph.get(owner.manifest.name)?.add(dependency);
      if (!declaredDependencies.get(owner.manifest.name)?.has(dependency)) {
        errors.push(
          `Undeclared workspace dependency: ${owner.manifest.name} imports ${dependency} in ${relativePath(root, file)}.`,
        );
      }
      if (typeof record.specifier === 'string' && record.specifier.startsWith('.')) {
        errors.push(
          `Cross-package relative import is forbidden: ${relativePath(root, file)} -> ${record.specifier}.`,
        );
      }
    }
  }

  const webPackage = manifests.find((entry) => entry.directory === 'apps/web');
  if (webPackage) {
    const webIndex = join(webPackage.packageDirectory, 'index.html');
    try {
      const html = await readFile(webIndex, 'utf8');
      for (const script of extractHtmlModuleScripts(html)) {
        if (script.body.trim().length > 0) {
          errors.push('Inline Web module scripts are forbidden; use apps/web/src.');
        }
        if (!script.source) continue;
        if (/^(?:https?:|data:|\/\/)/i.test(script.source)) continue;
        const source = stripModuleSuffix(script.source);
        const target = source.startsWith('/')
          ? resolveSourceCandidate(
              resolve(webPackage.packageDirectory, `.${source}`),
              sourceFileSet,
            )
          : source.startsWith('.')
            ? resolveSourceCandidate(resolve(dirname(webIndex), source), sourceFileSet)
            : undefined;
        if (!target || !relativePath(root, target).startsWith('apps/web/src/')) {
          errors.push(`Web module script must stay under apps/web/src: ${script.source}.`);
        }
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }

  checkCycles(graph, errors);

  for (const entry of sources) {
    const expectedTarget = legacyCompatibilityWrapperTargets.get(entry.path);
    if (expectedTarget && !isThinWildcardReExport(entry.source, entry.file, expectedTarget)) {
      errors.push(`Legacy compatibility wrapper must stay a thin re-export: ${entry.path}.`);
    }
  }

  const domain = byName.get('@sunny-court/domain');
  if (!domain) {
    if (!fixture) errors.push('Missing @sunny-court/domain package.');
  } else {
    const dependencies = Object.keys({
      ...domain.manifest.dependencies,
      ...domain.manifest.devDependencies,
      ...domain.manifest.optionalDependencies,
      ...domain.manifest.peerDependencies,
    });
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
      /\bdocument\b/,
      /\bwindow\b/,
      /\bindexedDB\b/,
      /\bprocess\b/,
      /\bBuffer\b/,
      /\bfetch\s*\(/,
      /@sunny-court\/application/,
      /@sunny-court\/persistence/,
      /@sunny-court\/ui-/,
    ];
    for (const entry of domainSources) {
      if (!fixture && extname(entry.file) !== '.ts') {
        errors.push(`Domain production source must be TypeScript: ${entry.path}.`);
      }
      if (
        entry.importRecords.some((record) => nodePlatformSpecifiers.has(record.resolvedSpecifier))
      ) {
        errors.push(`Domain must not import a Node platform module: ${entry.path}.`);
      }
      for (const pattern of forbiddenDomainPatterns) {
        if (pattern.test(entry.source)) {
          errors.push(`Forbidden domain pattern ${pattern} in ${entry.path}`);
        }
      }
    }
  }

  for (const entry of sources) {
    const isLegacySource = isLegacyPath(entry.path);
    const isCoreSource = isCorePath(entry.path);
    const isMatchSource = isMatchPath(entry.path);
    const isV2Source = isV2ProductionPath(entry.path);
    const isWebSource = entry.path.startsWith('apps/web/src/');
    const isCliSource = entry.path.startsWith('apps/sim-cli/src/');
    const reachesLegacy = moduleReaches(entry.file, moduleGraph, (target) =>
      isLegacyPath(relativePath(root, target)),
    );
    const reachesV2 = moduleReaches(entry.file, moduleGraph, (target) =>
      isV2ProductionPath(relativePath(root, target)),
    );

    if (entry.importRecords.some((record) => record.specifier === undefined)) {
      errors.push(`Non-static module specifier is forbidden in production source: ${entry.path}.`);
    }
    if (
      entry.importRecords.some(
        (record) =>
          dynamicLoaderSpecifiers.has(record.resolvedSpecifier) ||
          ['get-builtin-module', 'import-meta-glob'].includes(record.kind),
      )
    ) {
      errors.push(`Dynamic module loaders are forbidden in production source: ${entry.path}.`);
    }
    if (
      entry.importRecords.some(
        (record) =>
          typeof record.specifier === 'string' &&
          record.specifier.startsWith('#') &&
          record.target === undefined &&
          record.resolvedSpecifier?.startsWith('#'),
      )
    ) {
      errors.push(
        `Unresolved package import alias is forbidden in production source: ${entry.path}.`,
      );
    }
    if (
      entry.importRecords.some(
        (record) => record.tsconfigPathMatched && record.target === undefined,
      )
    ) {
      errors.push(
        `Unresolved tsconfig path alias is forbidden in production source: ${entry.path}.`,
      );
    }
    if (
      entry.importRecords.some((record) => {
        const target = workspaceExportValue(record.resolvedSpecifier, byName);
        return target !== undefined && typeof target !== 'string';
      })
    ) {
      errors.push(
        `Conditional workspace exports are forbidden in production source: ${entry.path}.`,
      );
    }
    if (
      entry.importRecords.some(
        (record) => workspaceFallbackEntrypoints(record.resolvedSpecifier, byName).length > 1,
      )
    ) {
      errors.push(
        `Ambiguous workspace entrypoints are forbidden in production source: ${entry.path}.`,
      );
    }
    if (
      entry.importRecords.some(
        (record) => record.target !== undefined && !isProductionSource(record.target),
      )
    ) {
      errors.push(`Production source must not import test/spec source: ${entry.path}.`);
    }
    if (
      entry.importRecords.some(
        (record) => record.target !== undefined && !sourceFileSet.has(record.target),
      )
    ) {
      errors.push(`Source import resolves outside the scanned production graph: ${entry.path}.`);
    }
    if (
      entry.importRecords.some(
        (record) =>
          looksLikeRelativeSourceSpecifier(record.specifier) && record.target === undefined,
      )
    ) {
      errors.push(`Unresolved relative source import is forbidden: ${entry.path}.`);
    }

    if (isLegacySource) {
      for (const specifier of entry.imports) {
        if (isSunnyCourtPackageSpecifier(specifier) && !specifier.endsWith('/legacy-p01')) {
          errors.push(
            `Legacy source must use an explicit /legacy-p01 package import: ${entry.path} -> ${specifier}.`,
          );
        }
      }
      if (
        reachesV2 ||
        entry.imports.some((specifier) => isV2Specifier(root, entry.file, specifier))
      ) {
        errors.push(`Legacy source must not import future V2 production code: ${entry.path}.`);
      }
    }

    if (
      isCoreSource &&
      (reachesLegacy || entry.imports.some((specifier) => isLegacySpecifier(entry.file, specifier)))
    ) {
      errors.push(`Core must not import Legacy P01: ${entry.path}.`);
    }

    if (
      isCoreSource &&
      (reachesV2 || entry.imports.some((specifier) => isV2Specifier(root, entry.file, specifier)))
    ) {
      errors.push(`Core must not import future V2 production code: ${entry.path}.`);
    }

    if (isCoreSource && !isApprovedCoreSource(entry.path, fixture)) {
      errors.push(`Core source is outside the P02-001 approved primitive surface: ${entry.path}.`);
    }

    if (
      isV2Source &&
      (reachesLegacy || entry.imports.some((specifier) => isLegacySpecifier(entry.file, specifier)))
    ) {
      errors.push(`Future V2 production source must not import Legacy P01: ${entry.path}.`);
    }

    if (isMatchSource) {
      const importsApplicationOrPersistence = entry.importRecords.some((record) => {
        if (
          typeof record.specifier === 'string' &&
          isApplicationOrPersistenceSpecifier(record.specifier)
        ) {
          return true;
        }
        if (!record.target) return false;
        return /^packages\/(?:application|persistence(?:-node|-indexeddb)?)\/src\//.test(
          relativePath(root, record.target),
        );
      });
      if (importsApplicationOrPersistence) {
        errors.push(`domain/match must not import application or persistence: ${entry.path}.`);
      }
      if (
        !importsApplicationOrPersistence &&
        entry.importRecords.some((record) =>
          isMatchMutableStateImport(root, entry.file, record, fixture),
        )
      ) {
        errors.push(`domain/match must not import a mutable GameState resolver: ${entry.path}.`);
      }
    }

    if (isWebSource && entry.importRecords.some((record) => isWebForbiddenImport(root, record))) {
      errors.push(
        `Web must not import application/domain/persistence production code: ${entry.path}.`,
      );
    }

    if (
      isCliSource &&
      entry.importRecords.some((record) => {
        const directDomainImport =
          typeof record.specifier === 'string' &&
          /^@sunny-court\/domain(?:\/|$)/.test(record.specifier);
        const resolvedDomainImport =
          record.target !== undefined &&
          relativePath(root, record.target).startsWith('packages/domain/src/');
        return (directDomainImport || resolvedDomainImport) && !isAllowedCliDomainImport(record);
      })
    ) {
      errors.push(`Production CLI must not call a domain state-change resolver: ${entry.path}.`);
    }
  }

  const web = byName.get('@sunny-court/web');
  if (web) {
    const webDependencies = Object.keys({
      ...web.manifest.dependencies,
      ...web.manifest.devDependencies,
      ...web.manifest.optionalDependencies,
      ...web.manifest.peerDependencies,
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
    if (entry.manifest.exports?.['.'] !== './src/index.ts') {
      errors.push(`Root export must target the compatibility entrypoint for ${packageName}.`);
    }
    const rootIndex = join(entry.packageDirectory, 'src', 'index.ts');
    try {
      const source = await readFile(rootIndex, 'utf8');
      if (!isThinWildcardReExport(source, rootIndex, './legacy-p01/index.js')) {
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
