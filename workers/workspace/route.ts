import { getAgentByName } from 'agents';
import { authorizeRequest } from '../ledgerSyncAuth.ts';
import { resolveChatOrigin, corsHeaders } from '../herculesGuard.js';
import { workspaceId } from '../../src/workspace/contracts.ts';
import type { WorkspaceEnv } from './env.ts';
export async function handleWorkspace(request: Request, env: WorkspaceEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/hercules/workspace/')) return null;
  const { allowed, origin } = resolveChatOrigin(request), headers = new Headers(corsHeaders(origin) as Record<string, string>);
  headers.set('Cache-Control', 'no-store'); headers.set('Content-Type', 'application/json');
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (!allowed) return reply({ error: 'FORBIDDEN' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const match = url.pathname.match(/^\/hercules\/workspace\/(development|production)\/(HH-[A-Za-z0-9_-]{1,96})$/);
  if (!match) return reply({ error: 'NOT_FOUND' }, 404);
  if (env.HERCULES_WORKSPACE_ENABLED !== 'true' || match[1] !== 'development') return reply({ error: 'WORKSPACE_NOT_ACTIVATED' }, 503);
  try {
    const { scope, token } = await authorizeRequest(request, env, match[1]!, match[2]!);
    const workspace = await getAgentByName(env.HERCULES_WORKSPACES, `${scope.environment}/${scope.householdId}/${scope.memberId}`);
    if (request.method === 'GET') return reply(url.searchParams.has('after')?await workspace.eventsFor(scope,Number(url.searchParams.get('after'))):await workspace.snapshotFor(scope));
    if (request.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (Number(request.headers.get('content-length') ?? 0) > 6_000_000) return reply({ error: 'INPUT_TOO_LARGE' }, 413);
    // Bound streams as well as declared Content-Length; never trust headers alone.
    const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    if (!reader) return reply({ error: 'BODY_REQUIRED' }, 400);
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 6_000_000) { await reader.cancel(); return reply({ error: 'INPUT_TOO_LARGE' }, 413); } chunks.push(part.value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (body.operation === 'action-review') return reply(await workspace.actionReviewFor(scope, workspaceId(body.projectId), workspaceId(body.proposalId)));
    if (body.operation === 'action-confirm') return reply(await workspace.authorizeActionFor(scope, workspaceId(body.confirmationId)));
    if (body.operation === 'share') return reply(await workspace.shareFor(scope, body.review, String(body.confirmDigest)));
    if (body.operation === 'external') return reply(await workspace.externalFor(scope, body.review, String(body.confirmDigest), String(body.googleToken ?? '')));
    if (body.operation === 'shared-artifacts') { const shared = await getAgentByName(env.HERCULES_SHARED_WORKSPACES, `${scope.environment}/${scope.householdId}`); return reply(await shared.listFor(scope)); }
    if (body.operation === 'export') return reply(await workspace.exportFor(scope, workspaceId(body.projectId), workspaceId(body.versionId), String(body.format)));
    workspaceId(body.commandId); workspaceId(body.projectId);
    return reply(await workspace.command(scope, token, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WORKSPACE_UNAVAILABLE';
    const safe = /^[A-Z0-9_]+$/.test(message) ? message : 'WORKSPACE_UNAVAILABLE';
    return reply({ error: safe }, /UNAUTHENTICATED|FORBIDDEN/.test(safe) ? 403 : /CHANGED|REUSED/.test(safe) ? 409 : 400);
  }
}
