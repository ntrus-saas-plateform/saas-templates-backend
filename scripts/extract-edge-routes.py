#!/usr/bin/env python3
"""Extract NestJS Edge controller routes + FE edgeApi methods / pages → alignment docs."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BE_CTRL = (
    ROOT
    / "saas-templates-backend"
    / "src"
    / "modules"
    / "edge"
    / "presentation"
    / "controllers"
)
FE_ROOT = ROOT / "saas-template-frontend"
FE_API = FE_ROOT / "lib" / "api" / "edge.ts"
FE_PAGES = FE_ROOT / "app"
OUT_DIR = ROOT / "saas-templates-backend" / "docs" / "edge" / "route-alignment"

STR_RE = re.compile(r"""['"]([^'"]*)['"]""")
HANDLER_RE = re.compile(r"(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(")
CLASS_RE = re.compile(r"export\s+class\s+(\w+)")


def first_string(arg: str) -> str:
    m = STR_RE.search(arg or "")
    return m.group(1) if m else ""


def join_path(*parts: str) -> str:
    segs: list[str] = []
    for p in parts:
        p = (p or "").strip()
        if not p:
            continue
        segs.extend(s for s in p.strip("/").split("/") if s)
    return "/" + "/".join(segs)


def extract_backend() -> tuple[list[dict], dict[str, str]]:
    routes: list[dict] = []
    class_ctrl: dict[str, str] = {}

    for f in sorted(BE_CTRL.glob("*.controller.ts")):
        if any(x in f.name for x in (".spec.", ".auth.", ".routing.")):
            continue
        text = f.read_text(encoding="utf-8")
        lines = text.splitlines()
        ctrl_path = ""
        class_name = f.name
        i = 0
        while i < len(lines):
            line = lines[i]
            cm = re.search(r"@Controller\((.*)\)", line)
            if cm:
                ctrl_path = first_string(cm.group(1))
                # peek class name
                for j in range(i + 1, min(i + 8, len(lines))):
                    cl = CLASS_RE.search(lines[j])
                    if cl:
                        class_name = cl.group(1)
                        class_ctrl[f"{f.name}::{class_name}"] = ctrl_path
                        break
                i += 1
                continue

            sm = re.search(
                r"@(Get|Post|Put|Patch|Delete|Head|Options)\((.*)\)",
                line,
            )
            if sm:
                method = sm.group(1).upper()
                sub = first_string(sm.group(2))
                handler = ""
                for j in range(i + 1, min(i + 15, len(lines))):
                    s = lines[j].strip()
                    if s.startswith("@") or not s:
                        continue
                    hm = HANDLER_RE.search(s)
                    if hm and hm.group(1) not in ("if", "for", "while", "switch"):
                        handler = hm.group(1)
                        break
                full_rel = join_path(ctrl_path, sub)
                routes.append(
                    {
                        "file": f.name,
                        "class": class_name,
                        "controller": ctrl_path,
                        "method": method,
                        "path": sub,
                        "full_relative": full_rel,
                        "runtime": join_path("api", "v1", full_rel.lstrip("/")),
                        "handler": handler,
                    }
                )
            i += 1

    # fallback index by file → first controller path
    prefixes: dict[str, str] = {}
    for r in routes:
        prefixes.setdefault(r["file"], r["controller"])
    return routes, prefixes


def extract_fe_api() -> list[dict]:
    text = FE_API.read_text(encoding="utf-8")
    methods: list[dict] = []
    for m in re.finditer(
        r"^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:async\s*)?(?:\([^)]*\)|[^=])\s*=>",
        text,
        re.MULTILINE,
    ):
        name = m.group(1)
        start = m.start()
        chunk = text[start : start + 3000]
        next_m = re.search(
            r"^\s{2}[A-Za-z_][A-Za-z0-9_]*\s*:",
            chunk[len(name) + 10 :],
            re.MULTILINE,
        )
        if next_m:
            chunk = chunk[: next_m.start() + len(name) + 10]
        paths = []
        # Nested generics e.g. edgeRequest<OperationsListPage<Foo>>(...) —
        # avoid naive <[^>]*> which stops at the inner '>'.
        # Prefer non-nested templates in edge.ts (`"?" + query` not `` `?${q}` ``).
        for pm in re.finditer(
            r"""edgeRequest(?:Text)?(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(`[^`]+`|'[^']+'|"[^"]+")""",
            chunk,
        ):
            paths.append(pm.group(1).strip("`'\""))
        if re.search(r"""method:\s*['"]POST['"]""", chunk):
            http = "POST"
        elif re.search(r"""method:\s*['"]PUT['"]""", chunk):
            http = "PUT"
        elif re.search(r"""method:\s*['"]PATCH['"]""", chunk):
            http = "PATCH"
        elif re.search(r"""method:\s*['"]DELETE['"]""", chunk):
            http = "DELETE"
        else:
            http = "GET"
        methods.append({"name": name, "http": http, "paths": paths[:5]})
    return methods


def extract_fe_pages() -> list[dict]:
    pages: list[dict] = []
    for group in ("(edge-console)", "(acquisition-public)"):
        base = FE_PAGES / group
        if not base.exists():
            continue
        for f in sorted(base.rglob("page.tsx")):
            rel = f.relative_to(FE_PAGES / group).as_posix()
            url = "/" + rel.replace("/page.tsx", "").replace("page.tsx", "")
            url = url.rstrip("/") or "/"
            pages.append(
                {
                    "file": f.relative_to(FE_ROOT).as_posix(),
                    "url": url,
                    "group": group,
                }
            )
    api_root = FE_PAGES / "api"
    if api_root.exists():
        for f in sorted(api_root.rglob("route.ts")):
            if "edge" not in f.as_posix():
                continue
            rel = f.relative_to(api_root).as_posix().replace("/route.ts", "")
            pages.append(
                {
                    "file": f.relative_to(FE_ROOT).as_posix(),
                    "url": "/api/" + rel.replace("/[...path]", "/*"),
                    "group": "bff",
                }
            )
    return pages


def markdown_backend(routes: list[dict], prefixes: dict[str, str]) -> str:
    by_file: dict[str, list[dict]] = defaultdict(list)
    for r in routes:
        by_file[r["file"]].append(r)

    # multi-controller note
    by_class: dict[str, list[dict]] = defaultdict(list)
    for r in routes:
        by_class[f"{r['file']}::{r['class']}"].append(r)

    lines = [
        "# Edge Backend — Inventaire complet des routes",
        "",
        "> Généré par `saas-templates-backend/scripts/extract-edge-routes.py`.",
        ">",
        "> **Runtime Nest :** `setGlobalPrefix('api')` + URI versioning `v1`",
        "> → chemin effectif = `/api/v1` + `@Controller` + `@Method`.",
        ">",
        "> Exemple : `@Controller('edge/sales')` + `@Get('opportunities')`",
        "> → `GET /api/v1/edge/sales/opportunities`.",
        "",
        f"**Total handlers HTTP :** {len(routes)}",
        f"**Fichiers contrôleurs :** {len(by_file)}",
        f"**Classes contrôleurs :** {len(by_class)}",
        "",
        "## Index des fichiers",
        "",
        "| Fichier | Premier `@Controller` | #routes |",
        "|---|---|---:|",
    ]
    for fname in sorted(by_file):
        lines.append(
            f"| `{fname}` | `{prefixes.get(fname, '') or '(paths on methods)'}` | {len(by_file[fname])} |"
        )

    lines += [
        "",
        "## Index des classes (multi-controller)",
        "",
        "| Classe | Controller path | #routes | Fichier |",
        "|---|---|---:|---|",
    ]
    for key in sorted(by_class):
        sample = by_class[key][0]
        lines.append(
            f"| `{sample['class']}` | `{sample['controller'] or '(empty — full path on method)'}` | {len(by_class[key])} | `{sample['file']}` |"
        )

    lines += ["", "## Routes détaillées par fichier", ""]

    for fname in sorted(by_file):
        lines += [
            f"### `{fname}`",
            "",
            "| Method | Runtime (`/api/v1/...`) | Handler | Class |",
            "|---|---|---|---|",
        ]
        for r in by_file[fname]:
            lines.append(
                f"| `{r['method']}` | `{r['runtime']}` | `{r['handler']}` | `{r['class']}` |"
            )
        lines.append("")

    lines += [
        "## Notes",
        "",
        "1. Contrôleurs `@Controller()` vides (ops, acquisition, tenants, revenue, provisioning depth) placent le path complet sur `@Get('edge/...')`.",
        "2. Auth : la plupart des routes Edge utilisent `EdgeAuthGuard` + `EdgePermissionGuard` + permissions `platform:*`.",
        "3. Hors console : `workflow-worker`, integrations M2M P5, certaines routes lab.",
        "4. Acquisition publique : `acquisition-public.controller` (sans session admin).",
        "",
    ]
    return "\n".join(lines)


def markdown_frontend(api: list[dict], pages: list[dict]) -> str:
    console = [p for p in pages if p["group"] == "(edge-console)"]
    public = [p for p in pages if p["group"] == "(acquisition-public)"]
    bff = [p for p in pages if p["group"] == "bff"]

    lines = [
        "# Edge Frontend — Inventaire pages & clients API",
        "",
        "> Généré par `saas-templates-backend/scripts/extract-edge-routes.py`.",
        ">",
        "> Surface console : `app/(edge-console)/edge/**`",
        "> Acquisition publique : `app/(acquisition-public)/**`",
        "> BFF : `app/api/edge-auth/**`, `edge-bootstrap`, `edge-backend/[...path]`",
        "> Client : `lib/api/edge.ts` → `edgeApi.*`",
        "",
        f"**Pages console :** {len(console)}",
        f"**Pages acquisition publique :** {len(public)}",
        f"**Routes BFF :** {len(bff)}",
        f"**Méthodes `edgeApi` :** {len(api)}",
        "",
        "## Nav shell (groupes accordion)",
        "",
        "| Groupe | Entrées typiques |",
        "|---|---|",
        "| Platform | Portfolio, Catalog, Commercial, Marketing, Sales, Acquisition, Revenue, Subscriptions, Billing |",
        "| Tenants | Operations, Tenant Management, Provisioning Ops |",
        "| Provisioning | Registry → Evidence (+ Keycloak) |",
        "| Governance | Markets, Readiness, Verticals, Backends, Admins, Security, Audit |",
        "| Workspace | Overview / Configuration / Administration (si vertical actif) |",
        "",
        "## Pages console Edge",
        "",
        "| URL | Fichier |",
        "|---|---|",
    ]
    for p in console:
        lines.append(f"| `{p['url']}` | `{p['file']}` |")

    lines += [
        "",
        "## Pages acquisition publique",
        "",
        "| URL | Fichier |",
        "|---|---|",
    ]
    for p in public:
        lines.append(f"| `{p['url']}` | `{p['file']}` |")

    lines += [
        "",
        "## BFF Next.js",
        "",
        "| URL | Fichier | Rôle |",
        "|---|---|---|",
        "| `/api/edge-auth/login` | callback OAuth start | PKCE login |",
        "| `/api/edge-auth/callback` | code exchange | session iron |",
        "| `/api/edge-auth/session` | session JSON | bootstrap auth |",
        "| `/api/edge-auth/logout` | destroy session | |",
        "| `/api/edge-bootstrap` | me + workspaces + permissions | |",
        "| `/api/edge-backend/*` | proxy → Nest `/api/v1/*` | |",
        "",
        "## Client `edgeApi` (extrait méthodes)",
        "",
        "| Méthode FE | HTTP | Path(s) |",
        "|---|---|---|",
    ]
    for m in api:
        paths = ", ".join(f"`{p}`" for p in m["paths"]) or "—"
        lines.append(f"| `{m['name']}` | `{m['http']}` | {paths} |")

    lines += [
        "",
        "## Notes",
        "",
        "1. Le FE ne parle presque jamais à Nest en direct : tout passe par le BFF cookie-session.",
        "2. Paths FE `/api/edge-backend/edge/...` correspondent à Nest `/api/v1/edge/...` (selon rewrite proxy).",
        "3. Une page peut être « présente » mais MVP (peu d’actions branchées).",
        "",
    ]
    return "\n".join(lines)


def normalize_path(p: str) -> str:
    p = p.split("?")[0]
    # Drop FE query helpers spliced into template literals (incl. multiline).
    # Do NOT truncate on bare `${id}` — those become `:param` below.
    p = re.sub(r"\$\{toQuery\(\{[\s\S]*?\}\)\}", "", p)
    p = re.sub(r"\$\{toQuery\([^)]*\)\}", "", p)
    # Truncated toQuery / nested-template remnant: `...${toQuery(...` or `...${query ? `
    p = re.sub(r"\$\{toQuery\([\s\S]*$", "", p)
    p = re.sub(r"\$\{[^}]*$", "", p)
    p = re.sub(r"\$\{[^}]+\}", ":param", p)
    p = re.sub(r":[A-Za-z_][A-Za-z0-9_]*", ":param", p)
    p = p.strip("/")
    for prefix in (
        "api/v1/",
        "api/edge-backend/",
        "api/",
        "v1/",
    ):
        if p.startswith(prefix):
            p = p[len(prefix) :]
    return "/" + p


def strip_edge(p: str) -> str:
    p = p.strip("/")
    if p.startswith("edge/"):
        p = p[5:]
    return "/" + p


def canonicalize_fe_be(p: str) -> str:
    """Align public BFF aliases with Nest acquisition/public paths."""
    p = strip_edge(p)
    # FE BFF `/api/acquisition-public/X` → Nest `/edge/acquisition/public/X`
    if p.startswith("/acquisition-public/"):
        p = "/acquisition/public/" + p[len("/acquisition-public/") :]
    elif p == "/acquisition-public":
        p = "/acquisition/public"
    return p


def paths_match(a: str, b: str, *, allow_prefix: bool = False) -> bool:
    a, b = canonicalize_fe_be(a), canonicalize_fe_be(b)
    if a == b:
        return True
    if a.rstrip("/") == b.rstrip("/"):
        return True
    # Prefix match is optional — default off to avoid
    # `/subscriptions` consuming `/subscriptions/overview`.
    if allow_prefix and (
        a.startswith(b.rstrip("/") + "/") or b.startswith(a.rstrip("/") + "/")
    ):
        return True
    return False


def build_alignment(routes: list[dict], api: list[dict], pages: list[dict]) -> str:
    be_norm = sorted({normalize_path(r["runtime"]) for r in routes})
    fe_entries = []
    for m in api:
        for raw in m["paths"]:
            fe_entries.append(
                {
                    "name": m["name"],
                    "http": m["http"],
                    "raw": raw,
                    "norm": normalize_path(raw),
                }
            )
    fe_norm = sorted({e["norm"] for e in fe_entries if e["raw"]})

    matched_be: set[str] = set()
    matched_fe: set[str] = set()
    for bp in be_norm:
        for fp in fe_norm:
            if paths_match(bp, fp):
                matched_be.add(bp)
                matched_fe.add(fp)
                break
    be_only = [p for p in be_norm if p not in matched_be]
    fe_only = [p for p in fe_norm if p not in matched_fe]

    # Domain scoring
    domain_defs = [
        (
            "Auth / Admins / Security / Workspaces",
            ["administrators", "authorization", "security", "workspaces"],
            ["/edge/login", "/edge/administrators", "/edge/security", "/edge/audit", "/edge/workspace"],
            "P0",
        ),
        (
            "Verticals / Products / Catalog / Backends",
            ["verticals", "products", "catalog"],
            ["/edge", "/edge/catalog", "/edge/verticals", "/edge/backends", "/edge/markets", "/edge/readiness"],
            "P0",
        ),
        (
            "Product Control (BB hub)",
            ["product-control"],
            ["/edge/provisioning/product-controls"],
            "P0",
        ),
        (
            "Tenants & Provisioning requests",
            ["tenant-management", "provisioning.controller"],
            ["/edge/tenants", "/edge/provisioning-requests"],
            "P0",
        ),
        (
            "Subscriptions",
            ["subscription"],
            ["/edge/subscriptions"],
            "P1",
        ),
        (
            "Billing",
            ["billing"],
            ["/edge/billing"],
            "P1",
        ),
        (
            "Acquisition admin + public",
            ["acquisition"],
            ["/edge/acquisition"],
            "P1",
        ),
        (
            "Commercial",
            ["commercial"],
            ["/edge/commercial"],
            "P2",
        ),
        (
            "Marketing",
            ["marketing"],
            ["/edge/marketing"],
            "P2",
        ),
        (
            "Sales + Partner opportunities",
            ["sales.controller", "sales-platform", "partner-opportunity"],
            ["/edge/sales"],
            "P2",
        ),
        (
            "Revenue + Customer Success",
            ["revenue-operations", "customer-success"],
            ["/edge/revenue"],
            "P2",
        ),
        (
            "Platform Operations",
            ["platform-operations"],
            ["/edge/operations"],
            "P1",
        ),
        (
            "Provisioning depth (Registry→Evidence+KC)",
            [
                "registry",
                "placement",
                "workflow",
                "infrastructure",
                "configuration",
                "experience",
                "activation",
                "lifecycle",
                "onboarding",
                "reconciliation",
                "connectivity-agent",
                "certification",
                "keycloak",
            ],
            ["/edge/provisioning"],
            "P1",
        ),
        (
            "Workers / M2M / Lab status",
            ["workflow-worker", "p5-provisioning-integration", "live-complete"],
            [],
            "P3",
        ),
    ]

    page_urls = {p["url"] for p in pages if p["group"] == "(edge-console)"}
    # also count public acquire pages
    public_urls = [p["url"] for p in pages if p["group"] == "(acquisition-public)"]

    lines = [
        "# Plan d’alignement Edge Backend ↔ Frontend",
        "",
        "> Cohérence **extrême** pilotage plateforme (tenants, abo, billing, BB) — hors ERP métier.",
        ">",
        "> Artefacts : [`edge-backend-routes.md`](./edge-backend-routes.md) · [`edge-frontend-routes.md`](./edge-frontend-routes.md) · `edge-routes.extract.json`",
        ">",
        "> Régénération : `python saas-templates-backend/scripts/extract-edge-routes.py`",
        "",
        "## 0. Chiffres clés",
        "",
        f"| Métrique | Valeur |",
        f"|---|---:|",
        f"| Handlers Nest Edge | **{len(routes)}** |",
        f"| Méthodes `edgeApi` | **{len(api)}** |",
        f"| Pages console | **{len([p for p in pages if p['group']=='(edge-console)'])}** |",
        f"| Pages acquisition publique | **{len(public_urls)}** |",
        f"| Paths BE matchés (heuristique) | {len(matched_be)} / {len(be_norm)} |",
        f"| Paths BE sans client FE | **{len(be_only)}** |",
        f"| Paths FE sans match BE | **{len(fe_only)}** |",
        "",
        "### Verdict",
        "",
        "Le backend Edge est une **control plane complète** (~900 handlers). Le frontend a une **bonne ossature de pages** (~60+) et un client API dense (~700 méthodes), mais la profondeur UI reste **inhomogène** : certains domaines sont studio-grade (verticals/catalog/BB en cours), d’autres sont des modules MVP (sales/marketing) ou des listes sans toutes les transitions BE.",
        "",
        "**Objectif d’alignement :** chaque handler console-scopé a (1) client typé, (2) consommateur UI ou annotation `OutOfScope`, (3) permissions, (4) 4 états UI, (5) smoke e2e P0/P1.",
        "",
        "## 1. Matrice domaines",
        "",
        "| Domaine | Priorité | #routes BE | Pages FE | Lecture statut |",
        "|---|---|---:|---|---|",
    ]

    for name, file_keys, prefs, prio in domain_defs:
        be_n = sum(
            1
            for r in routes
            if any(k.replace(".controller", "") in r["file"] or k in r["file"] for k in file_keys)
        )
        # simpler file match
        be_n = 0
        for r in routes:
            fn = r["file"]
            if any(
                (k if k.endswith(".ts") else k) in fn
                or fn.startswith(k.split(".")[0])
                for k in file_keys
            ):
                be_n += 1
        # recount properly
        be_n = sum(
            1
            for r in routes
            if any(
                k.replace(".controller", "") in r["file"]
                or k in r["file"]
                for k in file_keys
            )
        )

        pages_hit = sorted(
            u
            for u in page_urls
            if any(u == pref or u.startswith(pref + "/") or (pref != "/edge" and u.startswith(pref)) for pref in prefs)
            or (prefs == ["/edge"] and u == "/edge")
        )
        # fix portfolio-only
        if name.startswith("Verticals"):
            pages_hit = sorted(
                u
                for u in page_urls
                if u == "/edge"
                or u.startswith("/edge/catalog")
                or u.startswith("/edge/verticals")
                or u.startswith("/edge/backends")
                or u.startswith("/edge/markets")
                or u.startswith("/edge/readiness")
            )

        if not prefs:
            status = "Hors console (M2M/lab) — documenter seulement"
        elif be_n == 0:
            status = "N/A"
        elif not pages_hit:
            status = "🔴 BE sans page"
        elif be_n >= 40 and len(pages_hit) <= 2:
            status = "🟠 Page(s) présentes — profondeur MVP / partielle"
        elif be_n >= 20 and len(pages_hit) <= 3:
            status = "🟠 À auditer handler-par-handler"
        else:
            status = "🟢 Surface large — compléter mutations + e2e"

        page_cell = ", ".join(f"`{u}`" for u in pages_hit[:6]) or "—"
        if len(pages_hit) > 6:
            page_cell += f" (+{len(pages_hit)-6})"
        lines.append(f"| {name} | {prio} | {be_n} | {page_cell} | {status} |")

    if public_urls:
        lines.append(
            f"| Acquisition publique (sites) | P1 | (voir acquisition-public) | {', '.join(f'`{u}`' for u in public_urls[:5])} | 🟢 Parcours public — parity admin |"
        )

    lines += [
        "",
        "## 2. Écarts path-level",
        "",
        "### 2.1 Backend sans client FE évident",
        "",
        f"Count: **{len(be_only)}**. Prioriser les paths `platform` console ; ignorer workers après annotation.",
        "",
        "<details><summary>Liste complète BE-only</summary>",
        "",
        "| Path normalisé |",
        "|---|",
    ]
    for p in be_only:
        lines.append(f"| `{p}` |")
    lines += ["", "</details>", ""]

    lines += [
        "### 2.2 Client FE sans match BE évident",
        "",
        f"Count: **{len(fe_only)}** (souvent BFF auth/bootstrap ou alias path).",
        "",
        "<details><summary>Liste FE-only</summary>",
        "",
        "| Path normalisé |",
        "|---|",
    ]
    for p in fe_only:
        lines.append(f"| `{p}` |")
    lines += ["", "</details>", ""]

    lines += [
        "## 3. Zones MVP / incomplètes — couverture obligatoire",
        "",
        "Pour chaque zone : **interdit** de laisser un handler « mort » sans UI ou sans `OutOfScope`.",
        "",
        "### 3.1 Sales (critique écart volume)",
        "",
        "- BE : `sales.controller` + `sales-platform` + partners ≈ 100 handlers.",
        "- FE : `/edge/sales` + opportunity detail — **MVP**.",
        "- Compléter : pipeline board, transitions stage, activities, quotes, assignation, permissions, empty/error (fix TS props).",
        "",
        "### 3.2 Marketing",
        "",
        "- BE journeys/campaigns/WAIT ≈ 50 handlers.",
        "- FE module unique — mapper chaque onglet → endpoints ; runtime status worker.",
        "",
        "### 3.3 Commercial",
        "",
        "- Plans / price books / availability / publication.",
        "- Detail plan existe — couvrir toutes mutations lifecycle.",
        "",
        "### 3.4 Billing & Subscriptions",
        "",
        "- BE très dense (70 billing + 54 subscriptions).",
        "- FE list/detail/portal — viser parité Stripe : invoice detail, retries, dunning, change-plan, pause/cancel, entitlements, credit notes si exposés.",
        "",
        "### 3.5 Acquisition",
        "",
        "- Admin inbox + public checkout/apply.",
        "- Compléter : décisions qualification, documents, handoff subscription, analytics funnel, honest lab badges.",
        "",
        "### 3.6 Revenue + CS",
        "",
        "- Revenue module présent ; CS (`edge/cs`) souvent **sans page dédiée** → hub CS ou section Revenue.",
        "",
        "### 3.7 Operations",
        "",
        "- 70 handlers ops — UI tabbed existe.",
        "- Compléter deep-links header inbox → alert/incident ; automation approvals ; status page publication.",
        "",
        "### 3.8 Tenants & provisioning-requests",
        "",
        "- Toutes transitions d’état + health snapshots + evidence isolation branchées en boutons (pas read-only).",
        "",
        "### 3.9 Product Control / Backends",
        "",
        "- Handshake, health-check, exchanges, capabilities, bindings catalog — parcours bout-en-bout lab.",
        "",
        "### 3.10 Provisioning depth",
        "",
        "- Chaque sous-page (registry, capacity, workflows, infra, config, experience, readiness, lifecycle, onboarding, reconciliation, agents, certification, evidence, keycloak) :",
        "  - list + detail + create + transition + permission gate + evidence viewer link.",
        "",
        "### 3.11 Verticals studio",
        "",
        "- Lifecycle vertical, memberships, config versions, products — déjà avancé ; fermer les handlers restants.",
        "",
        "### 3.12 Workers / live-complete",
        "",
        "- Pas d’UI CRUD ; badge opérateur + docs runbook lab.",
        "",
        "## 4. Plan d’exécution avancé",
        "",
        "### Phase 0 — Gouvernance contrat (3–5 j)",
        "",
        "1. CI : régénérer ce trio `.md` + fail si drift JSON non commité.",
        "2. Annotation Nest `@ConsoleScope('in'|'out')` ou fichier allowlist OutOfScope.",
        "3. Export OpenAPI Edge filtré `edge/**` comme source de vérité DTO.",
        "4. Script `edge:routes:diff` : BE handler sans `edgeApi` + sans OutOfScope = erreur.",
        "",
        "### Phase 1 — Client API 100% console-scopé (2 sprints)",
        "",
        "Ordre : P0 → P1 → P2.",
        "",
        "DoD méthode `edgeApi` :",
        "- path exact runtime",
        "- types réponse/body",
        "- `EdgeApiError`",
        "- queryKey factory documentée",
        "",
        "### Phase 2 — UI complète anti-MVP (3 sprints)",
        "",
        "Template page domaine :",
        "",
        "```",
        "List (filters/paging/states)",
        "  → Detail (status + actions lifecycle)",
        "    → Nested resources tabs",
        "      → Audit / evidence",
        "```",
        "",
        "Règles :",
        "- Aucun bouton cosmétique",
        "- Confirm dialog sur transitions destructives",
        "- `EdgePermissionGate` + message forbidden",
        "- Badges honest CODE_COMPLETE / NEED_LAB_RUN",
        "",
        "### Phase 3 — Shell & discoverability (1 sprint)",
        "",
        "1. Accordion nav (fait) + deep-link",
        "2. Command menu = union pages + create actions + jump vertical",
        "3. Header status/inbox → ops detail",
        "4. Breadcrumbs sur tous les `[id]`",
        "",
        "### Phase 4 — Qualité & anti-dérive (continu)",
        "",
        "| Contrôle | Fréquence |",
        "|---|---|",
        "| Diff routes CI | chaque PR |",
        "| E2E smoke P0 | chaque PR |",
        "| E2E domaine P1 | nightly |",
        "| Audit MVP (% handlers branchés) | bi-hebdo |",
        "| Contract test OpenAPI | chaque PR API |",
        "",
        "### Phase 5 — Fermeture MVP par domaine",
        "",
        "| Sprint focus | Domaine | Exit criteria |",
        "|---|---|---|",
        "| S1 | Verticals/Catalog/BB/Product-control | 100% handlers P0 wired + e2e lab provision |",
        "| S2 | Tenants + provisioning-requests + registry/workflows | transitions UI = BE |",
        "| S3 | Subscriptions + Billing + Acquisition | parity actions critiques Stripe-like |",
        "| S4 | Ops + Capacity/Infra/Config | alert loop + health |",
        "| S5 | Commercial/Marketing/Sales | plus de modules « démo » |",
        "| S6 | Revenue/CS + polish provisioning | hub CS + evidence |",
        "",
        "## 5. Checklist d’acceptation « cohérence extrême »",
        "",
        "- [ ] 100% handlers console-scopés → `edgeApi`",
        "- [ ] 100% `edgeApi` → UI ou OutOfScope daté",
        "- [ ] 100% pages : permission + 4 états + breadcrumbs",
        "- [ ] 0 DTO inventés (OpenAPI/types partagés)",
        "- [ ] E2E P0/P1 verts",
        "- [ ] Docs routes = artifact CI sans drift",
        "- [ ] Aucun faux « production ready » (statuts lab honest)",
        "- [ ] Sales/Marketing/Billing sortis du statut MVP",
        "",
        "## 6. Top contrôleurs par volume (charge d’alignement)",
        "",
        "| Fichier | #routes |",
        "|---|---:|",
    ]

    by_file = defaultdict(int)
    for r in routes:
        by_file[r["file"]] += 1
    for fname, n in sorted(by_file.items(), key=lambda x: -x[1]):
        lines.append(f"| `{fname}` | {n} |")

    lines += [
        "",
        "## 7. Mapping BFF",
        "",
        "```",
        "Browser  →  Next /api/edge-auth/*          (session)",
        "        →  Next /api/edge-bootstrap       (me, workspaces, permissions)",
        "        →  Next /api/edge-backend/<path>  (proxy)",
        "              →  Nest /api/v1/<path>",
        "```",
        "",
        "Toute nouvelle route Nest `edge/**` doit :",
        "1. apparaître dans OpenAPI",
        "2. avoir une méthode `edgeApi`",
        "3. être consommée ou OutOfScope",
        "4. mettre à jour la nav/command palette si page nouvelle",
        "",
        "---",
        "",
        "_Plan vivant — régénérer après chaque vague contrôleur._",
        "",
    ]
    return "\n".join(lines)


def load_out_of_scope_patterns() -> list[str]:
    """Parse path patterns from edge-console-out-of-scope.md table."""
    path = OUT_DIR / "edge-console-out-of-scope.md"
    if not path.exists():
        return []
    patterns: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cols = [c.strip() for c in line.strip("|").split("|")]
        if not cols:
            continue
        cell = cols[0].strip().strip("`")
        if (
            not cell
            or cell.lower().startswith("runtime")
            or set(cell) <= {"-", "—"}
        ):
            continue
        # Prefer an absolute path token in the cell
        m = re.search(r"(/api/v1/[^\s|]+|/edge/[^\s|]+)", cell)
        if m:
            patterns.append(m.group(1))
    seen: set[str] = set()
    out: list[str] = []
    for p in patterns:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def path_matches_oos(norm_path: str, patterns: list[str]) -> bool:
    """Match normalize_path() result against OutOfScope patterns (supports /**)."""
    cand = normalize_path(norm_path)
    for raw in patterns:
        pat = raw.strip()
        if not pat.startswith("/"):
            pat = "/" + pat
        if "/**" in pat or pat.endswith("**"):
            base = normalize_path(pat.replace("/**", "").rstrip("*"))
            base = base.rstrip("/")
            if cand == base or cand.startswith(base + "/"):
                return True
        elif paths_match(cand, normalize_path(pat)):
            return True
    return False


def compute_coverage(
    routes: list[dict], api: list[dict]
) -> tuple[list[str], list[str], list[str]]:
    """Return (be_only, fe_only, uncovered_console) where uncovered excludes OutOfScope."""
    be_norm = sorted({normalize_path(r["runtime"]) for r in routes})
    fe_norm = sorted(
        {
            normalize_path(raw)
            for m in api
            for raw in m["paths"]
            if raw
        }
    )
    matched_be: set[str] = set()
    matched_fe: set[str] = set()
    # Exact matches first
    for bp in be_norm:
        for fp in fe_norm:
            if paths_match(bp, fp, allow_prefix=False):
                matched_be.add(bp)
                matched_fe.add(fp)
                break
    # Optional prefix pass for leftovers (collection roots only)
    for bp in be_norm:
        if bp in matched_be:
            continue
        for fp in fe_norm:
            if fp in matched_fe:
                continue
            if paths_match(bp, fp, allow_prefix=True):
                matched_be.add(bp)
                matched_fe.add(fp)
                break
    be_only = [p for p in be_norm if p not in matched_be]
    fe_only = [p for p in fe_norm if p not in matched_fe]
    oos = load_out_of_scope_patterns()
    uncovered = [p for p in be_only if not path_matches_oos(p, oos)]
    return be_only, fe_only, uncovered


def render_artifacts(
    routes: list[dict],
    prefixes: dict[str, str],
    api: list[dict],
    pages: list[dict],
) -> dict[str, str]:
    extract_json = json.dumps(
        {
            "backend": routes,
            "frontendApi": api,
            "frontendPages": pages,
            "controllers": prefixes,
        },
        indent=2,
    ) + "\n"
    return {
        "edge-backend-routes.md": markdown_backend(routes, prefixes),
        "edge-frontend-routes.md": markdown_frontend(api, pages),
        "edge-be-fe-alignment-plan.md": build_alignment(routes, api, pages),
        "edge-routes.extract.json": extract_json,
    }


def main() -> None:
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description="Extract Edge BE/FE routes and alignment docs."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if committed docs drift from a fresh extract (no write).",
    )
    parser.add_argument(
        "--diff",
        action="store_true",
        help="Print BE paths without edgeApi match (OutOfScope filtered).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="With --diff: exit 1 if any uncovered console-scoped BE path remains.",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    routes, prefixes = extract_backend()
    api = extract_fe_api()
    pages = extract_fe_pages()
    artifacts = render_artifacts(routes, prefixes, api, pages)

    if args.diff or args.strict:
        be_only, fe_only, uncovered = compute_coverage(routes, api)
        print(
            json.dumps(
                {
                    "beOnly": len(be_only),
                    "feOnly": len(fe_only),
                    "uncoveredConsole": len(uncovered),
                    "outOfScopePatterns": len(load_out_of_scope_patterns()),
                    "sampleUncovered": uncovered[:40],
                },
                indent=2,
            )
        )
        if args.strict and uncovered:
            print(
                f"edge:routes:diff STRICT fail: {len(uncovered)} BE paths without edgeApi / OutOfScope",
                file=sys.stderr,
            )
            sys.exit(1)
        if args.diff and not args.check:
            return

    if args.check:
        drift: list[str] = []
        for name, content in artifacts.items():
            path = OUT_DIR / name
            if not path.exists():
                drift.append(f"missing:{name}")
                continue
            existing = path.read_text(encoding="utf-8")
            # Normalize newlines for Windows
            if existing.replace("\r\n", "\n") != content.replace("\r\n", "\n"):
                drift.append(name)
        summary = {
            "mode": "check",
            "backendRoutes": len(routes),
            "feApiMethods": len(api),
            "fePages": len(pages),
            "drift": drift,
        }
        print(json.dumps(summary, indent=2))
        if drift:
            print(
                "edge:routes:check fail: regenerate with `npm run edge:routes:extract` and commit.",
                file=sys.stderr,
            )
            sys.exit(1)
        return

    for name, content in artifacts.items():
        (OUT_DIR / name).write_text(content, encoding="utf-8")
    print(
        json.dumps(
            {
                "out": str(OUT_DIR),
                "backendRoutes": len(routes),
                "feApiMethods": len(api),
                "fePages": len(pages),
            }
        )
    )


if __name__ == "__main__":
    main()
