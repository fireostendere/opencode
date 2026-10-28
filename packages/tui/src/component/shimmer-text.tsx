import { RGBA, type OptimizedBuffer, type RenderContext, type TextOptions } from "@opentui/core"
import { extend, type JSX } from "@opentui/solid"
import { splitProps } from "solid-js"
import { MaskedTextRenderable } from "./masked-text"
import { coast, intensityAt } from "./tab-pulse"
import { motionFor, type Motion } from "../ui/motion"

type ShimmerTextOptions = TextOptions & {
  shimmer: RGBA
}

const DURATION = 1200

// Not live: the sweep follows the shared motion clock, so it steps with every other animation on screen.
class ShimmerTextRenderable extends MaskedTextRenderable {
  private _shimmer = RGBA.defaultForeground()
  private readonly motion: Motion

  constructor(ctx: RenderContext, options: ShimmerTextOptions) {
    super(ctx, options)
    this.matrix[3] = this._shimmer.r
    this.matrix[7] = this._shimmer.g
    this.matrix[11] = this._shimmer.b
    this.matrix[15] = 1
    if (options.shimmer) this.shimmer = options.shimmer
    this.motion = motionFor(ctx)
  }

  set shimmer(value: RGBA) {
    if (value.equals(this._shimmer)) return
    this._shimmer = value
    this.matrix[3] = value.r
    this.matrix[7] = value.g
    this.matrix[11] = value.b
    this.requestRender()
  }

  protected override onUpdate() {
    this.motion.want(this)
  }

  protected override destroySelf() {
    this.motion.release(this)
    super.destroySelf()
  }

  protected override renderSelf(buffer: OptimizedBuffer) {
    if (!this.visible || this.isDestroyed || !Number.isFinite(this.width) || this.width <= 0 || this.height <= 0) return
    const elapsed = this.motion.time % DURATION
    this.renderMasked(buffer, 0, (end) => {
      const front = -4 + coast(elapsed / DURATION) * (end + 22)
      return (column) => intensityAt(column, front, 4, 18)
    })
  }
}

extend({ shimmer_text: ShimmerTextRenderable })

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    shimmer_text: typeof ShimmerTextRenderable
  }
}

type Props = Omit<JSX.IntrinsicElements["text"], "ref"> & { shimmer: RGBA }

export function ShimmerText(props: Props) {
  const [local, text] = splitProps(props, ["shimmer"])
  return <shimmer_text {...text} shimmer={local.shimmer} />
}
