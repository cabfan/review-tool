<template>
  <div class="home">
    <el-container>
      <el-header>
        <div class="header-content">
          <h2>Review Tool</h2>
          <div class="header-actions">
            <el-select v-model="repoType" placeholder="选择仓库类型" style="width: 120px">
              <el-option label="Git" value="git" />
              <el-option label="SVN" value="svn" />
            </el-select>
            <el-button type="primary" @click="selectRepo" :disabled="!userStore.isUserSet">
              选择{{ repoType.toUpperCase() }}项目
            </el-button>
            <el-button @click="showUserSettings">
              用户设置
              <el-icon v-if="userStore.isUserSet" class="setting-status"><Check /></el-icon>
            </el-button>
            <el-button @click="showAiConfig">
              AI设置
              <el-icon v-if="userStore.isAiConfigSet" class="setting-status"><Check /></el-icon>
            </el-button>
          </div>
        </div>
      </el-header>
      
      <el-main v-if="currentRepo">
        <el-tabs v-model="activeTab" class="main-tabs">
          <el-tab-pane label="提交记录" name="commits">
            <div class="commits-container table-wrapper">
              <el-table :data="commits" style="width: 100%">
                <el-table-column 
                  type="index" 
                  label="序号" 
                  width="70"
                  :index="getIndex"
                />
                <el-table-column prop="hash" label="提交Hash" width="100" />
                <el-table-column prop="date" label="日期" width="200" />
                <el-table-column prop="author" label="作者" width="200" />
                <el-table-column prop="message" label="提交信息" />
                <el-table-column fixed="right" label="操作" width="120">
                  <template #default="scope">
                    <el-button link type="primary" @click="viewDiff(scope.row)">
                      查看差异
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              
              <div class="pagination-container">
                <el-pagination
                  v-model:current-page="currentPage"
                  v-model:page-size="pageSize"
                  :page-sizes="[20, 50, 100]"
                  :total="totalCommits"
                  :pager-count="7"
                  background
                  :small="true"
                  prev-text="上一页"
                  next-text="下一页"
                  layout="total, sizes, prev, pager, next, jumper"
                  :page-size-opts="[
                    { value: 20, label: '20条/页' },
                    { value: 50, label: '50条/页' },
                    { value: 100, label: '100条/页' }
                  ]"
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
                >
                  <template #total>
                    共 {{ totalCommits }} 条
                  </template>
                  <template #jumper>
                    前往第
                    <el-input
                      v-model.number="currentPage"
                      class="jump-input"
                      size="small"
                    />
                    页
                  </template>
                </el-pagination>
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="代码差异" name="diff" v-if="selectedCommit">
            <div class="diff-container">
              <div class="diff-header">
                <h3>提交: {{ selectedCommit.message }}</h3>
                <el-button type="primary" @click="analyzeCode" 
                  :disabled="!userStore.isAiConfigSet" 
                  :loading="isAnalyzing">
                  AI代码分析
                </el-button>
              </div>

              <div v-if="isLoadingDiff" class="diff-loading">
                <el-icon class="loading-icon" :size="24"><Loading /></el-icon>
                <span>正在加载差异内容...</span>
              </div>

              <div v-else class="diff-scroll-area">
                <div class="diff-content" v-for="file in diffFiles" :key="file.path">
                  <div class="file-header">{{ file.path }}</div>
                  <div class="diff-view-wrapper">
                    <pre class="diff-view" v-html="formatDiff(file.diff)"></pre>
                  </div>
                </div>
              </div>
              
              <el-dialog
                v-model="showAnalysisDialog"
                title="AI 代码分析"
                width="800px"
                class="analysis-dialog"
                :modal-append-to-body="false"
                :close-on-click-modal="false"
                :close-on-press-escape="false"
                destroy-on-close
              >
                <div v-if="aiAnalysis" class="analysis-content">
                  <div class="analysis-meta">
                    <div class="meta-info">
                      <span>分析时间: {{ aiAnalysis.timestamp }}</span>
                      <span>审查者: {{ aiAnalysis.reviewer }}</span>
                    </div>
                    <el-button
                      type="primary"
                      link
                      :icon="DocumentCopy"
                      @click="copyAnalysis"
                      :loading="isCopying"
                    >
                      复制分析结果
                    </el-button>
                  </div>
                  <div v-if="isAnalyzing && aiAnalysis.items.length === 0" class="analysis-loading">
                    <el-icon class="loading-icon" :size="24"><Loading /></el-icon>
                    <span>正在分析中...</span>
                  </div>
                  <template v-else>
                    <div class="markdown-body"
                         style="max-height: 400px; overflow-y: auto;"
                         v-html="renderMarkdown(aiAnalysis.items[0]?.content || '')">
                    </div>
                  </template>
                  <div v-if="isTyping && !aiAnalysis.items[0]?.content.endsWith('```')" class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
                <template #footer>
                  <span class="dialog-footer">
                    <el-button @click="closeAnalysis">关闭</el-button>
                  </span>
                </template>
              </el-dialog>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-main>
      
      <el-main v-else>
        <el-empty description="请选择Git项目目录" />
      </el-main>
    </el-container>
  </div>

  <el-dialog
    v-model="userSettingsVisible"
    title="用户设置"
    width="500px"
    :close-on-click-modal="false"
  >
    <user-settings @close="userSettingsVisible = false" />
  </el-dialog>

  <el-dialog
    v-model="aiConfigVisible"
    title="AI设置"
    width="500px"
    :close-on-click-modal="false"
  >
    <ai-config @close="aiConfigVisible = false" />
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { Check, Loading, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'  // 使用 GitHub 风格的代码高亮样式
import MarkdownIt from 'markdown-it'
import 'github-markdown-css'
import UserSettings from '../components/UserSettings.vue'
import AiConfig from '../components/AiConfig.vue'

const userStore = useUserStore()
const currentRepo = ref(null)
const commits = ref([])
const selectedCommit = ref(null)
const diffFiles = ref([])
const aiAnalysis = ref({
  timestamp: '',
  reviewer: '',
  items: []
})
const activeTab = ref('commits')
const isAnalyzing = ref(false)
const showAnalysisDialog = ref(false)
const currentText = ref('')
const isTyping = ref(false)
const currentPage = ref(1)
const pageSize = ref(50)
const totalCommits = ref(0)
const repoType = ref('git')
const repoPath = ref('')
const isLoadingDiff = ref(false)
const isCopying = ref(false)
const userSettingsVisible = ref(false)
const aiConfigVisible = ref(false)

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return ''
  }
})

