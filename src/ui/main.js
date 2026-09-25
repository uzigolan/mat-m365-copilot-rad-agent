const form = document.querySelector("#chat-form");
const promptInput = document.querySelector("#prompt");
const messages = document.querySelector("#messages");
const status = document.querySelector("#status");
const clear = document.querySelector("#clear");

async function loadHealth() {
  const response = await fetch("/api/health");
  const health = await response.json();
  status.textContent = `Model ${health.model} | MCP servers: ${health.mcpServers.length || "none configured"}`;
}

function addMessage(role, text = "") {
  const item = document.createElement("article");
  item.className = `message ${role}`;
  item.textContent = text;
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  promptInput.value = "";
  addMessage("user", prompt);
  const assistant = addMessage("assistant", "");

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventText of events) {
      const line = eventText.split("\n").find((entry) => entry.startsWith("data: "));
      if (!line) continue;
      const chunk = JSON.parse(line.slice(6));
      if (chunk.type === "message") assistant.textContent += chunk.content;
      if (chunk.type === "error") assistant.textContent += `\nError: ${chunk.error}`;
      messages.scrollTop = messages.scrollHeight;
    }
  }
});

clear.addEventListener("click", () => {
  messages.textContent = "";
});

loadHealth().catch((error) => {
  status.textContent = error.message;
});
