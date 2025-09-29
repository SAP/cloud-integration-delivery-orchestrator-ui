<script setup lang="ts">
import type { DeliveryRequest, TransportNode } from '@/service/api';
import { Handle, Position, useVueFlow } from '@vue-flow/core'

const { updateNodeData, getConnectedEdges } = useVueFlow()
// props were passed from the slot using `v-bind="customNodeProps"`
const props = defineProps({
  id: {
    type: String,
    required: true
  },
  data: {
    type: Object as () => { curNode: TransportNode, deliveryRequest: DeliveryRequest },
    required: true
  }
})
  
</script>

<template>
  <div>
    <div>{{ data.curNode.name }}</div>
    <div v-for="a in data.deliveryRequest.Artifacts">
      <div>{{ a.Name }} - {{ a.Version }}</div>
    </div>
  </div>
</template>