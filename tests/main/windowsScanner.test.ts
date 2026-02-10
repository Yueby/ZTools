import { describe, it, expect, vi } from 'vitest'
import {
  shouldSkipShortcut,
  getIconUrl,
  deduplicateCommands,
  SKIP_FOLDERS,
  SKIP_EXTENSIONS,
  SKIP_NAME_PATTERN,
  SKIP_TARGET_PATTERN,
  SYSTEM_DIRECTORIES
} from '../../src/main/core/commandScanner/windowsScanner'

// ========== shouldSkipShortcut ==========

describe('shouldSkipShortcut', () => {
  describe('有目标路径时（基于目标路径判断）', () => {
    it('应跳过系统目录中的应用', () => {
      expect(shouldSkipShortcut('Notepad', 'C:\\Windows\\notepad.exe')).toBe(true)
      expect(shouldSkipShortcut('cmd', 'C:\\Windows\\System32\\cmd.exe')).toBe(true)
      expect(shouldSkipShortcut('app', 'C:\\Windows\\SysWOW64\\app.exe')).toBe(true)
    })

    it('不应跳过非系统目录中的应用', () => {
      expect(shouldSkipShortcut('App', 'C:\\Program Files\\App\\app.exe')).toBe(false)
      expect(shouldSkipShortcut('App', 'D:\\Games\\app.exe')).toBe(false)
    })

    it('应跳过文档类扩展名', () => {
      expect(shouldSkipShortcut('Help', 'C:\\App\\help.html')).toBe(true)
      expect(shouldSkipShortcut('Manual', 'C:\\App\\manual.pdf')).toBe(true)
      expect(shouldSkipShortcut('Help', 'C:\\App\\help.chm')).toBe(true)
      expect(shouldSkipShortcut('Readme', 'C:\\App\\README.md')).toBe(true)
      expect(shouldSkipShortcut('Doc', 'C:\\App\\guide.docx')).toBe(true)
    })

    it('不应跳过可执行文件', () => {
      expect(shouldSkipShortcut('App', 'C:\\App\\app.exe')).toBe(false)
    })

    it('应跳过卸载程序', () => {
      expect(shouldSkipShortcut('Uninstall', 'C:\\App\\uninstall.exe')).toBe(true)
      expect(shouldSkipShortcut('Uninstall', 'C:\\App\\uninst.exe')).toBe(true)
      expect(shouldSkipShortcut('Uninstall', 'C:\\App\\unins000.exe')).toBe(true)
      expect(shouldSkipShortcut('Uninstall', 'C:\\App\\unwise.exe')).toBe(true)
      expect(shouldSkipShortcut('Uninstall', 'C:\\App\\_uninst.exe')).toBe(true)
    })

    it('应跳过安装程序', () => {
      expect(shouldSkipShortcut('Setup', 'C:\\App\\setup.exe')).toBe(true)
      expect(shouldSkipShortcut('Install', 'C:\\App\\install.exe')).toBe(true)
      expect(shouldSkipShortcut('Installer', 'C:\\App\\installer.exe')).toBe(true)
      expect(shouldSkipShortcut('Install', 'C:\\App\\instmsi.exe')).toBe(true)
    })

    it('不应跳过名称包含 setup 但不以其开头的文件', () => {
      // GameSetup.exe 的 basename（去掉扩展名）是 GameSetup，不匹配 ^setup$
      expect(shouldSkipShortcut('GameSetup', 'C:\\App\\GameSetup.exe')).toBe(false)
    })

    it('目标路径检查通过时不应检查名称', () => {
      // 即使名称匹配 SKIP_NAME_PATTERN，如果目标路径正常，也不应跳过
      expect(shouldSkipShortcut('Uninstall Tool', 'C:\\App\\goodapp.exe')).toBe(false)
    })
  })

  describe('无目标路径时（降级检查名称）', () => {
    it('应跳过匹配跳过名称模式的应用', () => {
      expect(shouldSkipShortcut('Uninstall App')).toBe(true)
      expect(shouldSkipShortcut('卸载程序')).toBe(true)
      expect(shouldSkipShortcut('App卸载')).toBe(true)
      expect(shouldSkipShortcut('Website')).toBe(true)
      expect(shouldSkipShortcut('公司网站')).toBe(true)
      expect(shouldSkipShortcut('Help Center')).toBe(true)
      expect(shouldSkipShortcut('readme')).toBe(true)
      expect(shouldSkipShortcut('Documentation')).toBe(true)
    })

    it('不应跳过正常名称', () => {
      expect(shouldSkipShortcut('Visual Studio Code')).toBe(false)
      expect(shouldSkipShortcut('Chrome')).toBe(false)
      expect(shouldSkipShortcut('原神')).toBe(false)
    })
  })
})

// ========== getIconUrl ==========

