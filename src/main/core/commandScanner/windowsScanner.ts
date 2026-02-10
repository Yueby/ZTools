import { shell } from 'electron'
import fsPromises from 'fs/promises'
import path from 'path'
import { extractAcronym } from '../../utils/common'
import { getWindowsScanPaths } from '../../utils/systemPaths'
import { Command } from './types'

// ========== 配置 ==========

// 要跳过的文件夹名称
export const SKIP_FOLDERS = [
  'sdk',
  'doc',
  'docs',
  'samples',
  'sample',
  'examples',
  'example',
  'demos',
  'demo',
  'documentation'
]

// 要跳过的目标文件扩展名（文档、网页等，用于检查 .lnk 快捷方式的目标路径）
// 注意：.url 不在此列表中，会单独解析内容判断是否为应用协议
export const SKIP_EXTENSIONS = [
  '.html', // 网页文件
  '.htm',
  '.pdf', // PDF文档
  '.txt', // 文本文档
  '.chm', // 帮助文件
  '.doc', // Word文档
  '.docx',
  '.xls', // Excel文档
  '.xlsx',
  '.ppt', // PowerPoint文档
  '.pptx',
  '.md', // Markdown文档
  '.msc' // 管理单元
]

// 要跳过的快捷方式名称关键词（不区分大小写）
export const SKIP_NAME_PATTERN =
  /^uninstall |^卸载|卸载$|website|网站|帮助|help|readme|read me|文档|manual|license|documentation/i

// 要跳过的目标可执行文件名（卸载程序、安装程序等）
// 卸载程序：uninst.exe, uninstall.exe, uninstaller.exe, UninstallXXX.exe, unins000.exe, unwise.exe, _uninst.exe 等
// 安装程序：setup.exe, install.exe, installer.exe, InstallXXX.exe, instmsi.exe, instmsiw.exe 等
// 注意：
//   - 过滤所有以 "uninstall"/"install" 开头的（包括 Installer.exe, UninstallSpineTrial.exe 等）
//   - 过滤 "uninst" 开头的（但 "unins" + 数字除外，需要精确匹配）
//   - 保留配置工具（如 "GameSetup.exe"，不以 setup/install 开头）
export const SKIP_TARGET_PATTERN =
  /^uninstall|^uninst|^unins\d+$|^unwise|^_uninst|^setup$|^install|^instmsi|卸载程序|安装程序/i

// Windows 系统目录（不应该扫描这些目录中的应用）
export const SYSTEM_DIRECTORIES = [
  'c:\\windows\\',
  'c:\\windows\\system32\\',
  'c:\\windows\\syswow64\\'
]

// ========== 辅助函数 ==========

// 检查是否应该跳过该快捷方式
// 优先基于目标文件的真实路径判断，而不是快捷方式名称
export function shouldSkipShortcut(name: string, targetPath?: string): boolean {
  // 如果有目标路径，优先检查目标文件
  if (targetPath) {
    const lowerTargetPath = targetPath.toLowerCase()

    // 1. 检查是否在系统目录中（Windows、System32、WindowsApps 等）
    if (SYSTEM_DIRECTORIES.some((sysDir) => lowerTargetPath.startsWith(sysDir))) {
      return true
    }

    // 2. 检查目标文件扩展名（文档、网页等非可执行文件）
    if (SKIP_EXTENSIONS.some((ext) => lowerTargetPath.endsWith(ext))) {
      return true
    }

    // 3. 检查目标文件的文件名（uninst.exe, uninstall.exe, setup.exe 等）
    const targetFileName = path.basename(targetPath, path.extname(targetPath))
    if (SKIP_TARGET_PATTERN.test(targetFileName)) {
      return true
    }

    // 目标路径检查通过，不过滤
    return false
  }

  // 如果没有目标路径（解析失败），降级检查快捷方式名称
  if (SKIP_NAME_PATTERN.test(name)) {
    return true
  }

  return false
}

// 生成图标 URL
export function getIconUrl(appPath: string): string {
  // 将绝对路径编码为 URL
  return `ztools-icon://${encodeURIComponent(appPath)}`
}

// 解析 .url 文件，提取 URL 和 IconFile 字段
export interface UrlFileInfo {
  url: string
  iconFile: string
}

export async function parseUrlFile(filePath: string): Promise<UrlFileInfo | null> {
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8')
    let url = ''
    let iconFile = ''

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('URL=')) {
        url = trimmed.slice(4)
      } else if (trimmed.startsWith('IconFile=')) {
        iconFile = trimmed.slice(9)
      }
    }

    if (!url) return null

    // 跳过普通网页链接（http/https），保留其他应用协议（如 steam://）
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
      return null
    }

    return { url, iconFile }
  } catch {
    return null
  }
}

