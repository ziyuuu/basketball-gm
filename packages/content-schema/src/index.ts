import { z } from 'zod';

export const ContentStatusSchema = z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'RETIRED']);
export const PositionSchema = z.enum(['PG', 'SG', 'SF', 'PF', 'C']);
export const RaritySchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const AssetReferencesSchema = z
  .object({
    portrait: z.string().min(1),
    casual: z.string().min(1).optional(),
    match: z.string().min(1).optional(),
    expressions: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const UniqueCharacterDefinitionSchema = z
  .object({
    catalogId: z.string().regex(/^CHAR_[A-Z0-9_]+$/),
    rarity: RaritySchema.refine((rarity) => rarity >= 4, {
      message: 'Unique-character definitions are reserved for rarity 4 or above.',
    }),
    name: z.string().min(1),
    positions: z
      .object({
        best: z.array(PositionSchema).min(1),
        swing: z.array(PositionSchema),
      })
      .strict(),
    coreSkillId: z.string().min(1),
    personalityCore: z.array(z.string().min(1)).min(1),
    contentStatus: ContentStatusSchema,
    approvalRecordId: z.string().min(1).optional(),
    assetRefs: AssetReferencesSchema,
  })
  .strict()
  .superRefine((definition, context) => {
    if (definition.contentStatus === 'APPROVED' && !definition.approvalRecordId) {
      context.addIssue({
        code: 'custom',
        message: 'Approved unique characters require an approval record.',
        path: ['approvalRecordId'],
      });
    }
  });

export const ContentManifestSchema = z
  .object({
    namespace: z.string().regex(/^[a-z][a-z0-9-]*$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    engineRange: z.string().min(1),
    uniqueCharacters: z.array(UniqueCharacterDefinitionSchema),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>();
    for (const [index, character] of manifest.uniqueCharacters.entries()) {
      if (ids.has(character.catalogId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate catalog ID: ${character.catalogId}`,
          path: ['uniqueCharacters', index, 'catalogId'],
        });
      }
      ids.add(character.catalogId);
    }
  });

export type ContentManifest = z.infer<typeof ContentManifestSchema>;
export type UniqueCharacterDefinition = z.infer<typeof UniqueCharacterDefinitionSchema>;