async function selectDirectory() {
  const path = await window.electronAPI.selectDirectory()
  if (path) {
    currentRepo.value = path
    currentPage.value = 1
    await loadCommits()
  }
}

async function loadCommits() {
  if (!currentRepo.value) return
  
  try {
    const result = repoType.value === 'git'
      ? await window.electronAPI.git.getCommits({
          repoPath: currentRepo.value,
          page: currentPage.value,
          pageSize: pageSize.value
        })
      : await window.electronAPI.svn.getCommits(
          currentRepo.value,
          currentPage.value,
          pageSize.value
        )
    
    commits.value = result.commits.map(commit => ({
      hash: commit.hash.substring(0, 7),
      date: new Date(commit.date).toLocaleString(),
      author: commit.author,
      message: commit.message,
      fullHash: commit.hash
    }))
    
    if (result.total) {
      totalCommits.value = result.total
    }
  } catch (error) {
    ElMessage.error(`加载${repoType.value.toUpperCase()}提交记录失败`)
  }
}

async function viewDiff(commit) {
  selectedCommit.value = commit
  activeTab.value = 'diff'
  isLoadingDiff.value = true
  diffFiles.value = [] // 清空之前的差异内容
  
  try {
    const diff = repoType.value === 'git'
      ? await window.electronAPI.git.show(currentRepo.value, commit.fullHash)
      : await window.electronAPI.svn.diff(currentRepo.value, commit.hash)
    
    // 如果是数组（SVN的情况），直接使用，否则解析Git的输出
    diffFiles.value = Array.isArray(diff) ? diff : parseDiff(diff)
  } catch (error) {
    ElMessage.error(`加载${repoType.value.toUpperCase()}差异失败: ${error.message}`)
  } finally {
    isLoadingDiff.value = false
  }
}

