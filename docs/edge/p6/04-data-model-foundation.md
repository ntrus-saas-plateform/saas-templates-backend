# P6 � Data Model Foundation

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE** � tables land in migrations **`090`�`092`** (same delivery as module code)

## Migrations (planned)

| Migration | Scope |
|-----------|--------|
| `090_edge_billing_accounts.sql` | Billing accounts, profiles, schedules, policies |
| `091_edge_billing_invoicing_payments.sql` | Invoices, lines, tax snapshots, payment intents/attempts, webhook receipts |
| `092_edge_billing_ledger_collections.sql` | Ledger entries, credit memos, refunds, collection cases, reconciliation batches |

## Tables

| Table | Role |
|-------|------|
| `edge_billing_accounts` | Billing account root; links `commercial_account_id`, `subscription_id` |
| `edge_billing_profiles` | Bill-to address, default currency, external customer ref |
| `edge_billing_payment_method_refs` | Tokenized method refs only � **no PAN/CVV** |
| `edge_billing_schedules` | Next run dates, anchor to P5 period refs |
| `edge_billing_policies` | Dunning, issue, payment confirmation policy |
| `edge_invoices` | Invoice aggregate; status separate from payment |
| `edge_invoice_lines` | Frozen lines at issue (amounts as `numeric` or text per convention � API decimal strings) |
| `edge_invoice_tax_snapshots` | Tax breakdown frozen at issue |
| `edge_payment_intents` | Amount due, currency, invoice link, provider correlation |
| `edge_payment_attempts` | Per-try state, provider attempt id, failure codes |
| `edge_payment_webhook_receipts` | Idempotent webhook ingest audit |
| `edge_credit_memos` | Credit against invoice / account |
| `edge_refunds` | Refund linked to payment attempt |
| `edge_collection_cases` | Dunning case stub + stage |
| `edge_ledger_entries` | Append-only debit/credit rows |
| `edge_reconciliation_batches` | Provider batch vs ledger match state |
| `edge_billing_coordination_outbox` | Optional mirror � prefer CP outbox; coordination row aligns with P5 table pattern |

## Identifiers

- Primary keys: `gen_random_uuid()`
- Invoice numbers: `INV-######` (sequence in `090`)
- No frontend-supplied technical IDs on create
- Idempotency: `correlation_id` on coordination + payment intents; webhook `provider_event_id` unique

## Immutability

| Artifact | Rule |
|----------|------|
| `edge_invoices` in `ISSUED`+ | Header totals and issue timestamp **immutable** |
| `edge_invoice_lines` | **Insert-only** after issue � no UPDATE on issued invoice |
| `edge_invoice_tax_snapshots` | Frozen at issue |
| `edge_ledger_entries` | **Append-only** � corrections via reversing entries |
| P5 commercial snapshot on invoice | Copied at issue; live catalog does not rewrite |

## Money representation

| Layer | Rule |
|-------|------|
| API / events | Decimal strings (e.g. `"19.99"`) |
| DB | `numeric(19,4)` or text per migration convention � **no float** |
| Currency | ISO 4217 `char(3)` |

## Non-goals in `090`�`092`

- Full tax engine (Avalara-style) � snapshots + manual rates only in P6.0
- Hyperswitch schema or connector tables
- PSP card vault tables holding sensitive authentication data
- P5 subscription or entitlement tables (read FK only)
