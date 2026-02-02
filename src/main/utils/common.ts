/**
 * 睡眠指定毫秒数
 * @param ms 毫秒数
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 提取英文名称的首字母缩写
 * 支持两种模式（优先级从高到低）：
 * 1. 空格分隔的单词首字母：Visual Studio Code → vsc
 * 2. 驼峰命名首字母：VisualStudioCode → vsc
 * @param name 应用名称
 * @returns 首字母缩写字符串
 */
export function extractAcronym(name: string): string {
  // 方式1：空格分隔的单词首字母（优先）
  // "Visual Studio Code" → "vsc"
  const words = name.split(/\s+/).filter((w) => w.length > 0)
  if (words.length > 1) {
    return words.map((w) => w[0].toLowerCase()).join('')
  }

  // 方式2：驼峰命名首字母
  // "VisualStudioCode" → "vsc"
  const capitals = name.match(/[A-Z]/g)
  if (capitals && capitals.length > 1) {
    return capitals.map((c) => c.toLowerCase()).join('')
  }

  // 无法提取首字母缩写
  return ''
}
