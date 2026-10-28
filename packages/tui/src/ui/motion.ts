import { CliRenderer, type RenderContext, type TimerHandle } from "@opentui/core"
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js"

// Looping animations (spinners, sweeps, shimmers) run on one shared motion clock per renderer.
// Every animating node asks for the next tick from onUpdate; one timer then requests one frame that
// carries all of them. Motion time advances one STEP per tick, so a blurred terminal (another VS Code
// terminal tab, another window) simply plays the same motion in slow motion at one tick per second:
// it still looks alive, and costs a twelfth of the redraws.
export const MOTION_STEP = 80
const BLURRED_STEP = 1_000

const [focused, setFocused] = createSignal(true)
/** Whether the terminal has keyboard focus, as reported by focus events (assumed focused until told otherwise). */
export const terminalFocused = focused

export class Motion {
  private ticks = 0
  private timer: TimerHandle | undefined
  private readonly wanters = new Set<object>()
  private readonly listeners = new Set<() => void>()

  constructor(private readonly renderer: CliRenderer) {
    renderer.on("focus", () => this.focus(true))
    renderer.on("blur", () => this.focus(false))
  }

  /** Motion time in milliseconds: advances by MOTION_STEP per tick, whatever the wall-clock cadence. */
  get time() {
    return this.ticks * MOTION_STEP
  }

  /** Ask for one more tick. Animating nodes call this from every update while they animate. */
  want(node: object) {
    this.wanters.add(node)
    this.schedule()
  }

  /** Withdraw a node's request, e.g. when it is destroyed; the last withdrawal cancels the tick. */
  release(node: object) {
    this.wanters.delete(node)
    if (this.wanters.size === 0 && this.listeners.size === 0) this.cancel()
  }

  /** Run a callback on every tick until the returned function is called. For reactive (non-node) animations. */
  listen(listener: () => void) {
    this.listeners.add(listener)
    this.schedule()
    return () => {
      this.listeners.delete(listener)
      if (this.wanters.size === 0 && this.listeners.size === 0) this.cancel()
    }
  }

  private schedule() {
    if (this.timer !== undefined) return
    this.timer = this.renderer.clock.setTimeout(this.tick, focused() ? MOTION_STEP : BLURRED_STEP)
  }

  private cancel() {
    if (this.timer === undefined) return
    this.renderer.clock.clearTimeout(this.timer)
    this.timer = undefined
  }

  private tick = () => {
    this.timer = undefined
    this.wanters.clear()
    this.ticks++
    for (const listener of this.listeners) listener()
    if (this.listeners.size > 0) this.schedule()
    this.renderer.requestRender()
  }

  private focus(value: boolean) {
    if (value === focused()) return
    setFocused(value)
    // Reschedule a pending tick at the new cadence.
    if (this.timer === undefined) return
    this.cancel()
    this.schedule()
  }
}

/** Motion time as a signal, ticking only while `active` holds. */
export function createMotionTime(renderer: CliRenderer, active: Accessor<boolean>) {
  const motion = motionFor(renderer)
  const [time, setTime] = createSignal(motion.time)
  createEffect(() => {
    if (!active()) return
    onCleanup(motion.listen(() => setTime(motion.time)))
  })
  return time
}

const motions = new WeakMap<CliRenderer, Motion>()

export function motionFor(ctx: RenderContext | CliRenderer) {
  if (!(ctx instanceof CliRenderer)) throw new Error("Motion requires a CLI renderer")
  let motion = motions.get(ctx)
  if (!motion) motions.set(ctx, (motion = new Motion(ctx)))
  return motion
}
