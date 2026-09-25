# Teams Agent Setup

This document is the Teams setup checklist. For product intent, read
[mat-teams-copilot-rad-agent.md](mat-teams-copilot-rad-agent.md). For the full
architecture, read
[m365-copilot-rad-agent-architecture.md](m365-copilot-rad-agent-architecture.md).

## Goal

Package Microsoft Agent Toolkit (MAT) as a Teams agent that users can add to:

- one-on-one chats
- group chats
- channels

Users interact with it by mentioning **MAT Agent**.

## Teams Requirements

The Teams app manifest should include these bot scopes:

```text
personal
groupchat
team
```

The backend endpoint is:

```text
POST /api/messages
```

Group chats and channels normally deliver messages to the agent only when it is
directly mentioned. Reading every message requires additional Microsoft 365
resource-specific consent and admin approval.

## Local Development Flow

1. Start the local app:

   ```powershell
   npm run dev
   ```

2. Expose port `3978` with Dev Tunnels:

   ```powershell
   .\.tools\devtunnel.exe user login
   .\.tools\devtunnel.exe create --allow-anonymous
   .\.tools\devtunnel.exe port create -p 3978
   .\.tools\devtunnel.exe host
   ```

3. Log in to Teams CLI:

   ```powershell
   teams login --device-code
   teams status
   ```

4. Register the app:

   ```powershell
   teams app create --endpoint <tunnel-url>/api/messages --name mat-agent --env .env
   ```

5. Install it in Teams, then add it to a chat:

   ```text
   Add people, agents and bots -> Add agents and bots -> MAT Agent
   ```

## Sideloading Blocker

If Teams CLI reports that sideloading is blocked for your user, ask IT to enable
custom app upload for your account:

```text
Teams Admin Center:
Users -> <your user> -> Policies -> App setup policy -> Upload custom apps = On
```

## Current Implementation Files

```text
src/server.ts
  Registers /api/messages through @microsoft/teams.apps.

src/teams/teamsAgent.ts
  Handles Teams messages and sends replies.

src/teams/mention.ts
  Removes the @MAT Agent mention from incoming text.
```

