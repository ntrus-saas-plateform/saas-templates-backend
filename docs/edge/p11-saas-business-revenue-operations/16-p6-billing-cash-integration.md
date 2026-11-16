# 16 — P6 billing & cash integration

## Direction

```
P6 invoice/payment refs --provenance--> INVOICED / COLLECTED / RECEIVABLES snapshots
P11 --X--> never creates invoices, payment intents, or stores credentials
```

**Live P6 recognition wiring deferred** for independent audit readiness of the foundation slice.

Assurance detectors consume evidence structs; they do not call P6 mutators.
