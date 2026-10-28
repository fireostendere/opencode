import { Plugin } from "@opencode/plugin/tui"
import type { BoxRenderable, RGBA } from "@opentui/core"
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { useAnimations } from "../../config"
import { createAnimatable, tween } from "../../ui/animation"
import { contextUsage } from "../../util/session"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

/** A one-row fill meter: a heavy rule for the used share, a light rule for the rest. The fill eases to new values. */
export function UsageMeter(props: { percent: number; fill: RGBA; track: RGBA }) {
  const animations = useAnimations()
  const [width, setWidth] = createSignal(0)
  const motion = createAnimatable({ percent: props.percent }, { enabled: animations, transition: tween({ duration: 0.6 }) })
  createEffect(() => motion.animate({ percent: props.percent }))
  const filled = createMemo(() => Math.max(0, Math.min(width(), Math.round((motion.value().percent / 100) * width()))))
  return (
    <box
      height={1}
      flexGrow={1}
      onSizeChange={function (this: BoxRenderable) {
        setWidth(this.width)
      }}
    >
      <text wrapMode="none">
        <span style={{ fg: props.fill }}>{"━".repeat(filled())}</span>
        <span style={{ fg: props.track }}>{"─".repeat(width() - filled())}</span>
      </text>
    </box>
  )
}

export function SidebarContext(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const msg = createMemo(() => props.context.data.session.message.list(props.sessionID))
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const cost = createMemo(() => props.context.data.session.cost(props.sessionID))

  const state = createMemo(() =>
    contextUsage(msg(), props.context.data.location.model.list(session()?.location), session()?.revert?.messageID),
  )
  // Calm while the window has room: green, amber past 60%, red past 85% where compaction is near.
  const level = (percent: number) => {
    if (percent >= 85) return theme.text.feedback.error.base
    if (percent >= 60) return theme.text.feedback.warning.base
    return theme.text.feedback.success.base
  }
  const details = createMemo(() => {
    const tokens = state()?.tokens
    return [tokens && `${tokens.toLocaleString()} tokens`, cost() > 0 && `${money.format(cost())} spent`]
      .filter(Boolean)
      .join(" · ")
  })

  return (
    <Show when={state() || cost() > 0}>
      <box>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text.base}>
            <b>Context</b>
          </text>
          <Show when={state()?.percent}>{(percent) => <text fg={level(percent())}>{percent()}%</text>}</Show>
        </box>
        <Show when={state()?.percent}>
          {(percent) => <UsageMeter percent={percent()} fill={level(percent())} track={theme.border.base} />}
        </Show>
        <text fg={theme.text.muted} wrapMode="none" truncate>
          {details()}
        </text>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "opencode.sidebar.context",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarContext context={context} sessionID={props.sessionID} />,
    })
  },
})
