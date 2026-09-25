import { App } from "@microsoft/teams.apps";
import { copilotProvider } from "../runtime/copilotProvider.js";
import { appendTrace } from "../runtime/traces.js";
import { stripBotMention } from "./mention.js";

const maxTeamsMessageLength = 24_000;

export function registerTeamsAgent(app: App): void {
  app.on("message", async ({ activity, reply }) => {
    const prompt = stripBotMention(activity);
    const conversationId = activity.conversation?.id;
    const tenantId = activity.channelData?.tenant?.id;
    const userId = activity.from?.id;

    await appendTrace("teams.message.received", {
      tenantId,
      conversationId,
      userId,
      text: prompt
    });

    if (!prompt) {
      await reply("Mention me with a RAD or Copilot request and I will help from this chat.");
      return;
    }

    await reply("Working on it...");

    let answer = "";
    for await (const chunk of copilotProvider.send(prompt)) {
      if (chunk.type === "message" && chunk.content) {
        answer += chunk.content;
      }

      if (chunk.type === "error") {
        answer += `\nError: ${chunk.error}`;
      }
    }

    const messages = splitTeamsMessage(answer.trim() || "I did not receive a response from Copilot.");
    for (const message of messages) {
      await reply(message);
    }
  });

  app.on("install.add", async ({ send }) => {
    await send(
      "MAT Agent is ready. Add me to chats or channels, then mention me with Copilot or RAD agent requests."
    );
  });
}

function splitTeamsMessage(text: string): string[] {
  if (text.length <= maxTeamsMessageLength) return [text];

  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += maxTeamsMessageLength) {
    chunks.push(text.slice(index, index + maxTeamsMessageLength));
  }

  return chunks;
}
