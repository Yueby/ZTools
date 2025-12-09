import { shell } from 'electron'

export function launchApp(appPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    shell
      .openPath(appPath)
      .then((error) => {
        if (error) {
          console.error('启动应用失败:', error)
          reject(new Error(error))
        } else {
          console.log(`成功启动应用: ${appPath}`)
          resolve()
        }
      })
      .catch((error) => {
        console.error('启动应用失败:', error)
        reject(error)
      })
  })
}
