<template>
  <div style="margin: 0 42px">
    <!-- head -->
    <n-card class="header-card-shadow-class">
      <n-flex justify="space-between">
        <n-flex vertical>
          <n-input
            class="ui5-title-root"
            v-model:value="jobInstance.name"
            v-if="jobInstance.status === 'DRAFT'"
            placeholder="Job Name"
            :status="jobInstance.name.length ? 'success':'error'"
            clearable
          />
          <span class="ui5-title-root" v-else>{{ jobInstance.name }}</span>

          <n-input
            v-model:value="jobInstance.description"
            v-if="jobInstance.status === 'DRAFT'"
            placeholder="Description"
            size="large"
            clearable
          />
          <n-text style="color: gray" v-else>{{ jobInstance.description }}</n-text>
        </n-flex>
        <n-tag type="info">{{ jobInstance.status }}</n-tag>

        <!-- action group -->
        <n-flex justify="start">
          <!-- Edit button -->
          <n-button @click="jobInstance.status = 'DRAFT'" quaternary>
            Edit
            <template #icon>
              <n-icon color="#0e7a0d" size="25">
                <edit16-regular />
              </n-icon>
            </template>
          </n-button>

          <n-divider vertical />

          <!-- Submit Button -->
          <n-button :disabled="jobInstance.status === 'SUBMITTED'" @click="handleSubmit">
            Submit
          </n-button>
          <n-button :disabled="jobInstance.status === 'DRAFT'">Run</n-button>
          <n-button :disabled="jobInstance.status === 'DRAFT'">Retry</n-button>
          <n-divider vertical />
          <!-- Delete button -->
          <n-button quaternary>
            Delete
            <template #icon>
              <n-icon color="#0e7a0d" size="25">
                <Delete28Regular />
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-flex>
    </n-card>

    <!-- generate steps -->
    <div class="config-class">
      <!-- upload file -->
      <n-flex justify="space-evenly">
        <n-upload multiple directory-dnd :max="1" style="width: 30%">
          <n-upload-dragger>
            <n-text style="font-size: 16px"> Upload </n-text>
            <n-p depth="3"> for file format, please visit: .... </n-p>
          </n-upload-dragger>
        </n-upload>
        <!-- choose step type -->
        <n-flex vertical>
          Create Steps Mannually:
          <n-flex vertical>
            <n-button
              v-for="(stepType, index) in stepTypeOptions"
              :key="index"
              @click="handleCreateStep(stepType.value)"
            >
              {{ stepType.label }}</n-button
            >
          </n-flex>
        </n-flex>
      </n-flex>
    </div>

    <!-- step list -->
    <n-card class="card-shadow-class">
      <div style="margin-bottom: 15px; font-size: 15px; font-weight: bold">Job Detail</div>
      <n-grid x-gap="40" :cols="5">
        <!-- step lists -->
        <n-gi span="2">
          <n-steps vertical :current="current" @update:current="handleCurrent">
            <n-step v-for="(step, index) in jobInstance.steps" :key="index">
              <template #title>
                {{ step.type }}
              </template>
              <import-step-card v-if="step.type === 'Import'" :step="step as ImportStep" />

              <deploy-step-card v-if="step.type === 'Deploy'" :step="step as DeployStep" />
            </n-step>
          </n-steps>
        </n-gi>

        // choose config
        <n-gi span="3">
          <div style="position: sticky; top: 200px">
            <n-flex class="table-class" vertical align="start">
              <div style="font-size: 15px; font-weight: bold">
                <span v-if="current > 0">Config Step {{ current }}:</span>
              </div>
              
              <ImportConfig :key="current-1" :step="jobInstance.steps[current-1] as ImportStep" v-if="current > 0 && jobInstance.steps[current-1].type === 'Import'" />

            </n-flex>
          </div>
        </n-gi>
      </n-grid>
    </n-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { type DataTableColumns, type StepsProps } from 'naive-ui'
import ImportStepCard from '../components/ImportStepCard.vue'
import DeployStepCard from '../components/DeployStepCard.vue'
import {
   type ImportStep, type DeployStep, type Job, type Step, type ToolBar, type ApiEndpoint, type Package,
   
} from '../store/index'
import {
  stepTypeOptions,
  transportRequestColums,
  apiEndpointSelectColums
} from '@/store/const-data'
import { Edit16Regular, Delete28Regular } from '@vicons/fluent'
import axios from 'axios'
import ImportConfig from '../components/ImportConfig.vue'

export default defineComponent({
  props: {
    jobId: {required: true, type: String}
  },
  components: {
    ImportStepCard,
    DeployStepCard,
    ImportConfig,
    Edit16Regular,
    Delete28Regular
  },
  created() {
    this.getJob()
  },
  data() {
    const customToolBars: ToolBar[] = [
      {
        text: 'select',
        func: (rows: DataTableColumns) => {}
      }
    ]

    const jobInstance: Job = {
      name: '',
      description: '',
      status: 'DRAFT',
      steps: [],
      id: -1
    }

    return {
      selectedStepType: null,
      stepTypeOptions,
      jobInstance,
      currentStatus: 'process',
      current: -1,
      trColums: transportRequestColums,
      customToolBars,
      apiEndpointSelectColums
    }
  },
  methods: {
    handleCreateStep(stepType: string) {
      const newStep: Step = {
        id: -1,
        status: 'DRAFT',
        type: stepType,
        endpoint_id: -1,
      }
      this.jobInstance.steps.push(newStep)
      this.current = this.jobInstance.steps.length
    },

    handleSubmit() {
      // update job
      axios.put(`/api/v1/job`,this.jobInstance)
      .catch(err => {

      })
      .then(()=>{
        this.getJob()  //refresh
      })
    },
    handleCurrent(current: number) {
      this.current = current
    },
    getJob() {
      axios
      .get(`/api/v1/job/${this.jobId}`)
      .then(resp=>{
        this.jobInstance = resp.data.result
      })
    }
  },
  computed: {
  },
  watch: {
  }
})
</script>
<style scoped>
.header-card-shadow-class {
  border-radius: 0.5rem;
  box-shadow:
    0 0 0.125rem 0 rgba(34, 53, 72, 0.2),
    0 0.125rem 0.25rem 0 rgba(34, 53, 72, 0.2);
  position: sticky;
  top: 80px;
  z-index: 99;
}

.card-shadow-class {
  border-radius: 0.5rem;
  box-shadow:
    0 0 0.125rem 0 rgba(34, 53, 72, 0.2),
    0 0.125rem 0.25rem 0 rgba(34, 53, 72, 0.2);
  margin-bottom: 10px;
}

.ui5-title-root {
  font-weight: bold;
  font-size: larger;
}

.config-class {
  margin: 20px 0;
}
</style>
