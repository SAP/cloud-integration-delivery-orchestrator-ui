<template>
  <div style="margin: 0 42px">
    <!-- head -->
    <n-card class="header-card-shadow-class">
      <n-flex justify="space-between">
        <!-- Job Name -->
        <n-flex vertical>
          <n-input
            class="ui5-title-root"
            v-model:value="jobInstance.Name"
            placeholder="Job Name"
            clearable
            autofocus
            v-if="editing"
          />
          <span class="ui5-title-root" v-else-if="jobInstance.Name">{{ jobInstance.Name }}</span>
          <n-text v-else class="ui5-title-root" type="warning">Empty Name</n-text>
          <!-- job description -->
          <n-input
            v-model:value="jobInstance.Description"
            placeholder="Description"
            size="large"
            clearable
            autofocus
            v-if="editing"
          />
          <n-text style="color: gray" v-else-if="jobInstance.Description">{{
            jobInstance.Description
          }}</n-text>
          <n-text v-else type="warning">Empty Description</n-text>
        </n-flex>

        <n-tag type="info">{{ status }}</n-tag>

        <!-- action group -->
        <n-flex justify="start">
          <!-- Edit button -->
          <IconBtn tip="Edit" :handler="onEdit">
            <edit16-regular />
          </IconBtn>
          <!-- Delete button -->
          <IconBtn tip="Delete" :handler="handleDeleteJob">
            <Delete28Regular />
          </IconBtn>

          <n-divider vertical />

          <!-- Submit Button -->
          <IconBtn tip="Save" :handler="handleSave" :disabled="!editing">
            <SaveAltRound />
          </IconBtn>
          <IconBtn tip="Execute" :handler="onExecute" :disabled="editing">
            <StartTwotone />
          </IconBtn>
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
          <n-button @click="handleCreateStep(jobInstance.Type)">
            {{ stepTypeOptions[jobInstance.Type] }}
          </n-button>
        </n-flex>
      </n-flex>
    </div>

    <!-- step list with config view -->
    <n-card class="card-shadow-class">
      <div style="margin-bottom: 15px; font-size: 15px; font-weight: bold">
        {{ jobInstance.Type }} Job {{ jobInstance.ID }} Detail
      </div>
      <n-grid x-gap="40" :cols="5">
        <!-- step lists -->
        <n-gi span="2">
          <n-steps vertical :current="current" @update:current="handleCurrent">
            <n-step
              v-for="(step, index) in jobInstance.Steps"
              :key="index"
              :status="mapStatus(step.Status)"
            >
              <template #title>
                {{ step.Status }}
              </template>

              <component
                :is="jobInstance.Type === 'Import' ? 'ImportStepCard' : 'DeployStepCard'"
                :step="step"
                @close="handleCloseStep(step, index)"
              />
            </n-step>
          </n-steps>
        </n-gi>

        <!-- choose config -->
        <n-gi span="3">
          <n-flex class="table-class" vertical align="start" v-if="current > 0">
            <span style="font-size: 15px; font-weight: bold"> Details of Step {{ current }}: </span>
            <component
              :is="jobInstance.Type === 'Import' ? 'ImportConfig' : 'DeployConfig'"
              :key="current - 1"
              :step="jobInstance.Steps[current - 1]"
              v-if="checkStatus(jobInstance.Steps[current - 1])"
            />
            <div>
              Job Execution Logs
              <n-alert
                :title="`Step ${log.Sequence} at ${log.CreatedAt}`"
                type="warning"
                v-for="(log, i) in jobInstance.ExecutionLogs"
                :key="i"
              >
                {{ log.Log }}
              </n-alert>
            </div>
          </n-flex>
        </n-gi>
      </n-grid>
    </n-card>
  </div>
</template>

