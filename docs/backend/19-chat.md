# Backend spec — Pharmacist chat (Screen 19)

A 1:1 conversation between the member and a pharmacist at their chosen pharmacy. A
full-screen route (`/chat?id={threadId}`), reached from the Home "Vos pharmaciens"
roster (tapping an avatar). Text, image, file, and voice message kinds; sending is
locally optimistic.

> **Attachments deferred.** The quick chips (Photo / Document / Vocal) and camera
> shortcut are presentational — no `expo-camera` / `expo-image-picker` / audio
> recording (avoids a native rebuild, [[env-disk-constraint]]). They toast
> "disponible bientôt". Text send works (optimistic append).

Client is **mock-first**: `src/features/chat/api/chatApi.ts` (`USE_MOCK`).
View-model: `src/features/chat/types.ts`.

All responses use the envelope `{ data, message, success }` (see `src/types/api.ts`).

---

## GET `/chat/threads/{threadId}`

Requires auth. Returns the pharmacist, the pharmacy label, and the message history
(oldest-first). Pharmacy-scoped (`tenantId` server-side).

**200 Response `data`** (`ChatThread`)
```jsonc
{
  "id": "thread_centre",
  "pharmacist": { "id": "ph_thomas", "name": "Thomas R.", "role": "Pharmacien", "online": true, "initials": "TR" },
  "pharmacyName": "Centre",
  "dateLabel": "Aujourd'hui",
  "messages": [
    { "id": "m1", "direction": "in",  "kind": "text",  "text": "Bonjour Camille 👋 …", "time": "13:42" },
    { "id": "m2", "direction": "out", "kind": "text",  "text": "Bonjour, …", "time": "13:44", "status": "read" },
    { "id": "m3", "direction": "out", "kind": "image", "label": "Ordonnance", "time": "13:44", "status": "read" },
    { "id": "m5", "direction": "in",  "kind": "file",  "file": { "name": "Devis_assurance.pdf", "ext": "PDF", "sizeLabel": "84 Ko" }, "time": "13:45" },
    { "id": "m6", "direction": "out", "kind": "voice", "durationLabel": "0:12", "time": "13:46", "status": "delivered" }
  ]
}
```
`direction`: `in` = pharmacist, `out` = member. `kind`: `text | image | file | voice`.
`status` (out-only): `sent | delivered | read` → drives the tick indicator.

## POST `/chat/threads/{threadId}/messages`

Send a message. Body for text: `{ "kind": "text", "text": "…" }`. Attachments use
`multipart/form-data` (file part + `kind`) once native pickers are wired. Returns the
created `ChatMessage` (with server id/time/status). Client appends optimistically and
reconciles.

**Realtime:** history is fetched via this GET; live delivery would layer a
websocket/SSE channel or push notifications (out of scope for the mock).

## Rejections

| code | when |
|---|---|
| 401 | not authenticated |
| 403 | thread belongs to another member/tenant |
| 404 | unknown thread |
| 413 / 415 | attachment too large / unsupported type |
