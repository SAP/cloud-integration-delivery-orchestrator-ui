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
import signerIcon from '@/assets/Signer.gif'
import decryptorIcon from '@/assets/Decryptor.gif'
import verifierIcon from '@/assets/Verifier.gif'
import xmlDigitalVerifySignIcon from '@/assets/XMLDigitalVerifySign.gif'
import encryptorIcon from '@/assets/Encryptor.gif'
import messageDigestIcon from '@/assets/MessageDigest.gif'
import splitterIcon from '@/assets/Splitter.gif'
import persistIcon from '@/assets/Persist.gif'
import dataStoreOperationIcon from '@/assets/DataStoreOperation.gif'
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
  | 'Signer'
  | 'Verifier'
  | 'XMLDigitalVerifySign'
  | 'Mapping'
  | 'ContentEnricher'
  | 'Multicast'
  | 'SequentialMulticast'
  | 'Join'
  | 'Sender'
  | 'Receiver'
  | 'IntegrationProcess'
  | 'MessageStartEvent'
  | 'StartEvent'
  | 'ErrorStartEvent'
  | 'StartTimerEvent'
  | 'MessageEndEvent'
  | 'ErrorEndEvent'
  | 'EndEvent'
  | 'ProcessCall'
  | 'Decryptor'
  | 'Encryptor'
  | 'MessageDigest'
  | 'Splitter'
  | 'Persist'
  | 'DataStoreOperation'
  | 'ExceptionSubprocess'

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
  /**
   * SAPBPMN font glyph character for gateway internal markers. Rendered at
   * the diamond center when present. Absent means no internal marker.
   */
  marker?: string
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
    kind: 'Signer',
    family: 'activity',
    aliases: ['simplesignmessage', 'signmessage'],
    icon: signerIcon,
  },
  {
    kind: 'Verifier',
    family: 'activity',
    aliases: ['verifysign'],
    icon: verifierIcon,
  },
  {
    kind: 'XMLDigitalVerifySign',
    family: 'activity',
    aliases: ['xmldigitalverifysign'],
    icon: xmlDigitalVerifySignIcon,
  },
  {
    kind: 'Decryptor',
    family: 'activity',
    aliases: ['decrypt', 'pgpdecrypt'],
    icon: decryptorIcon,
  },
  {
    kind: 'Encryptor',
    family: 'activity',
    aliases: ['pgpencrypt', 'encrypt'],
    icon: encryptorIcon,
  },
  {
    kind: 'MessageDigest',
    family: 'activity',
    aliases: ['messagedigest'],
    icon: messageDigestIcon,
  },
  {
    kind: 'Splitter',
    family: 'activity',
    aliases: ['splitter'],
    icon: splitterIcon,
  },
  {
    kind: 'Persist',
    family: 'activity',
    aliases: ['persist'],
    icon: persistIcon,
  },
  {
    kind: 'DataStoreOperation',
    family: 'activity',
    aliases: ['dbstorage', 'variables'],
    icon: dataStoreOperationIcon,
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
    kind: 'Multicast',
    family: 'gateway',
    aliases: ['multicast'],
    marker: '\uE030',
  },
  {
    kind: 'SequentialMulticast',
    family: 'gateway',
    aliases: ['sequentialmulticast'],
    marker: '\uE030',
  },
  {
    kind: 'Join',
    family: 'gateway',
    aliases: ['join'],
    marker: '\uE030',
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
  {
    kind: 'ExceptionSubprocess',
    family: 'container',
    aliases: ['erroreventsubprocesstemplate'],
  },
  // Event members: the `marker` field drives the SAPBPMN trigger glyph inside
  // the event circle (e.g. envelope for message events). Events without a marker
  // render as plain circles (e.g. none start/end events). The stroke-width
  // (start=1, end=3) is determined by element type in drawEvent, not by kind.
  {
    kind: 'MessageStartEvent',
    family: 'event',
    aliases: ['messagestartevent'],
    marker: '\uE001',
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
    marker: '\uE020',
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
    marker: '\uE002',
  },
  {
    kind: 'ErrorEndEvent',
    family: 'event',
    aliases: ['errorendevent'],
    marker: '\uE021',
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
const markerByKind = new Map<CpiVisualKind, string>()

for (const spec of CPI_COMPONENT_CATALOG) {
  familyByKind.set(spec.kind, spec.family)
  if (spec.icon !== undefined) iconByKind.set(spec.kind, spec.icon)
  if (spec.marker !== undefined) markerByKind.set(spec.kind, spec.marker)
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

/** SAPBPMN marker glyph for a kind, or undefined when it has no internal marker. */
export function markerOf(kind: CpiVisualKind): string | undefined {
  return markerByKind.get(kind)
}
