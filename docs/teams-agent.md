# Teams Agent Target

Goal: package Microsoft Agent Toolkit (MAT) as a Microsoft Teams agent that users can add to a group chat, channel, or one-on-one chat.

Primary runtime goal: Teams agent -> GitHub Copilot SDK -> RAD agent toolkit MCP server and skills.

## Runtime Shape

```text
Teams chat/channel
  -> Teams app + bot/agent messaging endpoint `/api/messages`
  -> Microsoft Agent Toolkit (MAT) backend
  -> Microsoft Agent Framework or direct Copilot SDK provider
  -> Copilot runtime
  -> MCP servers, skills, files, and approved tools
```

## Required Teams Behavior

- Add `personal`, `groupchat`, and `team` scopes to the Teams app manifest.
- Handle direct mentions in group chats and channels.
- Map each Teams conversation ID to one shared Copilot session ID.
- Post the answer back to the same Teams conversation/thread.
- Store traces by Teams tenant, conversation, user, and Copilot session.
- Use Entra ID for company identity and authorization.

By default, Teams agents in group chats and channels only receive messages when directly mentioned. If the agent must observe every message in a chat or channel, use resource-specific consent and tenant admin approval.

## Development Flow

1. Install Teams tooling.

   ```powershell
   npm install -g @microsoft/teams.cli
   teams login
   ```

2. Expose the local runtime.

   ```powershell
   winget install Microsoft.devtunnel
   devtunnel user login
   devtunnel create --allow-anonymous
   devtunnel port create -p 3978
   devtunnel host
   ```

3. Register the app.

   ```powershell
   teams app create --endpoint <tunnel-url>/api/messages --name mat-agent --env .env
   ```

4. Install it in Teams, then add it to the target group chat with **Add people, agents and bots**.

This repo now hosts the Teams endpoint at `/api/messages` from `src/server.ts` via `@microsoft/teams.apps`.

## Implementation Notes

The existing `src/runtime/copilotProvider.ts` should stay behind the Teams endpoint. The Teams handler should:

1. Remove the agent mention from the incoming message text.
2. Resolve the Teams conversation ID.
3. Resume or create the matching Copilot session.
4. Stream or collect the Copilot answer.
5. Send the result back to Teams.
