/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { ManualClock } from "@opentui/core/testing"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import { ShimmerText } from "../../src/component/shimmer-text"
import "../../src/component/title-shimmer"

test("shimmer text paints its masked content", async () => {
  await using app = await testRender(
    () => <ShimmerText shimmer={RGBA.fromHex("#ff0000")} content="Checking for updates" />,
    { width: 30, height: 2 },
  )
  await app.renderOnce()
  expect(app.captureCharFrame()).toContain("Checking for updates")
})

test("title shimmer paints while pending and through the rename wipe", async () => {
  const clock = new ManualClock()
  const [title, setTitle] = createSignal("Untitled session")
  const [pending, setPending] = createSignal(true)
  await using app = await testRender(
    () => <title_shimmer content={title()} rename={{ title: title(), pending: pending() }} />,
    { width: 30, height: 2, clock },
  )
  await app.renderOnce()
  expect(app.captureCharFrame()).toContain("Untitled session")

  setTitle("Generated title")
  setPending(false)
  await app.renderOnce()
  expect(app.captureCharFrame()).toContain("Untitled session")
  // The wipe steps on motion ticks, each drawn as its own frame.
  for (let elapsed = 0; elapsed < 500; elapsed += 80) {
    clock.advance(80)
    await app.renderOnce()
  }
  expect(app.captureCharFrame()).toContain("Generated title")
  expect(clock.pendingTimerCount).toBe(0)
})
