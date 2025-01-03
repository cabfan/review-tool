const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const simpleGit = require('simple-git')
const https = require('https')
const { throttle } = require('lodash')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)
const xml2js = require('xml2js')

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
    
    // 使用 rev-parse 获取当前分支的最新提交
    const head = await git.raw(['rev-parse', 'HEAD'])
    
    // 获取所有提交的 hash 列表来计算总数
    const allCommits = await git.raw([
      'log',
      '--format=%H',
      '--no-merges',
      head.trim()
    ])
    
    const totalCommits = allCommits.trim().split('\n').length
    
    // 计算正确的 skip 值
    const skip = (page - 1) * pageSize
    
    // 如果 skip 超过了总数，返回空结果
    if (skip >= totalCommits) {
      return {
        commits: [],
        total: totalCommits,
        page,
        pageSize
      }
    }
    
    // 计算实际需要获取的数量（处理最后一页的情况）
    const actualPageSize = Math.min(pageSize, totalCommits - skip)
    
    // 获取具体的提交信息
    const logOptions = [
      head.trim(),
      `--skip=${skip}`,
      `--max-count=${actualPageSize}`,
      '--pretty=format:{"hash":"%H","author":"%an","date":"%ai","message":"%s"}',
      '--no-merges'
    ]

    const result = await git.raw(['log', ...logOptions])
    
    // 处理空结果的情况
    if (!result.trim()) {
      return {
        commits: [],
        total: totalCommits,
        page,
        pageSize
      }
    }
    
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

// 在现有代码后添加 SVN 相关函数
async function getSvnCommits(repoPath, page = 1, pageSize = 50) {
  try {
    // 首先检查 SVN 是否已安装
    try {
      await execAsync('svn --version')
    } catch (error) {
      throw new Error('未安装 SVN 命令行工具，请先安装 TortoiseSVN 或 SVN 命令行工具')
    }
    
    // 获取所有日志
    const command = `svn log --xml "${repoPath}"`
    const { stdout } = await execAsync(command)
    
    // 使用 xml2js 解析 XML
    const parser = new xml2js.Parser()
    const result = await parser.parseStringPromise(stdout)
    
    if (!result.log || !result.log.logentry) {
      return {
        commits: [],
        total: 0,
        page,
        pageSize
      }
    }

    // 获取所有提交记录
    const allCommits = result.log.logentry.map(entry => ({
      hash: entry.$.revision,
      author: entry.author?.[0] || '',
      date: entry.date?.[0] || '',
      message: entry.msg?.[0] || ''
    }))

    const totalCommits = allCommits.length
    
    // 计算正确的分页
    const start = (page - 1) * pageSize
    const end = Math.min(start + pageSize, totalCommits)
    
    // 如果起始位置超过总数，返回空结果
    if (start >= totalCommits) {
      return {
        commits: [],
        total: totalCommits,
        page,
        pageSize
      }
    }

    return {
      commits: allCommits.slice(start, end),
      total: totalCommits,
      page,
      pageSize
    }
  } catch (error) {
    console.error('Error getting svn commits:', error)
    throw error
  }
}

// 获取 SVN 差异
async function getSvnDiff(repoPath, revision) {
  try {
    const command = `svn diff -c ${revision} "${repoPath}"`
    const { stdout } = await execAsync(command)
    
    // 解析差异输出，添加文件路径信息
    const diffs = []
    let currentFile = null
    let currentDiff = []
    
    stdout.split('\n').forEach(line => {
      if (line.startsWith('Index: ')) {
        if (currentFile) {
          diffs.push({ path: currentFile, diff: currentDiff.join('\n') })
        }
        currentFile = line.slice(7)
        currentDiff = []
      } else if (currentFile) {
        currentDiff.push(line)
      }
    })
    
    if (currentFile) {
      diffs.push({ path: currentFile, diff: currentDiff.join('\n') })
    }
    
    return diffs.length ? diffs : [{ path: 'Unknown', diff: stdout }]
  } catch (error) {
    console.error('Error getting svn diff:', error)
    throw new Error(`获取 SVN 差异失败: ${error.message}`)
  }
}

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

  // SVN相关处理器
  ipcMain.handle('get-svn-commits', async (event, repoPath, page, pageSize) => {
    return await getSvnCommits(repoPath, page, pageSize)
  })

  ipcMain.handle('svn-diff', async (event, repoPath, revision) => {
    return await getSvnDiff(repoPath, revision)
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

  const iconPath = isDev 
    ? path.join(__dirname, 'build/icon.ico')
    : path.join(process.resourcesPath, 'build/icon.ico')

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.setMenu(null)

  if (isDev) {
    // 等待 Vite 开发服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000))
    try {
      await win.loadURL('http://localhost:5173')
      // 打开开发工具
      win.webContents.openDevTools()
    } catch (error) {
      console.error('Failed to load dev server:', error)
      dialog.showErrorBox('启动错误', '无法连接到开发服务器，请确保运行了 "npm run dev"')
      app.quit()
    }
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html')
    try {
      await win.loadFile(indexPath)
    } catch (error) {
      console.error('Failed to load production build:', error)
      dialog.showErrorBox('启动错误', '无法加载应用，请确保已经运行了 "npm run build"')
      app.quit()
    }
  }

  return win
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