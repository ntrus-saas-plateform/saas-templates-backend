/**
 * Build OpenAPI 3 document + markdown from Nest controller/DTO sources
 * (no runtime DI / DB required). Mirrors Swagger decorator metadata.
 *
 * Usage: pnpm exec tsx scripts/export-openapi-from-source.ts
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'src');
const outJson = join(root, 'edge-frontend', 'docs', 'openapi.json');
const outMd = join(
  root,
  'edge-frontend',
  'docs',
  'OPENAPI-SCHEMAS-REFERENCE.md',
);

type PropMeta = {
  name: string;
  required: boolean;
  type?: string;
  format?: string;
  enum?: unknown[];
  example?: unknown;
  description?: string;
  nullable?: boolean;
  isArray?: boolean;
  itemsType?: string;
  additionalProperties?: boolean;
  ref?: string;
  raw?: string;
};

type SchemaDef = {
  name: string;
  file: string;
  description?: string;
  properties: PropMeta[];
};

type OperationDef = {
  method: string;
  path: string;
  operationId: string;
  summary?: string;
  tags: string[];
  security: boolean;
  permission?: string;
  roles?: string;
  requestBody?: string;
  responseModel?: string;
  paginated?: boolean;
  status?: number;
  params: Array<{ name: string; in: 'path' | 'query'; required: boolean }>;
  file: string;
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(p, acc);
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function extractClasses(src: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const re = /export\s+class\s+(\w+)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    while (i < src.length && depth > 0) {
      const c = src[i++];
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    out.push({ name, body: src.slice(start, i - 1) });
  }
  return out;
}

function parseApiProperty(block: string): Partial<PropMeta> {
  const meta: Partial<PropMeta> = {};
  const optional = /@ApiPropertyOptional/.test(block);
  meta.required = !optional && !/@IsOptional/.test(block);

  const objMatch = block.match(/@(?:ApiPropertyOptional|ApiProperty)\(\s*\{([\s\S]*?)\}\s*\)/);
  if (objMatch) {
    const obj = objMatch[1];
    const ex = obj.match(/example\s*:\s*([^,\n}]+(?:\[[\s\S]*?\])?)/);
    if (ex) {
      try {
        meta.example = Function(`"use strict"; return (${ex[1].trim()})`)();
      } catch {
        // Truncated array literals like `['users:read', 'orders:write']` — keep raw string
        const raw = ex[1].trim();
        if ((raw.startsWith("'") || raw.startsWith('"') || raw.startsWith('`')) && raw.length > 1) {
          meta.example = raw.slice(1).replace(/['"`]$/, '');
        } else if (raw.startsWith('[')) {
          meta.example = raw;
        }
      }
    }
    const desc = obj.match(/description\s*:\s*(['"`])([\s\S]*?)\1/);
    if (desc) meta.description = desc[2];
    if (/nullable\s*:\s*true/.test(obj)) meta.nullable = true;
    if (/type\s*:\s*\[String\]/.test(obj) || /isArray\s*:\s*true/.test(obj)) {
      meta.isArray = true;
      meta.itemsType = 'string';
    }
    const enumM = obj.match(/enum\s*:\s*(\[[\s\S]*?\]|\w+)/);
    if (enumM) {
      try {
        if (enumM[1].startsWith('[')) meta.enum = Function(`return (${enumM[1]})`)();
        else meta.enum = [enumM[1]];
      } catch {
        meta.description = `${meta.description ?? ''} enum:${enumM[1]}`.trim();
      }
    }
    if (/format\s*:\s*['"]uuid['"]/.test(obj)) meta.format = 'uuid';
    if (/format\s*:\s*['"]date-time['"]/.test(obj)) meta.format = 'date-time';
    if (/additionalProperties/.test(obj)) {
      meta.type = 'object';
      meta.additionalProperties = true;
    }
  }

  if (/@IsUUID/.test(block)) {
    meta.type = 'string';
    meta.format = 'uuid';
  } else if (/@IsEmail/.test(block)) {
    meta.type = 'string';
    meta.format = 'email';
  } else if (/@IsInt|@IsNumber/.test(block)) {
    meta.type = 'number';
  } else if (/@IsBoolean/.test(block)) {
    meta.type = 'boolean';
  } else if (/@IsArray/.test(block)) {
    meta.isArray = true;
    meta.itemsType = 'string';
  } else if (/@IsObject|Record<string/.test(block)) {
    meta.type = 'object';
    meta.additionalProperties = true;
  } else if (/@IsEnum/.test(block)) {
    meta.type = 'string';
  } else if (!meta.type) {
    meta.type = 'string';
  }

  // Property type from TS annotation
  const propType = block.match(/!\s*:\s*([^;=\n]+)/)?.[1]?.trim();
  if (propType) {
    if (propType.startsWith('string')) meta.type = 'string';
    if (propType.startsWith('number')) meta.type = 'number';
    if (propType.startsWith('boolean')) meta.type = 'boolean';
    if (propType.includes('[]') || propType.startsWith('Array<')) {
      meta.isArray = true;
      if (propType.includes('string')) meta.itemsType = 'string';
    }
    if (/Date/.test(propType)) {
      meta.type = 'string';
      meta.format = meta.format ?? 'date-time';
    }
    const ref = propType.match(/^(\w+)(?:\s*\|\s*null)?$/);
    if (ref && /^[A-Z]/.test(ref[1]) && !['String', 'Number', 'Boolean', 'Date', 'Record'].includes(ref[1])) {
      meta.ref = ref[1];
      delete meta.type;
    }
  }

  return meta;
}

function parseDtoFile(file: string): SchemaDef[] {
  const raw = readFileSync(file, 'utf8');
  const src = stripComments(raw);
  const schemas: SchemaDef[] = [];
  const reservedPropNames = new Set([
    'format',
    'example',
    'type',
    'enum',
    'nullable',
    'required',
    'additionalProperties',
    'deprecated',
    'default',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'constructor',
  ]);

  for (const cls of extractClasses(src)) {
    if (!/@ApiProperty(?:Optional)?\s*\(/.test(cls.body)) continue;

    const properties: PropMeta[] = [];
    const seen = new Set<string>();
    const lines = cls.body.split('\n');
    let decoBuf: string[] = [];

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        // Accumulate possibly multi-line decorator
        let deco = line;
        let open = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        while (open > 0 && li + 1 < lines.length) {
          li++;
          deco += '\n' + lines[li];
          open += (lines[li].match(/\(/g) || []).length - (lines[li].match(/\)/g) || []).length;
        }
        decoBuf.push(deco);
        continue;
      }

      const fieldM = trimmed.match(/^(?:readonly\s+)?([A-Za-z_]\w*)\s*([?!])?\s*:\s*(.+?);?\s*$/);
      if (fieldM && decoBuf.length) {
        const name = fieldM[1];
        const block = decoBuf.join('\n');
        decoBuf = [];
        if (seen.has(name) || reservedPropNames.has(name)) continue;
        if (!/@ApiProperty/.test(block) && !/@Is[A-Z]/.test(block)) continue;
        seen.add(name);
        const optionalMark = fieldM[2] === '?';
        const tsType = fieldM[3].replace(/;$/, '').trim();
        const meta = parseApiProperty(block + `\n${name}!: ${tsType}`);
        if (optionalMark) meta.required = false;
        // Force correct TS-driven typing when ApiProperty example misleads
        if (tsType.includes('string[]') || tsType === 'string[]') {
          meta.isArray = true;
          meta.itemsType = 'string';
          delete meta.ref;
          meta.type = undefined;
        } else if (/^string\b/.test(tsType)) {
          meta.type = 'string';
          meta.isArray = false;
          delete meta.ref;
        } else if (/^number\b/.test(tsType)) {
          meta.type = 'number';
          meta.isArray = false;
        } else if (/^boolean\b/.test(tsType)) {
          meta.type = 'boolean';
          meta.isArray = false;
        } else if (/^Date\b/.test(tsType)) {
          meta.type = 'string';
          meta.format = 'date-time';
        } else if (/Record<|object\b|^\{\}/.test(tsType)) {
          meta.type = 'object';
          meta.additionalProperties = true;
          meta.isArray = false;
        } else if (/\[\]$/.test(tsType) || /^Array</.test(tsType)) {
          meta.isArray = true;
          const inner = tsType.match(/Array<(\w+)>/)?.[1] ?? tsType.replace('[]', '');
          if (/^[A-Z]/.test(inner)) meta.ref = undefined; // items ref handled simply as object
          meta.itemsType = /^[a-z]/.test(inner) ? inner : 'object';
        } else if (/^[A-Z]\w+/.test(tsType)) {
          const refName = tsType.replace(/\s*\|\s*null/, '').trim();
          if (!['String', 'Number', 'Boolean'].includes(refName)) {
            meta.ref = refName;
            delete meta.type;
            meta.isArray = false;
          }
        }
        properties.push({ name, required: meta.required ?? !optionalMark, ...meta });
        continue;
      }

      // blank / other → reset dangling decorators if we hit a method
      if (/^\w+\s*\(/.test(trimmed)) decoBuf = [];
      if (!trimmed) continue;
    }

    if (properties.length === 0) continue;
    schemas.push({
      name: cls.name,
      file: relative(root, file).replace(/\\/g, '/'),
      properties,
    });
  }
  return schemas;
}

function controllerPrefix(src: string): string {
  const m = src.match(/@Controller\(\s*['`]([^'`]*)['`]\s*\)/);
  return m ? m[1] : '';
}

function controllerTags(src: string): string[] {
  const m = src.match(/@ApiTags\(\s*([^)]+)\)/);
  if (!m) return [];
  const inner = m[1];
  if (inner.includes('SwaggerTags.')) {
    const map: Record<string, string> = {
      HEALTH: 'Health',
      PLATFORM: 'Platform',
      TENANTS: 'Tenants',
      ORGANIZATIONS: 'Organizations',
      USERS: 'Users',
      MEMBERSHIPS: 'Memberships',
      INVITATIONS: 'Invitations',
      ROLES: 'Roles & Permissions',
      SETTINGS: 'Settings',
      SECURITY: 'Security',
      ADMIN: 'Admin',
      CUSTOMERS: 'Customers',
      COMMERCE: 'Commerce',
      PHARMACY: 'Pharmacy',
    };
    const key = inner.match(/SwaggerTags\.(\w+)/)?.[1];
    return key && map[key] ? [map[key]] : ['API'];
  }
  const lit = inner.match(/['"]([^'"]+)['"]/);
  return lit ? [lit[1]] : [];
}

/** Split files that declare multiple @Controller classes (e.g. sessions + security). */
function splitControllerSections(src: string): string[] {
  const indices: number[] = [];
  const re = /@Controller\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) indices.push(m.index);
  if (indices.length <= 1) return [src];

  const sections: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    let start = indices[i]!;
    const lookbackStart = Math.max(0, start - 1200);
    const lookback = src.slice(lookbackStart, start);
    const markers = ['@ApiTags', '@ApiBearerAuth', '@RequireRoles', '@RequirePermissions'];
    let earliest = -1;
    for (const marker of markers) {
      const at = lookback.lastIndexOf(marker);
      if (at >= 0 && (earliest < 0 || at < earliest)) earliest = at;
    }
    if (earliest >= 0) start = lookbackStart + earliest;

    const end = i + 1 < indices.length ? indices[i + 1]! : src.length;
    sections.push(src.slice(start, end));
  }
  return sections;
}

