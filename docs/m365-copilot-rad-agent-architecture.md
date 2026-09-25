# Microsoft Agent Toolkit (MAT) M365 Copilot RAD Agent - architecture

*(Surface distribution mode: **Microsoft 365 first**, starting with Teams. Runtime mode: GitHub Copilot SDK backed by the Copilot CLI runtime. RAD capabilities are served through the RAD agent toolkit MCP server.)*

## Document purpose

This document specifies the architecture for a Microsoft 365 agent that can be
added to a Teams chat and use GitHub Copilot plus the RAD agent toolkit to
answer RAD questions and perform approved RAD workflows.

It is intended to explain:

1. Which technology owns each part of the system.
2. How Microsoft 365, Teams, the Microsoft Agent Toolkit (MAT) backend, GitHub Copilot SDK, Copilot CLI,
   MCP servers, and RAD skills connect.
3. Where safety and approval gates must be enforced.
4. How the current Teams implementation can later support other Microsoft 365
   surfaces such as Outlook, SharePoint, or Microsoft 365 Copilot agents.

## Executive decision

Use **Microsoft Teams as the first Microsoft 365 surface**, but keep the backend
surface-neutral.

The backend should treat Teams as one front door into a reusable agent runtime:

```text
Microsoft 365 surface
  -> Microsoft Agent Toolkit (MAT) backend
  -> GitHub Copilot SDK
  -> Copilot CLI runtime
  -> RAD agent toolkit MCP server
```

Do not put RAD logic directly in the Teams handler. Teams should only receive
messages, identify the conversation and user, strip the agent mention, call the
runtime, and post the answer back to the same conversation.

The reusable product is:

- RAD MCP server configuration.
- RAD skills and safety rules.
- Permission policy.
- Session mapping.
- Trace capture.
- Copilot provider abstraction.

Teams, Outlook, SharePoint, and future Microsoft 365 surfaces should be
replaceable entry points over the same runtime.

## Current implemented baseline

The current repo implements the first Teams-facing baseline:

```text
src/server.ts
  Hosts Express and registers /api/messages through @microsoft/teams.apps.

src/teams/teamsAgent.ts
  Handles Teams message events and replies into the same Teams conversation.

src/teams/mention.ts
  Removes the @MAT Agent mention from incoming Teams text.

src/runtime/copilotProvider.ts
  Owns GitHub Copilot SDK client/session creation and streaming.

src/config/copilot.ts
  Configures model, working directory, and the RAD MCP runtime.

src/policies/permissions.ts
  Central permission callback for Copilot/RAD tool use.
```

## High-level architecture diagram

```mermaid
flowchart TD
    U[Company Users] -->|mention agent| T[Microsoft Teams Chat / Channel]
    T -->|Bot Framework activity| TA["Microsoft Agent Toolkit (MAT) Teams App<br/>/api/messages"]

    TA -->|clean prompt + context| MB["Microsoft Agent Toolkit (MAT) backend"]
    MB --> SM[Session Mapper\nTeams conversation -> Copilot session]
    MB --> TR[Trace Store\nJSONL now, durable store later]
    MB --> PP[Permission Policy]

    MB --> CP[Copilot Provider\nGitHub Copilot SDK]
    CP --> CR[Copilot CLI Runtime\nJSON-RPC]

    CR --> MCP[RAD MCP Server\nrad-network-toolkit]
    CR --> SK[RAD Skills\nSafety + routing instructions]
    CR -. future .-> SALES["Sales MCP + Skills"]
    CR -. future .-> MKT["Marketing MCP + Skills"]
    CR -. future .-> IT["IT MCP + Skills"]
    CR --> FS[Workspace Files]
    CR --> SH[Shell / local tools\nrestricted by policy]

    MCP --> KP[RAD Knowledge Plane\nmanuals, CLI refs, MIBs, catalog]
    MCP --> DP[RAD Device Plane\ninventory, SSH, SNMP]
    DP --> DEV[RAD Devices]

    PP -. approval required .-> T
    T -. user confirms .-> PP

    MB -->|reply| T

    classDef blockBig font-size:16px,stroke-width:2px,padding:16px;
    class U,T,TA,MB,SM,TR,PP,CP,CR,MCP,SK,SALES,MKT,IT,FS,SH,KP,DP,DEV blockBig;
```

