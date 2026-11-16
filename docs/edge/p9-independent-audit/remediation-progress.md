# P9 remediation progress (P1)

**Branch:** `feature/console`  
**Note:** Do not rewrite original findings in `findings-register.md`. This file only maps FIND-P9-* to remediation artifacts.

**Migration numbering:** Deliverable requested as `117_edge_p9_remediation_ops.sql`, but `117_edge_p10_acquisition_foundation.sql` already exists. Remediation shipped as **`118_edge_p9_remediation_ops.sql`**.

## FIND → files

| Finding | Remediation | Files / artifacts |
|---|---|---|
| FIND-P9-001 / FIND-P9-002 | Probe results + connect sets CONFIGURED only; CONNECTED after UP probe | `migrations/control-plane/118_edge_p9_remediation_ops.sql` (`edge_p9_monitoring_probe_results`); `ConnectMonitoringSourceUseCase`; `RecordMonitoringProbeResultUseCase`; `assertMonitoringConnectedRequiresProbe` |
| FIND-P9-003 / FIND-P9-005 | Notification delivery tracking with honest status transitions | `edge_p9_notification_deliveries`; `RecordNotificationDeliveryUseCase`; `UpdateNotificationDeliveryStatusUseCase`; `assertNotificationDeliveryTransition` (blocks QUEUED→DELIVERED skip; DELIVERED needs `provider_ref`) |
| FIND-P9-004 | Real release registry (alias path kept, wired to list releases) | `edge_p9_releases`; `CreateReleaseUseCase`; `TransitionReleaseUseCase`; `ListReleasesUseCase`; `GET/POST edge/operations/releases`; `assertReleaseDeployedEvidence` |
| FIND-P9-006 | Trusted SLO source policy | `assertSloMeasurementSourceTrusted` in `operations-policy.ts`; enforced in `RecordSloMeasurementUseCase` |
| FIND-P9-007 | Recovery evidence kind + stronger refs | `evidence_kind` / `evidence_justification` columns; hardened `assertRestoreSuccessRequiresEvidence`; `VerifyRecoveryUseCase` + DTO |
| FIND-P9-008 | Record-only automation honesty | Always set `executionMode: 'RECORD_ONLY'`; `assertAutomationNotClaimingExternalSuccess` rejects fake provider SUCCESS |
| FIND-P9-009 | Testcontainers for P9 ops tables | `test/integration/edge-p9-operations-db.spec.ts` (`describe.skipIf(!runTestcontainers)`) |

## Permissions added

- `platform:operations:notifications:read|manage`
- `platform:operations:releases:read|manage`

## Honesty constraints (no fake provider SUCCESS)

- Notification `DELIVERED`/`ACKNOWLEDGED` require non-empty `provider_ref` (DB CHECK + policy).
- Release `DEPLOYED` requires `artifact_digest` OR `external_evidence_ref` (DB CHECK + policy).
- Monitoring connect never claims `CONNECTED` without probe `UP`.
- Automation execute remains record-only; cannot claim `providerSuccess` / `providerStatus: SUCCESS`.

## FE alignment (same wave)

- Types + `edgeApi` for releases/notifications/probes; recovery `evidenceKind`
- Operations Center tabs Releases/Notifications; probes under Alerts
- Module tests **8 passed**; smoke unauth paths extended

## Remaining (not closed — still blocks ACCEPTED)

- Live provider adapters / E4 (real scrape, paging, backup APIs)
- Run Testcontainers with `TESTCONTAINERS=true` in CI evidence capture
- P2 adversarial suites and deeper FE workflows (FIND-P9-010+)
- Remote push for Gate A (await explicit confirmation)
