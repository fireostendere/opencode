import { parseColor, RGBA, type ColorInput } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { oneCellFrame, type OneCellMotion } from "../ui/one-cell-motion"
import { motionFor } from "../ui/motion"
import "./spinner-renderable"

export function OneCellSpinner(props: {
  animation: OneCellMotion
  color: ColorInput
  animations?: boolean
  speed?: number
  paused?: boolean
  glow?: boolean
  age?: number
  still?: string
}) {
  const renderer = useRenderer()
  const [elapsed, setElapsed] = createSignal(0)
  const sequenced = () => !!props.animation.intro || !!props.animation.once || !!props.animation.pace
  const frame = createMemo(() => oneCellFrame(props.animation, elapsed()))
  const complete = createMemo(() => frame().complete)
  const base = createMemo(() => parseColor(props.color))
  const color = createMemo(() => {
    if (props.glow === false) return base()
    if (sequenced()) {
      const color = RGBA.clone(base())
      color.a *= frame().level
      return color
    }
    const palette = props.animation.levels?.map((level) => {
      const color = RGBA.clone(base())
      color.a *= level
      return color
    })
    return palette ? (frame: number) => palette[frame]! : base()
  })

  createEffect(() => {
    props.animation
    props.animations
    setElapsed(props.age ?? 0)
  })
  createEffect(() => {
    if (!sequenced() || props.animations === false || props.paused || complete()) return
    // Step on the shared motion clock; its timer leaves the idle gaps mini awaits with renderer.idle().
    const motion = motionFor(renderer)
    let previous = motion.time
    const stop = motion.listen(() => {
      setElapsed((value) => value + (motion.time - previous) * (props.speed ?? 1))
      previous = motion.time
    })
    onCleanup(() => {
      stop()
      renderer.requestRender()
    })
  })

  return (
    <box width={1} height={1} flexShrink={0}>
      <Show when={props.animations !== false} fallback={<text fg={base()}>{props.still ?? "\u25aa"}</text>}>
        <spinner
          frames={sequenced() ? [frame().glyph] : props.animation.frames}
          interval={props.animation.interval / (props.speed ?? 1)}
          autoplay={!props.paused && !sequenced()}
          color={color()}
        />
      </Show>
    </box>
  )
}