function parseDiff(diff) {
  // 简单的diff解析，实际项目中可能需要更复杂的解析
  return [{
    path: 'Changed files',
    diff: diff
  }]
}

async function analyzeCode() {
  if (!selectedCommit.value || !userStore.aiBaseUrl || !userStore.aiApiKey) {
    ElMessage.warning('请先完成AI设置并选择提交')
    return
  }

  // 验证基本的 URL 格式
  try {
    new URL(userStore.aiBaseUrl)
  } catch (error) {
    ElMessage.error('API地址格式无效，请输入有效的URL')
    return
  }
  
  showAnalysisDialog.value = true
  isAnalyzing.value = true
  isTyping.value = false
  
  // 重置分析结果
  aiAnalysis.value = {
    timestamp: new Date().toLocaleString(),
    reviewer: `${userStore.username} <${userStore.email}>`,
    items: []
  }
  
  let cleanup = null
  try {
    cleanup = window.electronAPI.ai.onChunk((chunk) => {
      if (!chunk) return

      try {
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') {
            isTyping.value = false
            isAnalyzing.value = false
            return
          }

          try {
            const json = JSON.parse(data)
            const content = json.choices[0]?.delta?.content || ''
            if (content) {
              isTyping.value = true
              if (aiAnalysis.value.items.length === 0) {
                aiAnalysis.value.items.push({ content: '' })
              }
              aiAnalysis.value.items[0].content += content
            }
          } catch (e) {
            console.error('Error parsing chunk JSON:', e)
          }
        }
      } catch (e) {
        console.error('Error processing chunk:', e)
      }
    })

    // 构建分析提示
    const prompt = `请对以下${repoType.value.toUpperCase()}代码进行全面的代码审查和评分（满分100分）。
请严格按照以下格式输出分析结果，并确保标注具体的文件路径和行号：

\`\`\`markdown
# 文件变更概览
${diffFiles.value.map(f => `* ${f.path}`).join('\n')}

# 安全性评估 (20分)
评分标准：
* 安全漏洞检查（SQL注入、XSS等）(8分)
* 敏感信息处理 (4分)
* 权限控制机制 (4分)
* 数据验证和清理 (4分)

发现的问题：
* [文件路径:行号] 具体问题描述及修复建议
* ...

# 性能分析 (20分)
评分标准：
* 计算密集操作优化 (5分)
* 资源使用效率 (5分)
* DOM操作效率 (5分)
* 内存管理 (5分)

发现的问题：
* [文件路径:行号] 具体问题描述及优化建议
* ...

# 代码质量 (20分)
评分标准：
* 命名规范和可读性 (5分)
* 代码重复和冗余 (5分)
* 注释完整性和质量 (5分)
* 单一职责原则遵循 (5分)

发现的问题：
* [文件路径:行号] 具体问题描述及改进建议
* ...

# 架构设计 (20分)
评分标准：
* 模块化和解耦 (5分)
* 设计模式使用 (5分)
* 扩展性 (5分)
* 维护性 (5分

发现的问题：
* [文件路径:行号] 具体问题描述及架构建议
* ...

# 错误处理 (20分)
评分标准：
* 异常捕获完整性 (5分)
* 错误恢复机制 (5分)
* 日志记录 (5分)
* 用户反馈机制 (5分)

发现的问题：
* [文件路径:行号] 具体问题描述及完善建议
* ...

# 总评
* 总分：[计算各部分得分总和]

* 关键发现：
  * 高危问题：
    * [文件路径:行号] 问题描述和严重程度
    * ...
  * 值得改进：
    * [文件路径:行号] 问题描述和优化空间
    * ...

* 优秀实践：
  * [文件路径:行号] 良好实践描述
  * ...

* 改进建议：
  1. 短期优先修复：
     * [文件路径] 具体修复建议和优先级
     * ...
  2. 长期改进方向：
     * [文件路径] 改进建议和预期收益
     * ...

* 附加建议：
  * 测试覆盖
  * 文档完善
  * 部署注意事项
\`\`\`

提交信息：${selectedCommit.value.message}

代码变更：
${diffFiles.value.map(f => `
文件：${f.path}
\`\`\`diff
${f.diff}
\`\`\`
`).join('\n')}
`

    // 发送分析请求
    await window.electronAPI.ai.analyze(
      userStore.aiBaseUrl.trim(),
      userStore.aiApiKey.trim(),
      prompt
    )
  } catch (error) {
    let errorMessage = 'AI分析失败'
    if (error.message) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'AI服务器连接失败，请检查API地址是否正确'
      } else if (error.message.includes('timeout')) {
        errorMessage = 'AI服务器响应超时，请稍后重试'
      } else if (error.message.includes('certificate')) {
        errorMessage = 'SSL证书验证失败，请检查API地址是否正确'
      } else if (error.message.includes('400')) {
        errorMessage = 'API请求格式错误，请检查API地址是否完整，以及API密钥是否正确'
      } else if (error.message.includes('401')) {
        errorMessage = 'API密钥无效或已过期'
      } else if (error.message.includes('403')) {
        errorMessage = 'API密钥没有权限访问该服务'
      } else if (error.message.includes('404')) {
        errorMessage = 'API地址不存在，请检查API地址是否正确'
      } else if (error.message.includes('429')) {
        errorMessage = 'API请求次数超限，请稍后重试'
      } else if (error.message.includes('500')) {
        errorMessage = 'AI服务器内部错误，请稍后重试'
      } else {
        errorMessage += `：${error.message}`
      }
    }
    ElMessage.error(errorMessage)
    showAnalysisDialog.value = false
  } finally {
    if (cleanup) {
      try {
        cleanup()
      } catch (e) {
        console.error('Error cleaning up:', e)
      }
    }
    isAnalyzing.value = false
  }
}

// 修改 markdown 渲染函数
function renderMarkdown(text) {
  if (!text) return ''
  
  // 移除开头的 ```markdown 和结尾的 ```
  let cleanText = text
  if (cleanText.startsWith('```markdown')) {
    cleanText = cleanText.substring('```markdown'.length)
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring('```'.length)
  }
  
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3)
  }
  
  // 去除可能存在的首尾空白字符
  cleanText = cleanText.trim()
  
  return md.render(cleanText)
}

