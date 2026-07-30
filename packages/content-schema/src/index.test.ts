import { describe, expect, it } from 'vitest';

import { ContentManifestSchema } from './index.js';

const approvedCharacter = {
  catalogId: 'CHAR_GUIDE_4STAR_01',
  rarity: 4,
  name: 'P00 Schema Fixture',
  positions: {
    best: ['PG'],
    swing: ['SG'],
  },
  coreSkillId: 'SKILL_FIXTURE',
  personalityCore: ['supportive'],
  contentStatus: 'APPROVED',
  approvalRecordId: 'APPROVAL-FIXTURE-001',
  assetRefs: {
    portrait: 'asset://fixture/portrait',
    expressions: [],
  },
} as const;

describe('content Schema spike', () => {
  it('accepts an approved unique-character fixture with an approval record', () => {
    const result = ContentManifestSchema.safeParse({
      namespace: 'p00-fixture',
      version: '0.1.0',
      engineRange: '^0.1.0',
      uniqueCharacters: [approvedCharacter],
    });

    expect(result.success).toBe(true);
  });

  it('rejects approved content without an approval record', () => {
    const { approvalRecordId: _approvalRecordId, ...withoutApproval } = approvedCharacter;
    const result = ContentManifestSchema.safeParse({
      namespace: 'p00-fixture',
      version: '0.1.0',
      engineRange: '^0.1.0',
      uniqueCharacters: [withoutApproval],
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate catalog IDs', () => {
    const result = ContentManifestSchema.safeParse({
      namespace: 'p00-fixture',
      version: '0.1.0',
      engineRange: '^0.1.0',
      uniqueCharacters: [approvedCharacter, approvedCharacter],
    });

    expect(result.success).toBe(false);
  });
});
