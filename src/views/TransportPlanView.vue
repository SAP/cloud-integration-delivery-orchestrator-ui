<template>
  <n-modal v-model:show="showModal" preset="dialog">
    <template #header>
      <n-gradient-text type="success">#{{ current }}</n-gradient-text> Transport Plan
    </template>
    <n-flex class="table-class" vertical align="start" v-if="current > 0">
      Choose Transport Group:
      <n-select @update:value="handleSelectTransportGroup" :options="transportGroupOptions" />
      <div v-if="selectedTransportGroup && Object.keys(selectedTransportGroup).length">
        <n-flex vertical>
          Import Nodes:
          <n-tag v-for="(transportNode, i) in selectedTransportGroup.TransportNodes" :key="i">
            {{ transportNode.name }}
          </n-tag>
          Deploy Nodes(CPI Tenants):
          <n-tag v-for="(cpiEndpoint, i) in selectedTransportGroup.DeployEndpoints" :key="i">
            {{ cpiEndpoint }}
          </n-tag>
        </n-flex>
      </div>

      Yaml Content:
      <n-input
        v-model:value="yamlContent"
        placeholder="yaml content"
        type="textarea"
        size="large"
        :autosize="{ minRows: 3 }"
      />
    </n-flex>
    <template #action>
      <n-button @click="handleParse">Parse</n-button>
    </template>
  </n-modal>
  <div style="margin: 0 42px">
    <!-- head -->
    <n-card class="header-card-shadow-class">
      <n-grid x-gap="10" :cols="5">
        <!-- transport plan name and desctiption -->
        <n-gi>
          <n-flex vertical>
            <!-- plan name -->
            <n-input
              class="ui5-title-root"
              v-model:value="transportPlan.Name"
              placeholder="Transport Plan Name"
              clearable
              autofocus
              v-if="editing"
            />
            <span class="ui5-title-root" v-else-if="transportPlan.Name">
              <n-text depth="3"> Transport Plan Name: </n-text>
              {{ transportPlan.Name }}
            </span>
            <!-- plan description -->
            <n-input
              v-model:value="transportPlan.Description"
              placeholder="Transport Plan Description"
              size="large"
              clearable
              v-if="editing"
            />
            <n-text style="font-weight: bold" v-else-if="transportPlan.Description">
              {{ transportPlan.Description }}
            </n-text>
          </n-flex>
        </n-gi>

        <!-- plan basic information -->
        <n-gi span="2">
          <n-flex vertical>
            <n-text depth="3" style="font-size: 12px" strong>
              Created By: {{ transportPlan.CreatedBy }} at{{ toLocalTime(transportPlan.CreatedAt) }}
            </n-text>
            <n-text depth="3" style="font-size: 12px" strong>
              Updated By: {{ transportPlan.UpdatedBy }} at
              {{ toLocalTime(transportPlan.UpdatedAt) }}
            </n-text>
          </n-flex>
        </n-gi>
        <!-- transport plan status tag -->
        <n-gi>
          <n-tag type="info"> Status? </n-tag>
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
          <IconBtn tip="Delete" :handler="handleDelete" v-if="!editing" color="#df423a">
            <Delete28Regular />
          </IconBtn>

          <n-divider vertical />

          <!-- Submit Button -->
          <IconBtn tip="Save" :handler="handleSave" v-if="editing">
            <SaveAltRound />
          </IconBtn>
        </n-gi>
      </n-grid>
    </n-card>

    <!-- step list with config view -->
    <n-card class="card-shadow-class">
      <div style="margin-bottom: 15px; font-size: 15px; font-weight: bold">
        Transport Plan <n-gradient-text type="success">#{{ transportPlan.ID }}</n-gradient-text>
      </div>
      <n-grid x-gap="40" :cols="5">
        <!-- step lists -->
        <n-gi span="3">
          <n-steps vertical :current="current" @update:current="handleCurrent">
            <!-- parse yaml step -->
            <n-step @click="showModal = true">
              <template #title> Create Transport Plan </template>
              <n-card hoverable size="medium">
                <n-text depth="3" style="font-size: medium">Transport Group: </n-text>
                <n-text strong>
                  {{ transportGroupInfo.Name }} - {{ transportGroupInfo.Description }}
                </n-text>

                <n-gradient-text type="success" :size="18">
                  #{{ transportGroupInfo.ID }}
                </n-gradient-text>
                <p />
                <n-text depth="3" style="font-size: medium">Transport Requests:</n-text>
                <div />
                <n-tag v-for="(tr, i) in transportPlan.TransportRequests" :key="i" type="info" :bordered="false" style="margin-right: 5px">
                  {{ tr.ID }}
                </n-tag>
                <div />
                <n-text depth="3" style="font-size: medium"> Artifacts: </n-text>

                <div />
                <n-tag
                  v-for="(artifact, i) in transportPlan.Artifacts"
                  :key="i"
                  :bordered="false"
                  type="info"
                  style="margin-right: 5px"
                >
                  {{ artifact.Id }}:{{ artifact.Version }}
                </n-tag>
              </n-card>
            </n-step>
            <!-- generate import step -->
            <n-step>
              <template #title> Generate Import Job </template>
              <n-card hoverable size="medium">
                <n-text depth="3" style="font-size: medium"> Target Tms Nodes: </n-text>
                <div />

                <n-tag
                  v-for="(node, i) in tmsNodes"
                  :key="i"
                  style="margin-bottom: 5px"
                  type="info"
                  :bordered="false"
                >
                  #{{ node.id }} {{ node.name }} - {{ node.description }}
                </n-tag>
                <div />

                <n-text depth="3" style="font-size: medium"> Transport Requests: </n-text>
                <div />
                <n-tag
                  v-for="(tr, i) in transportPlan.TransportRequests"
                  :key="i"
                  style="margin-bottom: 5px"
                  type="info"
                  :bordered="false"
                >
                  {{ tr.ID }} - {{ tr.Description }}
                </n-tag>

                <div />
                <n-button @click="handleGenImportJob">Generate</n-button>
                <div />

                <n-text depth="3" style="font-size: medium"> Import Job: </n-text>
                <n-gradient-text type="success" :size="15">
                  #{{ transportPlan.ImportJobId }}
                </n-gradient-text>
              </n-card>
            </n-step>
            <!-- generate deploy step -->
            <n-step>
              <template #title> Generate Deploy Job </template>
              <n-card hoverable size="medium">
                <n-text depth="3" style="font-size: medium"> Target CPI Tenants: </n-text>
                <div/>
                <n-tag v-for="(cpiEndpoint, i) in cpiTenants" :key="i" type="info" :bordered="false">{{ cpiEndpoint }}</n-tag>
                
                <div/>
                <n-text depth="3" style="font-size: medium">Artifacts:</n-text>
                <div/>
                <n-tag v-for="(artifact, i) in transportPlan.Artifacts" :key="i" type="info" :bordered="false" style="margin-right: 5px">
                  {{ artifact.Id }}:{{ artifact.Version }}
                </n-tag>

                <div/>
                <n-button @click="handleGenDeployJob">Generate</n-button>
                <div/>
                <n-text depth="3" style="font-size: medium">Deploy Job:</n-text>
                <n-gradient-text type="success" :size="15">
                  #{{ transportPlan.DeployJobId }}
                </n-gradient-text>
              </n-card>
            </n-step>
          </n-steps>
        </n-gi>
        <n-gi span="2">
          Log
        </n-gi>
      </n-grid>
    </n-card>
  </div>
