<template>
  <div class="app-container">
    <el-config-provider>
      <router-view></router-view>
    </el-config-provider>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useUserStore } from './stores/user'

const userStore = useUserStore()

onMounted(() => {
  // 检查是否已设置用户信息
  if (!userStore.isUserSet) {
    userStore.showUserSettingsDialog()
  }
})
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
}

.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 覆盖element-plus的一些默认样式 */
.el-tabs__content {
  padding: 0 !important;
}

.el-main {
  --el-main-padding: 0 !important;
}
</style> 