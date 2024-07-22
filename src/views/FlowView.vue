<template>
  <n-flex justify="space-around">
    <n-flex vertical>
      <n-steps vertical v-model:current="current">
        <n-step
          v-for="(step, index) in jobInstance.steps"
          :key="index"
          :title="step.type"
          :status="statusDict[step.status]"
        >
          <import-step-card v-if="step.type === 'Import'" :step="step" />
          <deploy-step-card v-if="step.type === 'Deploy'" :step="step" />
        </n-step>

        <n-step title="Create">
          <CreateStepCard @update:value="onCreateStep" />
        </n-step>
      </n-steps>

      <n-space>
        <n-radio-group v-model:value="currentStatus" size="medium" name="vertical">
          <n-radio-button value="error"> Error </n-radio-button>
          <n-radio-button value="process"> Process </n-radio-button>
          <n-radio-button value="wait"> Wait </n-radio-button>
          <n-radio-button value="finish"> Finish </n-radio-button>
        </n-radio-group>
      </n-space>
    </n-flex>
    <div>
      <h1>Logs</h1>
    </div>
  </n-flex>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StepsProps } from 'naive-ui'
import ImportStepCard from '../components/ImportStepCard.vue'
import DeployStepCard from '../components/DeployStepCard.vue'
import CreateStepCard from '../components/CreateStepCard.vue'
import { type ImportStep, type DeployStep, type Job, type Step, statusDict } from '../store/index'
import { mockJob } from '@/store/mocks'

export default defineComponent({
  components: {
    ImportStepCard,
    DeployStepCard,
    CreateStepCard
  },
  data() {
    return {
      //   jobInstance: this.job, //actual usage
      statusDict,
      jobInstance: mockJob,
      currentStatus: 'process',
      current: 1
    }
  },
  methods: {
    onCreateStep(stepType: string) {
      const newStep: Step = {
        job: this.jobInstance,
        status: 'DRAFT',
        type: stepType
      }
      this.jobInstance.steps.push(newStep)

      for (let step of this.jobInstance.steps) {
        console.log(`step status: ${step.status} tenant: ${step.tenant}`)
      }
      console.log(`=======`)
    }
  },
  props: {
    job: Object as PropType<Job>
  }
})
</script>
