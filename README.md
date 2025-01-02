# Git Review Tool

一个基于 Electron + Vue3 的 Git和Svn 代码审查工具，利用 AI 辅助分析。

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

1. 选择 Git 或 Svn 项目目录
2. 配置用户信息（用户名和邮箱）
3. 配置 AI 设置（API 地址和密钥）
4. 查看提交记录（支持分页和每页条数调整）
5. 点击"查看差异"查看代码变更
6. 使用"AI 代码分析"获取分析报告

## 构建产物

构建后会在 dist_electron 目录下生成：
- win-unpacked 目录：免安装版本
- Git Review Tool Setup.exe：安装程序
- Git Review Tool.exe：便携版

## License

MIT
