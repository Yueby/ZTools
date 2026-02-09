import os from 'os'
import path from 'path'

/**
 * 获取 Windows 开始菜单路径
 */
export function getWindowsScanPaths(): string[] {
  // 系统级开始菜单
  const programDataStartMenu = path.join(
    'C:',
    'ProgramData',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs'
  )

  // 用户级开始菜单
  const userStartMenu = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs'
  )

  // 用户桌面
  const userDesktop = path.join(os.homedir(), 'Desktop')

  // 公共桌面
  const publicDesktop = path.join('C:', 'Users', 'Public', 'Desktop')

  return [programDataStartMenu, userStartMenu, userDesktop, publicDesktop]
}

/**
 * 获取 macOS 应用目录路径
 */
export function getMacApplicationPaths(): string[] {
  return ['/Applications', '/System/Applications', `${process.env.HOME}/Applications`]
}
