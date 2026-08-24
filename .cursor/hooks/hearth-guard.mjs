let raw = "";

for await (const chunk of process.stdin) {
  raw += chunk;
}

function respond(permission, message) {
  process.stdout.write(
    JSON.stringify({
      permission,
      user_message: message,
      agent_message: message,
    }),
  );
}

let input;

try {
  input = JSON.parse(raw || "{}");
} catch {
  respond("deny", "Hearth blocked this action because the safety hook received invalid input.");
  process.exit(0);
}

const command = String(input.command ?? input.cmd ?? "");
const toolName = String(input.tool_name ?? input.toolName ?? "");
const server = String(input.server ?? input.server_name ?? input.serverName ?? "");

const approvalCommands = [
  /\bpnpm\s+(?:run\s+)?(?:books:apply|cf:deploy|cf:preview)\b/i,
  /\bwrangler\s+(?:deploy|versions\s+upload|secret\s+(?:put|delete))\b/i,
  /\bsupabase\s+(?:link|db\s+(?:push|reset)|migration\s+up|functions\s+deploy|secrets\s+set)\b/i,
  /\b(?:git\s+push|git\s+merge|git\s+rebase|gh\s+pr\s+merge)\b/i,
  /\b(?:git\s+reset\s+--hard|git\s+clean\b|git\s+checkout\s+--|git\s+restore\b|rm\s+-[^\s]*[rR])\b/i,
  /\b(?:drop|truncate|delete\s+from|alter\s+table|insert\s+into|update\s+\S+\s+set)\b/i,
  /(?:^|\s)(?:cat|sed|awk|rg|grep|head|tail|less|more)\s+[^\n]*(?:\.env(?:\.|\s|$)|\.dev\.vars|credentials?|secrets?)/i,
];

if (command && approvalCommands.some((pattern) => pattern.test(command))) {
  respond("ask", "Hearth requires Jonathan's approval for this shell action.");
  process.exit(0);
}

const hostedServer = /supabase|cloudflare|wrangler/i.test(server);
const hostedTool = /supabase|cloudflare|wrangler/i.test(toolName);
const mutatingTool =
  /(?:apply_migration|execute_sql|deploy|create_|update_|delete_|merge_|reset_|rebase_|secret|write)/i;
const unmistakablyHostedMutation =
  /^(?:apply_migration|execute_sql|deploy_edge_function|create_branch|merge_branch|reset_branch|delete_branch)$/i;

if (
  unmistakablyHostedMutation.test(toolName) ||
  ((hostedServer || hostedTool) && mutatingTool.test(toolName))
) {
  respond("ask", "Hearth requires Jonathan's approval for this hosted tool action.");
  process.exit(0);
}

respond("allow", "Hearth safety check passed.");
