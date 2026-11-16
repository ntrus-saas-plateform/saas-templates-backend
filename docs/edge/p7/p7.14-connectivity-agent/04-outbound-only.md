# P7.14 — Outbound-Only Connectivity

Agents must initiate all control-plane contact. No inbound listener is registered by the platform for tenant networks.

- Create/register always persist `outbound_only=true`.
- Client `outboundOnly=false` is rejected at API/use-case/policy layers.
- Spool delivers pending commands when the agent polls outbound.
- Explicit tunnels / inbound reverse connectivity are out of scope for this phase.
