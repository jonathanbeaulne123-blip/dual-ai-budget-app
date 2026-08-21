export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const path = new URL(request.url).pathname;
    const isDocument = path === "/" || path.endsWith("/") || path.endsWith(".html");
    if (!isDocument) return response;
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
