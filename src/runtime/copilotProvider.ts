import {
  CopilotClient,
  type CopilotSession,
  type PermissionRequest,
  type PermissionRequestResult
} from "@github/copilot-sdk";
import { copilotConfig } from "../config/copilot.js";
import { decidePermission } from "../policies/permissions.js";
import { appendTrace } from "./traces.js";

export type ChatChunk = {
  type: "message" | "idle" | "error";
  content?: string;
  error?: string;
};

export class CopilotProvider {
  private client: CopilotClient | undefined;
  private session: CopilotSession | undefined;

  async start(): Promise<void> {
    if (this.client) return;
    this.client = new CopilotClient();
    await this.client.start();
    await appendTrace("copilot.client.started", { model: copilotConfig.model });
  }

  async stop(): Promise<void> {
    await this.session?.disconnect();
    await this.client?.stop();
    this.session = undefined;
    this.client = undefined;
  }

  async *send(prompt: string): AsyncGenerator<ChatChunk> {
    await this.start();
    const session = await this.getSession();

    const idle = new Promise<void>((resolve) => {
      const unsubscribe = session.on("session.idle", () => {
        unsubscribe();
        resolve();
      });
    });

    const chunks: ChatChunk[] = [];
    const onMessage = (event: { data?: { content?: string } }) => {
      const content = event.data?.content;
      if (content) chunks.push({ type: "message", content });
    };

    const unsubscribeMessages = session.on("assistant.message", onMessage);

    try {
      await appendTrace("copilot.prompt", { prompt });
      await session.send({ prompt });

      while (true) {
        if (chunks.length > 0) {
          yield chunks.shift()!;
          continue;
        }

        const finished = await Promise.race([
          idle.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 75))
        ]);

        if (finished) break;
      }

      yield { type: "idle" };
      await appendTrace("copilot.response.done", {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appendTrace("copilot.error", { message });
      yield { type: "error", error: message };
    } finally {
      unsubscribeMessages();
    }
  }

  private async getSession(): Promise<CopilotSession> {
    if (this.session) return this.session;
    if (!this.client) throw new Error("Copilot client is not started.");

    this.session = await this.client.createSession({
      model: copilotConfig.model,
      workingDirectory: copilotConfig.workingDirectory,
      enableConfigDiscovery: copilotConfig.enableConfigDiscovery,
      systemMessage: {
        mode: "append",
        content: copilotConfig.instructions
      },
      mcpServers: copilotConfig.mcpServers,
      onPermissionRequest: (
        request: PermissionRequest
      ): PermissionRequestResult => decidePermission(request)
    });

    await appendTrace("copilot.session.created", {
      cwd: copilotConfig.workingDirectory,
      mcpServers: Object.keys(copilotConfig.mcpServers)
    });

    return this.session;
  }
}

export const copilotProvider = new CopilotProvider();
