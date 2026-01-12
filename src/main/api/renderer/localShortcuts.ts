import { app, dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'fs'
import fsSync from 'fs'
import path from 'path'
import { pinyin as getPinyin } from 'pinyin-pro'
import plist from 'simple-plist'
import databaseAPI from '../shared/database'

/**
 * 本地启动项类型
 */
export interface LocalShortcut {
  id: string // 唯一标识
  name: string // 显示名称（文件名）
  path: string // 完整路径
  type: 'file' | 'folder' | 'app' // 类型
  icon?: string // 图标路径（可选）
  keywords?: string[] // 搜索关键词
  pinyin?: string // 拼音
  pinyinAbbr?: string // 拼音首字母
  addedAt: number // 添加时间戳
}

const LOCAL_SHORTCUTS_KEY = 'local-shortcuts'

/**
 * 获取 macOS 应用图标文件路径
 */
async function getMacAppIconFile(appPath: string): Promise<string> {
  return new Promise((resolve) => {
    const plistPath = path.join(appPath, 'Contents', 'Info.plist')

    plist.readFile(plistPath, (err: any, data: any) => {
      if (err || !data || !data.CFBundleIconFile) {
        // 返回系统默认图标
        return resolve(
          '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns'
        )
      }

      const iconFileName = data.CFBundleIconFile
      const baseIconPath = path.join(appPath, 'Contents', 'Resources', iconFileName)

      // 尝试多种扩展名
      const iconCandidates = [
        baseIconPath,
        `${baseIconPath}.icns`,
        `${baseIconPath}.tiff`,
        `${baseIconPath}.png`
      ]

      // 同步检查文件存在性
      for (const candidate of iconCandidates) {
        try {
          if (fsSync.existsSync(candidate)) {
            return resolve(candidate)
          }
        } catch {
          continue
        }
      }

      // 都找不到，返回默认图标
      resolve(
        '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns'
      )
    })
  })
}

/**
 * 本地启动 API - 主程序专用
 */
export class LocalShortcutsAPI {
  private mainWindow: Electron.BrowserWindow | null = null

  public init(mainWindow: Electron.BrowserWindow): void {
    this.mainWindow = mainWindow
    this.setupIPC()
  }

  private setupIPC(): void {
    ipcMain.handle('local-shortcuts:get-all', () => this.getAllShortcuts())
    ipcMain.handle('local-shortcuts:add', () => this.addShortcut())
    ipcMain.handle('local-shortcuts:add-by-path', (_event, filePath: string) =>
      this.addShortcutByPath(filePath)
    )
    ipcMain.handle('local-shortcuts:delete', (_event, id: string) => this.deleteShortcut(id))
    ipcMain.handle('local-shortcuts:open', (_event, shortcutPath: string) =>
      this.openShortcut(shortcutPath)
    )
  }

  /**
   * 获取所有本地启动项
   */
  public async getAllShortcuts(): Promise<LocalShortcut[]> {
    try {
      const shortcuts = await databaseAPI.dbGet(LOCAL_SHORTCUTS_KEY)
      return shortcuts || []
    } catch (error) {
      console.error('获取本地启动项失败:', error)
      return []
    }
  }

  /**
   * 添加本地启动项（通过文件选择对话框）
   */
  private async addShortcut(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.mainWindow) {
        return { success: false, error: '主窗口未初始化' }
      }

      // 打开文件选择对话框
      const result = await dialog.showOpenDialog(this.mainWindow, {
        title: '选择文件、文件夹或应用',
        properties: ['openFile', 'openDirectory'],
        filters:
          process.platform === 'win32'
            ? [
                { name: '所有文件', extensions: ['*'] },
                { name: '可执行文件', extensions: ['exe', 'lnk'] }
              ]
            : process.platform === 'darwin'
              ? [{ name: '所有文件', extensions: ['*', 'app'] }]
              : [{ name: '所有文件', extensions: ['*'] }]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: '用户取消选择' }
      }

      const selectedPath = result.filePaths[0]

      // 获取文件信息
      const stats = await fs.stat(selectedPath)
      const baseNameWithExt = path.basename(selectedPath)
      // 去掉后缀名
      const fileName = path.parse(baseNameWithExt).name

      // 判断类型
      let type: 'file' | 'folder' | 'app'
      if (stats.isDirectory()) {
        // 检查是否为 macOS 应用
        if (process.platform === 'darwin' && selectedPath.endsWith('.app')) {
          type = 'app'
        } else {
          type = 'folder'
        }
      } else {
        // Windows 可执行文件或快捷方式视为应用
        if (
          process.platform === 'win32' &&
          (selectedPath.endsWith('.exe') || selectedPath.endsWith('.lnk'))
        ) {
          type = 'app'
        } else {
          type = 'file'
        }
      }

      // 获取文件图标
      let icon: string | undefined
      if (type === 'app') {
        // 应用程序使用 ztools-icon:// 协议（与系统应用扫描器一致）
        if (process.platform === 'darwin') {
          // macOS: 提取 .app 内部的 .icns 图标文件路径
          const iconFilePath = await getMacAppIconFile(selectedPath)
          icon = `ztools-icon://${encodeURIComponent(iconFilePath)}`
        } else {
          // Windows: 直接使用 .exe 或 .lnk 路径
          icon = `ztools-icon://${encodeURIComponent(selectedPath)}`
        }
      } else if (type === 'folder' && process.platform === 'win32') {
        // Windows 文件夹：使用 ztools-icon:// 协议获取系统文件夹图标
        icon = `ztools-icon://${encodeURIComponent(selectedPath)}`
      } else {
        // 其他情况（macOS 文件夹、普通文件）使用 app.getFileIcon 获取系统图标
        try {
          const iconData = await app.getFileIcon(selectedPath, { size: 'normal' })
          icon = iconData.toDataURL()
        } catch (error) {
          console.warn('获取文件图标失败:', error)
        }
      }

      // 生成拼音
      const pinyinFull = getPinyin(fileName, { toneType: 'none', type: 'array' }).join('')
      const pinyinAbbr = getPinyin(fileName, { pattern: 'first', toneType: 'none' })
        .split(' ')
        .join('')

      // 创建本地启动项
      const shortcut: LocalShortcut = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: fileName,
        path: selectedPath,
        type,
        icon,
        keywords: [fileName],
        pinyin: pinyinFull,
        pinyinAbbr,
        addedAt: Date.now()
      }

      // 读取现有列表
      const shortcuts = await this.getAllShortcuts()

      // 检查是否已存在
      const exists = shortcuts.some((s) => s.path === selectedPath)
      if (exists) {
        return { success: false, error: '该项目已存在' }
      }

      // 添加到列表
      shortcuts.push(shortcut)

      // 保存到数据库
      await databaseAPI.dbPut(LOCAL_SHORTCUTS_KEY, shortcuts)

      console.log('添加本地启动项成功:', shortcut.name)

      // 通知渲染进程刷新指令列表
      this.mainWindow?.webContents.send('apps-changed')

      return { success: true }
    } catch (error) {
      console.error('添加本地启动项失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  }

  /**
   * 添加本地启动项（通过文件路径）
   */
  private async addShortcutByPath(
    selectedPath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 获取文件信息
      const stats = await fs.stat(selectedPath)
      const baseNameWithExt = path.basename(selectedPath)
      // 去掉后缀名
      const fileName = path.parse(baseNameWithExt).name

      // 判断类型
      let type: 'file' | 'folder' | 'app'
      if (stats.isDirectory()) {
        // 检查是否为 macOS 应用
        if (process.platform === 'darwin' && selectedPath.endsWith('.app')) {
          type = 'app'
        } else {
          type = 'folder'
        }
      } else {
        // Windows 可执行文件或快捷方式视为应用
        if (
          process.platform === 'win32' &&
          (selectedPath.endsWith('.exe') || selectedPath.endsWith('.lnk'))
        ) {
          type = 'app'
        } else {
          type = 'file'
        }
      }

      // 获取文件图标
      let icon: string | undefined
      if (type === 'app') {
        // 应用程序使用 ztools-icon:// 协议（与系统应用扫描器一致）
        if (process.platform === 'darwin') {
          // macOS: 提取 .app 内部的 .icns 图标文件路径
          const iconFilePath = await getMacAppIconFile(selectedPath)
          icon = `ztools-icon://${encodeURIComponent(iconFilePath)}`
        } else {
          // Windows: 直接使用 .exe 或 .lnk 路径
          icon = `ztools-icon://${encodeURIComponent(selectedPath)}`
        }
      } else if (type === 'folder' && process.platform === 'win32') {
        // Windows 文件夹：使用 ztools-icon:// 协议获取系统文件夹图标
        icon = `ztools-icon://${encodeURIComponent(selectedPath)}`
      } else {
        // 其他情况（macOS 文件夹、普通文件）使用 app.getFileIcon 获取系统图标
        try {
          const iconData = await app.getFileIcon(selectedPath, { size: 'normal' })
          icon = iconData.toDataURL()
        } catch (error) {
          console.warn('获取文件图标失败:', error)
        }
      }

      // 生成拼音
      const pinyinFull = getPinyin(fileName, { toneType: 'none', type: 'array' }).join('')
      const pinyinAbbr = getPinyin(fileName, { pattern: 'first', toneType: 'none' })
        .split(' ')
        .join('')

      // 创建本地启动项
      const shortcut: LocalShortcut = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: fileName,
        path: selectedPath,
        type,
        icon,
        keywords: [fileName],
        pinyin: pinyinFull,
        pinyinAbbr,
        addedAt: Date.now()
      }

      // 读取现有列表
      const shortcuts = await this.getAllShortcuts()

      // 检查是否已存在
      const exists = shortcuts.some((s) => s.path === selectedPath)
      if (exists) {
        return { success: false, error: '该项目已存在' }
      }

      // 添加到列表
      shortcuts.push(shortcut)

      // 保存到数据库
      await databaseAPI.dbPut(LOCAL_SHORTCUTS_KEY, shortcuts)

      console.log('添加本地启动项成功:', shortcut.name)

      // 通知渲染进程刷新指令列表
      this.mainWindow?.webContents.send('apps-changed')

      return { success: true }
    } catch (error) {
      console.error('添加本地启动项失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  }

  /**
   * 删除本地启动项
   */
  private async deleteShortcut(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const shortcuts = await this.getAllShortcuts()
      const filtered = shortcuts.filter((s) => s.id !== id)

      if (filtered.length === shortcuts.length) {
        return { success: false, error: '未找到该项目' }
      }

      await databaseAPI.dbPut(LOCAL_SHORTCUTS_KEY, filtered)

      console.log('删除本地启动项成功:', id)

      // 通知渲染进程刷新指令列表
      this.mainWindow?.webContents.send('apps-changed')

      return { success: true }
    } catch (error) {
      console.error('删除本地启动项失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  }

  /**
   * 打开本地启动项
   */
  private async openShortcut(shortcutPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 使用 shell.openPath 打开文件/文件夹/应用
      const result = await shell.openPath(shortcutPath)

      if (result) {
        // 如果返回非空字符串，表示有错误
        console.error('打开失败:', result)
        return { success: false, error: result }
      }

      return { success: true }
    } catch (error) {
      console.error('打开本地启动项失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  }
}

export default new LocalShortcutsAPI()
