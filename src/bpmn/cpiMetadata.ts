export type CpiVisualKind =
  | 'ContentModifier'
  | 'Script'
  | 'Router'
  | 'Send'
  | 'RequestReply'
  | 'Sender'
  | 'Receiver'
  | 'IntegrationProcess'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object'
    ? value as UnknownRecord
    : undefined
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value

  const object = asRecord(value)
  if (object === undefined) return undefined
  if (typeof object.$body === 'string') return object.$body
  if (typeof object.value === 'string') return object.value
  return undefined
}

function localName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.split(':').at(-1)?.toLowerCase()
}

function childValue(
  property: UnknownRecord,
  childName: 'key' | 'value',
): string | undefined {
  if (!Array.isArray(property.$children)) return undefined

  for (const child of property.$children) {
    const object = asRecord(child)
    if (object === undefined || localName(object.$type) !== childName) continue

    const value = stringValue(object)
    if (value !== undefined) return value
  }

  return undefined
}

function propertyPart(
  property: UnknownRecord,
  part: 'key' | 'value',
): string | undefined {
  return stringValue(property[part]) ?? childValue(property, part)
}

function extensionProperties(
  businessObject: UnknownRecord,
  expectedKey: string,
): string[] {
  const extensionElements = asRecord(businessObject.extensionElements)
  if (extensionElements === undefined) return []

  const candidates = [
    ...(Array.isArray(extensionElements.values) ? extensionElements.values : []),
    ...(Array.isArray(extensionElements.$children) ? extensionElements.$children : []),
  ]
  const values: string[] = []

  for (const candidate of candidates) {
    const property = asRecord(candidate)
    if (property === undefined) continue

    const key = propertyPart(property, 'key')
    if (key?.trim().toLowerCase() !== expectedKey.toLowerCase()) continue

    const value = propertyPart(property, 'value')
    if (value !== undefined) values.push(value)
  }

  return values
}

function normalizedIdentity(value: string): string {
  return value.trim().toLowerCase()
}

function classifyCoreIdentity(value: string | undefined): CpiVisualKind | undefined {
  if (value === undefined) return undefined

  const identity = normalizedIdentity(value)
  if (identity === 'enricher' || identity === 'contentmodifier') {
    return 'ContentModifier'
  }
  if (['script', 'groovyscript', 'javascript'].includes(identity)) return 'Script'
  if (identity === 'exclusivegateway' || identity === 'router') return 'Router'
  if (identity === 'send') return 'Send'
  if (identity === 'externalcall' || identity === 'requestreply') {
    return 'RequestReply'
  }
  if (identity === 'integrationprocess') return 'IntegrationProcess'
  return undefined
}

function cnameIdentity(uri: string | undefined): string | undefined {
  if (uri === undefined) return undefined

  for (const segment of uri.split('/')) {
    const match = /^cname::(.*)$/i.exec(segment.trim())
    if (match !== null) return match[1].trim()
  }

  return undefined
}

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

function classifyParticipantIdentity(
  value: string | undefined,
): CpiVisualKind | undefined {
  if (value === undefined) return undefined

  const identity = normalizedIdentity(value)
  if (identity === 'endpointsender') return 'Sender'
  if (identity === 'endpointreceiver' || identity === 'endpointrecevier') {
    return 'Receiver'
  }
  if (identity === 'integrationprocess') return 'IntegrationProcess'
  return undefined
}

export function classifyCpiElement(
  businessObject: unknown,
): CpiVisualKind | undefined {
  const object = asRecord(businessObject)
  if (object === undefined) return undefined

  const activityType = classifyExtensionProperty(object, 'activityType')
  if (activityType !== undefined) return activityType

  const cmdVariant = classifyExtensionProperty(
    object,
    'cmdVariantUri',
    cnameIdentity,
  )
  if (cmdVariant !== undefined) return cmdVariant

  const subActivityType = classifyExtensionProperty(object, 'subActivityType')
  if (subActivityType !== undefined) return subActivityType

  return classifyParticipantIdentity(participantType(object))
}
