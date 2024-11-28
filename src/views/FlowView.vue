<template>
  <!-- choose config modal -->
  <n-modal v-model:show="showModal" style="width: 50%; position: sticky; left: 50%;" preset="card">
    <template #header>
      Details of Step <n-gradient-text type="success">#{{ current }}</n-gradient-text>
    </template>
    <n-flex vertical align="start" v-if="current > 0">
      <!-- step create & update info -->
      <n-text depth="3">
        Updated By: {{ jobInstance.Steps[current - 1].UpdatedBy }} - Created At:
        {{ toLocalTime(jobInstance.Steps[current - 1].CreatedAt) }} - Updated at
        {{ toLocalTime(jobInstance.Steps[current - 1].UpdatedAt) }}
      </n-text>
      <component
        :is="comps(jobInstance.Steps[current - 1]).config"
        :key="current - 1"
        :step="jobInstance.Steps[current - 1]"
        v-if="checkStatus(jobInstance.Steps[current - 1])"
      />
    </n-flex>
  </n-modal>

  <div style="margin: 0 42px">
    <!-- head -->
    <n-card class="header-card-shadow-class">
      <n-grid x-gap="10" :cols="5">
        <!-- job name and desctiption -->
        <n-gi>
          <n-flex vertical>
            <!-- Job name -->
            <n-input
              class="ui5-title-root"
              v-model:value="jobInstance.Name"
              placeholder="Job Name"
              clearable
              autofocus
              v-if="editing"
            />
            <span class="ui5-title-root" v-else-if="jobInstance.Name">
              <n-text depth="3"> Job Name: </n-text>
              {{ jobInstance.Name }}
            </span>
            <!-- job description -->
            <n-input
              v-model:value="jobInstance.Description"
              placeholder="Deploy Reason"
              size="large"
              clearable
              v-if="editing"
            />
            <n-text style="font-weight: bold" v-else-if="jobInstance.Description">
              <n-text depth="3">Deploy Reason:</n-text>
              {{ jobInstance.Description }}
            </n-text>
          </n-flex>
        </n-gi>

        <!-- job basic information -->
        <n-gi span="2">
          <n-flex vertical>
            <n-text depth="3" style="font-size: 12px" strong>
              Created By: {{ jobInstance.CreatedBy }} at {{ toLocalTime(jobInstance.CreatedAt) }}
            </n-text>
            <n-text depth="3" style="font-size: 12px" strong>
              Updated By: {{ jobInstance.UpdatedBy }} at {{ toLocalTime(jobInstance.UpdatedAt) }}
            </n-text>
            <n-text depth="3" style="font-size: 12px" strong>{{ triggerInfo }} </n-text>
          </n-flex>
        </n-gi>
        <!-- job status tag -->
        <n-gi>
          <n-tag :type="toJobStatusTag(status)">{{ status }}</n-tag>
        </n-gi>
        <!-- action buttions -->
        <n-gi>
          <!-- Edit button -->
          <IconBtn tip="Edit" :handler="onEdit" v-if="!editing">
            <edit16-regular />
          </IconBtn>
          <IconBtn tip="Cancel" :handler="refresh" v-if="editing" color="#df423a">
            <CancelOutlined />
          </IconBtn>
          <!-- Delete button -->
          <IconBtn tip="Delete" :handler="handleDeleteJob" v-if="!editing" color="#df423a">
            <Delete28Regular />
          </IconBtn>

          <n-divider vertical />

          <!-- Submit Button -->
          <IconBtn tip="Save" :handler="handleSave" v-if="editing">
            <SaveAltRound />
          </IconBtn>
          <IconBtn tip="Execute" :handler="onExecute" v-if="!editing">
            <StartTwotone />
          </IconBtn>
        </n-gi>
      </n-grid>
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
          <n-text strong depth="3">Create Steps Mannually:</n-text>
          <n-button
            v-for="(context, type) in filterStepType"
            :key="type"
            @click="handleCreateStep(type)"
          >
            <n-text strong>{{ context }}</n-text>
          </n-button>
        </n-flex>
      </n-flex>
    </div>

    <!-- step list view and config view -->
    <n-card class="card-shadow-class">
      <div style="margin-bottom: 15px; font-size: 15px; font-weight: bold">
        {{ jobInstance.Type }} Job
        <n-gradient-text type="success">#{{ jobInstance.ID }}</n-gradient-text> Detail
      </div>
      <n-grid x-gap="40" :cols="5">
        <!-- step lists -->
        <n-gi span="3">
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
                :is="comps(step).stepCard"
                :step="step"
                @close="handleCloseStep(step, index)"
              />
            </n-step>
          </n-steps>
        </n-gi>

        <!-- execution log -->
        <n-gi span="2">
          <!-- step execution log -->
          <h4>
            Execution Log of Job <n-text type="success">#{{ jobInstance.ID }}</n-text> - {{ jobInstance.Name }}
          </h4>
          <div v-for="(step, i) in jobInstance.Steps" style="margin-bottom: 10px">
            <component :is="comps(step).log" :step="step" :key="i" :index="i" />
          </div>
          <!-- job log -->
          <h4>Job Execution Logs</h4>
          <n-alert
            :title="`Step ${log.Sequence} at ${log.CreatedAt}`"
            type="warning"
            v-for="(log, i) in jobInstance.ExecutionLogs"
            :key="i"
            style="margin-bottom: 10px"
          >
            {{ log.Log }}
          </n-alert>
        </n-gi>
      </n-grid>
    </n-card>
  </div>
