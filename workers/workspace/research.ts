export function publicSourceUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443'
    || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)
    || host.endsWith('.workers.dev') || host.endsWith('.supabase.co') || host.endsWith('.r2.cloudflarestorage.com')) throw new Error('PUBLIC_SOURCE_REQUIRED');
  return url;
}
export async function readPublicSource(source: string) {
  let url = publicSourceUrl(source);
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(url, { redirect: 'manual', credentials: 'omit', headers: { Accept: 'text/html,text/plain', 'User-Agent': 'HearthResearch/1.0' }, signal: AbortSignal.timeout(15000) });
    if (response.status >= 300 && response.status < 400) { const next = response.headers.get('Location'); if (!next) throw new Error('SOURCE_REDIRECT_FAILED'); url = publicSourceUrl(new URL(next, url).href); continue; }
    if (!response.ok || !/text\/(html|plain)/i.test(response.headers.get('Content-Type') ?? '')) throw new Error('SOURCE_UNAVAILABLE');
    const reader = response.body?.getReader(); if (!reader) throw new Error('SOURCE_EMPTY');
    const decoder = new TextDecoder(); let text = '', bytes = 0, truncated = false;
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 500000) { truncated = true; await reader.cancel(); break; } text += decoder.decode(part.value, { stream: true }); }
    text = text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    return { text: text.slice(0, 24000), url: url.href, truncated: truncated || text.length > 24000 };
  }
  throw new Error('SOURCE_REDIRECT_LIMIT');
}
