const BPMN_MODEL_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
const BPMN_DI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI'

// Cached result of the malformed-XML capability probe.
// undefined = not yet probed; null = browser does not expose parsererror elements.
// string = parsererror namespace URI (may be empty string).
// Browser capabilities are stable within a session, so we probe once and cache.
let cachedParserErrorNamespace: string | null | undefined = undefined

function probeParserErrorNamespace(): string | null {
  if (cachedParserErrorNamespace !== undefined) return cachedParserErrorNamespace

  try {
    const doc = new DOMParser().parseFromString('<invalid', 'application/xml')
    const err = doc.documentElement.localName === 'parsererror'
      ? doc.documentElement
      : (Array.from(doc.getElementsByTagNameNS('*', 'parsererror'))[0] ?? null)
    cachedParserErrorNamespace = err !== null ? (err.namespaceURI ?? null) : null
  } catch {
    cachedParserErrorNamespace = null
  }

  return cachedParserErrorNamespace
}

/** Reset the probe cache. Only for use in tests. */
export function _resetProbeCache(): void {
  cachedParserErrorNamespace = undefined
}

function isParserError(
  document: XMLDocument,
  parserErrorNamespace: string | null,
): boolean {
  return document.documentElement.localName === 'parsererror'
    || Array.from(document.getElementsByTagNameNS('*', 'parsererror'))
      .some(element => element.namespaceURI === parserErrorNamespace)
}

function isExpanded(shape: Element): boolean {
  const value = shape.getAttribute('isExpanded')
  return value === 'true' || value === '1'
}

function bpmnReferenceId(element: Element, value: string): string | null {
  const normalized = value.trim()
  const separator = normalized.indexOf(':')
  if (normalized.length === 0) return null

  if (separator === -1) {
    const defaultNamespace = element.lookupNamespaceURI(null)
    return defaultNamespace === null || defaultNamespace === BPMN_MODEL_NS
      ? normalized
      : null
  }

  if (separator === 0 || normalized.indexOf(':', separator + 1) !== -1) return null
  const prefix = normalized.slice(0, separator)
  return element.lookupNamespaceURI(prefix) === BPMN_MODEL_NS
    ? normalized.slice(separator + 1)
    : null
}

function diagramElementsByPlane(document: XMLDocument): Map<Element, Element[]> {
  const elementsByPlane = new Map<Element, Element[]>()

  const visit = (element: Element, containingPlane?: Element) => {
    const isDiagramElement = element.namespaceURI === BPMN_DI_NS
    const plane = isDiagramElement && element.localName === 'BPMNPlane'
      ? element
      : containingPlane

    if (plane !== undefined && isDiagramElement) {
      if (element.localName === 'BPMNShape' || element.localName === 'BPMNEdge') {
        const elements = elementsByPlane.get(plane) ?? []
        elements.push(element)
        elementsByPlane.set(plane, elements)
      }
    }

    Array.from(element.children).forEach(child => visit(child, plane))
  }

  visit(document.documentElement)
  return elementsByPlane
}

interface SemanticOwnerIndex {
  ownerBySemanticId: Map<string, string>
  parentBySubprocessId: Map<string, string>
}

function buildSemanticOwnerIndex(document: XMLDocument): SemanticOwnerIndex {
  const ownerBySemanticId = new Map<string, string>()
  const parentBySubprocessId = new Map<string, string>()

  const visit = (element: Element, containingSubprocess?: string) => {
    if (element.namespaceURI === BPMN_DI_NS) return
    const isBpmnElement = element.namespaceURI === BPMN_MODEL_NS
    const semanticId = isBpmnElement ? element.getAttribute('id') : null
    const isSubprocess = isBpmnElement && element.localName === 'subProcess'

    if (semanticId !== null && containingSubprocess !== undefined) {
      ownerBySemanticId.set(semanticId, containingSubprocess)
    }
    if (isSubprocess && semanticId !== null && containingSubprocess !== undefined) {
      parentBySubprocessId.set(semanticId, containingSubprocess)
    }

    const childOwner = isSubprocess && semanticId !== null
      ? semanticId
      : containingSubprocess
    Array.from(element.children).forEach(child => visit(child, childOwner))
  }

  visit(document.documentElement)
  return { ownerBySemanticId, parentBySubprocessId }
}

function expandableSubprocessIds(
  referencedIds: Set<string>,
  ownerIndex: SemanticOwnerIndex,
): Set<string> {
  const expandableIds = new Set<string>()

  referencedIds.forEach((semanticId) => {
    let owner = ownerIndex.ownerBySemanticId.get(semanticId)
    while (owner !== undefined) {
      if (expandableIds.has(owner)) break
      expandableIds.add(owner)
      owner = ownerIndex.parentBySubprocessId.get(owner)
    }
  })

  return expandableIds
}

export function prepareIflowXmlForRendering(xml: string): string {
  const parserErrorNamespace = probeParserErrorNamespace()
  if (parserErrorNamespace === null) return xml

  let document: XMLDocument

  try {
    document = new DOMParser().parseFromString(xml, 'application/xml')
    if (isParserError(document, parserErrorNamespace)) return xml
  } catch {
    return xml
  }

  const ownerIndex = buildSemanticOwnerIndex(document)
  let changed = false

  diagramElementsByPlane(document).forEach((diagramElements) => {
    const referencedIds = new Set<string>()

    diagramElements.forEach((element) => {
      const reference = element.getAttribute('bpmnElement')
      if (reference === null) return
      const semanticId = bpmnReferenceId(element, reference)
      if (semanticId === null) return
      referencedIds.add(semanticId)
    })
    const subprocessesWithChildDi = expandableSubprocessIds(referencedIds, ownerIndex)

    diagramElements.forEach((shape) => {
      if (shape.localName !== 'BPMNShape') return
      const reference = shape.getAttribute('bpmnElement')
      if (reference === null) return
      const semanticId = bpmnReferenceId(shape, reference)
      if (semanticId === null || !subprocessesWithChildDi.has(semanticId)) return
      if (isExpanded(shape)) return
      shape.setAttribute('isExpanded', 'true')
      changed = true
    })
  })

  if (!changed) return xml

  try {
    return new XMLSerializer().serializeToString(document)
  } catch {
    return xml
  }
}
