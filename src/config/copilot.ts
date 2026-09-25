import path from "node:path";

export type McpServerConfig = {
  type: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
};

export type AppCopilotConfig = {
  model: string;
  workingDirectory: string;
  instructions: string;
  mcpServers: Record<string, McpServerConfig>;
  enableConfigDiscovery: boolean;
};

const radMcpUrl = process.env.RAD_MCP_URL?.trim();

export const copilotConfig: AppCopilotConfig = {
  model: process.env.COPILOT_MODEL ?? "gpt-5",
  workingDirectory: process.env.COPILOT_WORKDIR
    ? path.resolve(process.env.COPILOT_WORKDIR)
    : process.cwd(),
  instructions:
    process.env.COPILOT_INSTRUCTIONS ??
    "You are the Microsoft Agent Toolkit (MAT) app's coding agent. Use connected MCP servers and skills when relevant, ask for approval before risky actions, and explain tool use clearly.",
  enableConfigDiscovery: process.env.COPILOT_CONFIG_DISCOVERY !== "false",
  mcpServers: radMcpUrl
    ? {
        radNetworkToolkit: {
          type: "http",
          url: radMcpUrl,
          ...(process.env.RAD_MCP_TOKEN
            ? { headers: { Authorization: `Bearer ${process.env.RAD_MCP_TOKEN}` } }
            : {})
        }
      }
    : {}
};
