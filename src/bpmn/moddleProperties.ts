/**
 * Shared moddle traversal helpers for reading CPI `ifl:property` metadata off
 * bpmn-moddle business objects. Consumed by both `cpiMetadata.ts` (Level-2 kind
 * classification) and `diff.ts` (Tier-2 property diff), which previously carried
 * their own duplicate copies of `asRecord`, the extension-source scan, and the
 * property-part reader (RFC 010 doc 10 §refactor).
 */

export type UnknownRecord = Record<string, unknown>

export function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object'
    ? value as UnknownRecord
    : undefined
}

export function localName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.split(':').at(-1)?.toLowerCase()
}

/**
 * Read a scalar out of a moddle value in its primitive (`'30'`) or wrapped
 * (`{ $body: '30' }` / `{ value: '30' }`) form.
 */
export function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value

  const object = asRecord(value)
  if (object === undefined) return undefined
  if (typeof object.$body === 'string') return object.$body
  if (typeof object.value === 'string') return object.value
  return undefined
}

function childValue(property: UnknownRecord, childName: 'key' | 'value'): string | undefined {
  if (!Array.isArray(property.$children)) return undefined

  for (const child of property.$children) {
    const object = asRecord(child)
    if (object === undefined || localName(object.$type) !== childName) continue

    const value = stringValue(object)
    if (value !== undefined) return value
  }

  return undefined
}

/**
 * Read the `key` or `value` of a single `ifl:property`, tolerating all three
 * moddle shapes: primitive (`{ key: 'x', value: 'y' }`), wrapped
 * (`{ key: { $body: 'x' } }`), and `$children`
 * (`<ifl:key>x</ifl:key><ifl:value>y</ifl:value>`).
 */
export function readPropertyPart(property: UnknownRecord, part: 'key' | 'value'): string | undefined {
  return stringValue(property[part]) ?? childValue(property, part)
}

/**
 * Extension-element sources to scan for `ifl:property` members, in fixed source
 * priority:
 *   1. the element's own `extensionElements`
 *   2. each `eventDefinitions[*].extensionElements` — error / timer events keep
 *      their CPI metadata nested under the eventDefinition (RFC 010 doc 07 §3.5)
 *   3. `processRef.extensionElements` — a participant's Local Integration Process
 *      keeps metadata on the referenced process, not the participant (doc 07 §3.1)
 *
 * Non-event, non-participant elements only ever contribute source (1); (2) and
 * (3) are no-ops for them.
 */
export function extensionSources(businessObject: UnknownRecord): UnknownRecord[] {
  const sources: UnknownRecord[] = []

  const direct = asRecord(businessObject.extensionElements)
  if (direct !== undefined) sources.push(direct)

  if (Array.isArray(businessObject.eventDefinitions)) {
    for (const definition of businessObject.eventDefinitions) {
      const nested = asRecord(asRecord(definition)?.extensionElements)
      if (nested !== undefined) sources.push(nested)
    }
  }

  const processRef = asRecord(businessObject.processRef)
  if (processRef !== undefined) {
    const processExt = asRecord(processRef.extensionElements)
    if (processExt !== undefined) sources.push(processExt)
  }

  return sources
}

/**
 * Extract every `ifl:property` as an ordered `[key, value]` pair, scanning all
 * extension sources in source priority and preserving document order within
 * each source. Pairs are returned as a list (not a Map) so callers that need
 * document-order value scanning or duplicate keys keep that information; callers
 * wanting a collapsed lookup can build `new Map(entries)` (last write wins).
 */
export function iflPropertyEntries(element: unknown): Array<[string, string]> {
  const object = asRecord(element)
  if (object === undefined) return []

  const entries: Array<[string, string]> = []

  for (const source of extensionSources(object)) {
    const candidates = [
      ...(Array.isArray(source.values) ? source.values : []),
      ...(Array.isArray(source.$children) ? source.$children : []),
    ]

    for (const candidate of candidates) {
      const property = asRecord(candidate)
      if (property === undefined) continue

      const key = readPropertyPart(property, 'key')
      const value = readPropertyPart(property, 'value')
      if (key !== undefined && value !== undefined) {
        entries.push([key, value])
      }
    }
  }

  return entries
}