// 递归扫描目录中的快捷方式
async function scanDirectory(dirPath: string, apps: Command[]): Promise<void> {
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      // 处理子目录
      if (entry.isDirectory()) {
        // 跳过 SDK、示例、文档等开发相关文件夹
        if (SKIP_FOLDERS.includes(entry.name.toLowerCase())) {
          continue
        }
        // 递归扫描子目录
        await scanDirectory(fullPath, apps)
        continue
      }

      if (!entry.isFile()) continue

      const ext = path.extname(entry.name).toLowerCase()

      // 处理 .url 快捷方式（应用协议链接，如 steam://）
      if (ext === '.url') {
        const urlInfo = await parseUrlFile(fullPath)
        if (!urlInfo) continue

        const appName = path.basename(entry.name, '.url')

        // 过滤检查
        if (SKIP_NAME_PATTERN.test(appName)) continue

        // 图标：优先使用 .url 文件中的 IconFile，否则使用 .url 文件本身
        const iconPath = urlInfo.iconFile || fullPath
        const icon = getIconUrl(iconPath)

        apps.push({
          name: appName,
          path: urlInfo.url, // 使用协议链接作为启动路径
          icon,
          acronym: extractAcronym(appName)
        })
        continue
      }

      // 处理 .lnk 快捷方式
      if (ext !== '.lnk') continue

      // 处理快捷方式
      const appName = path.basename(entry.name, '.lnk')

      // 尝试解析快捷方式目标（必须先解析才能获取真实路径）
      let shortcutDetails: Electron.ShortcutDetails | null = null
      try {
        shortcutDetails = shell.readShortcutLink(fullPath)
      } catch {
        // 解析失败，使用快捷方式本身
      }

      // 获取目标路径和应用路径
      const targetPath = shortcutDetails?.target?.trim() || ''

      // 如果 .lnk 指向 .url 文件，解析 .url 内容判断是否为应用协议
      if (targetPath.toLowerCase().endsWith('.url')) {
        const urlInfo = await parseUrlFile(targetPath)
        if (!urlInfo) continue // http/https 或解析失败，跳过

        if (SKIP_NAME_PATTERN.test(appName)) continue

        const iconPath = urlInfo.iconFile || fullPath
        const icon = getIconUrl(iconPath)

        apps.push({
          name: appName,
          path: urlInfo.url,
          icon,
          acronym: extractAcronym(appName)
        })
        continue
      }

      // 如果目标路径存在且文件存在，使用目标路径；否则使用 .lnk 文件本身
      let appPath = fullPath
      // 图标优先级：快捷方式自定义图标 > 目标文件 > 快捷方式本身
      // 解决同路径不同名应用（如米哈游各游戏）显示相同图标的问题
      let iconPath = shortcutDetails?.icon || fullPath

      if (targetPath) {
        const fs = await import('fs')
        if (fs.existsSync(targetPath)) {
          appPath = targetPath
          // 仅当快捷方式没有自定义图标时，才使用目标文件的图标
          if (!shortcutDetails?.icon) {
            iconPath = targetPath
          }
        }
      }

      // 过滤检查：基于目标文件的真实路径判断（优先），或快捷方式名称（降级）
      if (shouldSkipShortcut(appName, targetPath)) {
        continue
      }

      // 生成图标 URL
      const icon = getIconUrl(iconPath)

      // 创建应用对象
      const app: Command = {
        name: appName,
        path: appPath,
        icon,
        acronym: extractAcronym(appName)
      }

      apps.push(app)
    }
  } catch (error) {
    console.error(`扫描目录失败 ${dirPath}:`, error)
  }
}

/**
 * 去重：按名称+路径的组合去重（允许不同名但同路径的应用共存）
 */
export function deduplicateCommands(apps: Command[]): Command[] {
  const uniqueApps = new Map<string, Command>()
  apps.forEach((app) => {
    const dedupeKey = `${app.name.toLowerCase()}|${app.path.toLowerCase()}`
    if (!uniqueApps.has(dedupeKey)) {
      uniqueApps.set(dedupeKey, app)
    }
  })
  return Array.from(uniqueApps.values())
}

export async function scanApplications(): Promise<Command[]> {
  try {
    const startTime = performance.now()

    const apps: Command[] = []

    // 获取 Windows 扫描路径（开始菜单 + 桌面）
    const scanPaths = getWindowsScanPaths()

    // 扫描所有目录
    for (const menuPath of scanPaths) {
      await scanDirectory(menuPath, apps)
    }

    const deduplicatedApps = deduplicateCommands(apps)

    const endTime = performance.now()
    console.log(
      `扫描完成: ${apps.length} 个应用 -> 去重后 ${deduplicatedApps.length} 个, 耗时 ${(endTime - startTime).toFixed(0)}ms`
    )

    return deduplicatedApps
  } catch (error) {
    console.error('扫描应用失败:', error)
    return []
  }
}
