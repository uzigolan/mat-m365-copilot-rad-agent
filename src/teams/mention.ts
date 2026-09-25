type Mention = {
  mentioned?: {
    id?: string;
    name?: string;
  };
  text?: string | null;
};

type TeamsActivity = {
  text?: string;
  recipient?: {
    id?: string;
    name?: string;
  };
  entities?: Array<{
    type?: string;
    mentioned?: Mention["mentioned"];
    text?: string | null;
  }>;
};

export function stripBotMention(activity: TeamsActivity): string {
  let text = activity.text ?? "";
  const recipientId = activity.recipient?.id;
  const recipientName = activity.recipient?.name;

  for (const entity of activity.entities ?? []) {
    if (entity.type !== "mention" || !entity.text) continue;
    const mentionsBotById = recipientId && entity.mentioned?.id === recipientId;
    const mentionsBotByName = recipientName && entity.mentioned?.name === recipientName;

    if (mentionsBotById || mentionsBotByName) {
      text = text.replace(entity.text, "");
    }
  }

  if (recipientName) {
    text = text.replace(new RegExp(`@${escapeRegExp(recipientName)}`, "gi"), "");
  }

  return text.replace(/<at>.*?<\/at>/gi, "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
