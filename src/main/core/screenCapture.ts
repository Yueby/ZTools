import { clipboard, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ScreenCapture } from './native'
import windowManager from '../managers/windowManager'

// 截图方法windows
export const screenWindow = (
  cb: (image: string, bounds?: { x: number; y: number; width: number; height: number }) => void
): void => {
  ScreenCapture.start((result) => {
    if (result.success) {
      const image = clipboard.readImage()
      const bounds = {
        x: result.x!,
        y: result.y!,
        width: result.width!,
        height: result.height!
      }
      cb && cb(image.isEmpty() ? '' : image.toDataURL(), bounds)
    } else {
      cb && cb('')
    }
  })
}

// 截图方法mac
export const handleScreenShots = (
  cb: (image: string, bounds?: { x: number; y: number; width: number; height: number }) => void
): void => {
  const tmpPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`)
  exec(`screencapture -i -r "${tmpPath}"`, () => {
    if (fs.existsSync(tmpPath)) {
      try {
        const imageBuffer = fs.readFileSync(tmpPath)
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
        cb(base64Image)
        fs.unlinkSync(tmpPath)
      } catch {
        cb('')
      }
    } else {
      cb('')
    }
  })
}

/**
 * Linux 截图：依次尝试 gnome-screenshot → spectacle → scrot → maim → grim+slurp
 * 所有工具均以「区域选择截图」模式调用
 */
export const handleLinuxScreenShot = (cb: (image: string) => void): void => {
  const tmpPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`)

  const readAndReturn = (): void => {
    if (fs.existsSync(tmpPath)) {
      try {
        const imageBuffer = fs.readFileSync(tmpPath)
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
        cb(base64Image)
        fs.unlinkSync(tmpPath)
      } catch {
        cb('')
      }
    } else {
      cb('')
    }
  }

  // 尝试 gnome-screenshot（GNOME 环境）
  exec(`gnome-screenshot -a -f "${tmpPath}"`, (err1) => {
    if (!err1 && fs.existsSync(tmpPath)) {
      return readAndReturn()
    }

    // 尝试 spectacle（KDE 环境）
    exec(`spectacle -r -b -o "${tmpPath}"`, (err2) => {
      if (!err2 && fs.existsSync(tmpPath)) {
        return readAndReturn()
      }

      // 尝试 scrot（通用 X11）
      exec(`scrot -s "${tmpPath}"`, (err3) => {
        if (!err3 && fs.existsSync(tmpPath)) {
          return readAndReturn()
        }

        // 尝试 maim（通用 X11）
        exec(`maim -s "${tmpPath}"`, (err4) => {
          if (!err4 && fs.existsSync(tmpPath)) {
            return readAndReturn()
          }

          // 尝试 grim + slurp（Wayland）
          exec(`grim -g "$(slurp)" "${tmpPath}"`, (err5) => {
            if (!err5 && fs.existsSync(tmpPath)) {
              return readAndReturn()
            }
            cb('')
          })
        })
      })
    })
  })
}

export const screenCapture = (
  mainWindow?: BrowserWindow,
  restoreShowWindow: boolean = true
): Promise<{ image: string; bounds?: { x: number; y: number; width: number; height: number } }> => {
  return new Promise((resolve) => {
    // 隐藏主窗口
    const wasVisible = mainWindow?.isVisible() || false
    if (mainWindow && wasVisible) {
      mainWindow.hide()
    }

    // 恢复窗口显示
    const restoreWindow = (): void => {
      if (mainWindow && wasVisible && restoreShowWindow) {
        windowManager.showWindow()
      }
    }

    // 接收到截图后的执行程序
    if (process.platform === 'darwin') {
      handleScreenShots((image, bounds) => {
        restoreWindow()
        resolve({ image, bounds })
      })
    } else if (process.platform === 'win32') {
      screenWindow((image, bounds) => {
        restoreWindow()
        resolve({ image, bounds })
      })
    } else {
      // Linux
      handleLinuxScreenShot((image) => {
        restoreWindow()
        resolve({ image, bounds: undefined })
      })
    }
  })
}
