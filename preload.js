const { contextBridge, ipcRenderer } = require('electron')

// 验证函数是否可用
function validateIPC() {
  if (!ipcRenderer) {
    throw new Error('IPC renderer is not available')
  }
}

// 创建一个 Map 来存储事件监听器
const listeners = new Map()

// 创建一个安全的事件处理包装器
function createSafeEventHandler(channel, callback) {
  validateIPC()
  const wrappedCallback = (event, ...args) => {
    try {
      callback(...args)
    } catch (error) {
    }
  }
  return wrappedCallback
}

// 创建安全的 IPC 调用包装器
function createSafeIPCInvoke(channel) {
  validateIPC()
  return async (...args) => {
    try {
      const result = await ipcRenderer.invoke(channel, ...args)
      return result
    } catch (error) {
      throw error
    }
  }
}

// 所有操作都通过IPC处理
const api = {
  selectDirectory: createSafeIPCInvoke('select-directory'),
  git: {
    getCommits: createSafeIPCInvoke('get-git-commits'),
    show: createSafeIPCInvoke('git-show')
  },
  ai: {
    analyze: createSafeIPCInvoke('ai-analyze'),
    onChunk: (callback) => {
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function')
      }

      // 移除旧的监听器（如果存在）
      if (listeners.has('ai-analyze-chunk')) {
        const oldListener = listeners.get('ai-analyze-chunk')
        ipcRenderer.removeListener('ai-analyze-chunk', oldListener)
        listeners.delete('ai-analyze-chunk')
      }

      // 创建新的监听器
      const wrappedCallback = createSafeEventHandler('ai-analyze-chunk', callback)
      listeners.set('ai-analyze-chunk', wrappedCallback)
      ipcRenderer.on('ai-analyze-chunk', wrappedCallback)

      // 返回清理函数
      return () => {
        if (listeners.has('ai-analyze-chunk')) {
          const listener = listeners.get('ai-analyze-chunk')
          ipcRenderer.removeListener('ai-analyze-chunk', listener)
          listeners.delete('ai-analyze-chunk')
        }
      }
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api) 