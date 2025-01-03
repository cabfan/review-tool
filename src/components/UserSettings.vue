<template>
  <el-form :model="form" label-width="80px" class="settings-form">
    <el-form-item label="用户名">
      <el-input v-model="form.username" placeholder="请输入用户名" class="full-width" />
    </el-form-item>
    <el-form-item label="邮箱">
      <el-input v-model="form.email" placeholder="请输入邮箱" class="full-width" />
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
  username: userStore.username,
  email: userStore.email
})

function saveSettings() {
  if (!form.value.username || !form.value.email) {
    ElMessage.warning('请填写完整信息')
    return
  }
  userStore.setUser(form.value.username, form.value.email)
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