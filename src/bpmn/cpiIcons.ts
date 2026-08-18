import { iconOf, type CpiVisualKind } from './cpiCatalog'
import { append, create } from 'tiny-svg'

/**
 * Creates an SVG <image> for a CPI icon at absolute coordinates, matching how
 * SAP CPI itself renders icons: a plain <image> at a fixed position/size, no
 * scaling.
 */
function createIconImage(
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
): SVGImageElement {
  const image = create('image', { href: url, x, y, width, height }) as SVGImageElement
  image.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  return image
}

/**
 * Builds an icon badge group at absolute coordinates. Returns null when the
 * kind is unknown (unrecognized member) or has no dedicated asset
 * (ContentModifier / RequestReply / Router), so the shape renders with no
 * misleading borrowed icon. Callers own the geometry — activity badges use
 * 16×16 at (2,3), participant endpoints use 16×14 at (5,10) — exactly as in
 * CPI's own DOM.
 */
export function createIconGroup(
  kind: CpiVisualKind | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): SVGGElement | null {
  if (kind === undefined) return null

  const url = iconOf(kind)
  if (!url) return null

  const group = create('g', {
    class: 'cpi-shape-icon',
    'data-cpi-kind': kind,
    'aria-hidden': 'true',
    focusable: 'false',
  })
  group.setAttribute('pointer-events', 'none')
  append(group, createIconImage(url, x, y, width, height))
  return group
}