function parseControllerSection(
  file: string,
  section: string,
  fullSrc: string,
): OperationDef[] {
  const prefix = controllerPrefix(section);
  const tags = controllerTags(section);
  const ops: OperationDef[] = [];

  // Find each HTTP route decorator, then resolve the real method name
  // (skip nested decorator calls like @RequirePermissions(...)).
  const routeStartRe = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['`]([^'`]*)['`])?\s*\)/g;
  const decoratorNames = new Set([
    'Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options',
    'RequirePermissions', 'RequireRoles', 'RequireStepUp', 'RequireModule',
    'RequireOrganization', 'RequireWritableTenant', 'AuditAction', 'Public',
    'CustomerRoute', 'ApiOperation', 'ApiOkDataResponse', 'ApiCreatedDataResponse',
    'ApiJsonBody', 'ApiResponse', 'ApiBearerAuth', 'ApiParam', 'ApiQuery',
    'ApiBody', 'ApiTags', 'Version', 'Throttle', 'Header', 'HttpCode',
    'UseGuards', 'UseInterceptors', 'UseFilters', 'UsePipes', 'Body', 'Query',
    'Param', 'Req', 'Res', 'Headers', 'Inject', 'ApiSecurity',
  ]);

  let m: RegExpExecArray | null;
  while ((m = routeStartRe.exec(section))) {
    const method = m[1].toLowerCase();
    const sub = m[2] ?? '';
    const after = section.slice(m.index + m[0].length, m.index + m[0].length + 2500);

    const methodNameRe =
      /(?:^|\n)\s*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_]\w*)\s*\(/g;
    let methodMatch: { 1: string; index: number; sig: string } | null = null;
    let nm: RegExpExecArray | null;
    while ((nm = methodNameRe.exec(after))) {
      const candidate = nm[1];
      if (decoratorNames.has(candidate)) continue;
      let i = nm.index + nm[0].length;
      let depth = 1;
      while (i < after.length && depth > 0) {
        const c = after[i++];
        if (c === '(') depth++;
        else if (c === ')') depth--;
      }
      const rest = after.slice(i);
      const brace = rest.match(/^\s*(?::\s*[^{\n]+)?\s*\{/);
      if (!brace) continue;
      methodMatch = {
        1: candidate,
        index: nm.index,
        sig: after.slice(nm.index, i + brace[0].length),
      };
      break;
    }
    if (!methodMatch) continue;
    const operationId = methodMatch[1];

    const decorators = after.slice(0, methodMatch.index);

    const fullPath = ('/api/v1/' + [prefix, sub].filter(Boolean).join('/'))
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/api/v1';

    const isNeutral =
      /VERSION_NEUTRAL/.test(decorators) ||
      /VERSION_NEUTRAL/.test(section.slice(Math.max(0, m.index - 500), m.index)) ||
      /VERSION_NEUTRAL/.test(fullSrc.slice(Math.max(0, fullSrc.indexOf(section) + m.index - 500), fullSrc.indexOf(section) + m.index));

    let openapiPath =
      isNeutral || /health\.controller|metrics\.controller/i.test(file)
        ? `/${sub}`.replace(/\/+/g, '/') || '/'
        : fullPath;

    const summary = decorators.match(
      /@ApiOperation\(\s*\{[\s\S]*?summary\s*:\s*['`]([^'`]*)['`]/,
    )?.[1];
    const perm = decorators.match(/@RequirePermissions\(\s*['`]([^'`]*)['`]/)?.[1]
      ?? decorators.match(/@RequirePermissions\(\s*['`]([^'`]*)['`]\s*,/)?.[1];
    const permAll = decorators.match(/@RequirePermissions\(([^)]*)\)/)?.[1];
    const permission =
      perm ??
      permAll
        ?.split(',')
        .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''))
        .filter(Boolean)[0];

    const roles = decorators.match(/@RequireRoles\(\s*['`]([^'`]*)['`]/)?.[1];
    const sig = methodMatch.sig;
    const bodyFromSig =
      decorators.match(/@ApiJsonBody\((\w+)\)/)?.[1] ??
      sig.match(/@Body\(\)\s+\w+\s*:\s*(\w+)/)?.[1];
    const requestBody =
      bodyFromSig && !decoratorNames.has(bodyFromSig) ? bodyFromSig : undefined;
    const finalRequestBody = ['post', 'put', 'patch'].includes(method) ? requestBody : undefined;

    const okModel = decorators.match(/@ApiOkDataResponse\((\w+)/)?.[1];
    const createdModel = decorators.match(/@ApiCreatedDataResponse\((\w+)/)?.[1];
    const paginated = /@ApiOkDataResponse\(\w+\s*,\s*true\s*\)/.test(decorators);
    const methodIsPublic = /@Public\(\)/.test(decorators);
    const sectionPublic = /@Public\(\)/.test(section.slice(0, section.indexOf('@Controller') + 200));
    const isPublic =
      methodIsPublic ||
      sectionPublic ||
      /health\.controller|metrics\.controller|customer-auth\.controller/i.test(file);

    const params: OperationDef['params'] = [];
    for (const pm of openapiPath.matchAll(/:([A-Za-z]+)/g)) {
      params.push({ name: pm[1], in: 'path', required: true });
    }
    const sigAndDeco = decorators + sig;
    if (/PaginationQueryDto/.test(sigAndDeco)) {
      params.push(
        { name: 'page', in: 'query', required: false },
        { name: 'limit', in: 'query', required: false },
        { name: 'cursor', in: 'query', required: false },
      );
    }
    if (/@Query\(\)\s*\w*\s*\w+\s*:\s*string/.test(sig) || /\bsearch\s*[?]?\s*:/.test(sigAndDeco)) {
      // keep generic; controllers may use named queries
    }
    if (/status\s*[?]?\s*:\s*/.test(sig) && /users\.controller/i.test(file)) {
      params.push({ name: 'status', in: 'query', required: false });
    }
    if (/organizationId\s*[?]?\s*:/.test(sig)) {
      params.push({ name: 'organizationId', in: 'query', required: false });
    }
    if (/\bhard\s*[?]?\s*:/.test(sig)) {
      params.push({ name: 'hard', in: 'query', required: false });
    }
    if (/\bsearch\s*[?]?\s*:/.test(sig)) {
      params.push({ name: 'search', in: 'query', required: false });
    }

    ops.push({
      method,
      path: openapiPath.replace(/:([A-Za-z]+)/g, '{$1}'),
      operationId,
      summary,
      tags: tags.length ? tags : ['API'],
      security: !isPublic,
      permission: permission,
      roles,
      requestBody: finalRequestBody,
      responseModel: createdModel ?? okModel,
      paginated,
      status: createdModel ? 201 : 200,
      params,
      file: relative(root, file).replace(/\\/g, '/'),
    });
  }
  return ops;
}

function parseController(file: string): OperationDef[] {
  const raw = readFileSync(file, 'utf8');
  const src = stripComments(raw);
  return splitControllerSections(src).flatMap((section) =>
    parseControllerSection(file, section, src),
  );
}

function schemaToOpenApi(s: SchemaDef): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of s.properties) {
    if (p.required && !p.nullable) required.push(p.name);
    let prop: Record<string, unknown>;
    if (p.ref) {
      prop = { $ref: `#/components/schemas/${p.ref}` };
    } else if (p.isArray) {
      prop = {
        type: 'array',
        items: p.itemsType ? { type: p.itemsType } : { type: 'string' },
      };
    } else {
      prop = { type: p.type ?? 'string' };
      if (p.format) prop.format = p.format;
      if (p.enum) prop.enum = p.enum;
      if (p.additionalProperties) prop.additionalProperties = true;
    }
    if (p.nullable) prop.nullable = true;
    if (p.description) prop.description = p.description;
    if (p.example !== undefined) prop.example = p.example;
    properties[p.name] = prop;
  }
  return {
    type: 'object',
    ...(required.length ? { required } : {}),
    properties,
    'x-source-file': s.file,
  };
}

function buildDocument(schemas: SchemaDef[], ops: OperationDef[]) {
  const schemaMap: Record<string, unknown> = {
    ApiErrorBodyDto: {
      type: 'object',
      required: ['code', 'message', 'details', 'requestId', 'correlationId'],
      properties: {
        code: { type: 'string', example: 'FORBIDDEN' },
        message: { type: 'string', example: 'Access denied' },
        details: { type: 'array', items: { type: 'object', additionalProperties: true } },
        requestId: { type: 'string' },
        correlationId: { type: 'string' },
      },
    },
    ApiErrorResponseDto: {
      type: 'object',
      required: ['error'],
      properties: {
        error: { $ref: '#/components/schemas/ApiErrorBodyDto' },
      },
    },
    PaginationMetaDto: {
      type: 'object',
      properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 42 },
        totalPages: { type: 'integer', example: 3 },
        hasNext: { type: 'boolean' },
        hasPrevious: { type: 'boolean' },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  };

  for (const s of schemas) {
    schemaMap[s.name] = schemaToOpenApi(s);
  }

  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of ops) {
    if (!paths[op.path]) paths[op.path] = {};
    const responses: Record<string, unknown> = {};
    const successSchema = op.responseModel
      ? op.paginated
        ? {
            type: 'object',
            required: ['data', 'pagination'],
            properties: {
              data: {
                type: 'array',
                items: { $ref: `#/components/schemas/${op.responseModel}` },
              },
              pagination: { $ref: '#/components/schemas/PaginationMetaDto' },
            },
          }
        : {
            type: 'object',
            required: ['data'],
            properties: {
              data: { $ref: `#/components/schemas/${op.responseModel}` },
            },
          }
      : {
          type: 'object',
          properties: { data: { type: 'object', additionalProperties: true } },
        };

    responses[String(op.status ?? 200)] = {
      description: 'Success',
      content: { 'application/json': { schema: successSchema } },
    };
    if (op.security) {
      responses['401'] = {
        description: 'Unauthorized',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponseDto' } },
        },
      };
      responses['403'] = {
        description: 'Forbidden',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponseDto' } },
        },
      };
    }

    const parameters = op.params.map((p) => ({
      name: p.name,
      in: p.in,
      required: p.required,
      schema: p.in === 'path' ? { type: 'string', format: 'uuid' } : { type: 'string' },
    }));

    const operation: Record<string, unknown> = {
      operationId: op.operationId,
      summary: op.summary ?? op.operationId,
      tags: op.tags,
      parameters,
      responses,
      'x-permission': op.permission,
      'x-roles': op.roles,
      'x-source-file': op.file,
    };
    if (op.security) operation.security = [{ bearer: [] }];
    if (op.requestBody && schemaMap[op.requestBody]) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${op.requestBody}` },
          },
        },
      };
    } else if (op.requestBody) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${op.requestBody}` },
          },
        },
      };
    }

    paths[op.path][op.method] = operation;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Platform Core API',
      version: '1.0.0',
      description:
        'Enterprise Identity & Tenant Management API. Protected routes require Bearer JWT from Keycloak. ' +
        'Tenant context is derived from JWT only — never from client headers. ' +
        'Generated from NestJS source decorators (controllers + DTOs). Live interactive UI: GET /docs',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local' }],
    tags: [
      { name: 'Health' },
      { name: 'Platform' },
      { name: 'Admin' },
      { name: 'Tenants' },
      { name: 'Organizations' },
      { name: 'Users' },
      { name: 'Memberships' },
      { name: 'Invitations' },
      { name: 'Roles & Permissions' },
      { name: 'Settings' },
      { name: 'Security' },
      { name: 'Customers' },
      { name: 'Commerce' },
      { name: 'Pharmacy' },
    ],
    paths,
    components: {
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Keycloak access token (staff platform-api / B2C platform-b2c)',
        },
      },
      schemas: schemaMap,
    },
  };
}

