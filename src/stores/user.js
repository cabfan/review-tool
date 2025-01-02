import { defineStore } from 'pinia'
import { ref, computed, h, reactive } from 'vue'
import { ElMessageBox, ElMessage, ElInput, ElForm, ElFormItem } from 'element-plus'

export const useUserStore = defineStore('user', () => {
  const username = ref('')
  const email = ref('')
  const aiBaseUrl = ref('')
  const aiApiKey = ref('')

  const isUserSet = computed(() => username.value && email.value)
  const isAiConfigSet = computed(() => aiBaseUrl.value && aiApiKey.value)

  // 从localStorage加载保存的设置
  function loadSettings() {
    const savedSettings = localStorage.getItem('gitReviewSettings')
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      username.value = settings.username || ''
      email.value = settings.email || ''
      aiBaseUrl.value = settings.aiBaseUrl || ''
      aiApiKey.value = settings.apiKey || ''
    }
  }

  // 保存设置到localStorage
  function saveSettings() {
    const settings = {
      username: username.value,
      email: email.value,
      aiBaseUrl: aiBaseUrl.value,
      apiKey: aiApiKey.value
    }
    localStorage.setItem('gitReviewSettings', JSON.stringify(settings))
  }

  function showUserSettingsDialog() {
    const formData = reactive({
      username: username.value,
      email: email.value
    })

    ElMessageBox({
      title: '用户设置',
      message: h(ElForm, { model: formData, labelPosition: 'top' }, {
        default: () => [
          h(ElFormItem, { label: '用户名' }, {
            default: () => h(ElInput, {
              modelValue: formData.username,
              'onUpdate:modelValue': (val) => formData.username = val,
              placeholder: '请输入用户名',
              clearable: true,
              autofocus: true
            })
          }),
          h(ElFormItem, { label: '邮箱' }, {
            default: () => h(ElInput, {
              modelValue: formData.email,
              'onUpdate:modelValue': (val) => formData.email = val,
              placeholder: '请输入邮箱',
              clearable: true
            })
          })
        ]
      }),
      showCancelButton: true,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      beforeClose: (action, instance, done) => {
        if (action === 'confirm') {
          if (!formData.username || !formData.email) {
            ElMessage.warning('用户名和邮箱都不能为空')
            return
          }
          username.value = formData.username.trim()
          email.value = formData.email.trim()
          saveSettings()
          ElMessage.success('用户设置已保存')
        }
        done()
      }
    }).catch(() => {
      // 取消时不做任何处理
    })
  }

  function showAiConfigDialog() {
    const formData = reactive({
      baseUrl: aiBaseUrl.value,
      apiKey: aiApiKey.value
    })

    ElMessageBox({
      title: 'AI设置',
      message: h(ElForm, { model: formData, labelPosition: 'top' }, {
        default: () => [
          h(ElFormItem, { label: 'Base URL' }, {
            default: () => h(ElInput, {
              modelValue: formData.baseUrl,
              'onUpdate:modelValue': (val) => formData.baseUrl = val,
              placeholder: '请输入AI服务的Base URL',
              clearable: true,
              autofocus: true
            })
          }),
          h(ElFormItem, { label: 'API Key' }, {
            default: () => h(ElInput, {
              modelValue: formData.apiKey,
              'onUpdate:modelValue': (val) => formData.apiKey = val,
              type: 'password',
              placeholder: '请输入API Key',
              showPassword: true,
              clearable: true
            })
          })
        ]
      }),
      showCancelButton: true,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      beforeClose: (action, instance, done) => {
        if (action === 'confirm') {
          if (!formData.baseUrl || !formData.apiKey) {
            ElMessage.warning('Base URL和API Key都不能为空')
            return
          }
          aiBaseUrl.value = formData.baseUrl.trim()
          aiApiKey.value = formData.apiKey.trim()
          saveSettings()
          ElMessage.success('AI设置已保存')
        }
        done()
      }
    }).catch(() => {
      // 取消时不做任何处理
    })
  }

  // 初始化时加载设置
  loadSettings()

  return {
    username,
    email,
    aiBaseUrl,
    aiApiKey,
    isUserSet,
    isAiConfigSet,
    showUserSettingsDialog,
    showAiConfigDialog
  }
}) 