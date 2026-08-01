import type { CpiVisualKind } from './cpiMetadata'
import { append, create } from 'tiny-svg'

type IconElementName = 'circle' | 'line' | 'path' | 'polyline' | 'rect'

interface IconElementDefinition {
  readonly name: IconElementName
  readonly attributes: Readonly<Record<string, string | number>>
}

type CpiIconDefinitions = Readonly<
  Record<CpiVisualKind, readonly IconElementDefinition[]>
>

export const CPI_ICON_KINDS = [
  'ContentModifier',
  'Script',
  'Router',
  'Send',
  'RequestReply',
  'Sender',
  'Receiver',
  'IntegrationProcess',
] as const satisfies readonly CpiVisualKind[]

// These compact symbols are original geometric compositions. They deliberately
// avoid product icon fonts and vendor SVG paths so the renderer is self-contained.
export const CPI_ICON_DEFINITIONS: CpiIconDefinitions = {
  ContentModifier: [
    { name: 'rect', attributes: { x: 5, y: 4, width: 14, height: 16, rx: 2 } },
    { name: 'path', attributes: { d: 'M8 9h8M8 13h5M8 17h7' } },
  ],
  Script: [
    { name: 'path', attributes: { d: 'M8 4h9l-3 4 3 4-3 4 3 4H8' } },
    { name: 'line', attributes: { x1: 6, y1: 4, x2: 6, y2: 20 } },
  ],
  Router: [
    { name: 'path', attributes: { d: 'M12 3l9 9-9 9-9-9z' } },
    { name: 'path', attributes: { d: 'M7 12h4m2 0h4M12 7v10' } },
  ],
  Send: [
    { name: 'path', attributes: { d: 'M3 7h12v10H3zM3 8l6 5 6-5' } },
    { name: 'path', attributes: { d: 'M13 4h8m-3-3 3 3-3 3' } },
  ],
  RequestReply: [
    { name: 'path', attributes: { d: 'M4 7h15m-4-4 4 4-4 4' } },
    { name: 'path', attributes: { d: 'M20 17H5m4-4-4 4 4 4' } },
    { name: 'circle', attributes: { cx: 12, cy: 12, r: 2 } },
  ],
  Sender: [
    { name: 'circle', attributes: { cx: 9, cy: 12, r: 6 } },
    { name: 'path', attributes: { d: 'M12 12h9m-4-4 4 4-4 4' } },
  ],
  Receiver: [
    { name: 'circle', attributes: { cx: 15, cy: 12, r: 6 } },
    { name: 'path', attributes: { d: 'M12 12H3m4-4-4 4 4 4' } },
  ],
  IntegrationProcess: [
    { name: 'rect', attributes: { x: 3, y: 5, width: 7, height: 5, rx: 1 } },
    { name: 'rect', attributes: { x: 14, y: 14, width: 7, height: 5, rx: 1 } },
    { name: 'path', attributes: { d: 'M10 7.5h4a3 3 0 0 1 3 3V14' } },
    { name: 'path', attributes: { d: 'M14 12l3 2 3-2' } },
  ],
}

export function createCpiIconSymbol(kind: CpiVisualKind): SVGGElement {
  const symbol = create('g', {
    class: 'cpi-icon-symbol',
    'data-cpi-symbol': kind,
  })
  symbol.setAttribute('fill', 'none')
  symbol.setAttribute('stroke', 'currentColor')
  symbol.setAttribute('stroke-width', '1.75')
  symbol.setAttribute('stroke-linecap', 'round')
  symbol.setAttribute('stroke-linejoin', 'round')

  for (const definition of CPI_ICON_DEFINITIONS[kind]) {
    append(symbol, create(definition.name, definition.attributes))
  }

  return symbol
}
