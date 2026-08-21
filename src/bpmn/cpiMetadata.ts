import {
  kindForAlias,
  kindForParticipantType,
  type CpiVisualKind,
  type ShapeFamily,
} from './cpiCatalog'
import {
  asRecord,
  iflPropertyEntries,
  localName,
  stringValue,
  type UnknownRecord,
} from './moddleProperties'

export type { CpiVisualKind, ShapeFamily } from './cpiCatalog'

function extensionProperties(businessObject: UnknownRecord, expectedKey: string): string[] {
  const target = expectedKey.toLowerCase()
  const values: string[] = []

  for (const [key, value] of iflPropertyEntries(businessObject)) {
    if (key.trim().toLowerCase() === target) values.push(value)
  }

  return values
}

function normalizedIdentity(value: string): string {
  return value.trim().toLowerCase()
}

function classifyCoreIdentity(value: string | undefined): CpiVisualKind | undefined {
  if (value === undefined) return undefined

  return kindForAlias(normalizedIdentity(value))
}

function cnameIdentity(uri: string | undefined): string | undefined {
  if (uri === undefined) return undefined

  for (const segment of uri.split('/')) {
    const match = /^cname::(.*)$/i.exec(segment.trim())
    if (match !== null) return match[1].trim()
  }

  return undefined
}

// Scan every value of `key` in document order and return the first that maps
// to a recognized catalog kind; unrecognized values are skipped. Returns
// undefined only when the key yields no recognizable value at all, letting the
// caller fall through to the next lower-priority source.
function classifyExtensionProperty(
  businessObject: UnknownRecord,
  key: string,
  identityFromValue: (value: string) => string | undefined = value => value,
): CpiVisualKind | undefined {
  for (const value of extensionProperties(businessObject, key)) {
    const visualKind = classifyCoreIdentity(identityFromValue(value))
    if (visualKind !== undefined) return visualKind
  }

  return undefined
}

function participantType(businessObject: UnknownRecord): string | undefined {
  if (localName(businessObject.$type) !== 'participant') return undefined

  const attrs = asRecord(businessObject.$attrs)
  const attributeValue = stringValue(attrs?.['ifl:type'])
    ?? stringValue(businessObject['ifl:type'])
  if (attributeValue !== undefined) return attributeValue

  const get = businessObject.get
  if (typeof get !== 'function') return undefined

  try {
    return stringValue(get.call(businessObject, 'ifl:type'))
  } catch {
    return undefined
  }
}

function classifyParticipantIdentity(value: string | undefined,): CpiVisualKind | undefined {
  if (value === undefined) return undefined

  return kindForParticipantType(normalizedIdentity(value))
}

/**
 * Level 2 · refine an element's CPI member kind from its metadata (RFC 010 doc
 * 07 §3.4/§7). This is the authoritative kind-deciding logic; the renderer's
 * family dispatch and change-strip labels both depend on it.
 *
 * Sources are consulted in a fixed KEY priority — NOT in the order properties
 * appear in the XML:
 *   1. activityType         (ifl:property)
 *   2. cmdVariantUri        (ifl:property; the `cname::` segment is extracted first)
 *   3. subActivityType      (ifl:property)
 *   4. participant ifl:type (Sender / Receiver / IntegrationProcess)
 *
 * A source "wins" only when one of its values maps to a recognized catalog kind
 * — merely being present is not enough. Within a single key, all values are
 * scanned in document order and the first recognized one wins; unrecognized,
 * empty, or malformed values are skipped. Only when a whole key yields nothing
 * recognizable does control fall through to the next lower-priority key.
 *
 * Recognition is driven entirely by the catalog (kindForAlias /
 * kindForParticipantType); adding a member kind is a catalog edit, not a change
 * here. Metadata is read from both the element's own extensionElements and each
 * `eventDefinitions[*].extensionElements` (RFC 010 doc 07 §3.5), so error / timer
 * events whose CPI metadata is nested are classified correctly.
 */
