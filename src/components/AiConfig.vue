<template>
  <el-form :model="form" label-width="80px" class="settings-form">
    <el-form-item label="API地址">
      <el-input v-model="form.baseUrl" placeholder="请输入API地址" class="full-width" />
    </el-form-item>
    <el-form-item label="API密钥">
      <el-input v-model="form.apiKey" placeholder="请输入API密钥" class="full-width" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="saveSettings">保存</el-button>
      <el-button @click="$emit('close')">取消</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '../stores/user'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['close'])
const userStore = useUserStore()

const form = ref({
  baseUrl: userStore.aiBaseUrl,
  apiKey: userStore.aiApiKey
})

function saveSettings() {
  if (!form.value.baseUrl || !form.value.apiKey) {
    ElMessage.warning('请填写完整信息')
    return
  }
  userStore.setAiConfig(form.value.baseUrl, form.value.apiKey)
  emit('close')
}
</script>

<style scoped>
.settings-form {
  padding: 20px;
}

.full-width {
  width: 100%;
}

:deep(.el-form-item__content) {
  width: calc(100% - 80px);
}
</style> 