describe('getIconUrl', () => {
  it('应生成正确的图标 URL', () => {
    const result = getIconUrl('C:\\App\\app.exe')
    expect(result).toBe(`ztools-icon://${encodeURIComponent('C:\\App\\app.exe')}`)
  })

  it('应正确编码特殊字符', () => {
    const result = getIconUrl('C:\\Program Files (x86)\\App\\app.exe')
    expect(result).toContain('ztools-icon://')
    expect(result).toContain(encodeURIComponent('C:\\Program Files (x86)\\App\\app.exe'))
  })

  it('应以 ztools-icon:// 协议开头', () => {
    expect(getIconUrl('test')).toMatch(/^ztools-icon:\/\//)
  })
})

// ========== deduplicateCommands ==========

describe('deduplicateCommands', () => {
  it('应去除完全相同名称和路径的重复项', () => {
    const apps = [
      { name: 'App', path: 'C:\\app.exe' },
      { name: 'App', path: 'C:\\app.exe' }
    ]
    const result = deduplicateCommands(apps)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('App')
  })

  it('应保留不同名但同路径的应用（核心特性）', () => {
    const apps = [
      { name: '原神', path: 'C:\\miHoYo\\launcher.exe' },
      { name: '米哈游启动器', path: 'C:\\miHoYo\\launcher.exe' }
    ]
    const result = deduplicateCommands(apps)
    expect(result).toHaveLength(2)
    expect(result.map((a) => a.name).sort()).toEqual(['原神', '米哈游启动器'].sort())
  })

  it('应保留同名但不同路径的应用', () => {
    const apps = [
      { name: 'App', path: 'C:\\v1\\app.exe' },
      { name: 'App', path: 'C:\\v2\\app.exe' }
    ]
    const result = deduplicateCommands(apps)
    expect(result).toHaveLength(2)
  })

  it('去重应不区分大小写', () => {
    const apps = [
      { name: 'App', path: 'C:\\App\\APP.EXE' },
      { name: 'app', path: 'c:\\app\\app.exe' }
    ]
    const result = deduplicateCommands(apps)
    expect(result).toHaveLength(1)
  })

  it('应保留第一个出现的重复项', () => {
    const apps = [
      { name: 'App', path: 'C:\\app.exe', icon: 'icon1' },
      { name: 'App', path: 'C:\\app.exe', icon: 'icon2' }
    ]
    const result = deduplicateCommands(apps)
    expect(result[0].icon).toBe('icon1')
  })

  it('空数组应返回空数组', () => {
    expect(deduplicateCommands([])).toEqual([])
  })
})

// ========== parseUrlFile ==========

describe('parseUrlFile', () => {
  it('应正确解析含应用协议的 .url 文件', async () => {
    vi.mock('fs/promises', () => ({
      default: {
        readFile: vi.fn()
      }
    }))

    const fsPromises = (await import('fs/promises')).default
    const mockedReadFile = vi.mocked(fsPromises.readFile)
    mockedReadFile.mockResolvedValue(
      '[InternetShortcut]\nURL=steam://rungameid/12345\nIconFile=C:\\steam.ico'
    )

    const { parseUrlFile } = await import('../../src/main/core/commandScanner/windowsScanner')
    const result = await parseUrlFile('test.url')

    expect(result).not.toBeNull()
    expect(result!.url).toBe('steam://rungameid/12345')
    expect(result!.iconFile).toBe('C:\\steam.ico')
  })

  it('应返回 null 对于 http:// 链接', async () => {
    const fsPromises = (await import('fs/promises')).default
    const mockedReadFile = vi.mocked(fsPromises.readFile)
    mockedReadFile.mockResolvedValue('[InternetShortcut]\nURL=http://example.com')

    const { parseUrlFile } = await import('../../src/main/core/commandScanner/windowsScanner')
    const result = await parseUrlFile('test.url')

    expect(result).toBeNull()
  })

  it('应返回 null 对于 https:// 链接', async () => {
    const fsPromises = (await import('fs/promises')).default
    const mockedReadFile = vi.mocked(fsPromises.readFile)
    mockedReadFile.mockResolvedValue('[InternetShortcut]\nURL=https://example.com')

    const { parseUrlFile } = await import('../../src/main/core/commandScanner/windowsScanner')
    const result = await parseUrlFile('test.url')

    expect(result).toBeNull()
  })

  it('应返回 null 当文件无 URL 字段时', async () => {
    const fsPromises = (await import('fs/promises')).default
    const mockedReadFile = vi.mocked(fsPromises.readFile)
    mockedReadFile.mockResolvedValue('[InternetShortcut]\nIconFile=test.ico')

    const { parseUrlFile } = await import('../../src/main/core/commandScanner/windowsScanner')
    const result = await parseUrlFile('test.url')

    expect(result).toBeNull()
  })

  it('应返回 null 当文件读取失败时', async () => {
    const fsPromises = (await import('fs/promises')).default
    const mockedReadFile = vi.mocked(fsPromises.readFile)
    mockedReadFile.mockRejectedValue(new Error('File not found'))

    const { parseUrlFile } = await import('../../src/main/core/commandScanner/windowsScanner')
    const result = await parseUrlFile('nonexistent.url')

    expect(result).toBeNull()
  })
})

// ========== 配置常量 ==========

describe('配置常量', () => {
  it('SKIP_FOLDERS 应包含常见开发文件夹', () => {
    expect(SKIP_FOLDERS).toContain('sdk')
    expect(SKIP_FOLDERS).toContain('docs')
    expect(SKIP_FOLDERS).toContain('examples')
    expect(SKIP_FOLDERS).toContain('demo')
  })

  it('SKIP_EXTENSIONS 应包含常见文档扩展名', () => {
    expect(SKIP_EXTENSIONS).toContain('.html')
    expect(SKIP_EXTENSIONS).toContain('.pdf')
    expect(SKIP_EXTENSIONS).toContain('.chm')
    expect(SKIP_EXTENSIONS).toContain('.md')
  })

  it('SYSTEM_DIRECTORIES 应包含 Windows 系统目录', () => {
    expect(SYSTEM_DIRECTORIES).toContain('c:\\windows\\')
    expect(SYSTEM_DIRECTORIES).toContain('c:\\windows\\system32\\')
  })
})
