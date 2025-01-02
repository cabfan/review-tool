<template>
  <div class="home">
    <el-container>
      <el-header>
        <div class="header-content">
          <h2>Git Review Tool</h2>
          <div class="header-actions">
            <el-button type="primary" @click="selectDirectory" :disabled="!userStore.isUserSet">
              选择Git项目
            </el-button>
            <el-button @click="userStore.showUserSettingsDialog">
              用户设置
              <el-icon v-if="userStore.isUserSet" class="setting-status"><Check /></el-icon>
            </el-button>
            <el-button @click="userStore.showAiConfigDialog">
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
                  layout="total, sizes, prev, pager, next"
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
                />
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

              <div class="diff-scroll-area">
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
                    <span>分析时间: {{ aiAnalysis.timestamp }}</span>
                    <span>审查者: {{ aiAnalysis.reviewer }}</span>
                  </div>
                  <div v-if="isAnalyzing && aiAnalysis.items.length === 0" class="analysis-loading">
                    <el-icon class="loading-icon" :size="24"><Loading /></el-icon>
                    <span>正在分析中...</span>
                  </div>
                  <template v-else>
                    <div class="analysis-description markdown-body"
                         style="max-height: 400px; overflow-y: auto;"
                         :class="{ 'typing': isTyping && !aiAnalysis.items[0]?.content.endsWith('```') }"
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
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '../stores/user'
import { Check, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'  // 使用 GitHub 风格的代码高亮样式
import MarkdownIt from 'markdown-it'
import 'github-markdown-css'

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
    const result = await window.electronAPI.git.getCommits({
      repoPath: currentRepo.value,
      page: currentPage.value,
      pageSize: pageSize.value
    })
    
    commits.value = result.commits.map(commit => ({
      hash: commit.hash.substring(0, 7),
      date: new Date(commit.date).toLocaleString(),
      author: commit.author,
      message: commit.message,
      fullHash: commit.hash
    }))
    
    if (currentPage.value === 1) {
      totalCommits.value = result.total
    }
  } catch (error) {
    ElMessage.error('加载提交记录失败')
  }
}

async function viewDiff(commit) {
  selectedCommit.value = commit
  activeTab.value = 'diff'
  
  try {
    const diff = await window.electronAPI.git.show(currentRepo.value, commit.fullHash)
    diffFiles.value = parseDiff(diff)
  } catch (error) {
    ElMessage.error('加载差异失败')
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
              // 直接追加原始内容
              if (aiAnalysis.value.items.length === 0) {
                aiAnalysis.value.items.push({ content: '' })
              }
              aiAnalysis.value.items[0].content += content
            }
          } catch (e) {
            // 保留错误处理，但移除日志
          }
        }
      } catch (e) {
        // 保留错误处理，但移除日志
      }
    })

    // 发送分析请求
    await window.electronAPI.ai.analyze(
      userStore.aiBaseUrl.trim(),
      userStore.aiApiKey.trim(),
      `请分析以下Git提交的代码变更，并对每个方面进行评分（满分100分）。请将分析结果用markdown代码块包裹，格式如下：

\`\`\`markdown
# 命名规范 (25分)

评分标准：
* 变量、函数、类的命名是否符合规范 (10分)
* 命名是否清晰表达了意图 (10分)
* 是否存在误导性的命名 (5分)

请列出具体的扣分项和扣分原因。

# 潜在问题 (25分)

评分标准：
* 代码中的bug或错误 (10分)
* 性能隐患 (5分)
* 安全风险 (5分)
* 边界情况处理 (5分)

请列出具体的扣分项和扣分原因。

# 逻辑严谨性 (25分)

评分标准：
* 代码逻辑是否清晰 (10分)
* 边界条件处理 (5分)
* 错误处理是否完善 (5分)
* 是否存在冗余或重复代码 (5分)

请列出具体的扣分项和扣分原因。

# 代码结构 (25分)

评分标准：
* 代码组织是否合理 (10分)
* 模块化和职责划分 (5分)
* 代码复用性 (5分)
* 可维护性和可扩展性 (5分)

请列出具体的扣分项和扣分原因。

# 总评

* 总分：[计算总分]
* 主要优点：[列出代码的主要优点]
* 主要问题：[列出需要重点改进的问题]
* 改进建议：[给出具体的改进建议]
\`\`\`

请严格按照上述格式输出，确保整个输出内容都包含在 \`\`\`markdown 代码块中。

提交信息：${selectedCommit.value.message}
代码变更：
\`\`\`diff
${diffFiles.value.map(f => f.diff).join('\n')}
\`\`\`
`
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
      } else if (error.message.includes('418')) {
        errorMessage = 'API地址不正确或未包含必要的端点路径，请确保使用完整的API地址（例如：https://api.deepseek.com/v1/chat/completions）'
      } else {
        errorMessage += `：${error.message}`
      }
    }
    ElMessage.error(errorMessage)
  } finally {
    if (cleanup) {
      try {
        cleanup()
      } catch (e) {
        // 保留错误处理，但移除日志
      }
    }
    isAnalyzing.value = false
  }
}

// 添加markdown渲染函数
function renderMarkdown(text) {
  if (!text) return ''
  console.log(text)
  return md.render(text)
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

function handleSizeChange(newSize) {
  pageSize.value = newSize
  currentPage.value = 1
  loadCommits()
}

function handleCurrentChange(newPage) {
  currentPage.value = newPage
  loadCommits()
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
  justify-content: flex-end;
  padding: 10px 0;
  background-color: #fff;
  flex-shrink: 0;
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

.analysis-description {
  white-space: pre-wrap;
  line-height: 1.6;
  color: #606266;
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

.analysis-description-wrapper {
  position: relative;
  padding: 10px;
  background-color: #ffffff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.typing::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 16px;
  background-color: #409EFF;
  animation: blink 0.8s step-end infinite;
}

.analysis-item {
  margin-bottom: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
}

.analysis-item h4 {
  color: #409EFF;
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 600;
}

.analysis-description {
  margin: 0;
  line-height: 1.6;
  color: #2c3e50;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
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

@keyframes blink {
  from, to { opacity: 0; }
  50% { opacity: 1; }
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
</style> 