The critical boundary is between **planning** and **execution**. Copilot and the
RAD knowledge plane may plan, explain, and retrieve documentation. Any live RAD
device command must pass through the approval policy before execution.

## Technology responsibility matrix

| Layer | Technology | Responsibility | Should not own |
|---|---|---|---|
| Microsoft 365 surface | Teams first, later Outlook/SharePoint/M365 | User interaction, identity context, shared conversation | RAD business logic |
| Teams app endpoint | `@microsoft/teams.apps` | Receive activities at `/api/messages`, reply to Teams | Copilot orchestration internals |
| Microsoft Agent Toolkit (MAT) backend | Express + TypeScript | Surface routing, session mapping, traces, policy integration | Vendor-specific RAD command syntax |
| Agent runtime | GitHub Copilot SDK | Structured Copilot sessions, events, MCP config, permissions | Teams installation/publishing |
| Runtime engine | Copilot CLI runtime | Tool execution substrate used by SDK | Product-specific approval policy |
| Tool plane | MCP | Expose RAD tools and knowledge as structured capabilities | Microsoft 365 identity |
| RAD plugin | RAD agent toolkit | RAD knowledge, inventory, CLI, SNMP, staged config flow | Teams message transport |
| Safety layer | Microsoft Agent Toolkit (MAT) policy + RAD skills | Confirmation gates, staged commits, destructive-action refusal | Raw device execution bypass |

## Microsoft 365 surface model

The system should support multiple future surfaces by keeping a surface adapter
layer.

```text
src/surfaces/
  teams/
  outlook/
  sharepoint/
  m365-copilot/

src/runtime/
  copilotProvider.ts
  sessionStore.ts
  permissionBroker.ts

src/config/
  copilot.ts
  radToolkit.ts
```

Current code uses `src/teams/` directly. If more surfaces are added, move Teams
under `src/surfaces/teams/` and introduce a common request object:

```ts
type AgentRequest = {
  tenantId: string;
  conversationId: string;
  threadId?: string;
  userId: string;
  text: string;
  surface: "teams" | "outlook" | "sharepoint" | "m365-copilot";
};
```

Every surface should translate its native event into `AgentRequest`, then call
the same runtime.

## Teams message flow

```mermaid
sequenceDiagram
    participant User
    participant Teams
    participant MAT as "Microsoft Agent Toolkit (MAT) /api/messages"
    participant Sessions as Session Mapper
    participant Copilot as GitHub Copilot SDK
    participant Runtime as Copilot CLI Runtime
    participant RAD as RAD MCP Server

    User->>Teams: @MAT Agent rad agent, does ETX-2i support TWAMP?
    Teams->>MAT: Bot Framework message activity
    MAT->>MAT: Strip @mention and extract tenant/user/conversation
    MAT->>Sessions: Resolve Teams conversation to Copilot session
    Sessions-->>MAT: Existing or new session id
    MAT->>Copilot: Send prompt
    Copilot->>Runtime: JSON-RPC session message
    Runtime->>RAD: knowledge_search / CLI reference tools
    RAD-->>Runtime: bounded RAD evidence
    Runtime-->>Copilot: assistant response
    Copilot-->>MAT: message event
    MAT-->>Teams: Reply in same chat/thread
    Teams-->>User: Everyone sees same answer
```

In group chats and channels, Teams normally sends messages to the agent only
when the agent is directly mentioned. Observing every message requires separate
Microsoft 365 consent and tenant admin approval.

## Session model

The session key should be scoped to tenant and conversation:

```text
tenantId + surface + conversationId + threadId -> copilotSessionId
```

