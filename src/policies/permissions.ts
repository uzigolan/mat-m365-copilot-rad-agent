import type {
  PermissionRequest,
  PermissionRequestResult
} from "@github/copilot-sdk";

const readOnlyCommands = new Set(["dir", "ls", "pwd", "type", "cat", "rg", "git status"]);

export function decidePermission(request: PermissionRequest): PermissionRequestResult {
  const requestText = JSON.stringify(request).toLowerCase();

  if (requestText.includes("rm ") || requestText.includes("remove-item") || requestText.includes("del ")) {
    return { kind: "reject", feedback: "Destructive filesystem commands require explicit app approval." };
  }

  for (const command of readOnlyCommands) {
    if (requestText.includes(command)) {
      return { kind: "approve-once" };
    }
  }

  if ("managedApprovalRequired" in request && request.managedApprovalRequired === true) {
    return { kind: "no-result" };
  }

  return { kind: "no-result" };
}
