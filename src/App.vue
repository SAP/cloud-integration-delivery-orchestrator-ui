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
    // const subContent = this.$router.currentRoute.value.name
    const subContent = 'Home'
    return {
      subContent
    }
  }
})
</script>

<template>
  <n-affix :trigger-top="0">
    <n-flex>
      <n-icon size="30px">
        <IosArrowBack @click="handleBack" />
      </n-icon>
      <n-image width="70" src="/SAP_BIG.png" preview-disabled @click="handleHome" />
      <h2>{{ subContent }}</h2>
    </n-flex>
  </n-affix>

  <div class="body-class">
    <router-view />
  </div>
</template>

<style scoped>
.n-affix {
  width: 100%;
  height: 64px;
  z-index: 999;
  background-color: white;
  box-shadow: 0 3px 5px gray;
  padding: 0px 44px;
}

.n-flex {
  align-items: center;
}
.body-class {
  padding-top: 70px;
}
</style>
