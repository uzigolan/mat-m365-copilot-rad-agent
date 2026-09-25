# Install and Run

This guide has two paths:

1. Local web debug
2. Microsoft Teams installation

Before either path, verify that GitHub Copilot CLI works and that the RAD agent
toolkit plugin is connected.

## Table Of Contents

1. [Prerequisites](#prerequisites)
2. [Verify Copilot And RAD Toolkit](#verify-copilot-and-rad-toolkit)
3. [Initial Setup](#initial-setup)
4. [Path 1: Local Web Debug](#path-1-local-web-debug)
5. [Path 2: Microsoft Teams](#path-2-microsoft-teams)
   - [Start The Local App](#start-the-local-app)
   - [Start Dev Tunnel](#start-dev-tunnel)
   - [Log In To Teams CLI](#log-in-to-teams-cli)
   - [Register The Teams App](#register-the-teams-app)
6. [Notes](#notes)

## Prerequisites

- Node.js 20.19 or newer
- npm
- GitHub Copilot CLI installed and signed in
- RAD agent toolkit plugin installed in Copilot CLI
- This repository cloned locally

## Verify Copilot And RAD Toolkit

Open Copilot CLI and verify MCP/plugin status:

```text
/mcp all
```

Confirm that the RAD agent toolkit / RAD MCP server appears connected.

Then ask:

```text
rad agent show system versions
```

Expected result: Copilot should answer with RAD toolkit/server/skills/driver
version information. If this does not work in Copilot CLI, fix that first
before running this app. The local web app can reuse Copilot CLI configuration
through Copilot config discovery.

## Initial Setup

From PowerShell:

```powershell
cd C:\Users\uzi_g\Downloads\ai-projects\MAT
npm install
Copy-Item .env.example .env -ErrorAction SilentlyContinue
```

For local debug with your existing Copilot CLI plugin setup, `.env` should use:

```env
PORT=3978
DANGEROUSLY_ALLOW_UNAUTHENTICATED_REQUESTS=true
COPILOT_MODEL=gpt-5
COPILOT_WORKDIR=.
COPILOT_CONFIG_DISCOVERY=true
# RAD_MCP_URL=
# RAD_MCP_TOKEN=
```

Leave `RAD_MCP_URL` empty/commented when you want the app to reuse Copilot CLI's
installed MCP/plugin configuration.

## Path 1: Local Web Debug

Start the app:

```powershell
npm run dev
```

Open:

```text
http://localhost:3978
```

Check health:

```powershell
Invoke-RestMethod http://localhost:3978/api/health | ConvertTo-Json
```

Expected shape:

```json
{
  "ok": true,
  "model": "gpt-5",
  "configDiscovery": true,
  "mcpServers": []
}
```

`mcpServers: []` is normal when `COPILOT_CONFIG_DISCOVERY=true` and
`RAD_MCP_URL` is empty. It means this app is not directly registering an MCP
server and is letting Copilot SDK discover Copilot CLI's installed config.

Try these prompts in the web UI:

```text
rad agent show system versions
```

```text
rad agent, does ETX-2i support TWAMP? Answer from RAD documentation.
```

For live RAD device commands, the agent must ask for explicit confirmation
before running anything, including read-only `show` commands.

## Path 2: Microsoft Teams

Teams requires a public HTTPS endpoint during local development. Use Dev
Tunnels.

### Start The Local App

Terminal 1:

```powershell
cd C:\Users\uzi_g\Downloads\ai-projects\MAT
npm run dev
```

### Start Dev Tunnel

If `devtunnel.exe` is not installed:

```powershell
New-Item -ItemType Directory -Force .tools | Out-Null
Invoke-WebRequest -Uri https://aka.ms/TunnelsCliDownload/win-x64 -OutFile .\.tools\devtunnel.exe
.\.tools\devtunnel.exe -h
```

Terminal 2:

```powershell
cd C:\Users\uzi_g\Downloads\ai-projects\MAT
.\.tools\devtunnel.exe user login
.\.tools\devtunnel.exe create --allow-anonymous
.\.tools\devtunnel.exe port create -p 3978
.\.tools\devtunnel.exe host
```

Copy the HTTPS tunnel URL.

### Log In To Teams CLI

Terminal 3:

```powershell
cd C:\Users\uzi_g\Downloads\ai-projects\MAT
npm install -g @microsoft/teams.cli
teams login --device-code
teams status
```

If sideloading is blocked, ask IT to enable custom app upload for your user:

```text
Teams Admin Center:
Users -> <your user> -> Policies -> App setup policy -> Upload custom apps = On
```

### Register The Teams App

Use your real tunnel URL:

```powershell
teams app create --endpoint https://YOUR-TUNNEL-URL/api/messages --name mat-agent --env .env
```

Then add it in Teams:

```text
Add people, agents and bots -> Add agents and bots -> MAT Agent
```

Try:

```text
@MAT Agent rad agent show system versions
```

## Notes

- Use local web debug first. It is faster and does not require Teams policy.
- Use Teams only after the web path works.
- Do not commit `.env`.
- `DANGEROUSLY_ALLOW_UNAUTHENTICATED_REQUESTS=true` is for local development
  only.
- For production or shared environments, use authenticated Teams requests and a
  shared HTTP RAD MCP service.
