# Procurement API (Wave 1)

Base: `/api/v1/purchasing`

**Auth:** Bearer JWT → tenant/org from context (never from body).  
**Gates:** `@RequireModule('purchasing')` + `@RequiresCapability('PURCHASING')` + route permissions / finer capabilities.

| Method | Path | Permission | Capability (extra) |
|--------|------|------------|--------------------|
| GET | `/suppliers` | `purchasing:read` | — |
| GET | `/suppliers/:id` | `purchasing:read` | — |
| POST | `/suppliers` | `purchasing:create` / manage | `SUPPLIER_MANAGEMENT` |
| PATCH | `/suppliers/:id` | `purchasing:supplier_manage` | `SUPPLIER_MANAGEMENT` |
| POST | `/suppliers/:id/transition` | `purchasing:supplier_manage` | `SUPPLIER_MANAGEMENT` |
| POST | `/suppliers/mappings` | `purchasing:supplier_manage` | `SUPPLIER_MANAGEMENT` |
| POST | `/suppliers/prices` | `purchasing:create` | — |
| GET | `/suppliers/:id/prices/history` | `purchasing:read` | — |
| POST | `/suppliers/contracts` | `purchasing:create` | — |
| POST | `/requisitions` | `purchasing:create` | — |
| POST | `/requisitions/:id/submit\|approve\|reject\|convert` | create/approve | — |
| POST | `/rfqs` | `purchasing:rfq` | `RFQ` |
| POST | `/rfqs/:id/open\|invite\|award` | `purchasing:rfq` | `RFQ` |
| POST | `/quotations` | `purchasing:quote` | `SUPPLIER_QUOTATION` |
| POST | `/rfqs/:id/compare` | `purchasing:quote` | `SUPPLIER_QUOTATION` |
| GET/POST | `/orders` … | read/create/approve | — |
| POST | `/orders/:id/transition` | `purchasing:approve` | — |
| POST | `/orders/:id/receive` | `purchasing:receive` | — |
| POST | `/orders/:id/backorders` | `purchasing:create` | — |
| POST | `/supplier-invoices` | `purchasing:create` | — |
| POST | `/three-way-match` | `purchasing:match` | `THREE_WAY_MATCH` |
| POST | `/landed-cost` … | `purchasing:create` | `LANDED_COST` |
| POST | `/supplier-credits` | `purchasing:return` | `SUPPLIER_RETURNS` |
| GET | `/analytics` | `purchasing:read` | — |

**Idempotency:** send `Idempotency-Key` on POST/PATCH.  
**Concurrency:** send `expectedVersion` on supplier/PO/RFQ updates where supported → **409** on conflict.

## MCP tools

`list_suppliers`, `get_supplier`, `create_supplier`, `create_purchase_requisition`, `approve_purchase_requisition`, `create_rfq`, `compare_supplier_quotes`, `create_purchase_order`, `approve_purchase_order`, `get_purchase_order`, `get_supplier_performance` — each mapped in `mcp-tool-permissions.ts` (deny-by-default).