For Teams:

```text
tenantId + "teams" + teamsConversationId + replyThreadId
```

This gives everyone in the same chat one shared agent result, while preventing
conversation bleed between tenants, chats, channels, and threads.

The current baseline keeps one in-memory Copilot session. Production should add
a session store:

```text
session_store
  session_key
  copilot_session_id
  tenant_id
  surface
  conversation_id
  thread_id
  created_at
  updated_at
```

## RAD MCP and skills connection

The RAD toolkit should be exposed as an **HTTP MCP service**, not as a
project-local stdio subprocess. Microsoft Agent Toolkit (MAT) is only one
consumer of that service. The same RAD MCP endpoint and RAD skills package
should also be installable for other AI clients such as Claude, GitHub Copilot,
and future internal clients.

Recommended HTTP MCP registration:

```json
{
  "mcpServers": {
    "rad-network-toolkit": {
      "type": "http",
      "url": "https://rad-mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${RAD_MCP_TOKEN}"
      }
    }
  }
}
```

For local development, the URL can point at a locally hosted RAD MCP server:

```text
RAD_MCP_URL=http://localhost:8765/mcp
```

This app configures the HTTP MCP endpoint in `src/config/copilot.ts`.

```text
Copilot SDK session
  -> mcpServers.radNetworkToolkit
  -> HTTP MCP endpoint
  -> RAD knowledge and device tools
```

The RAD MCP service should be packaged and documented independently from this
Teams/Microsoft 365 app so multiple clients can install the same capability:

```text
RAD MCP HTTP Service
  -> Microsoft Agent Toolkit (MAT)
  -> GitHub Copilot SDK / CLI clients
  -> Claude Desktop / Claude Code MCP clients
  -> Future internal AI clients
```

The RAD skills should follow the same reuse model. They describe behavior,
routing, and safety rules for the RAD domain, while the MCP service exposes the
typed tools.

Tool names exposed through Copilot SDK are shaped by the MCP server key plus
the tool name:

```text
<server-key>-<tool-name>
```

Examples:

```text
radNetworkToolkit-knowledge_search
radNetworkToolkit-list_devices
radNetworkToolkit-run_show
radNetworkToolkit-cli_help
```

Exact names must be verified from the runtime before hard-coding allow/deny
rules.

## Multi-client RAD MCP installation model

The RAD MCP and skills package is a shared company capability, not a private
implementation detail of this project.

```mermaid
flowchart TD
    RADS["RAD MCP HTTP Service"] --> RADD["RAD knowledge + device APIs"]
    RADSK["RAD Skills Package"] --> RULES["Routing, safety, staged config rules"]

    MAT["Microsoft Agent Toolkit (MAT)"] --> RADS
    MAT --> RADSK

    COP["GitHub Copilot clients"] --> RADS
    COP --> RADSK

    CLAUDE["Claude MCP clients"] --> RADS
    CLAUDE --> RADSK

    OTHER["Future AI clients"] --> RADS
    OTHER --> RADSK

    classDef blockBig font-size:16px,stroke-width:2px,padding:16px;
    class RADS,RADD,RADSK,RULES,MAT,COP,CLAUDE,OTHER blockBig;
```

Client configuration examples:

```json
{
  "mcpServers": {
    "rad-network-toolkit": {
      "type": "http",
      "url": "https://rad-mcp.example.com/mcp"
    }
  }
}
```

For clients that support headers:

```json
{
  "mcpServers": {
    "rad-network-toolkit": {
      "type": "http",
      "url": "https://rad-mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${RAD_MCP_TOKEN}"
      }
    }
  }
}
```

If a client only supports local stdio MCP, use a small stdio-to-HTTP adapter as
a compatibility shim. The authoritative deployment target should still be the
HTTP MCP service.

## Future business MCP and skills domains

RAD is the first domain package, but the architecture should support additional
company capability packages. Each package should expose tools through MCP and
behavior through skills.

