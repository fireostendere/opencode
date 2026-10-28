import { expect, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode/client"
import { formatElapsed, sessionActivity } from "../../src/util/activity"

const at = (created: number) => ({ id: `msg_${created}`, time: { created } })
const assistant = (content: readonly unknown[], completed?: number) =>
  ({
    ...at(30),
    type: "assistant",
    agent: "build",
    model: { id: "m", providerID: "p" },
    content,
    time: { created: 30, completed },
  }) as unknown as SessionMessageInfo
const user = (created: number) => ({ ...at(created), type: "user", text: "go" }) as unknown as SessionMessageInfo
const idle = (created: number) => ({ ...at(created), type: "idle", outcome: "succeeded" }) as SessionMessageInfo
const tool = (name: string, status: string) => ({ type: "tool", id: "t", name, state: { status }, time: { created: 1 } })

test.each([
  { name: "waiting for the first token", content: [], label: "Thinking" },
  { name: "reasoning", content: [{ type: "reasoning", text: "" }], label: "Thinking" },
  { name: "streaming text", content: [{ type: "text", text: "hi" }], label: "Writing" },
  { name: "a running shell tool", content: [tool("bash", "running")], label: "Running a command" },
  { name: "a streaming edit", content: [tool("edit", "streaming")], label: "Editing" },
  { name: "an unknown running tool", content: [tool("alice_led", "running")], label: "Using alice_led" },
  { name: "a finished tool, before the next step", content: [tool("read", "completed")], label: "Working" },
])("labels $name", ({ content, label }) => {
  expect(sessionActivity([user(10), assistant(content)]).label).toBe(label)
})

test("a completed assistant step waits for the model", () => {
  expect(sessionActivity([user(10), assistant([{ type: "text", text: "done" }], 40)]).label).toBe("Working")
})

test("the run starts after the last idle boundary", () => {
  expect(sessionActivity([user(1), idle(5), user(10), assistant([])]).since).toBe(10)
  expect(sessionActivity([user(3), assistant([])]).since).toBe(3)
  expect(sessionActivity([]).since).toBeUndefined()
})

test.each([
  [0, "0s"],
  [8_900, "8s"],
  [125_000, "2m 05s"],
  [3_720_000, "1h 02m"],
])("formats %p ms as %p", (ms, text) => {
  expect(formatElapsed(ms)).toBe(text)
})
