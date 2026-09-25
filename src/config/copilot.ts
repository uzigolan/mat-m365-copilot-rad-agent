import path from "node:path";

export type McpServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type AppCopilotConfig = {
  model: string;
  workingDirectory: string;
  instructions: string;
  mcpServers: Record<string, McpServerConfig>;
};

export const copilotConfig: AppCopilotConfig = {
  model: process.env.COPILOT_MODEL ?? "gpt-5",
  workingDirectory: process.env.COPILOT_WORKDIR
    ? path.resolve(process.env.COPILOT_WORKDIR)
    : process.cwd(),
  instructions:
    process.env.COPILOT_INSTRUCTIONS ??
    "You are the MAT app's coding agent. Use connected MCP servers and skills when relevant, ask for approval before risky actions, and explain tool use clearly.",
  mcpServers: {
    radNetworkToolkit: {
      command:
        process.env.RAD_MCP_RUNTIME ??
        "C:\\Users\\uzi_g\\.codex\\plugins\\cache\\pack-stdio-0270-marketplace\\pack-stdio-0270\\0.27.0\\runtime\\windows-amd64\\rad-mcp-runtime.exe",
      args: ["--server", "legacy", "--enable-market-intel"]
    }
  }
};
