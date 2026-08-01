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

function isRuntimeImportRecord(record) {
  if (['import-type', 'reference-types'].includes(record.kind)) return false;
  if (
    ['import', 'import-equals', 'export'].includes(record.kind) &&
    record.bindings.length > 0 &&
    record.bindings.every((binding) => binding.typeOnly)
  ) {
    return false;
  }
  return true;
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
  const compilerOptions = {
    allowJs: true,
    module: ts.ModuleKind.ESNext,
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const compilerHost = ts.createCompilerHost(compilerOptions);
  compilerHost.fileExists = (candidate) => candidate === file;
  compilerHost.readFile = (candidate) => (candidate === file ? source : undefined);
  compilerHost.getSourceFile = (candidate) => (candidate === file ? sourceFile : undefined);
  const program = ts.createProgram([file], compilerOptions, compilerHost);
  const checker = program.getTypeChecker();
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

  const loaderCapabilities = new Map([
    ['global:require', new Set(['loader:require'])],
    ['global:module', new Set(['object:module'])],
    ['global:process', new Set(['object:process'])],
    ['global:global', new Set(['object:global'])],
    ['global:globalThis', new Set(['object:global'])],
    ['global:Proxy', new Set(['constructor:proxy', 'value:function'])],
    ['global:eval', new Set(['codegen:eval'])],
    ['global:Function', new Set(['codegen:function-constructor'])],
    ['global:Object', new Set(['object:builtin-object', 'value:function'])],
    ['global:Reflect', new Set(['object:reflect'])],
    ['global:Array', new Set(['value:function'])],
  ]);

  function isRuntimeBinding(symbol) {
    return (symbol?.declarations ?? []).some(
      (declaration) =>
        !declaration.getSourceFile().isDeclarationFile &&
        !(ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Ambient),
    );
  }

  function bindingKey(identifier) {
    const symbol = checker.getSymbolAtLocation(identifier);
    if (symbol && isRuntimeBinding(symbol)) return symbol;
    if (
      [
        'require',
        'module',
        'process',
        'global',
        'globalThis',
        'Proxy',
        'eval',
        'Function',
        'Object',
        'Reflect',
        'Array',
      ].includes(identifier.text)
    ) {
      return `global:${identifier.text}`;
    }
    return symbol ?? `unbound:${identifier.text}`;
  }

  function addCapabilities(identifier, capabilities) {
    if (!identifier || capabilities.size === 0) return false;
    const key = typeof identifier === 'string' ? identifier : bindingKey(identifier);
    const existing = loaderCapabilities.get(key) ?? new Set();
    const previousSize = existing.size;
    for (const capability of capabilities) existing.add(capability);
    loaderCapabilities.set(key, existing);
    return existing.size !== previousSize;
  }

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      statement.importClause
    ) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause.name && !clause.isTypeOnly) {
        if (['node:process', 'process'].includes(specifier)) {
          addCapabilities(clause.name, new Set(['object:process']));
        }
        if (dynamicLoaderSpecifiers.has(specifier)) {
          addCapabilities(clause.name, new Set(['object:module']));
        }
      }
      if (
        clause.namedBindings &&
        ts.isNamespaceImport(clause.namedBindings) &&
        !clause.isTypeOnly
      ) {
        if (['node:process', 'process'].includes(specifier)) {
          addCapabilities(clause.namedBindings.name, new Set(['object:process']));
        }
        if (dynamicLoaderSpecifiers.has(specifier)) {
          addCapabilities(clause.namedBindings.name, new Set(['object:module']));
        }
      }
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          if (clause.isTypeOnly || element.isTypeOnly) continue;
          const imported = (element.propertyName ?? element.name).text;
          if (['node:process', 'process'].includes(specifier) && imported === 'getBuiltinModule') {
            addCapabilities(element.name, new Set(['callable:get-builtin-module']));
          }
          if (dynamicLoaderSpecifiers.has(specifier) && imported === 'createRequire') {
            addCapabilities(element.name, new Set(['factory:create-require']));
          }
        }
      }
    }
    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteralLike(statement.moduleReference.expression)
    ) {
      const specifier = statement.moduleReference.expression.text;
      if (statement.isTypeOnly) continue;
      if (['node:process', 'process'].includes(specifier)) {
        addCapabilities(statement.name, new Set(['object:process']));
      }
      if (dynamicLoaderSpecifiers.has(specifier)) {
        addCapabilities(statement.name, new Set(['object:module']));
      }
    }
  }

  const memberCapabilityPrefix = 'member:';
  const staticMemberCapabilityPrefix = 'static-member:';
  const instanceMemberCapabilityPrefix = 'instance-member:';
  const returnArgumentCapabilityPrefix = 'function:return-argument:';
  const returnFixedCapabilityPrefix = 'function:return-fixed:';

  function encodedMemberCapability(prefix, property, capability) {
    return `${prefix}${encodeURIComponent(property)}:${capability}`;
  }

  function decodedMemberCapability(capability, prefix, property) {
    if (!capability.startsWith(prefix)) return undefined;
    const remainder = capability.slice(prefix.length);
    const separator = remainder.indexOf(':');
    if (separator < 0 || decodeURIComponent(remainder.slice(0, separator)) !== property) {
      return undefined;
    }
    return remainder.slice(separator + 1);
  }

  function classCapabilities(declaration) {
    const result = new Set(['value:function']);
    for (const member of declaration.members) {
      if (!member.name) continue;
      const property = staticPropertyName(member.name);
      if (property === undefined || property === 'constructor') continue;
      let memberCapabilities = new Set();
      if (ts.isMethodDeclaration(member)) {
        memberCapabilities = new Set(['value:function']);
      } else if (ts.isPropertyDeclaration(member) && member.initializer) {
        memberCapabilities = capabilitiesForExpression(member.initializer);
      }
      const prefix = member.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword,
      )
        ? staticMemberCapabilityPrefix
        : instanceMemberCapabilityPrefix;
      for (const capability of memberCapabilities) {
        result.add(encodedMemberCapability(prefix, property, capability));
      }
    }
    return result;
  }

  function functionValueCapabilities(declaration) {
    const result = new Set(['value:function']);
    const parameterIndexes = new Map(
      declaration.parameters
        .filter((parameter) => ts.isIdentifier(parameter.name))
        .map((parameter) => [
          bindingKey(parameter.name),
          declaration.parameters.indexOf(parameter),
        ]),
    );
    function visitReturn(node) {
      if (node !== declaration.body && ts.isFunctionLike(node)) return;
      const expression =
        ts.isArrowFunction(declaration) && !ts.isBlock(declaration.body)
          ? declaration.body
          : ts.isReturnStatement(node)
            ? node.expression
            : undefined;
      if (expression) {
        const current = unwrapExpression(expression);
        if (ts.isIdentifier(current)) {
          const parameterIndex = parameterIndexes.get(bindingKey(current));
          if (parameterIndex !== undefined) {
            result.add(`${returnArgumentCapabilityPrefix}${parameterIndex}`);
          }
        }
        if (ts.isArrowFunction(declaration) && !ts.isBlock(declaration.body)) return;
      }
      ts.forEachChild(node, visitReturn);
    }
    visitReturn(declaration.body);
    return result;
  }

  function seedFunctionValues(node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      addCapabilities(node.name, functionValueCapabilities(node));
    }
    if (ts.isClassDeclaration(node) && node.name) {
      addCapabilities(node.name, classCapabilities(node));
    }
    ts.forEachChild(node, seedFunctionValues);
  }
  seedFunctionValues(sourceFile);

  function unwrapExpression(expression) {
    let current = expression;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isPartiallyEmittedExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  }

  function accessedProperty(expression) {
    const current = unwrapExpression(expression);
    if (ts.isPropertyAccessExpression(current)) return current.name.text;
    if (ts.isElementAccessExpression(current) && current.argumentExpression) {
      return staticStringExpression(current.argumentExpression);
    }
    return undefined;
  }

  function staticPropertyName(name) {
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
    if (ts.isComputedPropertyName(name)) {
      return staticStringExpression(name.expression);
    }
    return undefined;
  }

  function propertyCapabilities(capabilities, property) {
    const result = new Set();
    for (const capability of capabilities) {
      if (
        property === undefined &&
        (capability.startsWith(memberCapabilityPrefix) ||
          capability.startsWith(staticMemberCapabilityPrefix)) &&
        capability.endsWith(':value:function')
      ) {
        result.add('codegen:unknown-function-property');
      }
      if (property !== undefined) {
        const memberCapability = decodedMemberCapability(
          capability,
          memberCapabilityPrefix,
          property,
        );
        const staticMemberCapability = decodedMemberCapability(
          capability,
          staticMemberCapabilityPrefix,
          property,
        );
        if (memberCapability !== undefined) result.add(memberCapability);
        if (staticMemberCapability !== undefined) result.add(staticMemberCapability);
      }
      if (capability === 'object:module' && property === 'require') {
        result.add('loader:module-require');
      }
      if (capability === 'object:module' && property === 'createRequire') {
        result.add('factory:create-require');
      }
      if (capability === 'object:process' && property === 'getBuiltinModule') {
        result.add('callable:get-builtin-module');
      }
      if (capability === 'object:global' && property === 'require') {
        result.add('loader:require');
      }
      if (capability === 'object:global' && property === 'module') {
        result.add('object:module');
      }
      if (capability === 'object:global' && property === 'process') {
        result.add('object:process');
      }
      if (capability === 'object:global' && ['global', 'globalThis'].includes(property)) {
        result.add('object:global');
      }
      if (capability === 'object:global' && property === 'Proxy') {
        result.add('constructor:proxy');
        result.add('value:function');
      }
      if (capability === 'object:global' && property === 'eval') {
        result.add('codegen:eval');
      }
      if (capability === 'object:global' && property === 'Function') {
        result.add('codegen:function-constructor');
      }
      if (capability === 'object:global' && property === 'Object') {
        result.add('object:builtin-object');
        result.add('value:function');
      }
      if (capability === 'object:global' && property === 'Reflect') {
        result.add('object:reflect');
      }
      if (capability === 'object:global' && property === 'Array') {
        result.add('value:function');
      }
      if (capability === 'object:builtin-object' && property === 'getPrototypeOf') {
        result.add('callable:get-prototype-of');
      }
      if (capability === 'object:reflect' && property === 'get') {
        result.add('callable:reflect-get');
      }
      if (capability === 'object:reflect' && property === 'apply') {
        result.add('callable:reflect-apply');
      }
      if (
        capability === 'object:array' &&
        [
          'at',
          'concat',
          'every',
          'entries',
          'filter',
          'find',
          'findIndex',
          'flat',
          'flatMap',
          'forEach',
          'includes',
          'indexOf',
          'join',
          'keys',
          'map',
          'pop',
          'push',
          'reduce',
          'reduceRight',
          'reverse',
          'shift',
          'slice',
          'some',
          'sort',
          'splice',
          'unshift',
          'values',
        ].includes(property ?? '')
      ) {
        result.add('value:function');
      }
      if (
        capability === 'object:plain' &&
        [
          '__defineGetter__',
          '__defineSetter__',
          '__lookupGetter__',
          '__lookupSetter__',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'toLocaleString',
          'toString',
          'valueOf',
        ].includes(property ?? '')
      ) {
        result.add('value:function');
      }
      if (
        ['object:array', 'object:plain', 'object:constructed-instance'].includes(capability) &&
        property === 'constructor'
      ) {
        result.add('value:function');
      }
      if (
        ['object:global', 'object:module', 'object:process', 'object:reflect'].includes(
          capability,
        ) &&
        property === 'constructor'
      ) {
        result.add('value:function');
      }
      if (
        ['value:function', 'object:function-prototype'].includes(capability) &&
        property === 'constructor'
      ) {
        result.add('codegen:function-constructor');
      }
      if (capability === 'value:function' && ['apply', 'bind', 'call'].includes(property ?? '')) {
        result.add('value:function');
      }
      if (
        ['value:function', 'object:function-prototype'].includes(capability) &&
        property === undefined
      ) {
        result.add('codegen:unknown-function-property');
      }
      if (
        (capability.startsWith('codegen:') || capability === 'constructor:proxy') &&
        property === 'constructor'
      ) {
        result.add('codegen:function-constructor');
      }
      if (capability.startsWith('codegen:') && ['name', 'length'].includes(property ?? '')) {
        result.add('value:metadata');
      }
      if (capability.startsWith('loader:') && property === 'resolve') {
        result.add('loader:require-resolve');
      }
    }
    return result;
  }

  function staticStringExpression(expression, seen = new Set()) {
    if (!expression) return undefined;
    const unwrapped = unwrapExpression(expression);
    if (ts.isStringLiteralLike(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
      return unwrapped.text;
    }
    if (
      ts.isBinaryExpression(unwrapped) &&
      unwrapped.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = staticStringExpression(unwrapped.left, seen);
      const right = staticStringExpression(unwrapped.right, seen);
      return left === undefined || right === undefined ? undefined : left + right;
    }
    if (ts.isIdentifier(unwrapped)) {
      const symbol = checker.getSymbolAtLocation(unwrapped);
      if (!symbol || seen.has(symbol)) return undefined;
      const nextSeen = new Set(seen).add(symbol);
      for (const declaration of symbol.declarations ?? []) {
        if (
          ts.isVariableDeclaration(declaration) &&
          declaration.initializer &&
          (ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const) !== 0
        ) {
          const value = staticStringExpression(declaration.initializer, nextSeen);
          if (value !== undefined) return value;
        }
      }
    }
    return undefined;
  }

  function literalStringExpression(expression) {
    if (!expression) return undefined;
    const unwrapped = unwrapExpression(expression);
    return ts.isStringLiteralLike(unwrapped) ? unwrapped.text : undefined;
  }

  function isInvokableCapability(capability) {
    return (
      capability.startsWith('loader:') ||
      capability === 'callable:get-builtin-module' ||
      capability === 'factory:create-require' ||
      capability === 'callable:get-prototype-of' ||
      capability === 'callable:reflect-get' ||
      capability === 'callable:reflect-apply' ||
      capability === 'value:function' ||
      capability.startsWith('function:return-') ||
      capability.startsWith('codegen:')
    );
  }

  function isForwardableCapability(capability) {
    return isInvokableCapability(capability) || capability === 'constructor:proxy';
  }

  function isModuleLoadingCapability(capability) {
    return ['loader:require', 'loader:module-require'].includes(capability);
  }

  function arrayElementsForExpression(expression, seen = new Set()) {
    if (!expression) return [];
    const current = unwrapExpression(expression);
    if (ts.isArrayLiteralExpression(current)) return [...current.elements];
    if (!ts.isIdentifier(current)) return [];
    const symbol = checker.getSymbolAtLocation(current);
    if (!symbol || seen.has(symbol)) return [];
    const nextSeen = new Set(seen).add(symbol);
    for (const declaration of symbol.declarations ?? []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        const elements = arrayElementsForExpression(declaration.initializer, nextSeen);
        if (elements.length > 0) return elements;
      }
    }
    return [];
  }

  function invocationForCall(call) {
    const called = unwrapExpression(call.expression);
    if (
      (ts.isPropertyAccessExpression(called) || ts.isElementAccessExpression(called)) &&
      ['call', 'apply'].includes(accessedProperty(called) ?? '')
    ) {
      const forwardedCapabilities = capabilitiesForExpression(called.expression);
      if ([...forwardedCapabilities].some(isInvokableCapability)) {
        const method = accessedProperty(called);
        const argumentList = arrayElementsForExpression(call.arguments[1]);
        return {
          arguments: method === 'call' ? [...call.arguments].slice(1) : argumentList,
          capabilities: forwardedCapabilities,
          target: called.expression,
        };
      }
    }
    return {
      arguments: [...call.arguments],
      capabilities: capabilitiesForExpression(called),
      target: called,
    };
  }

  function invocationResultCapabilities(invocation) {
    const result = new Set();
    const calledCapabilities = invocation.capabilities;
    const firstArgument = literalStringExpression(invocation.arguments[0]);
    if (calledCapabilities.has('factory:create-require')) result.add('loader:require');
    if (
      calledCapabilities.has('callable:get-builtin-module') &&
      dynamicLoaderSpecifiers.has(firstArgument)
    ) {
      result.add('object:module');
    }
    if ([...calledCapabilities].some(isModuleLoadingCapability)) {
      if (dynamicLoaderSpecifiers.has(firstArgument)) result.add('object:module');
      if (['node:process', 'process'].includes(firstArgument)) result.add('object:process');
    }
    if (calledCapabilities.has('callable:get-prototype-of')) {
      const targetCapabilities = capabilitiesForExpression(invocation.arguments[0]);
      if ([...targetCapabilities].some(isInvokableCapability)) {
        result.add('object:function-prototype');
      } else if ([...targetCapabilities].some((capability) => capability.startsWith('object:'))) {
        result.add('object:constructed-instance');
      }
    }
    if (calledCapabilities.has('callable:reflect-get')) {
      const targetCapabilities = capabilitiesForExpression(invocation.arguments[0]);
      const property = staticStringExpression(invocation.arguments[1]);
      for (const capability of propertyCapabilities(targetCapabilities, property)) {
        result.add(capability);
      }
    }
    for (const capability of calledCapabilities) {
      if (capability.startsWith(returnArgumentCapabilityPrefix)) {
        const index = Number.parseInt(capability.slice(returnArgumentCapabilityPrefix.length), 10);
        for (const returnedCapability of capabilitiesForExpression(invocation.arguments[index])) {
          result.add(returnedCapability);
        }
      }
      if (capability.startsWith(returnFixedCapabilityPrefix)) {
        result.add(capability.slice(returnFixedCapabilityPrefix.length));
      }
    }
    return result;
  }

  function objectLiteralCapabilities(literal) {
    const result = new Set(['object:plain']);
    for (const propertyNode of literal.properties) {
      if (!propertyNode.name) continue;
      const property = staticPropertyName(propertyNode.name);
      if (property === undefined) continue;
      let memberCapabilities = new Set();
      if (ts.isMethodDeclaration(propertyNode)) {
        memberCapabilities = new Set(['value:function']);
      } else if (ts.isPropertyAssignment(propertyNode)) {
        memberCapabilities = capabilitiesForExpression(propertyNode.initializer);
      } else if (ts.isShorthandPropertyAssignment(propertyNode)) {
        memberCapabilities = capabilitiesForExpression(propertyNode.name);
      }
      for (const capability of memberCapabilities) {
        result.add(encodedMemberCapability(memberCapabilityPrefix, property, capability));
      }
    }
    return result;
  }

  const summarizingFunctions = new Set();
  const parameterCapabilityStack = [];

  function functionNodeForExpression(expression) {
    const current = unwrapExpression(expression);
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) return current;
    if (!ts.isIdentifier(current)) return undefined;
    const symbol = checker.getSymbolAtLocation(current);
    for (const declaration of symbol?.declarations ?? []) {
      if (ts.isFunctionDeclaration(declaration)) return declaration;
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        (ts.isFunctionExpression(declaration.initializer) ||
          ts.isArrowFunction(declaration.initializer))
      ) {
        return declaration.initializer;
      }
    }
    return undefined;
  }

  function addParameterCapabilities(name, capabilities, target) {
    if (ts.isIdentifier(name)) {
      target.set(bindingKey(name), new Set(capabilities));
      return;
    }
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const property = element.propertyName
          ? staticPropertyName(element.propertyName)
          : ts.isIdentifier(element.name)
            ? element.name.text
            : undefined;
        addParameterCapabilities(
          element.name,
          propertyCapabilities(capabilities, property),
          target,
        );
      }
    }
  }

  function functionReturnCapabilities(expression, argumentsList) {
    const declaration = functionNodeForExpression(expression);
    if (!declaration || summarizingFunctions.has(declaration)) return new Set();
    summarizingFunctions.add(declaration);
    const parameterCapabilities = new Map();
    for (const [index, parameter] of declaration.parameters.entries()) {
      addParameterCapabilities(
        parameter.name,
        capabilitiesForExpression(argumentsList[index]),
        parameterCapabilities,
      );
    }
    parameterCapabilityStack.push(parameterCapabilities);
    const result = new Set();
    try {
      if (ts.isArrowFunction(declaration) && !ts.isBlock(declaration.body)) {
        for (const capability of capabilitiesForExpression(declaration.body)) {
          result.add(capability);
        }
      } else if (declaration.body) {
        function visitReturn(node) {
          if (node !== declaration.body && ts.isFunctionLike(node)) return;
          if (ts.isReturnStatement(node) && node.expression) {
            for (const capability of capabilitiesForExpression(node.expression)) {
              result.add(capability);
            }
            return;
          }
          ts.forEachChild(node, visitReturn);
        }
        visitReturn(declaration.body);
      }
    } finally {
      parameterCapabilityStack.pop();
      summarizingFunctions.delete(declaration);
    }
    return result;
  }

  function capabilitiesForExpression(expression) {
    if (!expression) return new Set();
    const current = unwrapExpression(expression);
    if (ts.isIdentifier(current)) {
      const key = bindingKey(current);
      const result = new Set(loaderCapabilities.get(key) ?? []);
      for (const parameterCapabilities of parameterCapabilityStack) {
        for (const capability of parameterCapabilities.get(key) ?? []) result.add(capability);
      }
      return result;
    }
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      return functionValueCapabilities(current);
    }
    if (ts.isClassExpression(current)) return classCapabilities(current);
    if (ts.isArrayLiteralExpression(current)) return new Set(['object:array']);
    if (ts.isObjectLiteralExpression(current)) return objectLiteralCapabilities(current);
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      const property = accessedProperty(current);
      const object = unwrapExpression(current.expression);
      const objectCapabilities = capabilitiesForExpression(object);
      if (
        property === 'constructor' &&
        (ts.isPropertyAccessExpression(object) || ts.isElementAccessExpression(object)) &&
        accessedProperty(object) !== 'constructor' &&
        ![...objectCapabilities].some((capability) => capability.startsWith('object:'))
      ) {
        return new Set(['codegen:function-constructor']);
      }
      if (
        ts.isMetaProperty(object) &&
        object.keywordToken === ts.SyntaxKind.ImportKeyword &&
        ['glob', 'globEager'].includes(property ?? '')
      ) {
        return new Set(['loader:import-meta-glob']);
      }
      return propertyCapabilities(objectCapabilities, property);
    }
    if (ts.isCallExpression(current)) {
      const called = unwrapExpression(current.expression);
      if (
        (ts.isPropertyAccessExpression(called) || ts.isElementAccessExpression(called)) &&
        accessedProperty(called) === 'bind'
      ) {
        const result = new Set();
        const boundCapabilities = capabilitiesForExpression(called.expression);
        const boundArguments = [...current.arguments].slice(1);
        for (const capability of boundCapabilities) {
          if (capability.startsWith(returnArgumentCapabilityPrefix)) {
            const index = Number.parseInt(
              capability.slice(returnArgumentCapabilityPrefix.length),
              10,
            );
            if (index < boundArguments.length) {
              for (const returnedCapability of capabilitiesForExpression(boundArguments[index])) {
                result.add(`${returnFixedCapabilityPrefix}${returnedCapability}`);
              }
            } else {
              result.add(`${returnArgumentCapabilityPrefix}${index - boundArguments.length}`);
            }
            continue;
          }
          if (isForwardableCapability(capability)) result.add(capability);
        }
        for (const returnedCapability of functionReturnCapabilities(
          called.expression,
          boundArguments,
        )) {
          result.add(`${returnFixedCapabilityPrefix}${returnedCapability}`);
        }
        return result;
      }
      const invocation = invocationForCall(current);
      if (invocation.capabilities.has('callable:reflect-apply')) {
        const target = invocation.arguments[0];
        const reflectedArguments = arrayElementsForExpression(invocation.arguments[2]);
        const targetInvocation = {
          arguments: reflectedArguments,
          capabilities: capabilitiesForExpression(target),
          target,
        };
        const result = invocationResultCapabilities(targetInvocation);
        for (const capability of functionReturnCapabilities(target, reflectedArguments)) {
          result.add(capability);
        }
        return result;
      }
      const result = invocationResultCapabilities(invocation);
      for (const capability of functionReturnCapabilities(
        invocation.target ?? called,
        invocation.arguments,
      )) {
        result.add(capability);
      }
      return result;
    }
    if (ts.isNewExpression(current)) {
      const constructorCapabilities = capabilitiesForExpression(current.expression);
      const argumentsList = [...(current.arguments ?? [])];
      if (constructorCapabilities.has('constructor:proxy')) {
        return capabilitiesForExpression(argumentsList[0]);
      }
      const result = invocationResultCapabilities({
        arguments: argumentsList,
        capabilities: constructorCapabilities,
      });
      if (constructorCapabilities.has('value:function')) {
        result.add('object:constructed-instance');
      }
      for (const capability of constructorCapabilities) {
        if (!capability.startsWith(instanceMemberCapabilityPrefix)) continue;
        result.add(
          `${memberCapabilityPrefix}${capability.slice(instanceMemberCapabilityPrefix.length)}`,
        );
      }
      return result;
    }
    if (ts.isConditionalExpression(current)) {
      return new Set([
        ...capabilitiesForExpression(current.whenTrue),
        ...capabilitiesForExpression(current.whenFalse),
      ]);
    }
    if (ts.isBinaryExpression(current)) {
      if (current.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return capabilitiesForExpression(current.right);
      }
      if (
        [
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(current.operatorToken.kind)
      ) {
        return new Set([
          ...capabilitiesForExpression(current.left),
          ...capabilitiesForExpression(current.right),
        ]);
      }
    }
    return new Set();
  }

  function bindCapabilities(name, capabilities) {
    if (ts.isIdentifier(name)) return addCapabilities(name, capabilities);
    if (ts.isObjectBindingPattern(name)) {
      let changed = false;
      for (const element of name.elements) {
        if (element.dotDotDotToken) {
          changed = bindCapabilities(element.name, capabilities) || changed;
          continue;
        }
        const property = element.propertyName
          ? staticPropertyName(element.propertyName)
          : ts.isIdentifier(element.name)
            ? element.name.text
            : undefined;
        changed =
          bindCapabilities(element.name, propertyCapabilities(capabilities, property)) || changed;
      }
      return changed;
    }
    return false;
  }

  function bindAssignmentTarget(target, capabilities) {
    const current = unwrapExpression(target);
    if (ts.isIdentifier(current)) return addCapabilities(current, capabilities);
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      return bindAssignmentTarget(current.left, capabilities);
    }
    if (ts.isObjectLiteralExpression(current)) {
      let changed = false;
      for (const property of current.properties) {
        if (ts.isSpreadAssignment(property)) {
          changed = bindAssignmentTarget(property.expression, capabilities) || changed;
          continue;
        }
        if (ts.isShorthandPropertyAssignment(property)) {
          changed =
            bindAssignmentTarget(
              property.name,
              propertyCapabilities(capabilities, property.name.text),
            ) || changed;
          continue;
        }
        if (ts.isPropertyAssignment(property)) {
          const propertyName = staticPropertyName(property.name);
          changed =
            bindAssignmentTarget(
              property.initializer,
              propertyCapabilities(capabilities, propertyName),
            ) || changed;
        }
      }
      return changed;
    }
    if (ts.isArrayLiteralExpression(current)) {
      let changed = false;
      for (const element of current.elements) {
        if (!ts.isOmittedExpression(element)) {
          changed = bindAssignmentTarget(element, capabilities) || changed;
        }
      }
      return changed;
    }
    return false;
  }

  function collectLoaderAliases(node) {
    let changed = false;
    if (ts.isVariableDeclaration(node) && node.initializer) {
      changed = bindCapabilities(node.name, capabilitiesForExpression(node.initializer)) || changed;
    }
    if (ts.isParameter(node) && node.initializer) {
      changed = bindCapabilities(node.name, capabilitiesForExpression(node.initializer)) || changed;
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.EqualsToken,
        ts.SyntaxKind.BarBarEqualsToken,
        ts.SyntaxKind.AmpersandAmpersandEqualsToken,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
      ].includes(node.operatorToken.kind)
    ) {
      changed = bindAssignmentTarget(node.left, capabilitiesForExpression(node.right)) || changed;
    }
    ts.forEachChild(node, (child) => {
      changed = collectLoaderAliases(child) || changed;
    });
    return changed;
  }

  while (collectLoaderAliases(sourceFile)) {
    // Iterate to a fixed point so aliases declared through another alias are name-independent.
  }

  function hasLoaderCapability(capabilities) {
    return [...capabilities].some(
      (capability) =>
        capability.startsWith('loader:') ||
        capability === 'callable:get-builtin-module' ||
        capability === 'factory:create-require' ||
        capability === 'object:module' ||
        capability === 'object:process' ||
        capability === 'object:global',
    );
  }

  function hasCodegenCapability(capabilities) {
    return [...capabilities].some((capability) => capability.startsWith('codegen:'));
  }

  function hasBoundaryCapability(capabilities) {
    return hasLoaderCapability(capabilities) || hasCodegenCapability(capabilities);
  }

  function isSupportedCapabilityTarget(target, capabilities) {
    const current = unwrapExpression(target);
    if (ts.isIdentifier(current)) return true;
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      return isSupportedCapabilityTarget(current.left, capabilities);
    }
    if (ts.isObjectBindingPattern(current)) {
      return current.elements.every((element) => {
        if (element.dotDotDotToken) return !hasBoundaryCapability(capabilities);
        const property = element.propertyName
          ? staticPropertyName(element.propertyName)
          : ts.isIdentifier(element.name)
            ? element.name.text
            : undefined;
        if (element.propertyName && property === undefined) {
          return !hasBoundaryCapability(capabilities);
        }
        return isSupportedCapabilityTarget(
          element.name,
          propertyCapabilities(capabilities, property),
        );
      });
    }
    if (ts.isObjectLiteralExpression(current)) {
      return current.properties.every((property) => {
        if (ts.isSpreadAssignment(property)) return !hasBoundaryCapability(capabilities);
        if (ts.isShorthandPropertyAssignment(property)) {
          return isSupportedCapabilityTarget(
            property.name,
            propertyCapabilities(capabilities, property.name.text),
          );
        }
        if (!ts.isPropertyAssignment(property)) return !hasBoundaryCapability(capabilities);
        const propertyName = staticPropertyName(property.name);
        if (propertyName === undefined) return !hasBoundaryCapability(capabilities);
        return isSupportedCapabilityTarget(
          property.initializer,
          propertyCapabilities(capabilities, propertyName),
        );
      });
    }
    if (ts.isArrayBindingPattern(current) || ts.isArrayLiteralExpression(current)) {
      return !hasBoundaryCapability(capabilities);
    }
    return !hasBoundaryCapability(capabilities);
  }

  function containsNode(container, node) {
    return container.pos <= node.pos && node.end <= container.end;
  }

  function isDeclarationIdentifier(identifier) {
    const parent = identifier.parent;
    if (!parent) return false;
    if (
      (ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isBindingElement(parent) ||
        ts.isFunctionDeclaration(parent) ||
        ts.isFunctionExpression(parent) ||
        ts.isClassDeclaration(parent) ||
        ts.isClassExpression(parent) ||
        ts.isImportClause(parent) ||
        ts.isNamespaceImport(parent) ||
        ts.isImportEqualsDeclaration(parent)) &&
      parent.name === identifier
    ) {
      return true;
    }
    if (ts.isImportSpecifier(parent) && parent.name === identifier) return true;
    if (
      (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent)) &&
      parent.name === identifier
    ) {
      return true;
    }
    if (ts.isPropertySignature(parent) || ts.isMethodSignature(parent)) return true;
    return false;
  }

  function isTypeOnlyReference(identifier) {
    if (ts.isPartOfTypeNode(identifier)) return true;
    for (
      let parent = identifier.parent;
      parent && !ts.isStatement(parent);
      parent = parent.parent
    ) {
      if (ts.isTypeQueryNode(parent)) return true;
    }
    return false;
  }

  function isSupportedAliasCarrier(identifier) {
    for (let parent = identifier.parent; parent; parent = parent.parent) {
      if (
        ts.isVariableDeclaration(parent) &&
        parent.initializer &&
        containsNode(parent.initializer, identifier)
      ) {
        const capabilities = capabilitiesForExpression(parent.initializer);
        return (
          hasBoundaryCapability(capabilities) &&
          isSupportedCapabilityTarget(parent.name, capabilities)
        );
      }
      if (
        ts.isParameter(parent) &&
        parent.initializer &&
        containsNode(parent.initializer, identifier)
      ) {
        const capabilities = capabilitiesForExpression(parent.initializer);
        return (
          hasBoundaryCapability(capabilities) &&
          isSupportedCapabilityTarget(parent.name, capabilities)
        );
      }
      if (
        ts.isBinaryExpression(parent) &&
        [
          ts.SyntaxKind.EqualsToken,
          ts.SyntaxKind.BarBarEqualsToken,
          ts.SyntaxKind.AmpersandAmpersandEqualsToken,
          ts.SyntaxKind.QuestionQuestionEqualsToken,
        ].includes(parent.operatorToken.kind) &&
        containsNode(parent.right, identifier)
      ) {
        const capabilities = capabilitiesForExpression(parent.right);
        return (
          hasBoundaryCapability(capabilities) &&
          isSupportedCapabilityTarget(parent.left, capabilities)
        );
      }
      if (ts.isStatement(parent)) break;
    }
    return false;
  }

  function isSafeLoaderReference(identifier) {
    if (isDeclarationIdentifier(identifier)) return true;
    const parent = identifier.parent;
    if (!parent) return false;
    for (let ancestor = parent; ancestor && !ts.isStatement(ancestor); ancestor = ancestor.parent) {
      if (
        ts.isBinaryExpression(ancestor) &&
        containsNode(ancestor.left, identifier) &&
        [
          ts.SyntaxKind.EqualsToken,
          ts.SyntaxKind.BarBarEqualsToken,
          ts.SyntaxKind.AmpersandAmpersandEqualsToken,
          ts.SyntaxKind.QuestionQuestionEqualsToken,
        ].includes(ancestor.operatorToken.kind)
      ) {
        return true;
      }
    }
    if (
      ts.isBinaryExpression(parent) &&
      containsNode(parent.left, identifier) &&
      [
        ts.SyntaxKind.EqualsToken,
        ts.SyntaxKind.BarBarEqualsToken,
        ts.SyntaxKind.AmpersandAmpersandEqualsToken,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
      ].includes(parent.operatorToken.kind)
    ) {
      return true;
    }
    for (let ancestor = parent; ancestor && !ts.isStatement(ancestor); ancestor = ancestor.parent) {
      if (!ts.isCallExpression(ancestor) || ancestor.arguments.length === 0) continue;
      const called = unwrapExpression(ancestor.expression);
      if (
        (ts.isPropertyAccessExpression(called) || ts.isElementAccessExpression(called)) &&
        ['bind', 'call', 'apply'].includes(accessedProperty(called) ?? '') &&
        [...capabilitiesForExpression(called.expression)].some(isInvokableCapability) &&
        containsNode(ancestor.arguments[0], identifier)
      ) {
        return true;
      }
    }
    let expression = identifier;
    while (
      expression.parent &&
      (ts.isParenthesizedExpression(expression.parent) ||
        ts.isAsExpression(expression.parent) ||
        ts.isTypeAssertionExpression(expression.parent) ||
        ts.isNonNullExpression(expression.parent) ||
        ts.isSatisfiesExpression(expression.parent) ||
        ts.isPartiallyEmittedExpression(expression.parent))
    ) {
      expression = expression.parent;
    }
    if (
      (ts.isCallExpression(expression.parent) || ts.isNewExpression(expression.parent)) &&
      expression.parent.expression === expression
    ) {
      return true;
    }
    if (
      (ts.isPropertyAccessExpression(expression.parent) ||
        ts.isElementAccessExpression(expression.parent)) &&
      expression.parent.expression === expression
    ) {
      const property = accessedProperty(expression.parent);
      const capabilities = capabilitiesForExpression(identifier);
      if (
        propertyCapabilities(capabilities, property).size > 0 ||
        (capabilities.has('object:module') && property === 'exports') ||
        (capabilities.has('object:process') && property !== undefined) ||
        (capabilities.has('object:global') && property !== undefined) ||
        ([...capabilities].some(isInvokableCapability) &&
          ['bind', 'call', 'apply'].includes(property ?? ''))
      ) {
        return true;
      }
    }
    return isSupportedAliasCarrier(identifier);
  }

  let hasLoaderEscape = false;
  let hasCodegenEscape = false;

  function markCapabilityEscape(capabilities) {
    if (hasLoaderCapability(capabilities)) hasLoaderEscape = true;
    if (hasCodegenCapability(capabilities)) hasCodegenEscape = true;
  }

  function isWithinAssignmentTarget(node) {
    for (let parent = node.parent; parent && !ts.isStatement(parent); parent = parent.parent) {
      if (
        ts.isBinaryExpression(parent) &&
        containsNode(parent.left, node) &&
        [
          ts.SyntaxKind.EqualsToken,
          ts.SyntaxKind.BarBarEqualsToken,
          ts.SyntaxKind.AmpersandAmpersandEqualsToken,
          ts.SyntaxKind.QuestionQuestionEqualsToken,
        ].includes(parent.operatorToken.kind)
      ) {
        return true;
      }
    }
    return false;
  }

  function visitLoaderEscapes(node) {
    if (
      ts.isIdentifier(node) &&
      !isTypeOnlyReference(node) &&
      hasBoundaryCapability(capabilitiesForExpression(node)) &&
      !isSafeLoaderReference(node)
    ) {
      markCapabilityEscape(capabilitiesForExpression(node));
    }
    if (ts.isCallExpression(node)) {
      const called = unwrapExpression(node.expression);
      const forwardingMethod =
        ts.isPropertyAccessExpression(called) || ts.isElementAccessExpression(called)
          ? accessedProperty(called)
          : undefined;
      const forwardsKnownCapability =
        ['bind', 'call', 'apply'].includes(forwardingMethod ?? '') &&
        [...capabilitiesForExpression(called.expression)].some(isInvokableCapability);
      const firstCapabilityArgument = forwardsKnownCapability ? 1 : 0;
      for (const argument of [...node.arguments].slice(firstCapabilityArgument)) {
        markCapabilityEscape(capabilitiesForExpression(argument));
      }
    }
    if (ts.isNewExpression(node)) {
      const constructorCapabilities = capabilitiesForExpression(node.expression);
      const wrapsKnownProxy = constructorCapabilities.has('constructor:proxy');
      const firstCapabilityArgument = wrapsKnownProxy ? 1 : 0;
      for (const argument of [...(node.arguments ?? [])].slice(firstCapabilityArgument)) {
        markCapabilityEscape(capabilitiesForExpression(argument));
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const baseCapabilities = capabilitiesForExpression(node.expression);
      const property = accessedProperty(node);
      if (
        [...baseCapabilities].some(isInvokableCapability) &&
        propertyCapabilities(baseCapabilities, property).size === 0 &&
        !['bind', 'call', 'apply'].includes(property ?? '')
      ) {
        markCapabilityEscape(baseCapabilities);
      }
    }
    if (ts.isPropertyAssignment(node) && !isWithinAssignmentTarget(node)) {
      markCapabilityEscape(capabilitiesForExpression(node.initializer));
    }
    if (ts.isShorthandPropertyAssignment(node) && !isWithinAssignmentTarget(node)) {
      markCapabilityEscape(capabilitiesForExpression(node.name));
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        if (!ts.isOmittedExpression(element)) {
          markCapabilityEscape(capabilitiesForExpression(element));
        }
      }
    }
    if (ts.isPropertyDeclaration(node) && node.initializer) {
      markCapabilityEscape(capabilitiesForExpression(node.initializer));
    }
    if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
      markCapabilityEscape(capabilitiesForExpression(node.body));
    }
    if (ts.isSpreadAssignment(node)) {
      markCapabilityEscape(capabilitiesForExpression(node.expression));
    }
    if (ts.isTaggedTemplateExpression(node)) {
      markCapabilityEscape(capabilitiesForExpression(node.tag));
    }
    if ((ts.isReturnStatement(node) || ts.isThrowStatement(node)) && node.expression) {
      markCapabilityEscape(capabilitiesForExpression(node.expression));
    }
    if (ts.isExportAssignment(node)) {
      markCapabilityEscape(capabilitiesForExpression(node.expression));
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.EqualsToken,
        ts.SyntaxKind.BarBarEqualsToken,
        ts.SyntaxKind.AmpersandAmpersandEqualsToken,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
      ].includes(node.operatorToken.kind)
    ) {
      const capabilities = capabilitiesForExpression(node.right);
      if (
        hasBoundaryCapability(capabilities) &&
        !isSupportedCapabilityTarget(node.left, capabilities)
      ) {
        markCapabilityEscape(capabilities);
      }
    }
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          markCapabilityEscape(capabilitiesForExpression(declaration.name));
        }
      }
    }
    if (
      ts.isExportDeclaration(node) &&
      !node.moduleSpecifier &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      for (const element of node.exportClause.elements) {
        const localSymbol = checker.getExportSpecifierLocalTargetSymbol(element);
        markCapabilityEscape(new Set(loaderCapabilities.get(localSymbol) ?? []));
      }
    }
    ts.forEachChild(node, visitLoaderEscapes);
  }
  visitLoaderEscapes(sourceFile);
  if (hasLoaderEscape) addRecord('<loader-escape>', 'loader-escape');
  if (hasCodegenEscape) addRecord('<dynamic-code-escape>', 'dynamic-code');

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

    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callExpression = ts.skipParentheses(node.expression);
      const isDynamicImport =
        ts.isCallExpression(node) && callExpression.kind === ts.SyntaxKind.ImportKeyword;
      const invocation = isDynamicImport
        ? { arguments: [...node.arguments], capabilities: new Set() }
        : ts.isCallExpression(node)
          ? invocationForCall(node)
          : {
              arguments: [...(node.arguments ?? [])],
              capabilities: capabilitiesForExpression(node.expression),
            };
      const capabilities = invocation.capabilities;
      const loaderCapability = [...capabilities].find((capability) =>
        capability.startsWith('loader:'),
      );
      const specifier = literalStringExpression(invocation.arguments[0]);
      const isGetBuiltinModule = capabilities.has('callable:get-builtin-module');
      const isDynamicCode =
        hasCodegenCapability(capabilities) &&
        (ts.isCallExpression(node) || (node.arguments?.length ?? 0) > 0);
      if (isDynamicImport || loaderCapability || isGetBuiltinModule) {
        addRecord(
          specifier,
          isDynamicImport
            ? 'dynamic-import'
            : isGetBuiltinModule
              ? 'get-builtin-module'
              : loaderCapability.slice('loader:'.length),
        );
      }
      if (isDynamicCode) addRecord('<dynamic-code>', 'dynamic-code');
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
          (dynamicLoaderSpecifiers.has(record.resolvedSpecifier) &&
            isRuntimeImportRecord(record)) ||
          ['get-builtin-module', 'import-meta-glob', 'loader-escape'].includes(record.kind),
      )
    ) {
      errors.push(`Dynamic module loaders are forbidden in production source: ${entry.path}.`);
    }
    if (entry.importRecords.some((record) => record.kind === 'dynamic-code')) {
      errors.push(`Dynamic code execution is forbidden in production source: ${entry.path}.`);
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
