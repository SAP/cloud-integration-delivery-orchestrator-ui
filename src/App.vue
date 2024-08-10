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
  <div class="header-class">
    <n-flex>
      <n-icon size="30px">
        <IosArrowBack @click="handleBack" />
      </n-icon>
      <n-image width="70" src="/SAP_BIG.png" preview-disabled @click="handleHome" />
      <h2>{{ subContent }}</h2>
    </n-flex>
  </div>

  <div class="body-class">
    <router-view />
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
