# P9 — Architecture

## Positionnement

P9 est le **control plane opérations plateforme** d’Okapi Edge. Il orchestre la visibilité et la gouvernance opérationnelle ; il **ne** devient **pas** :

- le registre tenants (P8),
- le moteur de provisioning / workflow (P7),
- l’autorité subscription/entitlement (P5),
- le moteur billing/paiement (P6).

## Style

Modular monolith NestJS hexagonale, cohérent avec P7/P8.

```
presentation (controllers/DTOs)
    ↓
application (use-cases)
    ↓
domain (types, policies, ports)
    ↑
infrastructure (PG, adapters télémétrie/notif/P7)
```

## Agrégats initiaux (P9.1+)

1. **PlatformService** — catalogue opérationnel canonique  
2. **ServiceDependency** — graphe versionné  
3. *(ultérieur)* Alert, Incident, Change, Maintenance, SLO, Runbook, …

## Intégrations (ports)

| Port | Direction | Source of truth |
|------|-----------|-----------------|
| P7 workflow/infra health | inbound observe | P7 |
| P8 tenant risk/refs | inbound observe | P8 |
| P5/P6 health refs | inbound observe | P5/P6 |
| OTEL/Prometheus/Alertmanager | inbound adapters | providers |
| Notification | outbound adapters | Identity/messaging |
| P7 remediation invoke | outbound authorized | P7 APIs only |

## Santé globale

Toute agrégation documente : sources, fraîcheur, règles.  
`UNKNOWN` / `STALE` / `UNAVAILABLE` **ne** deviennent **jamais** `HEALTHY` silencieusement.

## Événements

Outbox `edge-control-plane` ; types `edge.p9.*` ; audit durable obligatoire sur mutations sensibles.
