import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ConsentState } from './marketing.entity.js';

export type RequiredConsentDefinition = {
  purpose: string;
  channel: string;
  textVersion: string;
  locale?: string;
  /** default true if omitted when listed */
  mandatory?: boolean;
  /** optional id in schema */
  consentRef?: string;
};

export type SubmittedConsent = {
  purpose: string;
  channel: string;
  textVersion: string;
  decision: 'GRANTED' | 'DENIED' | 'NOT_PROVIDED' | 'WITHDRAWN';
  locale?: string;
  consentRef?: string;
  /** ISO */
  decidedAt?: string;
};

export type ValidatedConsentRecord = {
  purpose: string;
  channel: string;
  state: ConsentState;
  consentTextVersion: string;
  locale: string | null;
  decidedAt: string;
  formId: string;
  formVersion: number;
  proof: {
    formId: string;
    formVersion: number;
    formSlug: string;
    locale: string | null;
    decidedAt: string;
    textVersion: string;
    consentRef?: string;
  };
};

const DECISION_TO_STATE: Record<
  Exclude<SubmittedConsent['decision'], 'WITHDRAWN'>,
  ConsentState
> = {
  GRANTED: ConsentState.GRANTED,
  DENIED: ConsentState.DENIED,
  NOT_PROVIDED: ConsentState.NOT_PROVIDED,
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function matchKey(purpose: string, channel: string, textVersion: string): string {
  return `${purpose}\0${channel}\0${textVersion}`;
}

function purposeChannelKey(purpose: string, channel: string): string {
  return `${purpose}\0${channel}`;
}

export function parseRequiredConsents(raw: unknown[]): RequiredConsentDefinition[] {
  if (!Array.isArray(raw)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'requiredConsents must be an array', [
      { field: 'requiredConsents' },
    ]);
  }

  const out: RequiredConsentDefinition[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `requiredConsents[${i}] must be an object`,
        [{ index: i }],
      );
    }
    const row = item as Record<string, unknown>;
    if (!isNonEmptyString(row.purpose) || !isNonEmptyString(row.channel) || !isNonEmptyString(row.textVersion)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `requiredConsents[${i}] requires purpose, channel, textVersion`,
        [{ index: i }],
      );
    }
    const def: RequiredConsentDefinition = {
      purpose: row.purpose.trim(),
      channel: row.channel.trim(),
      textVersion: row.textVersion.trim(),
    };
    if (row.locale !== undefined) {
      if (!isNonEmptyString(row.locale)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `requiredConsents[${i}].locale must be a non-empty string when provided`,
          [{ index: i }],
        );
      }
      def.locale = row.locale.trim();
    }
    if (row.mandatory !== undefined) {
      if (typeof row.mandatory !== 'boolean') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `requiredConsents[${i}].mandatory must be a boolean when provided`,
          [{ index: i }],
        );
      }
      def.mandatory = row.mandatory;
    }
    if (row.consentRef !== undefined) {
      if (!isNonEmptyString(row.consentRef)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          `requiredConsents[${i}].consentRef must be a non-empty string when provided`,
          [{ index: i }],
        );
      }
      def.consentRef = row.consentRef.trim();
    }
    out.push(def);
  }
  return out;
}

function isMandatory(def: RequiredConsentDefinition): boolean {
  return def.mandatory !== false;
}

function parseSubmitted(
  submitted: SubmittedConsent[] | undefined,
): SubmittedConsent[] {
  if (submitted == null) return [];
  if (!Array.isArray(submitted)) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'consents must be an array', [
      { field: 'consents' },
    ]);
  }

  const out: SubmittedConsent[] = [];
  for (let i = 0; i < submitted.length; i++) {
    const c = submitted[i];
    if (!c || typeof c !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, `consents[${i}] must be an object`, [
        { index: i },
      ]);
    }
    if (
      !isNonEmptyString(c.purpose) ||
      !isNonEmptyString(c.channel) ||
      !isNonEmptyString(c.textVersion)
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `consents[${i}] requires purpose, channel, textVersion`,
        [{ index: i }],
      );
    }
    const decision = c.decision;
    if (
      decision !== 'GRANTED' &&
      decision !== 'DENIED' &&
      decision !== 'NOT_PROVIDED' &&
      decision !== 'WITHDRAWN'
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `consents[${i}].decision must be GRANTED, DENIED, NOT_PROVIDED, or WITHDRAWN`,
        [{ index: i, decision }],
      );
    }
    out.push({
      purpose: c.purpose.trim(),
      channel: c.channel.trim(),
      textVersion: c.textVersion.trim(),
      decision,
      locale: isNonEmptyString(c.locale) ? c.locale.trim() : undefined,
      consentRef: isNonEmptyString(c.consentRef) ? c.consentRef.trim() : undefined,
      decidedAt: isNonEmptyString(c.decidedAt) ? c.decidedAt.trim() : undefined,
    });
  }
  return out;
}