```mermaid
flowchart TD
    CP[Copilot SDK Session] --> CR[Copilot CLI Runtime]

    CR --> RAD["RAD MCP + RAD Skills"]
    CR -. future .-> SALES["Sales MCP + Sales Skills"]
    CR -. future .-> MKT["Marketing MCP + Marketing Skills"]
    CR -. future .-> IT["IT MCP + IT Skills"]

    RAD --> RADK[Product docs, CLI refs, MIBs, device inventory, approved live operations]
    SALES --> SALESK[CRM/account data, opportunity notes, quotes, approved sales workflows]
    MKT --> MKTK[Campaign material, product messaging, competitive notes, approved content workflows]
    IT --> ITK[Service desk, asset inventory, access requests, approved IT operations]

    classDef blockBig font-size:16px,stroke-width:2px,padding:16px;
    class CP,CR,RAD,SALES,MKT,IT,RADK,SALESK,MKTK,ITK blockBig;
```

The same rules apply to every future domain:

- MCP exposes typed tools.
- Skills describe routing, safety, and domain behavior.
- The MAT backend owns session mapping, Microsoft 365 identity context, traces,
  and approval UX.
- Domain tools should not bypass the central permission policy.
- Sensitive actions require explicit approval in the originating Microsoft 365
  surface.

Recommended future package names:

| Domain | MCP package | Skills package | Example use |
|---|---|---|---|
| RAD | `rad-network-toolkit` | RAD skills | Product support, CLI reference, SNMP, approved device actions |
| Sales | `sales-toolkit` | Sales skills | Account lookup, quote assistance, opportunity summaries |
| Marketing | `marketing-toolkit` | Marketing skills | Product messaging, campaign content, competitive material |
| IT | `it-toolkit` | IT skills | Service desk, asset lookup, access-request workflows |

### Future agent runtime options without app-owned API keys

GitHub Copilot SDK plus the Copilot CLI runtime is the first runtime target for
this project, but it should not be the only possible runtime. The MCP and skills
domains above should remain reusable regardless of which agent runtime is
selected.

Preferred identity model: avoid hard-coded or app-owned model API keys. Use a
signed-in user, tenant identity, delegated Microsoft 365 identity, or managed
identity whenever possible.

```mermaid
flowchart TD
    SURF[Microsoft 365 Surface] --> MAT["Microsoft Agent Toolkit (MAT) Backend"]

    MAT --> RSEL{Agent Runtime Provider}

    RSEL --> COP["GitHub Copilot SDK<br/>Copilot CLI Runtime<br/>local signed-in Copilot user"]
    RSEL --> MAF["Microsoft Agent Framework<br/>provider abstraction<br/>delegated or managed identity"]
    RSEL --> M365["Microsoft 365 Copilot / Agent 365<br/>tenant-governed identity"]
    RSEL --> BYOK["Bring Your Own Key (BYOK) provider<br/>customer-managed keys only when required"]

    COP --> DOM["Shared MCP + Skills Domains"]
    MAF --> DOM
    M365 --> DOM
    BYOK --> DOM

    DOM --> RAD["RAD"]
    DOM --> SALES["Sales"]
    DOM --> MKT["Marketing"]
    DOM --> IT["IT"]

    classDef blockBig font-size:16px,stroke-width:2px,padding:16px;
    class SURF,MAT,RSEL,COP,MAF,M365,BYOK,DOM,RAD,SALES,MKT,IT blockBig;
```

Runtime options:

| Option | API-key posture | Best fit | Notes |
|---|---|---|---|
| GitHub Copilot SDK + Copilot CLI runtime | No app-owned model API key; uses signed-in Copilot user or supported Copilot auth mode | Developer and internal engineering agents | Current first implementation path |
| Microsoft Agent Framework | Can use delegated identity, managed identity, or provider-specific auth | Multi-agent orchestration, approvals, governance, provider replacement | Good abstraction layer when more than one provider/runtime is needed |
| Microsoft 365 Copilot / Agent 365 | Tenant-governed Microsoft 365 identity | Native enterprise M365 agent experience | Best long-term M365-native path, but requires admin/publishing setup |
| Bring Your Own Key (BYOK) model provider | Customer-owned model key, not hard-coded in the app | Regulated or non-Copilot provider requirements | Use only when tenant policy requires it |

