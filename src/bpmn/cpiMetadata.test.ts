import { BpmnModdle } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import {
  classifyCpiElement,
  familyOfElement,
  type CpiVisualKind,
  type ShapeFamily,
} from './cpiMetadata'

function property(key: unknown, value: unknown) {
  return { $type: 'ifl:property', key, value }
}

function withValues(...properties: unknown[]) {
  return {
    extensionElements: {
      values: properties,
    },
  }
}

function withChildren(...properties: unknown[]) {
  return {
    extensionElements: {
      $children: properties,
    },
  }
}

describe('classifyCpiElement', () => {
  it.each([
    ['Enricher', 'ContentModifier'],
    ['ContentModifier', 'ContentModifier'],
    ['Script', 'Script'],
    ['GroovyScript', 'Script'],
    ['JavaScript', 'Script'],
    ['ExclusiveGateway', 'Router'],
    ['Router', 'Router'],
    ['Send', 'Send'],
    ['ExternalCall', 'RequestReply'],
    ['Decoder', 'Decoder'],
    ['IntegrationProcess', 'IntegrationProcess'],
  ] satisfies Array<[string, CpiVisualKind]>)(
    'maps activityType %s to %s',
    (activityType, expected) => {
      expect(classifyCpiElement(
        withValues(property('activityType', activityType)),
      )).toBe(expected)
    },
  )

  it.each([
    ['EndpointSender', 'Sender'],
    ['EndpointRecevier', 'Receiver'],
    ['EndpointReceiver', 'Receiver'],
    ['IntegrationProcess', 'IntegrationProcess'],
  ] satisfies Array<[string, CpiVisualKind]>)(
    'maps participant ifl:type %s to %s',
    (participantType, expected) => {
      expect(classifyCpiElement({
        $type: 'bpmn:Participant',
        $attrs: { 'ifl:type': participantType },
      })).toBe(expected)
    },
  )

  it.each([
    'Request-Reply',
    'S-e-n-d',
    'Content Modifier',
  ])('rejects unsupported core alias %s', (activityType) => {
    expect(classifyCpiElement(
      withValues(property('activityType', activityType)),
    )).toBeUndefined()
  })

  it.each([
    'Endpoint Sender',
    'Endpoint_Receiver',
  ])('rejects unsupported participant alias %s', (participantType) => {
    expect(classifyCpiElement({
      $type: 'bpmn:Participant',
      $attrs: { 'ifl:type': participantType },
    })).toBeUndefined()
  })

  it('falls through after a separator-injected higher-priority alias', () => {
    expect(classifyCpiElement(withValues(
      property('activityType', 'Content Modifier'),
      property('cmdVariantUri', 'vendor/cname::Send/version::1'),
    ))).toBe('Send')
  })

  it('extracts a trimmed, case-insensitive cname path segment', () => {
    expect(classifyCpiElement(withValues(
      property(
        'cmdVariantUri',
        'odc://component/path/CNAME::  groovyscript  /version::1.0',
      ),
    ))).toBe('Script')
  })

  it('classifies a Decoder from its cmdVariant cname when activityType is absent', () => {
    expect(classifyCpiElement(withValues(
      property(
        'cmdVariantUri',
        'ctype::FlowstepVariant/cname::Base64 Decode/version::1.0.1',
      ),
    ))).toBe('Decoder')
  })

  it('reads subActivityType from generic key/value child objects', () => {
    expect(classifyCpiElement(withChildren({
      $type: 'ifl:property',
      $children: [
        { $type: 'ifl:key', value: 'subActivityType' },
        { $type: 'ifl:value', $body: 'ExternalCall' },
      ],
    }))).toBe('RequestReply')
  })

  it('uses metadata sources in priority order when recognized values conflict', () => {
    expect(classifyCpiElement({
      $type: 'bpmn:Participant',
      $attrs: { 'ifl:type': 'EndpointReceiver' },
      extensionElements: {
        values: [
          property('activityType', 'ExclusiveGateway'),
          property('cmdVariantUri', 'vendor/cname::Send/version::1'),
          property('subActivityType', 'GroovyScript'),
        ],
      },
    })).toBe('Router')
  })

  it('skips empty and whitespace duplicates before a valid activityType', () => {
    expect(classifyCpiElement(withValues(
      property('activityType', ''),
      property('activityType', '   '),
      property('activityType', 'Enricher'),
    ))).toBe('ContentModifier')
  })

  it('skips an unrecognized duplicate before a recognized value', () => {
    expect(classifyCpiElement(withValues(
      property('activityType', 'NotACpiShape'),
      property('activityType', 'GroovyScript'),
    ))).toBe('Script')
  })

  it('preserves the first recognized value among same-key duplicates', () => {
    expect(classifyCpiElement(withValues(
      property('activityType', 'ExclusiveGateway'),
      property('activityType', 'Send'),
    ))).toBe('Router')
  })

  it('skips malformed and non-string duplicates before a valid value', () => {
    expect(classifyCpiElement(withValues(
      property('activityType', null),
      property('activityType', 42),
      property('activityType', { unexpected: 'Send' }),
      property('activityType', 'Send'),
    ))).toBe('Send')
  })

  it('exhausts activityType duplicates before trying a lower-priority source', () => {
    expect(classifyCpiElement(withValues(
      property('activityType', 'NotACpiShape'),
      property('cmdVariantUri', 'vendor/cname::Send/version::1'),
      property('activityType', 'ExclusiveGateway'),
    ))).toBe('Router')
  })

  it('continues to later sources after unrecognized or malformed earlier values', () => {
    expect(classifyCpiElement({
      $type: 'bpmn:Participant',
      $attrs: { 'ifl:type': 'EndpointSender' },
      extensionElements: {
        values: [
          property('activityType', 'NotACpiShape'),
          property('cmdVariantUri', 'vendor/cname::sap:HTTP/version::1'),
          property('subActivityType', null),
        ],
      },
    })).toBe('Sender')
  })

  it('supports primitive properties in values and generic properties in $children', () => {
    const businessObject = {
      extensionElements: {
        values: [property('activityType', undefined)],
        $children: [{
          key: { $body: 'subActivityType' },
          value: { value: 'Send' },
        }],
      },
    }

    expect(classifyCpiElement(businessObject)).toBe('Send')
  })

  it.each(['sap:HTTP', 'sap:Script'])(
    'does not classify adapter cname value %s as a core shape',
    (adapterIdentity) => {
      expect(classifyCpiElement(withValues(
        property(
          'cmdVariantUri',
          `vendor/cname::${adapterIdentity}/version::1`,
        ),
      ))).toBeUndefined()
    },
  )

  it.each([
    null,
    undefined,
    {},
    { extensionElements: null },
    { extensionElements: { values: [null, 1, 'property'] } },
    withValues(property(null, 'Send')),
    withValues(property('activityType', { unexpected: 'Send' })),
    withValues(property('cmdVariantUri', 'vendor/cname::/version::1')),
    withValues(property('cmdVariantUri', 42)),
  ])('returns fallback for unknown or malformed metadata %#', (businessObject) => {
    expect(classifyCpiElement(businessObject)).toBeUndefined()
  })

  it('ignores display names, BPMN types, ids, and parent metadata', () => {
    const parent = withValues(property('activityType', 'Send'))
    const businessObject = {
      id: 'GroovyScript_ExclusiveGateway',
      name: 'Content Modifier',
      $type: 'bpmn:SendTask',
      $parent: parent,
    }
    ;(parent as Record<string, unknown>).child = businessObject

    expect(classifyCpiElement(businessObject)).toBeUndefined()
  })

  it('supports direct parser-exposed ifl:type attributes on participants', () => {
    expect(classifyCpiElement({
      $type: 'bpmn:Participant',
      'ifl:type': 'EndpointReceiver',
    })).toBe('Receiver')
  })

  it('classifies generic extension objects produced by bpmn-moddle', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:ifl="http://example.com/ifl">
  <bpmn:process id="Process_1">
    <bpmn:task id="Task_1">
      <bpmn:extensionElements>
        <ifl:property>
          <ifl:key>activityType</ifl:key>
          <ifl:value>Enricher</ifl:value>
        </ifl:property>
      </bpmn:extensionElements>
    </bpmn:task>
  </bpmn:process>
</bpmn:definitions>`
    const { elementsById } = await new BpmnModdle().fromXML(xml)

    expect(classifyCpiElement(elementsById.Task_1)).toBe('ContentModifier')
  })

  it('reads participant ifl:type from bpmn-moddle parsed attributes', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:ifl="http://example.com/ifl">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Receiver_1" ifl:type="EndpointRecevier" />
  </bpmn:collaboration>
</bpmn:definitions>`
    const { elementsById } = await new BpmnModdle().fromXML(xml)

    expect(classifyCpiElement(elementsById.Receiver_1)).toBe('Receiver')
  })
})

