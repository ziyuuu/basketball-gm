import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const boundaryScript = fileURLToPath(new URL('../scripts/check-boundaries.mjs', import.meta.url));
const fixturesRoot = fileURLToPath(new URL('./fixtures/boundaries/', import.meta.url));

function runFixture(name: string) {
  return spawnSync(process.execPath, [boundaryScript, '--fixture', `${fixturesRoot}${name}`], {
    encoding: 'utf8',
  });
}

function expectSingleRuleFailure(fixture: string, expectedError: string): void {
  const result = runFixture(fixture);
  const diagnostics = result.stderr.split(/\r?\n/).filter((line) => line.length > 0);
  expect(result.status).toBe(1);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toContain(expectedError);
}

describe('P02-001 boundary checker fixtures', () => {
  it('accepts the positive scaffold fixture', () => {
    const result = runFixture('positive');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Legacy/V2 boundaries enforced');
  });

  it.each([
    ['negative-core-imports-v2', 'Core must not import future V2 production code'],
    ['negative-core-require-alias-v2', 'Core must not import future V2 production code'],
    ['negative-v2-imports-legacy-root', 'Future V2 production source must not import Legacy P01'],
    [
      'negative-v2-require-alias-legacy-root',
      'Future V2 production source must not import Legacy P01',
    ],
    [
      'negative-v2-imports-legacy-wrapper',
      'Future V2 production source must not import Legacy P01',
    ],
    ['negative-v2-imports-main-legacy', 'Future V2 production source must not import Legacy P01'],
    ['negative-v2-imports-deep-legacy', 'Future V2 production source must not import Legacy P01'],
    ['negative-v2-reference-path-legacy', 'Future V2 production source must not import Legacy P01'],
    ['negative-core-imports-legacy-wrapper', 'Core must not import Legacy P01'],
    [
      'negative-approved-v2-path-imports-legacy',
      'Future V2 production source must not import Legacy P01',
    ],
    [
      'negative-v2-dynamic-imports-legacy',
      'Future V2 production source must not import Legacy P01',
    ],
    ['negative-v2-nonstatic-import', 'Non-static module specifier is forbidden'],
    [
      'negative-match-imports-resolver',
      'domain/match must not import a mutable GameState resolver',
    ],
    [
      'negative-match-require-alias-resolver',
      'domain/match must not import a mutable GameState resolver',
    ],
    [
      'negative-match-imports-approved-core-resolver',
      'domain/match must not import a mutable GameState resolver',
    ],
    ['negative-cli-resolver', 'Production CLI must not call a domain state-change resolver'],
    [
      'negative-cli-require-alias-resolver',
      'Production CLI must not call a domain state-change resolver',
    ],
    [
      'negative-cli-require-alias-chain',
      'Production CLI must not call a domain state-change resolver',
    ],
    [
      'negative-cli-module-destructure-assignment',
      'Production CLI must not call a domain state-change resolver',
    ],
    ['negative-cli-require-call', 'Production CLI must not call a domain state-change resolver'],
    [
      'negative-cli-global-object-require-alias',
      'Production CLI must not call a domain state-change resolver',
    ],
    ['negative-tsconfig-core-imports-v2', 'Core must not import future V2 production code'],
    [
      'negative-tsconfig-v2-imports-legacy-root',
      'Future V2 production source must not import Legacy P01',
    ],
    [
      'negative-tsconfig-match-imports-resolver',
      'domain/match must not import a mutable GameState resolver',
    ],
    [
      'negative-tsconfig-cli-resolver',
      'Production CLI must not call a domain state-change resolver',
    ],
    [
      'negative-baseurl-v2-imports-legacy-root',
      'Future V2 production source must not import Legacy P01',
    ],
    ['negative-baseurl-root-bridge', 'Future V2 production source must not import Legacy P01'],
    [
      'negative-tsconfig-unmanifested-bridge',
      'Future V2 production source must not import Legacy P01',
    ],
    [
      'negative-v2-relative-outside-graph',
      'Source import resolves outside the scanned production graph',
    ],
  ])('independently rejects %s with exactly its intended rule', (fixture, expectedError) => {
    expectSingleRuleFailure(fixture, expectedError);
  });

  it.each([
    ['negative-v2-imports-legacy', 'Future V2 production source must not import Legacy P01'],
    ['negative-legacy-imports-v2', 'Legacy source must not import future V2 production code'],
    [
      'negative-match-imports-application',
      'domain/match must not import application or persistence',
    ],
    [
      'negative-web-imports-domain',
      'Web must not import application/domain/persistence production code',
    ],
    ['negative-web-html-domain', 'Web module script must stay under apps/web/src'],
    ['negative-web-dependency', 'Web has forbidden production dependencies'],
    ['negative-core-imports-legacy', 'Core must not import Legacy P01'],
    ['negative-package-cycle', 'Package cycle'],
    ['negative-cli-module-require', 'Production CLI must not call a domain state-change resolver'],
    [
      'negative-cli-get-builtin-module',
      'Dynamic module loaders are forbidden in production source',
    ],
    [
      'negative-loader-export-specifier',
      'Dynamic module loaders are forbidden in production source',
    ],
    [
      'negative-loader-identity-wrapper',
      'Dynamic module loaders are forbidden in production source',
    ],
    [
      'negative-loader-object-container',
      'Dynamic module loaders are forbidden in production source',
    ],
    [
      'negative-loader-process-wrapper',
      'Dynamic module loaders are forbidden in production source',
    ],
    ['negative-loader-member-export', 'Dynamic module loaders are forbidden in production source'],
    ['negative-loader-value-of', 'Dynamic module loaders are forbidden in production source'],
  ])('rejects %s', (fixture, expectedError) => {
    const result = runFixture(fixture);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expectedError);
  });

  it('allows injected functions that shadow loader-like global names', () => {
    const result = runFixture('positive-loader-shadow');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('tracks loader capabilities forwarded through bind, call, and apply', () => {
    const result = runFixture('negative-cli-forwarded-loader-invocations');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Dynamic module loaders are forbidden in production source');
    expect(result.stderr).toContain('Production CLI must not call a domain state-change resolver');
  });

  it('rejects Match imports that cross into application through relative paths', () => {
    const result = runFixture('negative-match-relative-application');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Cross-package relative import is forbidden');
    expect(result.stderr).toContain('domain/match must not import application or persistence');
  });

  it('rejects Web imports that cross into domain through relative paths', () => {
    const result = runFixture('negative-web-relative-domain');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Cross-package relative import is forbidden');
    expect(result.stderr).toContain(
      'Web must not import application/domain/persistence production code',
    );
  });

  it('tracks a process loader obtained through module.require', () => {
    const result = runFixture('negative-cli-module-require-loader-chain');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Dynamic module loaders are forbidden in production source');
    expect(result.stderr).toContain('Production CLI must not call a domain state-change resolver');
  });

  it('rejects Vite import.meta glob loaders that reach domain from Web', () => {
    const result = runFixture('negative-web-import-meta-glob');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Dynamic module loaders are forbidden in production source');
    expect(result.stderr).toContain(
      'Web must not import application/domain/persistence production code',
    );
    expect(result.stderr).toContain('apps/web/src/query.mjs');
  });

  it('detects package cycles formed by relative source imports', () => {
    const result = runFixture('negative-package-cycle-relative');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Package cycle');
  });

  it('resolves package imports aliases before applying protected-zone rules', () => {
    const result = runFixture('negative-package-import-aliases');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Core must not import future V2 production code');
    expect(result.stderr).toContain('Future V2 production source must not import Legacy P01');
    expect(result.stderr).toContain('domain/match must not import a mutable GameState resolver');
    expect(result.stderr).toContain('Production CLI must not call a domain state-change resolver');
    expect(result.stderr).toContain('Dynamic module loaders are forbidden in production source');
    expect(result.stderr).toContain(
      'Unresolved package import alias is forbidden in production source',
    );
    expect(result.stderr).toContain(
      'Conditional workspace exports are forbidden in production source',
    );
    expect(result.stderr).toContain('packages/relay/src/index.mjs');
    expect(result.stderr).toContain('pattern-v2.mjs');
  });

  it('rejects arbitrary Match resolvers hidden under domain/core', () => {
    const result = runFixture('negative-match-imports-core-resolver');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Core source is outside the P02-001 approved primitive surface',
    );
    expect(result.stderr).toContain('domain/match must not import a mutable GameState resolver');
  });

  it('does not let a test-suffixed module hide a V2 to Legacy edge', () => {
    const result = runFixture('negative-v2-imports-test-bridge');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Production source must not import test/spec source');
    expect(result.stderr).toContain('Future V2 production source must not import Legacy P01');
  });
});
