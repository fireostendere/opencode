import { CliRenderer, type RenderContext, type TimerHandle } from "@opentui/core"
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js"

// Looping animations (spinners, sweeps, shimmers) run on one shared motion clock per renderer.
// Every animating node asks for the next tick from onUpdate; one timer then requests one frame that
// carries all of them, at a steady 12.5 fps. Focus does not change the cadence: an unfocused terminal
// is often still on screen (a split, the editor or chat focused beside it), and terminals already skip
// rendering a hidden tab.
export const MOTION_STEP = 80

export class Motion {
  private ticks = 0
  private timer: TimerHandle | undefined
  private readonly wanters = new Set<object>()
  private readonly listeners = new Set<() => void>()

  constructor(private readonly renderer: CliRenderer) {}

  /** Motion time in milliseconds: advances by MOTION_STEP per tick. */
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
    this.timer = this.renderer.clock.setTimeout(this.tick, MOTION_STEP)
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
