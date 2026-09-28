# ERP Sagas

Step definitions live in `src/modules/orchestration/domain/saga.definitions.ts`. Engine helpers: `assertSagaStepTransition`, `nextStep`, `isTerminal`, `buildCompensationPlan`.

## Sales order

```mermaid
sequenceDiagram
  participant Orch as Orchestration
  participant Sales
  participant Inv as Inventory
  participant Ful as Fulfillment
  participant Fin as Finance
  Orch->>Sales: VALIDATE (SoT)
  Orch->>Orch: PRICE / CREDIT (WAITING until facades)
  Orch->>Inv: ATP / RESERVE (optional engine)
  Orch->>Inv: ALLOCATE
  Orch->>Ful: FULFILL / SHIP
  Orch->>Fin: INVOICE / PAYMENT / ACCOUNTING
  Orch->>Inv: ISSUE
  Orch->>Orch: COMPLETE
```

Steps: `VALIDATE → PRICE → CREDIT → ATP → RESERVE → ALLOCATE → FULFILL → SHIP → INVOICE → PAYMENT → ISSUE → ACCOUNTING → COMPLETE`

Compensatable: RESERVE, ALLOCATE, FULFILL, SHIP, INVOICE, PAYMENT, ISSUE, ACCOUNTING.

## Purchase order

```mermaid
flowchart LR
  DEMAND --> REQUISITION --> APPROVE --> PO --> RECEIVE --> QC --> INVENTORY --> THREE_WAY --> AP --> CLOSE
```

## Fulfillment

```mermaid
flowchart LR
  RESERVE --> ALLOCATE --> PICK --> PACK --> SHIP --> DELIVER
```

## Return

```mermaid
flowchart LR
  REQUEST --> APPROVE --> RECEIVE --> INSPECT --> INVENTORY_DECISION --> CREDIT --> REFUND --> ACCOUNTING --> CLOSE
```

## Payment

```mermaid
flowchart LR
  INTENT --> CAPTURE --> SETTLE --> ACCOUNTING
```

## Replenishment

```mermaid
flowchart LR
  DETECT --> SUGGEST --> REQUISITION --> APPROVE --> PO --> RECEIVE --> PUTAWAY --> CLOSE
```

## Operating the saga

1. `POST /orchestration/sagas` — start (creates steps + business process).
2. `POST /orchestration/sagas/:id/advance` — record `SUCCEEDED` | `FAILED` | `WAITING` | `SKIPPED`.
3. `POST /orchestration/sagas/:id/retry` — from FAILED / WAITING / MANUAL_REVIEW.
4. `POST /orchestration/sagas/:id/compensate` — reverse compensatable completed steps (records COMPENSATED; inventory release via orchestrator when engine present).

`SalesOrderSagaOrchestrator.startForOrder` auto-advances VALIDATE → PRICE(WAITING). Use `tryReserve` when at ATP.
