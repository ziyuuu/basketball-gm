export const DOMAIN_REASON_CODES = [
  'BUDGET_INSUFFICIENT',
  'NO_ACTIVE_PLAYERS',
  'TIME_ALREADY_COMPLETE',
  'STATE_INVARIANT_FAILED',
] as const;

export type DomainReasonCode = (typeof DOMAIN_REASON_CODES)[number];

export class DomainRuleError extends Error {
  readonly reasonCode: DomainReasonCode;

  constructor(reasonCode: DomainReasonCode, message: string) {
    super(message);
    this.name = 'DomainRuleError';
    this.reasonCode = reasonCode;
  }
}