function formatDiff(diff) {
  if (!diff) return ''
  return diff.split('\n').map(line => {
    if (line.startsWith('+')) {
      return `<span class="diff-add">${escapeHtml(line)}</span>`
    } else if (line.startsWith('-')) {
      return `<span class="diff-remove">${escapeHtml(line)}</span>`
    }
    return escapeHtml(line)
  }).join('\n')
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function closeAnalysis() {
  showAnalysisDialog.value = false
  setTimeout(() => {
    aiAnalysis.value = {
      timestamp: '',
      reviewer: '',
      items: []
    }
    currentText.value = ''
    isTyping.value = false
  }, 300)
}

function handleSizeChange(val) {
  pageSize.value = val
  currentPage.value = 1  // 重置到第一页
  loadCommits()
}

function handleCurrentChange(val) {
  currentPage.value = val
  loadCommits()
}

async function getCommits(page = 1, pageSize = 50) {
  try {
    const result = repoType.value === 'git' 
      ? await window.electronAPI.git.getCommits(repoPath.value, page, pageSize)
      : await window.electronAPI.svn.getCommits(repoPath.value, page, pageSize)
    
    commits.value = result.commits
    // ... 处理分页等逻辑 ...
  } catch (error) {
    ElMessage.error(`获取${repoType.value}提交记录失败: ${error.message}`)
  }
}

async function getDiff(commit) {
  try {
    const diff = repoType.value === 'git'
      ? await window.electronAPI.git.show(repoPath.value, commit.hash)
      : await window.electronAPI.svn.diff(repoPath.value, commit.hash)
    
    // ... 处理差异显示逻辑 ...
  } catch (error) {
    ElMessage.error(`获取代码差异失败: ${error.message}`)
  }
}

async function selectRepo() {
  try {
    const result = await window.electronAPI.selectDirectory()
    if (result) {
      if (repoType.value === 'svn') {
        try {
          await window.electronAPI.svn.getCommits(result, 1, 1)
        } catch (error) {
          if (error.message.includes('未安装 SVN')) {
            ElMessageBox.alert(
              '请按照以下步骤安装 SVN 命令行工具：\n\n' +
              '1. 下载并安装 TortoiseSVN (https://tortoisesvn.net/downloads.html)\n' +
              '2. 安装时勾选"command line client tools"\n' +
              '3. 安装完成后重启应用\n\n' +
              '如果已安装 TortoiseSVN，请确保安装时勾选了"command line client tools"选项。',
              'SVN 工具未安装',
              {
                confirmButtonText: '知道了',
                type: 'warning'
              }
            )
            return
          }
        }
      }
      currentRepo.value = result
      currentPage.value = 1
      await loadCommits()
    }
  } catch (error) {
    ElMessage.error(`选择${repoType.value.toUpperCase()}仓库失败: ${error.message}`)
  }
}

// 复制分析结果
async function copyAnalysis() {
  if (!aiAnalysis.value?.items?.[0]?.content) return
  
  isCopying.value = true
  try {
    // 获取纯文本内容（移除 markdown 标记）
    let content = aiAnalysis.value.items[0].content
    if (content.startsWith('```markdown')) {
      content = content.substring('```markdown'.length)
    }
    if (content.endsWith('```')) {
      content = content.substring(0, content.length - 3)
    }
    content = content.trim()
    
    await navigator.clipboard.writeText(content)
    ElMessage.success('分析结果已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败，请手动复制')
    console.error('Copy failed:', error)
  } finally {
    isCopying.value = false
  }
}

function showUserSettings() {
  userSettingsVisible.value = true
}

function showAiConfig() {
  aiConfigVisible.value = true
}

// 检查用户设置
onMounted(() => {
  if (!userStore.isUserSet) {
    userSettingsVisible.value = true
  }
})

// 计算序号
function getIndex(index) {
  return (currentPage.value - 1) * pageSize.value + index + 1
}
</script>

<style scoped>
.home {
  height: 100vh;
  display: flex;
}

.el-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.el-header {
  flex-shrink: 0;
  padding: 0 20px;
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  height: 60px !important;
}

.el-main {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.header-content {
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.main-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.el-tabs__content) {
  flex: 1;
  height: 100%;
  padding: 0;
}

:deep(.el-tab-pane) {
  height: 100%;
}

.commits-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.table-wrapper .el-table {
  flex: 1;
  height: 100%;
}

:deep(.el-table) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

:deep(.el-table__inner-wrapper) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.el-table__body-wrapper) {
  flex: 1;
  overflow-y: auto !important;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  padding: 10px 0;
  background-color: #fff;
}

/* 固定表头 */
:deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 2;
  background-color: #fff;
}

