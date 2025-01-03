# Review Tool

一个基于 Electron + Vue3 的代码审查工具，支持 Git 和 SVN 仓库，利用 AI 辅助分析。

## 功能特性

- 📝 Git 提交记录查看和分页
- 📝 Svn 提交记录查看和分页
- 🔍 代码差异对比
- 🤖 AI 代码分析（支持流式输出）
- 📊 代码质量评分（命名规范、潜在问题、逻辑严谨性、代码结构）
- 🎯 改进建议生成

## 技术栈

- Electron 25.3.1
- Vue 3.3.4
- Element Plus 2.3.8
- Simple Git 3.19.1
- Markdown-it + GitHub Markdown CSS
- Highlight.js
- Svn 2.8.0

## 开发
``` bash
安装依赖
npm install
启动开发服务器
npm run dev
构建应用
npm run electron:build
```

## 使用说明

1. 选择仓库类型(Git/SVN)
2. 选择项目目录
3. 配置用户信息（用户名和邮箱）
4. 配置 AI 设置（API 地址和密钥）
5. 查看提交记录（支持分页和每页条数调整）
6. 点击"查看差异"查看代码变更
7. 使用"AI 代码分析"获取分析报告

## 环境要求

- Node.js 14+
- Git
- SVN (svn 命令行工具)

## 构建产物

构建后会在 dist_electron 目录下生成：
- win-unpacked 目录：免安装版本
- Git Review Tool Setup.exe：安装程序
- Git Review Tool.exe：便携版

## 常见问题与解决方案

### Git 相关

1. **分页总数不准确**
   - 问题：使用 `rev-list --count` 获取的总数与实际提交数不一致
   - 解决：使用 `git log --format=%H --no-merges` 获取完整提交列表后计算总数，确保使用相同的过滤条件

2. **分页数据不完整**
   - 问题：最后几页数据显示不正确或丢失
   - 解决：计算实际需要获取的提交数量 `actualPageSize = Math.min(pageSize, totalCommits - skip)`

### SVN 相关

1. **命令行工具缺失**
   - 问题：提示 "svn 不是内部或外部命令"
   - 解决：安装 TortoiseSVN 时需勾选"command line client tools"选项

2. **分页参数不支持**
   - 问题：SVN 不支持 `--skip` 参数
   - 解决：获取所有日志后在内存中进行分页处理

### AI 分析相关

1. **API 请求格式错误**
   - 问题：HTTP Error 400
   - 解决：检查 API 地址完整性和 API 密钥格式

2. **Markdown 渲染问题**
   - 问题：AI 返回的 markdown 代码块标记影响显示
   - 解决：在渲染前移除 ```markdown 和 ``` 标记

### UI/UX 相关

1. **加载状态提示**
   - 问题：差异内容加载时没有提示
   - 解决：添加加载动画和提示文本

2. **分页组件本地化**
   - 问题：分页组件显示英文
   - 解决：自定义分页组件模板，使用中文文本

## 开发注意事项

1. Git 操作
   - 使用 simple-git 库处理 Git 命令
   - 注意处理命令执行错误和返回值解析
   - 确保使用一致的过滤条件（如 --no-merges）

2. SVN 操作
   - 使用 xml2js 解析 SVN 日志
   - 处理 XML 解析错误和特殊字符
   - 注意文件路径的编码问题

3. 界面开发
   - 使用 Element Plus 组件库
   - 注意处理加载状态和错误提示
   - 保持界面响应性和用户体验

4. 数据处理
   - 正确处理分页逻辑
   - 注意数据格式的一致性
   - 处理边界情况和错误情况

## License

MIT
