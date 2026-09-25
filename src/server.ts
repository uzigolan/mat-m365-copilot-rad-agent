import express from "express";
import { App, ExpressAdapter } from "@microsoft/teams.apps";
import { z } from "zod";
import { copilotConfig } from "./config/copilot.js";
import { copilotProvider } from "./runtime/copilotProvider.js";
import { registerTeamsAgent } from "./teams/teamsAgent.js";

const app = express();
const port = Number(process.env.PORT ?? 3978);
const teamsApp = new App({
  httpServerAdapter: new ExpressAdapter(app),
  dangerouslyAllowUnauthenticatedRequests:
    process.env.DANGEROUSLY_ALLOW_UNAUTHENTICATED_REQUESTS === "true"
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static("src/ui"));
registerTeamsAgent(teamsApp);

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    model: copilotConfig.model,
    mcpServers: Object.keys(copilotConfig.mcpServers)
  });
});

app.post("/api/chat", async (request, response) => {
  const body = z.object({ prompt: z.string().min(1) }).safeParse(request.body);

  if (!body.success) {
    response.status(400).json({ error: "A non-empty prompt is required." });
    return;
  }

  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");

  for await (const chunk of copilotProvider.send(body.data.prompt)) {
    response.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  response.end();
});

process.on("SIGINT", async () => {
  await copilotProvider.stop();
  process.exit(0);
});

await teamsApp.initialize();

app.listen(port, () => {
  console.log(`MAT Copilot Teams agent listening on http://localhost:${port}`);
  console.log(`Teams messaging endpoint: http://localhost:${port}/api/messages`);
});
