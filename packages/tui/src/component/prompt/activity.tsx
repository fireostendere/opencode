import type { RGBA } from "@opentui/core"
import { createMemo, createSignal, onCleanup, Show } from "solid-js"
import { useData } from "../../context/data"
import { tint } from "../../theme/color"
import { MOTION_STEP } from "../../ui/motion"
import { formatElapsed, sessionActivity } from "../../util/activity"
import { SPINNER_FRAMES } from "../spinner-frames"
import "../spinner-renderable"

// A breath is three turns of the spinner (2.4 s): the glyph brightens and dims while it turns.
const BREATH = SPINNER_FRAMES.length * 3
const FRAMES = Array.from({ length: BREATH }, (_, index) => SPINNER_FRAMES[index % SPINNER_FRAMES.length]!)

/**
 * The running indicator under the prompt: one breathing glyph, what the agent is doing, and how long the run has
 * taken. Only the glyph moves, so a running session redraws one cell per motion tick and one clock per second.
 */
export function PromptActivity(props: {
  sessionID: string
  color: RGBA
  muted: RGBA
  animations: boolean
}) {
  const data = useData()
  const activity = createMemo(() => sessionActivity(data.session.message.list(props.sessionID)))
  const [now, setNow] = createSignal(Date.now())
  const clock = setInterval(() => setNow(Date.now()), 1_000)
  onCleanup(() => clearInterval(clock))
  const elapsed = createMemo(() => {
    const since = activity().since
    return since === undefined ? undefined : formatElapsed(now() - since)
  })
  const palette = createMemo(() =>
    FRAMES.map((_, index) => tint(props.muted, props.color, 0.55 + 0.45 * Math.cos((index / BREATH) * Math.PI * 2))),
  )

  return (
    <box flexDirection="row" gap={1} flexShrink={1} minWidth={0}>
      <box width={1} flexShrink={0}>
        <Show when={props.animations} fallback={<text fg={props.color}>•</text>}>
          <spinner frames={FRAMES} interval={MOTION_STEP} color={(frame: number) => palette()[frame]!} />
        </Show>
      </box>
      <text fg={props.color} wrapMode="none" truncate flexShrink={1} minWidth={0}>
        {activity().label}
        <Show when={elapsed()}>
          {(value) => <span style={{ fg: props.muted }}> · {value()}</span>}
        </Show>
      </text>
    </box>
  )
}
