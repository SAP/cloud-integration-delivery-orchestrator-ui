import type { CpiVisualKind } from './cpiMetadata'
import { create } from 'tiny-svg'

import javascriptIcon from '@/assets/JavaScript.gif'
import sendIcon from '@/assets/Send.gif'
import processIcon from '@/assets/Process.gif'

/**
 * Maps CPI visual kinds to their icon image URLs.
 * Router has no icon. Sender/Receiver have no icon (until gif files are provided).
 */
const iconImageUrl: Partial<Record<CpiVisualKind, string>> = {
  ContentModifier: javascriptIcon, // placeholder until Enricher.gif
  Script: javascriptIcon,
  Send: sendIcon,
  RequestReply: sendIcon, // placeholder until ExternalCall.gif
  IntegrationProcess: processIcon,
}

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

export function createCpiIconSymbol(kind: CpiVisualKind): SVGGElement | null {
  if (kind === 'Router' || kind === 'Sender' || kind === 'Receiver') return null

  const url = iconImageUrl[kind]
  if (!url) return null

  return createImageIcon(url)
}

function createImageIcon(url: string): SVGGElement {
  const group = create('g', {
    class: 'cpi-icon-symbol',
    'aria-hidden': 'true',
  })

  const image = create('image', {
    href: url,
    x: 0,
    y: 0,
    width: 16,
    height: 16,
  })
  image.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  group.appendChild(image)

  return group
}
