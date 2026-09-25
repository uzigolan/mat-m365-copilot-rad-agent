# Microsoft Agent Toolkit (MAT) Teams Copilot RAD Agent - product brief

This document is the short product brief. For the full technical architecture,
read [m365-copilot-rad-agent-architecture.md](m365-copilot-rad-agent-architecture.md).
For Teams setup steps, read [teams-agent.md](teams-agent.md).

## Product Goal

Microsoft Agent Toolkit (MAT) should let users add **MAT Agent** to a Microsoft
Teams chat, mention it, and receive one shared answer in the same conversation.

First implemented domain:

```text
RAD MCP + RAD skills
```

Future domains:

```text
Sales MCP + Sales skills
Marketing MCP + Marketing skills
IT MCP + IT skills
```

## User Experience

1. A user adds **MAT Agent** to a Teams group chat.
2. A user asks a question:

   ```text
   @MAT Agent rad agent, does ETX-2i support TWAMP?
   ```

3. MAT sends the prompt to the runtime.
4. The runtime uses the configured MCP/skills domain.
5. MAT posts the answer back into the same Teams chat.

## Example Questions

```text
@MAT Agent rad agent, does ETX-2i support LACP on user Ethernet ports? Answer from RAD documentation.
```

```text
@MAT Agent rad agent, on ETX-2i, what is the correct CLI command to check active alarms? Do not run it on a device, just show the documented command.
```

```text
@MAT Agent rad agent, I want to check whether device etx2i-lab supports SyncE. Tell me the exact read-only command you would run and ask for confirmation before running it.
```

## Non-Negotiable RAD Safety Rule

Before any live RAD device command, including read-only `show` commands, MAT
must show the exact command in Teams and wait for explicit user confirmation.

Configuration changes must use:

```text
backup_config -> stage_config -> preview -> explicit approval -> commit_config
```

The detailed safety and approval design lives in the architecture document.