describe('familyOfElement', () => {
  it.each([
    ['bpmn:startEvent', 'event'],
    ['bpmn:endEvent', 'event'],
    ['bpmn:intermediateCatchEvent', 'event'],
    ['bpmn:intermediateThrowEvent', 'event'],
    ['bpmn:boundaryEvent', 'event'],
    ['bpmn:exclusiveGateway', 'gateway'],
    ['bpmn:parallelGateway', 'gateway'],
    ['bpmn:inclusiveGateway', 'gateway'],
    ['bpmn:eventBasedGateway', 'gateway'],
    ['bpmn:task', 'activity'],
    ['bpmn:serviceTask', 'activity'],
    ['bpmn:callActivity', 'activity'],
    ['bpmn:scriptTask', 'activity'],
    ['bpmn:subProcess', 'container'],
    ['bpmn:transaction', 'container'],
    ['bpmn:adHocSubProcess', 'container'],
  ] satisfies Array<[string, ShapeFamily]>)(
    'maps element type %s to family %s from the element type alone',
    ($type, expected) => {
      expect(familyOfElement({ $type })).toBe(expected)
    },
  )

  it.each([
    ['EndpointSender', 'endpoint'],
    ['EndpointReceiver', 'endpoint'],
    ['EndpointRecevier', 'endpoint'],
    ['IntegrationProcess', 'pool'],
  ] satisfies Array<[string, ShapeFamily]>)(
    'splits participant ifl:type %s into family %s',
    (participantType, expected) => {
      expect(familyOfElement({
        $type: 'bpmn:participant',
        $attrs: { 'ifl:type': participantType },
      })).toBe(expected)
    },
  )

  it('classifies an event from CPI metadata nested under its eventDefinition', () => {
    const errorStartEvent = {
      $type: 'bpmn:startEvent',
      eventDefinitions: [{
        $type: 'bpmn:errorEventDefinition',
        extensionElements: {
          values: [property('activityType', 'StartErrorEvent')],
        },
      }],
    }

    // family is authoritative from the element type; the member is now refined
    // from the nested eventDefinition extensionElements (RFC 010 doc 07 §3.5).
    expect(familyOfElement(errorStartEvent)).toBe('event')
    expect(classifyCpiElement(errorStartEvent)).toBe('ErrorStartEvent')
  })

  it.each([
    ['MessageStartEvent', 'MessageStartEvent'],
    ['StartEvent', 'StartEvent'],
    ['MessageEndEvent', 'MessageEndEvent'],
    ['EndEvent', 'EndEvent'],
  ] satisfies Array<[string, CpiVisualKind]>)(
    'classifies event %s from direct extensionElements',
    (activityType, expected) => {
      expect(classifyCpiElement(
        withValues(property('activityType', activityType)),
      )).toBe(expected)
    },
  )

  it('classifies a timer start event from its nested activityType', () => {
    expect(classifyCpiElement({
      $type: 'bpmn:startEvent',
      eventDefinitions: [{
        $type: 'bpmn:timerEventDefinition',
        extensionElements: {
          values: [property('activityType', 'StartTimerEvent')],
        },
      }],
    })).toBe('StartTimerEvent')
  })

  it.each([
    null,
    undefined,
    {},
    { $type: 'bpmn:sequenceFlow' },
    { $type: 'bpmn:participant' },
    { $type: 'bpmn:participant', $attrs: { 'ifl:type': 'Something' } },
  ])('returns undefined for unknown element types %#', (businessObject) => {
    expect(familyOfElement(businessObject)).toBeUndefined()
  })

  it('maps real bpmn-moddle $type (bpmn2 prefix, PascalCase) to families', async () => {
    // .iflw files use the bpmn2: prefix, but bpmn-moddle normalizes $type to the
    // package prefix bpmn: with PascalCase local names (bpmn:StartEvent, etc.).
    // familyOfElement must handle both — this proves the prefix/case wiring.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:ifl="http://example.com/ifl">
  <bpmn2:collaboration id="Collaboration_1">
    <bpmn2:participant id="Sender_1" ifl:type="EndpointSender" />
    <bpmn2:participant id="Process_Pool" ifl:type="IntegrationProcess" />
  </bpmn2:collaboration>
  <bpmn2:process id="Proc_1">
    <bpmn2:startEvent id="Start_1"><bpmn2:errorEventDefinition id="Err_1" /></bpmn2:startEvent>
    <bpmn2:endEvent id="End_1" />
    <bpmn2:exclusiveGateway id="Gate_1" />
    <bpmn2:parallelGateway id="Gate_2" />
    <bpmn2:callActivity id="Call_1" />
    <bpmn2:serviceTask id="Svc_1" />
    <bpmn2:subProcess id="Sub_1" />
  </bpmn2:process>
</bpmn2:definitions>`
    const { elementsById } = await new BpmnModdle().fromXML(xml)

    const expected: Array<[string, ShapeFamily | undefined]> = [
      ['Start_1', 'event'],
      ['End_1', 'event'],
      ['Gate_1', 'gateway'],
      ['Gate_2', 'gateway'],
      ['Call_1', 'activity'],
      ['Svc_1', 'activity'],
      ['Sub_1', 'container'],
      ['Sender_1', 'endpoint'],
      ['Process_Pool', 'pool'],
    ]
    for (const [id, family] of expected) {
      expect(familyOfElement(elementsById[id])).toBe(family)
    }
  })
})
