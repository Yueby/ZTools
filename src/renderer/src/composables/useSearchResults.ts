import { computed } from 'vue'
import { useCommandDataStore } from '../stores/commandDataStore'

/**
 * 搜索结果计算 Composable
 * 统一管理所有搜索结果的计算逻辑
 */
export function useSearchResults(props: {
  searchQuery: string
  pastedImage?: string | null
  pastedFiles?: any[] | null
  pastedText?: string | null
}): {
  bestSearchResults: any
  bestMatches: any
  recommendations: any
  allListModeResults: any
} {
  const commandDataStore = useCommandDataStore()
  const { search, searchInCommands, searchImageCommands, searchTextCommands, searchFileCommands } =
    commandDataStore

  // 统一的搜索结果（只执行一次搜索）
  const unifiedSearchResult = computed(() => {
    if (!props.searchQuery.trim()) {
      return { bestMatches: [], regexMatches: [] }
    }
    return search(props.searchQuery)
  })

  // 最佳搜索结果（模糊搜索：应用、插件、系统设置）
  const bestSearchResults = computed(() => {
    // 粘贴图片或文件时不显示最佳搜索结果
    if (props.pastedImage || props.pastedFiles) {
      return []
    }

    // 粘贴文本时，检查是否有 regex 类型的匹配
    if (props.pastedText) {
      const allMatched = searchTextCommands(props.pastedText)
      const regexMatched = allMatched.filter((cmd) => {
        const cmdType = cmd.cmdType || cmd.matchCmd?.type
        return cmdType === 'regex'
      })

      // 如果有 regex 匹配，则不显示 over 类型
      if (regexMatched.length > 0) {
        return []
      }

      // 返回 over 类型的指令
      const matchedCommands = allMatched.filter((cmd) => {
        const cmdType = cmd.cmdType || cmd.matchCmd?.type
        return cmdType === 'over'
      })

      // 如果有搜索关键词，在匹配的指令中搜索
      if (props.searchQuery.trim()) {
        return searchInCommands(matchedCommands, props.searchQuery)
      }
      return matchedCommands
    }

    // 正常搜索
    if (!props.searchQuery.trim()) {
      return []
    }

    return unifiedSearchResult.value.bestMatches
  })

  // 最佳匹配（匹配指令：regex/img/files 类型）
  const bestMatches = computed(() => {
    // 粘贴图片时，返回 img 类型的匹配指令
    if (props.pastedImage) {
      const matchedCommands = searchImageCommands()
      if (props.searchQuery.trim()) {
        return searchInCommands(matchedCommands, props.searchQuery)
      }
      return matchedCommands
    }

    // 粘贴文件时，返回 files 类型的匹配指令
    if (props.pastedFiles) {
      const matchedCommands = searchFileCommands(props.pastedFiles)
      if (props.searchQuery.trim()) {
        return searchInCommands(matchedCommands, props.searchQuery)
      }
      return matchedCommands
    }

    // 粘贴文本时，返回 regex 类型的匹配指令
    if (props.pastedText) {
      const allMatched = searchTextCommands(props.pastedText)
      const regexMatched = allMatched.filter((cmd) => {
        const cmdType = cmd.cmdType || cmd.matchCmd?.type
        return cmdType === 'regex'
      })

      if (props.searchQuery.trim()) {
        return searchInCommands(regexMatched, props.searchQuery)
      }
      return regexMatched
    }

    // 普通搜索：过滤出 regex、img、files 类型（排除 over）
    if (!props.searchQuery.trim()) {
      return []
    }

    return unifiedSearchResult.value.regexMatches.filter((cmd) => {
      const cmdType = cmd.cmdType || cmd.matchCmd?.type
      return cmdType === 'regex' || cmdType === 'img' || cmdType === 'files'
    })
  })

  // 推荐列表（over 类型）
  const recommendations = computed(() => {
    // 粘贴图片或文件时不显示推荐
    if (props.pastedImage || props.pastedFiles) return []

    let overTypeResults: any[] = []

    // 粘贴文本时，获取 over 类型的匹配指令
    if (props.pastedText) {
      const allMatched = searchTextCommands(props.pastedText)
      overTypeResults = allMatched.filter((cmd) => {
        const cmdType = cmd.cmdType || cmd.matchCmd?.type
        return cmdType === 'over'
      })

      if (props.searchQuery.trim()) {
        overTypeResults = searchInCommands(overTypeResults, props.searchQuery)
      }
    } else {
      // 普通搜索
      if (props.searchQuery.trim() === '') {
        return []
      }

      overTypeResults = unifiedSearchResult.value.regexMatches.filter((cmd) => {
        const cmdType = cmd.cmdType || cmd.matchCmd?.type
        return cmdType === 'over'
      })
    }

    // 去重：同一个 feature 只保留第一个匹配的 cmd
    const seenFeatures = new Set<string>()
    return overTypeResults.filter((item) => {
      const featureKey = item.type === 'plugin' ? `${item.path}:${item.featureCode}` : item.path
      if (seenFeatures.has(featureKey)) {
        return false
      }
      seenFeatures.add(featureKey)
      return true
    })
  })

  // 列表模式：合并所有搜索结果
  const allListModeResults = computed(() => {
    return [...bestSearchResults.value, ...bestMatches.value, ...recommendations.value]
  })

  return {
    bestSearchResults,
    bestMatches,
    recommendations,
    allListModeResults
  }
}
