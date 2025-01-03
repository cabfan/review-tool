import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

export const useUserStore = defineStore('user', () => {
  const _username = ref('')
  const _email = ref('')
  const _aiBaseUrl = ref('')
  const _aiApiKey = ref('')

  const isUserSet = computed(() => _username.value && _email.value)
  const isAiConfigSet = computed(() => _aiBaseUrl.value && _aiApiKey.value)

  // 从localStorage加载保存的设置
  function loadSettings() {
    _username.value = localStorage.getItem('username') || ''
    _email.value = localStorage.getItem('email') || ''
    _aiBaseUrl.value = localStorage.getItem('aiBaseUrl') || ''
    _aiApiKey.value = localStorage.getItem('aiApiKey') || ''
  }

  function setUser(username, email) {
    localStorage.setItem('username', username)
    localStorage.setItem('email', email)
    _username.value = username
    _email.value = email
    ElMessage.success('用户信息已保存')
  }

  function setAiConfig(baseUrl, apiKey) {
    localStorage.setItem('aiBaseUrl', baseUrl)
    localStorage.setItem('aiApiKey', apiKey)
    _aiBaseUrl.value = baseUrl
    _aiApiKey.value = apiKey
    ElMessage.success('AI配置已保存')
  }

  // 初始化时加载设置
  loadSettings()

  return {
    username: computed(() => _username.value),
    email: computed(() => _email.value),
    aiBaseUrl: computed(() => _aiBaseUrl.value),
    aiApiKey: computed(() => _aiApiKey.value),
    isUserSet,
    isAiConfigSet,
    setUser,
    setAiConfig
  }
}) 