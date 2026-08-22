const HTML_PATH = /(?:^\/$|\.html(?:$|\?))/i;

function isHtml(request, response) {
  if (HTML_PATH.test(new URL(request.url).pathname)) return true;
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html");
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (!isHtml(request, response)) return response;

    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