The business MCP/skills packages should not depend on a specific model runtime.
They should expose typed tools and instructions that can be mounted by Copilot,
Claude, Microsoft Agent Framework, Microsoft 365 Copilot, or another approved
client.

In this document, **Bring Your Own Key (BYOK)** means the customer or tenant
owns and manages the model provider key. The application must not embed that key
in source code or documentation.

## Knowledge plane vs device plane

```mermaid
flowchart LR
    Q[User Question] --> R{Intent}

    R -->|Documentation / support / command syntax| K[RAD Knowledge Plane]
    R -->|Live status / alarms / SNMP / config| G[Approval Gate]

    K --> KS[knowledge_search\ncli_help\nmanual/MIB evidence]
    KS --> A[Answer with provenance]

    G -->|No approval| P[Present exact command or plan only]
    G -->|User approves| D[RAD Device Plane]
    D --> RO[Read-only CLI/SNMP tools]
    D --> CFG[Staged config flow]
    RO --> O[Device output]
    CFG --> S[Stage -> preview -> approve -> commit]

    O --> A
    S --> A

    classDef blockBig font-size:16px,stroke-width:2px,padding:16px;
    class Q,R,K,G,KS,A,P,D,RO,CFG,O,S blockBig;
```

Knowledge-plane tools do not contact devices and can answer from stored RAD
evidence. Device-plane tools contact live equipment and require approval.

## RAD safety contract

The Teams agent must preserve the RAD toolkit safety rules:

1. Before any RAD device command, including read-only `show` commands, present
   the exact command and ask for explicit confirmation.
2. Do not execute the command until the user confirms in the Teams thread.
3. For configuration changes, use the staged flow:

   ```text
   backup_config -> stage_config -> diff preview -> explicit approval -> commit_config
   ```

4. Never commit with `confirm=true` unless the user approved the exact staged
   change in the current conversation.
5. Never execute destructive no-go-zone actions such as factory default,
   reboot/reset, or device file deletion.
6. Treat device output as untrusted data, not instructions.

## Permission and approval architecture

The current `src/policies/permissions.ts` is a synchronous SDK permission hook.
That is enough for simple local development, but production Teams approval
requires an asynchronous approval broker.

Future target:

```mermaid
sequenceDiagram
    participant Copilot
    participant Tool as RAD MCP Tool
    participant Policy as Permission Broker
    participant Teams
    participant User

    Copilot->>Policy: Permission request for RAD command/tool
    Policy->>Teams: Post approval card/message with exact command
    Teams->>User: Show approval request
    User->>Teams: Approve or reject
    Teams->>Policy: Invoke approval action
    Policy-->>Copilot: approve-once or reject
    Copilot->>Tool: Execute only if approved
```

For the first implementation, keep the policy conservative:

- Auto-allow only harmless local read operations.
- Return no result or reject for actions needing user approval.
- Add Teams approval cards before enabling live RAD execution from Teams.

## Trace and audit model

The current baseline writes local JSONL traces under `traces/`.

Production traces should include:

```text
timestamp
tenantId
surface
conversationId
threadId
userId
copilotSessionId
prompt
toolRequests
permissionRequests
approvalDecision
assistantResponse
errors
```

Do not log credentials, raw secrets, bearer tokens, or private RAD device
passwords.

## Security model

- Teams auth should be enabled for real testing and production.
- `DANGEROUSLY_ALLOW_UNAUTHENTICATED_REQUESTS=true` is local-development only.
- `.env` must not be committed.
- Dev tunnel URLs are temporary development endpoints, not production hosting.
- RAD MCP server credentials must stay in the RAD toolkit environment, not in
  Teams messages, README files, or traces.
