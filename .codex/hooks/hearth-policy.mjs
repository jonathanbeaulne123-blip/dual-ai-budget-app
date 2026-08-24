const chunks = [];

for await (const chunk of process.stdin) {
  chunks.push(Buffer.from(chunk));
}

function deny(reason) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })}\n`,
  );
}

let input;

try {
  input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
} catch {
  deny("Hearth blocked this action because the safety hook received invalid input.");
  process.exit(0);
}

const toolName = String(input.tool_name ?? input.toolName ?? "");
const toolInput = input.tool_input ?? input.toolInput ?? {};
const command = String(toolInput.command ?? toolInput.cmd ?? "");
const serialized = JSON.stringify(toolInput);

const blockedShell = [
  [
    /\b(?:pnpm|npm|yarn)\s+(?:run\s+)?(?:books:apply|cf:deploy|cf:preview)\b/i,
    "Hearth deploy and hosted-schema commands require Jonathan's explicit Release approval.",
  ],
  [
    /\bapply-supabase-schema\.mjs\b/i,
    "Direct hosted-schema application is blocked inside Codex.",
  ],
  [
    /\bwrangler\s+(?:deploy|versions\s+upload|secret\s+put|secret\s+delete)\b/i,
    "Cloudflare deploys and secret changes require Jonathan's explicit Release approval.",
  ],
  [
    /\bsupabase\s+(?:link|db\s+(?:push|reset)|migration\s+up|functions\s+deploy|secrets\s+set)\b/i,
    "Hosted Supabase mutations are blocked inside Codex.",
  ],
  [
    /\bclasp\s+push\b/i,
    "Sheets-era clasp pushes are forbidden for Hearth.",
  ],
  [
    /\bgit\s+push\b[^\n]*(?:--force(?:-with-lease)?|-f(?:\s|$))/i,
    "Force-pushing is blocked by Hearth repository policy.",
  ],
  [
    /\bgit\s+(?:reset\s+--hard|clean\b[^\n]*-[a-z]*f[a-z]*|checkout\s+--|restore\b)/i,
    "Destructive Git restoration is blocked inside Codex.",
  ],
  [
    /(?:^|\s)(?:cat|sed|awk|rg|grep|head|tail|less|more)\s+[^\n]*(?:\.env(?:\.|\s|$)|\.dev\.vars|credentials?|secrets?)/i,
    "Reading secret-bearing files through the shell is blocked.",
  ],
];

if (toolName === "Bash" || command) {
  for (const [pattern, reason] of blockedShell) {
    if (pattern.test(command)) {
      deny(reason);
      process.exit(0);
    }
  }
}

if (/^(?:apply_patch|Edit|Write)$/.test(toolName)) {
  const privatePath =
    /(?:^|[\\/])(?:\.env(?:\.(?!example|sample|template)[^\\/]+)?|\.dev\.vars|credentials?[^\\/]*|secrets?[^\\/]*)/i;

  if (privatePath.test(serialized)) {
    deny("Editing private environment, credential, or secret files is blocked.");
    process.exit(0);
  }
}

const hostedMutation =
  /(?:supabase|cloudflare|wrangler).*(?:execute_sql|apply_migration|deploy|create_branch|merge_branch|reset_branch|delete_branch|secret|write|update|delete)/i;
const releaseMutation = /github.*(?:merge_pull_request|delete_branch|rerun_workflow)/i;

if (hostedMutation.test(toolName)) {
  deny("Hosted data, schema, deploy, and secret mutations require Jonathan's explicit approval outside this default Codex flow.");
  process.exit(0);
}

if (releaseMutation.test(toolName)) {
  deny("Merge, branch deletion, and release reruns remain Jonathan's explicit release decision.");
}