</template>

<script lang="ts">
import {
  DeleteTransportPlan,
  GenDeployJob,
  GenImportJob,
  GetTransportGroups,
  GetTransportPlan,
  ParseTransportPlan,
  SaveTransportPlan,
  type TransportGroup,
  type TransportPlan
} from '@/service/api'
import { toJobStatusTag, toLocalTime } from '@/service/consts'
import { Edit16Regular, Delete28Regular } from '@vicons/fluent'
import { SaveAltRound, StartTwotone, CancelOutlined } from '@vicons/material'
import IconBtn from '@/components/IconBtn.vue'

export default {
  name: 'TransportPlanView',
  components: {
    Edit16Regular,
    Delete28Regular,
    SaveAltRound,
    StartTwotone,
    CancelOutlined,
    IconBtn
  },
  props: { planId: { required: true, type: Number } },
  data() {
    return {
      showModal: false,
      transportPlan: {} as TransportPlan,
      editing: false,
      current: 0,
      toLocalTime,
      yamlContent: '',
      transportGroupOptions: [] as { label: string; value: TransportGroup }[],
      selectedTransportGroup: {} as TransportGroup
    }
  },
  methods: {
    onEdit() {
      this.editing = true
    },
    refresh() {
      this.editing = false
      GetTransportPlan(this.planId).then((res) => {
        this.transportPlan = res
      })
    },
    handleDelete() {
      DeleteTransportPlan(this.planId).then(() => {
        this.$router.go(-1)
      })
    },
    handleSave() {
      this.editing = false
      SaveTransportPlan(this.transportPlan).then(() => {
        this.refresh()
      })
    },
    handleCurrent(current: number) {
      this.current = current
    },
    handleSelectTransportGroup(val: TransportGroup) {
      this.transportPlan.TransportGroupID = val.ID
      this.transportPlan.TransportGroupName = val.Name
      this.selectedTransportGroup = val
    },
    handleParse() {
      if (!this.yamlContent || this.transportPlan.TransportGroupID === 0) {
        window.$message.warning('empty yaml content or transport group')
        return
      }
      ParseTransportPlan(
        this.yamlContent,
        this.transportPlan.TransportGroupID,
        this.transportPlan.ID
      ).then(() => {})
    },
    handleGenImportJob() {
      // generate import job
      GenImportJob(this.transportPlan.ID).then(() => {
        this.refresh()
      })
    },
    handleGenDeployJob() {
      GenDeployJob(this.transportPlan.ID).then(() => {
        this.refresh()
      })
    }
  },
  computed: {
    transportGroupInfo() {
      if (!this.transportPlan.TransportGroupID || !this.transportGroupOptions.length)
        return {} as TransportGroup
      return this.transportGroupOptions.filter(
        (item) => item.value.ID === this.transportPlan.TransportGroupID
      )[0].value
    },
    tmsNodes() {
      // tms nodes info for current transport plan
      if (!this.transportPlan.TransportGroupID || !this.transportGroupOptions.length) return []
      return this.transportGroupOptions.filter(
        (item) => item.value.ID === this.transportPlan.TransportGroupID
      )[0].value.TransportNodes
    },
    cpiTenants() {
      // cpi tenants info for current transport plan
      if (!this.transportPlan.TransportGroupID || !this.transportGroupOptions.length) return []
      return this.transportGroupOptions.filter(
        (item) => item.value.ID === this.transportPlan.TransportGroupID
      )[0].value.DeployEndpoints
    }
  },
  created() {
    this.refresh()
    GetTransportGroups().then((res) => {
      this.transportGroupOptions = res.map((transportGroup: TransportGroup) => {
        return {
          label: `${transportGroup.Name} - ${transportGroup.Description}`,
          value: transportGroup
        }
      })
    })
  }
}
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

.ui5-title-root {
  font-weight: bold;
  font-size: larger;
}
.card-shadow-class {
  border-radius: 0.5rem;
  box-shadow:
    0 0 0.125rem 0 rgba(34, 53, 72, 0.2),
    0 0.125rem 0.25rem 0 rgba(34, 53, 72, 0.2);
  margin-bottom: 10px;
}
</style>
