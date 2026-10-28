/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { Context } from "@opencode/plugin/tui/context"
import { SidebarContext } from "../../src/feature-plugins/sidebar/context"

const GREEN = RGBA.fromInts(0, 200, 0)
const AMBER = RGBA.fromInts(200, 150, 0)
const RED = RGBA.fromInts(200, 0, 0)

function context(options?: { cost?: number; tokens?: number; limit?: number }) {
  const color = RGBA.fromInts(200, 200, 200)
  return {
    theme: {
      text: {
        base: color,
        muted: color,
        feedback: { success: { base: GREEN }, warning: { base: AMBER }, error: { base: RED } },
      },
      border: { base: color },
    },
    data: {
      session: {
        get: () => ({ location: { directory: "/workspace" } }),
        cost: () => options?.cost ?? 0,
        message: {
          list: () =>
            options?.tokens
              ? [
                  {
                    id: "message",
                    type: "assistant",
                    model: { providerID: "provider", id: "model" },
                    tokens: {
                      input: options.tokens,
                      output: 0,
                      reasoning: 0,
                      cache: { read: 0, write: 0 },
                    },
                  },
                ]
              : [],
        },
      },
      location: {
        model: {
          list: () =>
            options?.limit ? [{ providerID: "provider", id: "model", limit: { context: options.limit } }] : [],
        },
      },
    },
  } as unknown as Context
}

test("sidebar omits context before usage is available", async () => {
  const app = await testRender(() => <SidebarContext context={context()} sessionID="session" />, {
    width: 42,
    height: 8,
  })

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("Context")
    expect(app.captureCharFrame()).not.toContain("Not measured")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar shows available context usage", async () => {
  const app = await testRender(() => <SidebarContext context={context({ tokens: 1234 })} sessionID="session" />, {
    width: 42,
    height: 8,
  })

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Context")
    expect(app.captureCharFrame()).toContain("1,234 tokens")
  } finally {
    app.renderer.destroy()
  }
})

test.each([
  { tokens: 50_000, color: GREEN },
  { tokens: 70_000, color: AMBER },
  { tokens: 90_000, color: RED },
])("sidebar meters $tokens of 100,000 context tokens", async (item) => {
  const app = await testRender(
    () => <SidebarContext context={context({ tokens: item.tokens, limit: 100_000 })} sessionID="session" />,
    { width: 20, height: 4 },
  )

  try {
    await app.renderOnce()
    await app.renderOnce()
    const [title, meter] = app.captureCharFrame().split("\n")
    const percent = item.tokens / 1_000
    expect(title).toContain(`${percent}%`)
    expect(meter).toBe("━".repeat(Math.round(percent / 5)) + "─".repeat(20 - Math.round(percent / 5)))
    const fill = app.captureSpans().lines[1]!.spans[0]!
    expect(fill.fg.equals(item.color)).toBe(true)
  } finally {
    app.renderer.destroy()
  }
})
