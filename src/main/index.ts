import { platform } from '@electron-toolkit/utils'
import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import path from 'path'
import api from './api/index'
import appWatcher from './appWatcher'
import detachedWindowManager from './core/detachedWindowManager'
import { loadInternalPlugins } from './core/internalPluginLoader'
import pluginManager from './pluginManager'
import windowManager from './windowManager'

// 配置 electron-log
log.transports.file.level = 'debug'
log.transports.file.maxSize = 5 * 1024 * 1024 // 5MB
log.transports.file.resolvePathFn = () => {
  return path.join(app.getPath('userData'), 'logs/main.log')
}
log.transports.console.level = 'debug'

// 生产环境接管 console
// if (process.env.NODE_ENV === 'production') {
Object.assign(console, log.functions)
// }

// 开发模式下禁用某些警告
if (process.env.NODE_ENV !== 'production') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

// 导出函数供 API 使用
export function updateShortcut(shortcut: string): boolean {
  return windowManager.registerShortcut(shortcut)
}

export function getCurrentShortcut(): string {
  return windowManager.getCurrentShortcut()
}

app.whenReady().then(async () => {
  // ✅ 首先加载内置插件
  await loadInternalPlugins()

  // 隐藏 Dock 图标（仅在没有分离窗口时隐藏）
  if (platform.isMacOS) {
    if (!detachedWindowManager.hasDetachedWindows()) {
      app.dock?.hide()
    }
  }

  // 创建主窗口
  const mainWindow = windowManager.createWindow()

  // 初始化 API 和插件管理器
  if (mainWindow) {
    api.init(mainWindow, pluginManager)
    pluginManager.init(mainWindow)
    // 初始化应用目录监听器
    appWatcher.init(mainWindow)
  }

  // 注册全局快捷键
  windowManager.registerShortcut()

  // 创建系统托盘
  windowManager.createTray()
})

app.on('window-all-closed', () => {
  if (!platform.isMacOS) {
    app.quit()
  }
})

app.on('will-quit', () => {
  windowManager.unregisterAllShortcuts()
  // 停止应用目录监听
  appWatcher.stop()
})

app.on('before-quit', () => {
  windowManager.setQuitting(true)
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager.createWindow()
  }
})

// 开发模式下监听 Ctrl+C 信号
if (process.env.NODE_ENV !== 'production') {
  process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，退出应用')
    app.quit()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，退出应用')
    app.quit()
    process.exit(0)
  })
}