function renderMarkdown(doc: ReturnType<typeof buildDocument>, ops: OperationDef[]): string {
  const schemas = doc.components.schemas as Record<string, unknown>;
  const lines: string[] = [];
  lines.push('# Référence OpenAPI — schémas générés depuis le code');
  lines.push('');
  lines.push('> **Source :** décorateurs NestJS (`@ApiProperty`, `@ApiOkDataResponse`, contrôleurs).');
  lines.push('> **Artefacts :** [`openapi.json`](./openapi.json) · UI live `http://localhost:3000/docs` · JSON live `/docs-json`');
  lines.push('> **Régénération :** `pnpm exec tsx scripts/export-openapi-from-source.ts`');
  lines.push('');
  lines.push('| Métrique | Valeur |');
  lines.push('|----------|--------|');
  lines.push(`| OpenAPI | ${doc.openapi} |`);
  lines.push(`| Paths | ${Object.keys(doc.paths).length} |`);
  lines.push(`| Operations | ${ops.length} |`);
  lines.push(`| Schemas | ${Object.keys(schemas).length} |`);
  lines.push(`| Généré | ${new Date().toISOString()} |`);
  lines.push('');
  lines.push('## 1. Référence interactive (Swagger UI)');
  lines.push('');
  lines.push('```bash');
  lines.push('pnpm start:dev');
  lines.push('# Ouvrir http://localhost:3000/docs');
  lines.push('# Authorize → coller JWT Keycloak');
  lines.push('# Try it out sur chaque opération');
  lines.push('```');
  lines.push('');
  lines.push('| URL | Rôle |');
  lines.push('|-----|------|');
  lines.push('| `/docs` | Swagger UI interactive |');
  lines.push('| `/docs-json` | OpenAPI 3 JSON (runtime Nest `SwaggerModule.createDocument`) |');
  lines.push('| `/docs/`, `/api/docs`, `/swagger` | Redirect → `/docs` |');
  lines.push(
    '| `edge-frontend/docs/openapi.json` | Snapshot généré depuis le code (ce script) |',
  );
  lines.push('');
  lines.push('### Générer un client TypeScript frontend');
  lines.push('');
  lines.push('```bash');
  lines.push(
    'npx openapi-typescript edge-frontend/docs/openapi.json -o edge-frontend/openapi-schema.d.ts',
  );
  lines.push('```');
  lines.push('');
  lines.push('### Enveloppes');
  lines.push('');
  lines.push('```ts');
  lines.push('// Success');
  lines.push('{ data: T } | { data: T[]; pagination: PaginationMetaDto }');
  lines.push('// Error');
  lines.push('{ error: { code, message, details, requestId, correlationId } }');
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 2. Index des opérations');
  lines.push('');
  lines.push('| Method | Path | operationId | Tag | Permission / Role | Request | Response |');
  lines.push('|--------|------|-------------|-----|-------------------|---------|----------|');
  for (const op of [...ops].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))) {
    lines.push(
      `| ${op.method.toUpperCase()} | \`${op.path}\` | \`${op.operationId}\` | ${op.tags.join(',')} | ${op.permission ?? op.roles ?? (op.security ? 'auth' : 'public')} | ${op.requestBody ?? '—'} | ${op.responseModel ?? 'object'}${op.paginated ? '[]' : ''} |`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 3. Détail des opérations');
  lines.push('');
  for (const op of [...ops].sort((a, b) => a.path.localeCompare(b.path))) {
    lines.push(`### \`${op.method.toUpperCase()} ${op.path}\``);
    lines.push('');
    lines.push(`- **operationId :** \`${op.operationId}\``);
    if (op.summary) lines.push(`- **summary :** ${op.summary}`);
    lines.push(`- **tags :** ${op.tags.join(', ')}`);
    lines.push(`- **security :** ${op.security ? 'Bearer JWT' : 'Public'}`);
    if (op.permission) lines.push(`- **permission :** \`${op.permission}\``);
    if (op.roles) lines.push(`- **roles :** \`${op.roles}\``);
    lines.push(`- **source :** \`${op.file}\``);
    lines.push(`- **HTTP success :** ${op.status ?? 200}`);
    if (op.params.length) {
      lines.push('');
      lines.push('**Parameters**');
      lines.push('');
      lines.push('| Name | In | Required |');
      lines.push('|------|----|----------|');
      for (const p of op.params) {
        lines.push(`| ${p.name} | ${p.in} | ${p.required} |`);
      }
    }
    if (op.requestBody) {
      lines.push('');
      lines.push(`**Request body schema :** [\`${op.requestBody}\`](#schema-${op.requestBody.toLowerCase()})`);
    }
    if (op.responseModel) {
      lines.push('');
      lines.push(
        `**Response \`data\` schema :** [\`${op.responseModel}\`](#schema-${op.responseModel.toLowerCase()})${op.paginated ? ' (array + pagination)' : ''}`,
      );
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## 4. Catalogue complet des schémas (`components.schemas`)');
  lines.push('');
  for (const name of Object.keys(schemas).sort()) {
    const schema = schemas[name] as Record<string, unknown>;
    lines.push(`### \`${name}\` {#schema-${name.toLowerCase()}}`);
    lines.push('');
    if (schema['x-source-file']) lines.push(`Source : \`${schema['x-source-file']}\``);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(schema, null, 2));
    lines.push('```');
    lines.push('');
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (props) {
      const req = new Set((schema.required as string[]) ?? []);
      lines.push('| Field | Schema | Required |');
      lines.push('|-------|--------|----------|');
      for (const [k, v] of Object.entries(props)) {
        lines.push(
          `| \`${k}\` | \`${JSON.stringify(v).replace(/\|/g, '\\|')}\` | ${req.has(k) ? 'oui' : 'non'} |`,
        );
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## 5. Fichier OpenAPI machine-readable');
  lines.push('');
  lines.push(
    'Le JSON complet est versionné dans [`edge-frontend/docs/openapi.json`](./openapi.json).',
  );
  lines.push('Quand l’API tourne, préférer `/docs-json` (génération runtime Nest) pour coller à 100 % au process live.');
  lines.push('');
  return lines.join('\n');
}

function main(): void {
  const files = walk(srcRoot);
  const dtoFiles = files.filter(
    (f) =>
      f.includes(`${join('presentation', 'dto')}`) ||
      f.endsWith('api-response.dto.ts') ||
      f.endsWith('query.dto.ts') ||
      f.includes('tenant-domains.controller.ts'), // inline DTOs
  );
  const controllerFiles = files.filter((f) => f.endsWith('.controller.ts'));

  const schemas: SchemaDef[] = [];
  for (const f of dtoFiles) schemas.push(...parseDtoFile(f));
  // also parse inline DTOs in controllers
  for (const f of controllerFiles) schemas.push(...parseDtoFile(f));

  // dedupe by name (last wins)
  const byName = new Map<string, SchemaDef>();
  for (const s of schemas) byName.set(s.name, s);

  const ops: OperationDef[] = [];
  for (const f of controllerFiles) ops.push(...parseController(f));

  const doc = buildDocument([...byName.values()], ops);
  // Ensure enum schemas referenced by DTOs exist (openapi-typescript $ref resolution)
  const schemaBag = doc.components.schemas as Record<string, unknown>;
  if (!schemaBag.TenantStatus) {
    schemaBag.TenantStatus = {
      type: 'string',
      enum: [
        'PROVISIONING',
        'ACTIVE',
        'SUSPENDED',
        'READ_ONLY',
        'DEACTIVATING',
        'ARCHIVED',
        'DELETED',
        'FAILED',
        'LOCKED',
      ],
      description: 'Tenant lifecycle status',
    };
  }
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify(doc, null, 2), 'utf8');
  writeFileSync(outMd, renderMarkdown(doc, ops), 'utf8');

  console.log(
    `OK: ${ops.length} operations, ${Object.keys(doc.components.schemas).length} schemas`,
  );
  console.log(`→ ${relative(root, outJson)}`);
  console.log(`→ ${relative(root, outMd)}`);
}

main();
