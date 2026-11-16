# P10 — Security & privacy

## Contrôles implémentés

| Contrôle | Preuve |
|----------|--------|
| Auth Edge + permissions | Controllers `@UseGuards` + `@RequireEdgePermissions` |
| Public endpoints | `@Public()` + `@Throttle` (leads 20/min, analytics 120/min) |
| No payment credentials | `assertNoPaymentCredentials` + pas de colonnes carte |
| Immutable published versions | Policy form/content |
| SoD self-approve | `assertSeparationOfDuties` |
| Document outbox sans storage URL | RegisterDocumentUpload payload stripped |
| Analytics PII strip | Keys sensibles retirées des properties |
| Audit append-only | `edge_p10_audit_events` sur mutations clés |
| Idempotency checkout | `edge_p10_idempotency_keys` |

## Données personnelles

- Emails normalisés sur prospects/leads
- Answers JSONB peuvent contenir PII métier — rétention / purge **pas** automatisée dans P10
- Documents : refs storage externes seulement

## Non livré

- Encryption field-level / tokenization
- Right-to-erasure workflow GDPR automatisé
- DLP scanning uploads
- WAF / bot score au-delà du throttle Nest

## Statut

**Baseline security controls DONE ; privacy ops tooling pending.**