<script lang="ts">
import { useMessage } from 'naive-ui'
import { defineComponent } from 'vue'
import ImportStepCard from '../components/ImportStepCard.vue'
import DeployStepCard from '../components/DeployStepCard.vue'
import { SaveAltRound, StartTwotone } from '@vicons/material'
import {
  type Job,
  type Step,
  DeleteJob,
  SaveJob,
  FetchJob,
  DeleteStep,
  ExecuteJob
} from '../service/api'
import { stepTypeOptions, transportRequestColums } from '@/service/consts'
import { Edit16Regular, Delete28Regular } from '@vicons/fluent'
import ImportConfig from '../components/ImportConfig.vue'
import DeployConfig from '../components/DeployConfig.vue'
import IconBtn from '@/components/IconBtn.vue'
export default defineComponent({
  props: {
    jobId: { required: true, type: String }
  },
  components: {
    ImportStepCard,
    DeployStepCard,
    ImportConfig,
    DeployConfig,
    Edit16Regular,
    Delete28Regular,
    SaveAltRound,
    StartTwotone,
    IconBtn
  },
  created() {
    this.refresh()
  },
  data() {
    const jobInstance: Job = {}

    return {
      selectedStepType: null,
      stepTypeOptions,
      jobInstance,
      current: -1,
      trColums: transportRequestColums,
      message: useMessage(),
      editing: false,
      status: ''
    }
  },
  methods: {
    handleCreateStep(stepType: string) {
      if (!this.editing) {
        this.message.error('Not in edit mode.')
        return
      }
      const newStep: Step = {
        ID: -1,
        Status: 'Draft',
        Type: stepType
      }
      this.jobInstance.Steps.push(newStep)
      this.current = this.jobInstance.Steps.length
      // this.jobInstance.status = 'DRAFT'
    },
    handleSave() {
      // update job
      const msg = window.$message.loading('Saving')
      SaveJob(this.jobInstance)
        .then(() => this.refresh()) // refresh
        .then((job) => {
          msg.type = 'success'
          msg.content = 'Job Saved'
          this.editing = false
        })
    },
    handleDeleteJob() {
      DeleteJob(this.jobInstance).then((job) => {
        this.$router.go(-1)
      })
    },
    handleCurrent(current: number) {
      this.current = Math.min(current, this.jobInstance.Steps.length)
    },
    handleCloseStep(step: Step, index: number) {
      if (!this.editing) {
        this.message.error('Not in edit mode')
        return
      }
      if (step.ID == -1) {
        this.jobInstance.Steps = this.jobInstance.Steps.filter((v, i) => i != index)
        this.message.info(`Removed an draft step: ${this.current}`)
        return
      }
      DeleteStep(step.ID, this.jobInstance.Type)
        .then(() => this.refresh())
        .then((job) => {
          window.$message.success(`Step ${this.current} Deleted`)
        })
    },
    onEdit() {
      this.editing = true
      this.status = 'DRAFT'
    },
    onExecute() {
      ExecuteJob(this.jobInstance).then(() => {
        this.refresh()
      })
    },
    refresh() {
      FetchJob(this.jobId).then((job) => {
        this.jobInstance = job as unknown as Job
        // update job status based on steps' status
        if (this.jobInstance.Steps.filter((v, i) => v.Status === 'Error').length)
          this.status = 'Error'
        else if (this.jobInstance.Steps.filter((v, i) => v.Status === 'Running').length)
          this.status = 'Running'
        else {
          const arr = this.jobInstance.Steps.filter((v, i) => v.Status === 'Finished')
          if (arr.length === this.jobInstance.Steps.length) this.status = 'Finished'
          else this.status = this.jobInstance.Status
        }
        return job
      })
    },
    checkStatus(step: Step) {
      // if (step.Status === 'Finished' || step.Status === 'Running' || step.Status === 'Error') {
      //   window.$message.error(`Step with status ${step.Status} cannot be modified.`)
      //   return false
      // }
      return true
    },
    mapStatus(status: string) {
      switch (status) {
        case 'Draft':
          return 'wait'
        case 'Running':
          return 'process'
        case 'Finished':
          return 'finish'
        case 'Error':
          return 'error'
        default:
          return 'wait'
      }
    }
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
