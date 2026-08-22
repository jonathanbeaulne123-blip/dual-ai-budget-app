const HTML_PATH = /(?:^\/$|\.html(?:$|\?))/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Keep in sync with src/core/herculesPersonality.ts laws. The prompt stays on the Worker.
const HERCULES_SYSTEM = `You are Hercules, a smug-kind Maine Coon who lives in Jonathan and Bianca's Toronto kitchen budget app, Hearth.

Voice:
- First person. Short sentences. One or two breaths, never a lecture.
- Occasional mrrp / prrrp / mrrrow — not every line.
- CAD only. America/Toronto dates. Two people, one household.
- Teach milk → bills → treats. Point at numbers. Do not replace the net.
- Warm and a little smug. Never mean.
- Off-topic: answer as a cat on a kitchen counter, then steer back to the books.

Hard laws:
- You NEVER post, save, log, insert, pay, or write money.
- You NEVER invent journal amounts. GROUNDED JOURNAL wins. Quote those CAD figures; do not mint new ones.
- You NEVER output SQL or code fences.
- You NEVER claim you already posted something.
- You NEVER name who spent more. Never shame Bianca or Jonathan.
- If they ask you to add/post/pay, tell them to tap + and confirm. You will loaf.

Use the briefing for mood and page. Use GROUNDED JOURNAL as the only source of dollar facts.`;

const MODELS = ["@cf/meta/llama-3.2-3b-instruct", "@cf/meta/llama-3.1-8b-instruct"];

const WRITE_CLAIM =
  /\b(i(?:'ve| have)?|we)\s+(just\s+)?(posted|logged|saved|recorded|wrote|inserted|updated|deleted|paid)\b/i;
const SQL_WRITE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;
const SHAME = /\b(bianca|jonathan)\s+(spent|wasted|blew|overspent)\b/i;
const MODEL_LEAK =
  /\b(as an ai|language model|i(?:'m| am) (?:an? )?(?:ai|language model|large language|assistant))\b/gi;

function isHtml(request, response) {
  if (HTML_PATH.test(new URL(request.url).pathname)) return true;
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".workers.dev");
  } catch {
    return false;
  }
}

function clipReply(text, max = 360) {
  const trimmed = String(text || "").replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 80 ? space : max - 1).replace(/[,:;.–-]$/, "")}…`;
}

function sanitizeHerculesReply(text, groundedSpeak = "") {
  let reply = String(text || "").replace(/\s+/g, " ").trim();
  if (!reply) return clipReply(groundedSpeak) || "mrrp. Ask a number. I don't write.";
  if (SQL_WRITE.test(reply) || /```/.test(reply) || /\bSELECT\b.+\bFROM\b/i.test(reply)) {
    return "I read. I don't write SQL you didn't mean.";
  }
  if (SHAME.test(reply) || (/\bwho spent more\b/i.test(reply) && /\b(bianca|jonathan)\b/i.test(reply))) {
    return "Not a scoreboard. I won't name who spent.";
  }
  if (WRITE_CLAIM.test(reply)) {
    return groundedSpeak
      ? clipReply(`I don't post. ${groundedSpeak}`)
      : "I don't write the books. Tell the kitchen what to post.";
  }
  reply = reply.replace(MODEL_LEAK, "I'm a cat");
  reply = reply.replace(/\bI(?:'ll| will) (post|log|save|record|write) (it|that|this|them)\b/gi, "I don't write");
  return clipReply(reply);
}

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function herculesChat(request, env) {
  if (!allowedOrigin(request)) return json({ ok: false, error: "origin" }, 403);
  if (!env.AI) return json({ ok: false, error: "ai unbound" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }

  const message = clip(body?.message, 400);
  if (!message) return json({ ok: false, error: "empty" }, 400);

  const briefing = clip(body?.briefing, 800);
  const grounded = body?.grounded && typeof body.grounded === "object" ? body.grounded : {};
  const groundedSpeak = clip(grounded.spoken, 220);
  const groundedBlock = [
    `spoken: ${groundedSpeak}`,
    grounded.lesson ? `lesson: ${clip(grounded.lesson, 180)}` : "",
    grounded.fact?.label ? `fact: ${clip(grounded.fact.label, 40)} ${clip(grounded.fact.value, 40)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const messages = [
    { role: "system", content: HERCULES_SYSTEM },
    { role: "system", content: `HOUSEHOLD BRIEFING\n${briefing || "(none)"}` },
    { role: "system", content: `GROUNDED JOURNAL (dollar facts; win over you)\n${groundedBlock || "(none)"}` },
  ];
  for (const turn of history) {
    const text = clip(turn?.text, 240);
    if (!text) continue;
    messages.push({
      role: turn.role === "hercules" || turn.role === "assistant" ? "assistant" : "user",
      content: text,
    });
  }
  messages.push({ role: "user", content: message });

  let reply = "";
  for (const model of MODELS) {
    try {
      const out = await env.AI.run(model, {
        messages,
        max_tokens: 160,
        temperature: 0.55,
      }).catch(() => env.AI.run(model, { messages, max_tokens: 160 }));
      const text =
        typeof out?.response === "string"
          ? out.response
          : typeof out?.result?.response === "string"
            ? out.result.response
            : "";
      if (text.trim()) {
        reply = text;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!reply) return json({ ok: false, error: "ai quiet" }, 503);
  return json({ ok: true, reply: sanitizeHerculesReply(reply, groundedSpeak) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/hercules/chat") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS });
      }
      if (request.method === "POST") return herculesChat(request, env);
      return json({ ok: false, error: "method" }, 405);
    }

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
