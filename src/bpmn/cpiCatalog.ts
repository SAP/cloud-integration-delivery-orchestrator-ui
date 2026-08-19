import javascriptIcon from '@/assets/JavaScript.gif'
import sendIcon from '@/assets/Send.gif'
import processIcon from '@/assets/Process.gif'
import systemIcon from '@/assets/System.gif'
import decoderIcon from '@/assets/Decoder.gif'
import externalCallIcon from '@/assets/ExternalCall.gif'
import encoderIcon from '@/assets/Encoder.gif'
import processCallIcon from '@/assets/ProcessCall.gif' 
import mappingIcon from '@/assets/Mapping.gif'
import contentEnricherIcon from '@/assets/ContentEnricher.gif'

/**
 * The six shape families every CPI component renders into. Families are a closed
 * set (framework-defined); members are open (extended over time). See RFC 010
 * doc 07 §3.2.
 */
export type ShapeFamily =
  | 'activity'
  | 'endpoint'
  | 'pool'
  | 'gateway'
  | 'event'
  | 'container'

/** Recognized CPI visual kinds (open set, extended one member at a time). */
export type CpiVisualKind =
  | 'ContentModifier'
  | 'Script'
  | 'Router'
  | 'Send'
  | 'ExternalCall'
  | 'RequestReply'
  | 'Decoder'
  | 'Encoder'
  | 'Mapping'
  | 'ContentEnricher'
  | 'Sender'
  | 'Receiver'
  | 'IntegrationProcess'
  | 'MessageStartEvent'
  | 'StartEvent'
  | 'ErrorStartEvent'
  | 'StartTimerEvent'
  | 'MessageEndEvent'
  | 'EndEvent'
  | 'ProcessCall'

/**
 * Single source of truth for one member kind: its family, the metadata aliases
 * that refine it, and its icon asset. Classification refinement, icon lookup and
 * family lookup are all derived from the catalog. See RFC 010 doc 07 §4.
 */
export interface CpiComponentSpec {
  kind: CpiVisualKind
  family: ShapeFamily
  /**
   * Recognizable activityType / cmdVariant cname / subActivityType values
   * (lowercased), used to refine activity/pool members.
   */
  aliases?: string[]
  /**
   * Recognizable participant `ifl:type` values (lowercased), used to refine
   * endpoint/pool members.
   */
  participantTypes?: string[]
  /** Icon asset URL; absent means no badge is drawn for this kind. */
  icon?: string
}

export const CPI_COMPONENT_CATALOG: readonly CpiComponentSpec[] = [
  {
    kind: 'ContentModifier',
    family: 'activity',
    aliases: ['enricher', 'contentmodifier'],
  },
  {
    kind: 'Script',
    family: 'activity',
    aliases: ['script', 'groovyscript', 'javascript'],
    icon: javascriptIcon,
  },
  {
    kind: 'Send',
    family: 'activity',
    aliases: ['send'],
    icon: sendIcon,
  },
  {
    kind: 'ExternalCall',
    family: 'activity',
    aliases: ['externalcall'],
    icon: externalCallIcon,
  },
  {
    kind: 'ProcessCall',
    family: 'activity',
    aliases: ['nonloopingprocess', 'processcallelement', 'idempotentprocesscall'],
    icon: processCallIcon,
  },
  {
    kind: 'RequestReply',
    family: 'activity',
    aliases: ['requestreply'],
  },
  {
    // Decoder covers all decoder variants (Base64 Decode, GZIP Decompress, …):
    // they share activityType=Decoder (authoritative), which alone classifies
    // the element; the cmdVariant cname (e.g. `Base64 Decode`) is a defensive
    // fallback for samples that omit activityType.
    kind: 'Decoder',
    family: 'activity',
    aliases: ['decoder', 'base64 decode'],
    icon: decoderIcon,
  },
  {
    kind: 'Encoder',
    family: 'activity',
    aliases: ['encoder'],
    icon: encoderIcon,
  },
  {
    kind: 'Mapping',
    family: 'activity',
    aliases: ['mapping', 'messagemapping'],
    icon: mappingIcon,
  },
  {
    kind: 'ContentEnricher',
    family: 'activity',
    aliases: ['contentenricherwithlookup', 'pollenrich'],
    icon: contentEnricherIcon,
  },
  {
    kind: 'Router',
    family: 'gateway',
    aliases: ['exclusivegateway', 'router'],
  },
  {
    kind: 'Sender',
    family: 'endpoint',
    participantTypes: ['endpointsender'],
    icon: systemIcon,
  },
  {
    kind: 'Receiver',
    family: 'endpoint',
    participantTypes: ['endpointreceiver', 'endpointrecevier'],
    icon: systemIcon,
  },
  {
    kind: 'IntegrationProcess',
    family: 'pool',
    aliases: ['integrationprocess'],
    participantTypes: ['integrationprocess'],
    icon: processIcon,
  },
  // Event members refine the change-strip label / diff category only; the glyph
  // (envelope / bolt / clock) and start/end border are drawn by the default
  // bpmn-js renderer, so event kinds carry no icon (RFC 010 doc 07 §3.5). The
  // recognizable values are CPI activityType / cmdVariant cname; error and timer
  // events keep them nested under their eventDefinition (scanned by cpiMetadata).
  {
    kind: 'MessageStartEvent',
    family: 'event',
    aliases: ['messagestartevent'],
  },
  {
    kind: 'StartEvent',
    family: 'event',
    aliases: ['startevent'],
  },
  {
    kind: 'ErrorStartEvent',
    family: 'event',
    aliases: ['errorstartevent', 'starterrorevent'],
  },
  {
    kind: 'StartTimerEvent',
    family: 'event',
    aliases: ['starttimerevent', 'intermediatetimer'],
  },
  {
    kind: 'MessageEndEvent',
    family: 'event',
    aliases: ['messageendevent'],
  },
  {
    kind: 'EndEvent',
    family: 'event',
    aliases: ['endevent'],
  },
]

const aliasIndex = new Map<string, CpiVisualKind>()
const participantIndex = new Map<string, CpiVisualKind>()
const familyByKind = new Map<CpiVisualKind, ShapeFamily>()
const iconByKind = new Map<CpiVisualKind, string>()

for (const spec of CPI_COMPONENT_CATALOG) {
  familyByKind.set(spec.kind, spec.family)
  if (spec.icon !== undefined) iconByKind.set(spec.kind, spec.icon)
  for (const alias of spec.aliases ?? []) aliasIndex.set(alias, spec.kind)
  for (const type of spec.participantTypes ?? []) participantIndex.set(type, spec.kind)
}

/** Resolves an activity/pool alias (already normalized, lowercased) to a kind. */
export function kindForAlias(alias: string): CpiVisualKind | undefined {
  return aliasIndex.get(alias)
}

/** Resolves a participant `ifl:type` (already normalized, lowercased) to a kind. */
export function kindForParticipantType(type: string): CpiVisualKind | undefined {
  return participantIndex.get(type)
}

/** Family of a recognized member kind. Every catalog kind has a family. */
export function familyOf(kind: CpiVisualKind): ShapeFamily {
  return familyByKind.get(kind) as ShapeFamily
}

/** Icon asset URL for a kind, or undefined when it has no dedicated asset. */
export function iconOf(kind: CpiVisualKind): string | undefined {
  return iconByKind.get(kind)
}
