<script lang="ts">
import { defineComponent } from 'vue'
import { IosArrowBack } from '@vicons/ionicons4'
export default defineComponent({
  components: {
    IosArrowBack
  },
  methods: {
    handleBack() {
      this.$router.go(-1)
    },
    handleHome() {
      this.$router.push('/')
    }
  },
  data() {
    return {
      route: this.$router
    }
  }
})
</script>

<template>
  <div class="header-class">
    <n-flex>
      <n-icon size="30px">
        <IosArrowBack @click="handleBack" />
      </n-icon>
      <n-image width="70" src="/SAP_BIG.png" preview-disabled @click="handleHome" />
      <h2>{{ route.currentRoute.name }}</h2>
    </n-flex>
  </div>

  <div class="body-class">
    <n-message-provider placement="bottom-left">
      <router-view />
    </n-message-provider>
  </div>
</template>

<style scoped>
.header-class {
  width: 100%;
  z-index: 999;
  background-color: white;
  box-shadow: 0 3px 5px gray;
  position: sticky;
  top: 0;
}

.n-flex {
  align-items: center;
}
.body-class {
  margin-top: 10px;
}
</style>