export function validateSubmittedConsents(input: {
  required: RequiredConsentDefinition[];
  submitted: SubmittedConsent[] | undefined;
  formId: string;
  formVersion: number;
  formSlug: string;
}): { records: ValidatedConsentRecord[] } {
  const required = input.required;
  const submitted = parseSubmitted(input.submitted);

  const requiredByMatch = new Map<string, RequiredConsentDefinition>();
  const requiredConsentRefs = new Set<string>();
  for (const def of required) {
    requiredByMatch.set(matchKey(def.purpose, def.channel, def.textVersion), def);
    if (def.consentRef) requiredConsentRefs.add(def.consentRef);
  }

  const seenPurposeChannel = new Set<string>();
  const submittedByMatch = new Map<string, SubmittedConsent>();

  for (const c of submitted) {
    const pc = purposeChannelKey(c.purpose, c.channel);
    if (seenPurposeChannel.has(pc)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Duplicate consent for purpose+channel',
        [{ purpose: c.purpose, channel: c.channel }],
      );
    }
    seenPurposeChannel.add(pc);

    const def = requiredByMatch.get(matchKey(c.purpose, c.channel, c.textVersion));
    if (!def) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Submitted consent does not match form requiredConsents',
        [
          {
            purpose: c.purpose,
            channel: c.channel,
            textVersion: c.textVersion,
            consentRef: c.consentRef ?? null,
          },
        ],
      );
    }
    if (c.consentRef != null && !requiredConsentRefs.has(c.consentRef)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Forged consentRef not listed in form requiredConsents',
        [{ consentRef: c.consentRef }],
      );
    }
    if (c.consentRef != null && def.consentRef != null && c.consentRef !== def.consentRef) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Submitted consentRef does not match required definition',
        [{ consentRef: c.consentRef, expected: def.consentRef }],
      );
    }
    if (c.decision === 'WITHDRAWN') {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'WITHDRAWN is not allowed on initial form submit',
        [{ purpose: c.purpose, channel: c.channel }],
      );
    }

    submittedByMatch.set(matchKey(c.purpose, c.channel, c.textVersion), c);
  }

  for (const def of required) {
    if (!isMandatory(def)) continue;
    const match = submittedByMatch.get(matchKey(def.purpose, def.channel, def.textVersion));
    if (!match) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Missing mandatory consent',
        [
          {
            purpose: def.purpose,
            channel: def.channel,
            textVersion: def.textVersion,
          },
        ],
      );
    }
    if (match.decision !== 'GRANTED') {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Mandatory consent must be GRANTED',
        [
          {
            purpose: def.purpose,
            channel: def.channel,
            decision: match.decision,
          },
        ],
      );
    }
  }

  const records: ValidatedConsentRecord[] = [];
  for (const c of submitted) {
    const def = requiredByMatch.get(matchKey(c.purpose, c.channel, c.textVersion))!;
    const decidedAt = c.decidedAt ?? new Date().toISOString();
    const locale = c.locale ?? def.locale ?? null;
    const state = DECISION_TO_STATE[c.decision as Exclude<SubmittedConsent['decision'], 'WITHDRAWN'>];
    const proof: ValidatedConsentRecord['proof'] = {
      formId: input.formId,
      formVersion: input.formVersion,
      formSlug: input.formSlug,
      locale,
      decidedAt,
      textVersion: c.textVersion,
    };
    if (c.consentRef ?? def.consentRef) {
      proof.consentRef = c.consentRef ?? def.consentRef;
    }
    records.push({
      purpose: c.purpose,
      channel: c.channel,
      state,
      consentTextVersion: c.textVersion,
      locale,
      decidedAt,
      formId: input.formId,
      formVersion: input.formVersion,
      proof,
    });
  }

  return { records };
}
