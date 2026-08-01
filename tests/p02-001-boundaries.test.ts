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

describe('P02-001 boundary checker fixtures', () => {
  it('accepts the positive scaffold fixture', () => {
    const result = runFixture('positive');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Legacy/V2 boundaries enforced');
  });

  it.each([
    ['negative-v2-imports-legacy', 'Future V2 production source must not import Legacy P01'],
    ['negative-legacy-imports-v2', 'Legacy source must not import future V2 production code'],
    [
      'negative-match-imports-application',
      'domain/match must not import application or persistence',
    ],
    [
      'negative-match-imports-resolver',
      'domain/match must not import a mutable GameState resolver',
    ],
    [
      'negative-web-imports-domain',
      'Web must not import application/domain/persistence production code',
    ],
    ['negative-web-dependency', 'Web has forbidden production dependencies'],
    ['negative-cli-resolver', 'Production CLI must not call a domain state-change resolver'],
    ['negative-core-imports-legacy', 'Core must not import Legacy P01'],
    ['negative-package-cycle', 'Package cycle'],
  ])('rejects %s', (fixture, expectedError) => {
    const result = runFixture(fixture);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expectedError);
  });
});
