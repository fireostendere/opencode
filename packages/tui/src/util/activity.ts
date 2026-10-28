import type { SessionMessageInfo } from "@opencode/client"

const VERBS: Record<string, string> = {
  bash: "Running a command",
  shell: "Running a command",
  execute: "Running a command",
  read: "Reading",
  edit: "Editing",
  write: "Writing a file",
  patch: "Editing",
  apply_patch: "Editing",
  grep: "Searching",
  glob: "Searching",
  list: "Searching",
  codesearch: "Searching",
  webfetch: "Browsing",
  fetch: "Browsing",
  websearch: "Searching the web",
  task: "Delegating",
  todowrite: "Planning",
  skill: "Loading a skill",
}

/** What a running session is doing right now, and when the current run started. */
export function sessionActivity(messages: ReadonlyArray<SessionMessageInfo>) {
  // A run starts with the first message after the last idle boundary.
  const boundary = messages.findLastIndex((message) => message.type === "idle")
  const since = messages[boundary + 1]?.time.created
  const last = messages.at(-1)
  return { label: label(last), since }
}

function label(message: SessionMessageInfo | undefined) {
  if (message?.type === "compaction" && message.status === "running") return "Compacting context"
  if (message?.type === "shell" && message.status === "running") return "Running a command"
  if (message?.type !== "assistant" || message.time.completed) return "Working"
  const part = message.content.at(-1)
  if (!part || part.type === "reasoning") return "Thinking"
  if (part.type === "text") return "Writing"
  if (part.state.status !== "streaming" && part.state.status !== "running") return "Working"
  return VERBS[part.name] ?? `Using ${part.name}`
}

/** "8s", "2m 05s", "1h 02m". */
export function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`
}