- Device output is untrusted and must not be treated as instructions.
- Live device actions require explicit user approval.

## Deployment stages

### Stage 1: Local Teams development

```text
npm run dev
devtunnel host port 3978
teams app create --endpoint <tunnel>/api/messages
```

Use this for validating Teams installation, mentions, and shared-chat replies.

### Stage 2: Internal development app

Host the Microsoft Agent Toolkit (MAT) backend on an internal development service and register a Teams app
for a limited developer group.

Requirements:

- Teams app registration.
- Bot credentials.
- Tenant policy allowing selected users to install the app.
- Central logs.
- Locked-down environment variables.

### Stage 3: Controlled pilot

Enable a small group of RAD users. Keep live device execution disabled or
approval-only.

Add:

- Durable session store.
- Durable trace store.
- Teams approval cards.
- Admin-managed allow/deny policies.
- Evaluation tasks for common RAD questions.

### Stage 4: Production

Publish through the company-approved Microsoft 365 app process.

Add:

- Production hosting.
- Observability.
- Incident/runbook procedures.
- Versioned RAD toolkit dependency.
- Audit retention policy.
- Security review.

## Future Microsoft 365 surfaces

The same backend can support other Microsoft 365 surfaces:

| Surface | Best use | Notes |
|---|---|---|
| Teams | Shared chat with agent | First target and best fit for group collaboration |
| Outlook | Email-based RAD triage or support | Add-in or action surface, not shared chat by default |
| SharePoint | Internal RAD support portal | Good for searchable knowledge and forms |
| Microsoft 365 Copilot / Agent 365 | Native enterprise agent | Needs stronger tenant/admin publishing path |
| Office add-ins | Word/Excel/PowerPoint workflows | Useful for report generation, less natural for chat |

The backend should not assume Teams-only fields. It should normalize each
surface into `AgentRequest`.

## Testing strategy

### Unit tests

- Mention stripping for Teams activities.
- Session key generation.
- Permission policy decisions.
- RAD MCP config loading.

### Integration tests

- `/api/health` reports configured MCP servers.
- `/api/messages` accepts a Teams message activity in local unauthenticated
  mode.
- Copilot provider can create a session.
- RAD MCP runtime can be discovered.

### Safety tests

- Live RAD command request produces an approval request.
- Rejected approval prevents execution.
- Config workflow cannot commit before staged preview approval.
- Destructive no-go-zone actions are refused.
- Device output is recorded as data and never executed.

### Microsoft 365 tests

- Agent can be installed in personal scope.
- Agent can be added to group chat.
- Agent can be added to team/channel scope.
- Mentions are stripped correctly.
- Replies appear in the correct thread.

## Acceptance criteria

The architecture is complete when:

1. Users can add MAT Agent to a Teams chat.
2. Users can mention MAT Agent and receive a response in the same conversation.
3. Copilot SDK is the normal runtime path.
4. RAD agent toolkit is connected through MCP.
5. RAD documentation questions work without live device access.
6. Live RAD device actions require explicit Teams approval.
7. Configuration changes use staged preview and explicit commit approval.
8. Traces capture prompts, tool requests, approval decisions, and responses.
9. `.env`, caches, downloaded tools, and traces are not committed.
10. The backend can later add Outlook, SharePoint, or M365 Copilot surfaces
    without replacing the Copilot/RAD runtime.

## Initial implementation sequence

1. Keep the current Teams endpoint working.
2. Add a durable session store keyed by tenant and Teams conversation.
3. Add a Teams approval broker for Copilot permission requests.
4. Add tests for mention cleanup, health, permissions, and Teams message flow.
5. Verify RAD MCP tool discovery through Copilot SDK.
6. Keep live RAD execution disabled until approval cards are implemented.
7. Add pilot deployment instructions for a limited Microsoft 365 user group.
8. Refactor `src/teams` into `src/surfaces/teams` only when a second surface is
   added.