.diff-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.diff-scroll-area {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
  background-color: #fff;
}

.diff-content {
  border-bottom: 1px solid #e6e6e6;
}

.diff-content:last-child {
  border-bottom: none;
}

.file-header {
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: bold;
  padding: 10px;
  background-color: #f1f8ff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #24292e;
}

.diff-view-wrapper {
  background-color: #fff;
}

.diff-view {
  margin: 0;
  padding: 10px;
  white-space: pre;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  tab-size: 2;
}

:deep(.diff-add) {
  display: block;
  background-color: #e6ffec;
  color: #24292f;
}

:deep(.diff-remove) {
  display: block;
  background-color: #ffebe9;
  color: #24292f;
}

.ai-analysis {
  margin-top: 20px;
  flex-shrink: 0;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
}

.analysis-item {
  margin-bottom: 15px;
}

.analysis-item h4 {
  margin-bottom: 5px;
  color: #409EFF;
}

.setting-status {
  margin-left: 5px;
  color: #67c23a;
}

.analysis-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #909399;
  gap: 10px;
}

.loading-icon {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.analysis-dialog {
  :deep(.el-dialog) {
    margin-top: 5vh !important;
    width: 800px !important;
    display: flex;
    flex-direction: column;
  }

  :deep(.el-dialog__header) {
    padding: 15px 20px;
    margin: 0;
    border-bottom: 1px solid #e6e6e6;
    flex-shrink: 0;
  }

  :deep(.el-dialog__body) {
    padding: 20px;
    max-height: 60vh !important;
    overflow-y: auto !important;
    display: flex;
    flex-direction: column;
    margin: 0;
  }

  :deep(.el-dialog__footer) {
    padding: 10px 20px;
    border-top: 1px solid #e6e6e6;
    margin: 0;
    flex-shrink: 0;
  }
}

.analysis-content {
  flex: 1;
  padding-right: 10px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.analysis-meta {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta-info {
  display: flex;
  gap: 20px;
}

.markdown-body {
  color: #24292e;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  padding: 16px;
  overflow-y: auto;
  /* 重置所有元素的默认边距 */
  h1, h2, h3, h4, h5, h6, p, ul, ol {
    margin: 0;
    padding: 0;
  }
}

/* 标题样式 */
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 10px;
  margin-bottom: 6px;
  font-weight: 600;
  line-height: 1.25;
}

/* 标题样式 */
.markdown-body h1 { font-size: 1.6em; }
.markdown-body h2 { font-size: 1.4em; }
.markdown-body h3 { font-size: 1.2em; }
.markdown-body h4 { font-size: 1.1em; }
.markdown-body h5 { font-size: 1em; }
.markdown-body h6 { font-size: 1em; color: #6a737d; }

.markdown-body h1:first-child {
  margin-top: 0;
}

/* 列表样式 */
.markdown-body ul,
.markdown-body ol {
  padding-left: 2em;
  margin-top: 4px;
  margin-bottom: 8px;
  /* 覆盖浏览器默认样式 */
  margin-block-start: 0;
  margin-block-end: 0;
  padding-inline-start: 2em;
}

/* 列表项样式 */
.markdown-body li {
  word-wrap: break-all;
  margin-bottom: 2px;
  /* 确保列表项紧凑 */
  line-height: 1.4;
}

/* 列表项中的段落 */
.markdown-body li p {
  margin-top: 2px;
  margin-bottom: 2px;
}

/* 段落样式 */
.markdown-body p {
  margin-top: 4px;
  margin-bottom: 6px;
  /* 覆盖浏览器默认样式 */
  margin-block-start: 0;
  margin-block-end: 0;
}

/* 嵌套列表的间距 */
.markdown-body ul ul,
.markdown-body ul ol,
.markdown-body ol ol,
.markdown-body ol ul {
  margin-top: 2px;
  margin-bottom: 2px;
}

/* 代码块样式 */
.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27,31,35,0.05);
  border-radius: 3px;
  font-family: SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;
}

.markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 3px;
  margin-bottom: 16px;
}