export function classifyCpiElement(businessObject: unknown,): CpiVisualKind | undefined {
  const object = asRecord(businessObject)
  if (object === undefined) return undefined

  const activityType = classifyExtensionProperty(object, 'activityType')
  if (activityType !== undefined) return activityType

  const cmdVariant = classifyExtensionProperty(object, 'cmdVariantUri', cnameIdentity)
  if (cmdVariant !== undefined) return cmdVariant

  const subActivityType = classifyExtensionProperty(object, 'subActivityType')
  if (subActivityType !== undefined) return subActivityType

  return classifyParticipantIdentity(participantType(object))
}

/**
 * Level-1 family lookup tables, keyed by BPMN element `$type` local name
 * (lowercased). These are NOT "all BPMN 2.0 types" — they are exactly the set of
 * element types that CpiRenderer *claims*. Their closure is proven against
 * ground truth in RFC 010 doc 08:
 *
 *   universe = shape types bpmn-js can actually render
 *            = shape-drawing handler keys in bpmn-js `BpmnRenderer`
 *              (minus connections / eventDefinitions / abstract bases)
 *
 * Within the four claimed families the tables are exhaustive over that universe:
 *   - event:     all 5 renderable events (start/end/intermediateCatch/
 *                intermediateThrow/boundary). `implicitThrowEvent` exists in the
 *                metamodel but has NO notation and NO bpmn-js draw handler, so it
 *                is never rendered → correctly omitted.
 *   - gateway:   all 5 gateways.
 *   - activity:  base task + 7 task subtypes + callActivity.
 *   - container: subProcess / transaction / adHocSubProcess.
 *
 * Deliberately EXCLUDED (renderable by bpmn-js but intentionally left to the
 * default renderer, so they get no CPI outline): group, textAnnotation,
 * dataObject, dataObjectReference, dataStoreReference, lane. `participant` is
 * also absent here — it is handled by its own branch in `familyOfElement` below
 * (pool vs endpoint by `ifl:type`). Expanding these tables to cover an excluded
 * type is a product decision, not a "missing BPMN type" fix.
 */
const EVENT_ELEMENT_TYPES = new Set([
  'startevent',
  'endevent',
  'intermediatecatchevent',
  'intermediatethrowevent',
  'boundaryevent',
])

const GATEWAY_ELEMENT_TYPES = new Set([
  'exclusivegateway',
  'parallelgateway',
  'inclusivegateway',
  'complexgateway',
  'eventbasedgateway',
])

const ACTIVITY_ELEMENT_TYPES = new Set([
  'servicetask',
  'callactivity',
  'task',
  'sendtask',
  'receivetask',
  'scripttask',
  'businessruletask',
  'manualtask',
  'usertask',
])

const CONTAINER_ELEMENT_TYPES = new Set([
  'subprocess',
  'transaction',
  'adhocsubprocess',
])

/**
 * Level 1 · family from the BPMN element type — authoritative and always
 * present, independent of whether CPI metadata is recognizable (see RFC 010
 * doc 07 §3.3). Participants split into pool (IntegrationProcess) vs endpoint
 * (Endpoint*) by their `ifl:type`. Unknown element types return undefined so
 * the renderer falls back to the default bpmn-js renderer.
 */
export function familyOfElement(businessObject: unknown): ShapeFamily | undefined {
  const object = asRecord(businessObject)
  if (object === undefined) return undefined

  const type = localName(object.$type)
  if (type === undefined) return undefined

  if (EVENT_ELEMENT_TYPES.has(type)) return 'event'
  if (GATEWAY_ELEMENT_TYPES.has(type)) return 'gateway'
  if (ACTIVITY_ELEMENT_TYPES.has(type)) return 'activity'
  if (CONTAINER_ELEMENT_TYPES.has(type)) return 'container'

  if (type === 'participant') {
    const identity = participantType(object)
    const normalized = identity === undefined
      ? undefined
      : normalizedIdentity(identity)
    if (normalized === 'integrationprocess') return 'pool'
    if (normalized?.startsWith('endpoint')) return 'endpoint'
    return undefined
  }

  return undefined
}
