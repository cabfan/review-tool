const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const simpleGit = require('simple-git')
const https = require('https')
const { throttle } = require('lodash')

// 开发环境下启用热重载
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: false
    })
  } catch (_) { console.log('Error loading electron-reloader') }
}

// 更健壮的环境检测
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'

// Git操作处理器
async function getGitCommits(repoPath, page = 1, pageSize = 50) {
  try {
    const git = simpleGit(repoPath)
    const skip = (page - 1) * pageSize
    
    // 使用 --skip 和 --max-count 参数来实现分页
    const logOptions = [
      `--skip=${skip}`,
      `--max-count=${pageSize}`,
      '--pretty=format:{"hash":"%H","author":"%an","date":"%ai","message":"%s"}',
      '--no-merges'  // 可选：排除合并提交
    ]

    const result = await git.raw(['log', ...logOptions])
    
    // 解析日志结果
    const commits = result
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line)
        } catch (e) {
          console.error('Failed to parse commit:', line)
          return null
        }
      })
      .filter(commit => commit !== null)

    // 获取总提交数（只需要在第一次加载时获取）
    let totalCommits = 0
    if (page === 1) {
      const revList = await git.raw(['rev-list', '--count', 'HEAD'])
      totalCommits = parseInt(revList.trim(), 10)
    }

    return {
      commits,
      total: totalCommits,
      page,
      pageSize
    }
  } catch (error) {
    console.error('Error getting git commits:', error)
    throw error
  }
}

// 添加一个节流的提交记录获取方法
const throttledGetCommits = throttle(getGitCommits, 1000)

// 注册所有 IPC 处理器
function registerIPCHandlers() {
  // Git相关处理器
  ipcMain.handle('get-git-commits', async (event, { repoPath, page, pageSize }) => {
    try {
      return await throttledGetCommits(repoPath, page, pageSize)
    } catch (error) {
      throw error
    }
  })
  
  ipcMain.handle('git-show', async (event, repoPath, hash) => {
    try {
      const git = simpleGit(repoPath)
      return await git.show(hash)
    } catch (error) {
      console.error('Git show error:', error)
      throw error
    }
  })
  
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.filePaths[0]
  })

  // AI相关处理器
  ipcMain.handle('ai-analyze', async (event, baseUrl, apiKey, content) => {
    if (!baseUrl || !apiKey || !content) {
      throw new Error('Missing required parameters')
    }

    return new Promise((resolve, reject) => {
      try {
        const postData = JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'user',
            content: content
          }],
          stream: true,
          temperature: 0.7,
          max_tokens: 2000,
          frequency_penalty: 0,
          presence_penalty: 0,
          top_p: 0.95,
          stop: null
        })

        // 构建完整的API URL
        const baseUrlObj = new URL(baseUrl)
        const fullPath = baseUrlObj.pathname.endsWith('/v1/chat/completions') || 
                        baseUrlObj.pathname.endsWith('/chat/completions') 
                        ? baseUrlObj.pathname 
                        : '/v1/chat/completions'
        
        const apiUrl = new URL(
          fullPath,
          baseUrlObj.origin + (baseUrlObj.pathname === '/' ? '' : baseUrlObj.pathname)
        )
        
        const options = {
          hostname: apiUrl.hostname,
          path: apiUrl.pathname + apiUrl.search,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'User-Agent': 'Git-Review-Tool/1.0',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 30000,
          rejectUnauthorized: false
        }

        let responseData = ''
        const req = https.request(options, (res) => {
          res.setEncoding('utf8')

          if (res.statusCode !== 200) {
            let errorMessage = `HTTP Error: ${res.statusCode}`
            if (res.statusCode === 401) {
              errorMessage = 'API密钥无效'
            } else if (res.statusCode === 404) {
              errorMessage = 'API地址无效'
            } else if (res.statusCode === 418) {
              errorMessage = 'API服务器拒绝请求，请检查API地址和密钥是否正确'
            }
            reject(new Error(errorMessage))
            return
          }

          res.on('data', (chunk) => {
            try {
              responseData += chunk
              // 将数据发送回渲染进程
              event.sender.send('ai-analyze-chunk', chunk)
            } catch (error) {
              console.error('Error processing chunk:', error)
            }
          })

          res.on('end', () => {
            if (responseData.includes('error')) {
              console.error('API error response:', responseData)
            }
            resolve(true)
          })

          res.on('error', (error) => {
            console.error('Response error:', error)
            reject(new Error(`Response error: ${error.message}`))
          })
        })

        req.on('error', (error) => {
          console.error('Request error:', error)
          reject(new Error(`Request failed: ${error.message}`))
        })

        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })

        req.write(postData)
        req.end()

      } catch (error) {
        reject(error)
      }
    })
  })
}

// 检查dist目录是否存在
function checkDistDirectory() {
  const distPath = path.join(__dirname, 'dist')
  const indexPath = path.join(distPath, 'index.html')
  
  if (!isDev) {
    if (!fs.existsSync(distPath)) {
      console.error('Error: dist directory not found. Please run "npm run build" first.')
      app.quit()
      return false
    }
    if (!fs.existsSync(indexPath)) {
      console.error('Error: index.html not found in dist directory. Please run "npm run build" first.')
      app.quit()
      return false
    }
  }
  return true
}

async function createWindow() {
  if (!isDev && !checkDistDirectory()) {
    return
  }

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.setMenu(null)

  if (isDev) {
    // 等待 Vite 开发服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000))
    try {
      await mainWindow.loadURL('http://localhost:5173')
      // 打开开发工具
      mainWindow.webContents.openDevTools()
    } catch (error) {
      console.error('Failed to load dev server:', error)
      dialog.showErrorBox('启动错误', '无法连接到开发服务器，请确保运行了 "npm run dev"')
      app.quit()
    }
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html')
    try {
      await mainWindow.loadFile(indexPath)
    } catch (error) {
      console.error('Failed to load production build:', error)
      dialog.showErrorBox('启动错误', '无法加载应用，请确保已经运行了 "npm run build"')
      app.quit()
    }
  }

  return mainWindow
}

app.whenReady().then(async () => {
  try {
    registerIPCHandlers()  // 确保在应用启动时注册所有处理器
    await createWindow()
  } catch (error) {
    console.error('Failed to create window:', error)
    app.quit()
  }
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
}) 