</template>

<script lang="ts">
import { useMessage } from 'naive-ui'
import { defineComponent } from 'vue'
import ImportStepCard from '@/components/importComps/ImportStepCard.vue'
import DeployStepCard from '@/components/deployComps/DeployStepCard.vue'
import { SaveAltRound, StartTwotone, CancelOutlined } from '@vicons/material'
import {
  type Job,
  type Step,
  DeleteJob,
  SaveJob,
  FetchJob,
  DeleteStep,
  ExecuteJob
} from '../service/api'
import {
  stepTypeOptions,
  transportRequestColums,
  toStepCardStatus,
  toLocalTime,
  toJobStatusTag
} from '@/service/consts'
import { Edit16Regular, Delete28Regular } from '@vicons/fluent'
import ImportConfig from '@/components/importComps/ImportConfig.vue'
import DeployConfig from '@/components/deployComps/DeployConfig.vue'
import ImportLog from '@/components/importComps/ImportLog.vue'
import DeployLog from '@/components/deployComps/DeployLog.vue'
import IconBtn from '@/components/IconBtn.vue'
import UnDeployStepCard from '@/components/undeployComps/UndeployStepCard.vue'
import UndeployStepCard from '@/components/undeployComps/UndeployStepCard.vue'
import UndeployConfig from '@/components/undeployComps/UndeployConfig.vue'
import UndeployLog from '@/components/undeployComps/UndeployLog.vue'
export default defineComponent({
  props: {
    jobId: { required: true, type: String }
  },
  components: {
    ImportStepCard,
    DeployStepCard,
    ImportConfig,
    DeployConfig,
    ImportLog,
    DeployLog,
    Edit16Regular,
    Delete28Regular,
    SaveAltRound,
    StartTwotone,
    IconBtn,
    CancelOutlined,
    UndeployStepCard,
    UndeployConfig,
    UndeployLog
  },
  created() {
    this.refresh()
  },
  watch: {
    status() {
      if (this.status !== 'Running') {
        return
      }
      const id = setInterval(() => {
        if (this.status !== 'Running') {
          clearInterval(id)
          return
        }
        this.refresh()
      }, 3000)
    }
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
      status: '',
      showModal: false,
      mapStatus: toStepCardStatus,
      toLocalTime,
      toJobStatusTag
    }
  },
  computed: {
    triggerInfo() {
      // print the trigger info of the first step
      if (!this.jobInstance.Steps || this.jobInstance.Steps.length === 0) {
        return 'Job Not Triggered'
      }
      return `Triggred by: ${this.jobInstance.Steps[0].TriggeredBy} at ${this.toLocalTime(this.jobInstance.Steps[0].TriggeredAt)}`
    },
    filterStepType() {
      //filter mannually choose step types
      const jobType = this.jobInstance.Type
      switch (jobType) {
        case 'Deploy':
          return {
            Deploy: stepTypeOptions['Deploy'],
            Undeploy: stepTypeOptions['Undeploy']
          }
        case 'Import':
          return {
            Import: stepTypeOptions['Import']
          }
        default:
          return {}
      }
    }
  },
  methods: {
    handleCreateStep(stepType: string) {
      if (!this.editing) {
        this.message.error('Not in edit mode.')
        return
      }
      const newStep: Step = {
        ID: 0,
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
      this.showModal = true
    },
    handleCloseStep(step: Step, index: number) {
      if (!this.editing) {
        this.message.error('Not in edit mode')
        return
      }
      if (step.ID == 0) {
        this.jobInstance.Steps = this.jobInstance.Steps.filter((v, i) => i != index)
        this.message.info(`Removed an draft step: ${this.current}`)
        return
      }
      if (step.Status === 'Success' || step.Status === 'Running' || step.Status === 'Error') {
        this.message.warning(`Step with status ${step.Status} cannot be deleted.`)
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
        window.$message.success('Job Triggered')
        this.refresh()
      })
    },
    refresh() {
      FetchJob(this.jobId).then((job) => {
        this.editing = false
        this.jobInstance = job as Job
        this.status = this.jobInstance.Status
        window.$message.success('Job Refreshed')
        return job
      })
    },
    checkStatus(step: Step) {
      // if (step.Status === 'Success' || step.Status === 'Running' || step.Status === 'Error') {
      //   window.$message.warning(`Step with status ${step.Status} cannot be modified.`)
      //   return false
      // }
      return true
    },
    comps(step: Step) {
      switch (step.Type) {
        case 'Import':
          return {
            stepCard: ImportStepCard,
            config: ImportConfig,
            log: ImportLog
          }
        case 'Deploy':
          return {
            stepCard: DeployStepCard,
            config: DeployConfig,
            log: DeployLog
          }
        case 'Undeploy':
          return {
            stepCard: UnDeployStepCard,
            config: UndeployConfig,
            log: UndeployLog
          }
        default:
          return {
            stepCard: ImportStepCard,
            config: ImportConfig,
            log: ImportLog
          }
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
