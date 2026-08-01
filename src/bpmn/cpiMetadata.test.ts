import { BpmnModdle } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import {
  classifyCpiElement,
  type CpiVisualKind,
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