.markdown-body pre code {
  padding: 0;
  margin: 0;
  font-size: 100%;
  word-break: normal;
  white-space: pre;
  background: transparent;
  border: 0;
}

/* 引用样式 */
.markdown-body blockquote {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 0 0 16px 0;
}

/* 表格样式 */
.markdown-body table {
  border-spacing: 0;
  border-collapse: collapse;
  margin-bottom: 16px;
  width: 100%;
  overflow: auto;
}

.markdown-body table th,
.markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.markdown-body table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}

.markdown-body table tr:nth-child(2n) {
  background-color: #f6f8fa;
}

.typing-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
  gap: 4px;
}

.typing-indicator span {
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: #409EFF;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.analysis-dialog {
  :deep(.el-dialog__body) {
    padding: 20px;
    height: 70vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  :deep(.el-dialog__footer) {
    padding: 10px 20px;
    border-top: 1px solid #e6e6e6;
    margin-top: auto;
  }
}

/* 确保表格内容可以滚动 */
.table-wrapper .el-table {
  flex: 1;
  overflow-y: auto;
}

/* 确保分页器固定在底部 */
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  padding: 10px 0;
  background-color: #fff;
}

/* 确保表格内容可以滚动 */
:deep(.el-table__body-wrapper) {
  overflow-y: auto !important;
}

/* 优化表格样式 */
:deep(.el-table) {
  --el-table-header-bg-color: #f5f7fa;
  --el-table-row-hover-bg-color: #f5f7fa;
}

/* 固定表头 */
:deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 2;
}

/* 优化分析内容的滚动 */
.analysis-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 10px; /* 为滚动条留出空间 */
}

/* 美化滚动条 */
:deep(*::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(*::-webkit-scrollbar-track) {
  background: #f1f1f1;
  border-radius: 4px;
}

:deep(*::-webkit-scrollbar-thumb) {
  background: #c1c1c1;
  border-radius: 4px;
}

:deep(*::-webkit-scrollbar-thumb:hover) {
  background: #a8a8a8;
}

.diff-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  gap: 16px;
}

.diff-loading .loading-icon {
  animation: rotate 1s linear infinite;
  color: #409EFF;
}

.diff-loading span {
  color: #606266;
  font-size: 14px;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 优化文件头部样式 */
.file-header {
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: bold;
  padding: 12px 16px;
  background-color: #f1f8ff;
  border-bottom: 1px solid #e1e4e8;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #24292e;
}

/* 优化差异内容的容器样式 */
.diff-scroll-area {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  background-color: #fff;
}

.diff-content {
  border-bottom: 1px solid #e1e4e8;
}

.diff-content:last-child {
  border-bottom: none;
}

.diff-view-wrapper {
  background-color: #fff;
  overflow-x: auto;
}

.diff-view {
  margin: 0;
  padding: 16px;
  white-space: pre;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.5;
  tab-size: 2;
}

/* 优化 markdown-body 样式 */
:deep(.markdown-body) {
  font-size: 14px;
  line-height: 1.6;
  padding: 16px;
  background-color: #ffffff;
}

/* 优化分页器样式 */
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  padding: 10px 0;
  background-color: #fff;
}

:deep(.el-pagination) {
  --el-pagination-button-bg-color: #f4f4f5;
  --el-pagination-hover-color: #409eff;
}

:deep(.el-pagination.is-background .el-pager li:not(.is-disabled).is-active) {
  background-color: #409eff;
}

:deep(.el-pagination .el-select .el-input) {
  width: 110px;
}

/* 美化分页按钮 */
:deep(.el-pagination.is-background .el-pager li) {
  margin: 0 4px;
  min-width: 32px;
  border-radius: 4px;
}

:deep(.el-pagination.is-background .btn-prev),
:deep(.el-pagination.is-background .btn-next) {
  border-radius: 4px;
  padding: 0 12px;
  min-width: 80px;
}

/* 优化跳转输入框样式 */
:deep(.jump-input.el-input) {
  width: 50px;
  margin: 0 6px;
}

:deep(.jump-input .el-input__inner) {
  text-align: center;
  padding: 0 4px;
}

/* 优化分页器中文字的样式 */
:deep(.el-pagination) {
  --el-pagination-font-size: 13px;
  font-size: 13px;
}

:deep(.el-pagination .el-select .el-input .el-input__inner) {
  font-size: 13px;
}
</style> 