<template>
  <div ref="scrollContainerRef" class="scrollable-content" @click="handleContainerClick">
    <!-- 聚合模式 -->
    <AggregateView
      v-if="searchMode === 'aggregate'"
      ref="aggregateViewRef"
      :search-query="searchQuery"
      :pasted-image="pastedImage"
      :pasted-files="pastedFiles"
      :pasted-text="pastedText"
      :best-search-results="bestSearchResults"
      :best-matches="bestMatches"
      :recommendations="recommendations"
      :display-apps="displayApps"
      :pinned-apps="pinnedApps"
      :finder-actions="finderActions"
      :navigation-grid="navigationGrid"
      :selected-row="selectedRow"
      :selected-col="selectedCol"
      :loading="loading"
      :show-recent-in-search="showRecentInSearch"
      :recent-rows="windowStore.recentRows"
      :pinned-rows="windowStore.pinnedRows"
      @select="handleSelectApp"
      @select-finder="handleFinderAction"
      @select-recommendation="handleRecommendationSelect"
      @contextmenu="handleAppContextMenu"
      @update:pinned-order="updatePinnedOrder"
      @height-changed="emit('height-changed')"
    />

    <!-- 列表模式 -->
    <div v-if="searchMode === 'list' && hasSearchContent" class="list-mode-results">
      <VerticalList
        :apps="allListModeResults"
        :selected-index="listModeSelectedIndex"
        :search-query="searchQuery"
        @select="handleSelectApp"
        @contextmenu="(app) => handleAppContextMenu(app, true, false)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useCommandDataStore } from '../../stores/commandDataStore'
import { useWindowStore } from '../../stores/windowStore'
import { useSearchResults } from '../../composables/useSearchResults'
import { useNavigation } from '../../composables/useNavigation'
import AggregateView from './AggregateView.vue'
import VerticalList from '../common/VerticalList.vue'

// MatchFile 接口（传递给插件的文件格式）
interface MatchFile {
  isFile: boolean
  isDirectory: boolean
  name: string
  path: string
}

// FileItem 接口（从剪贴板管理器返回的格式）
interface FileItem {
  path: string
  name: string
  isDirectory: boolean
}

interface Props {
  searchQuery: string
  pastedImage?: string | null
  pastedFiles?: FileItem[] | null
  pastedText?: string | null
}

const props = defineProps<Props>()

const windowStore = useWindowStore()
const searchMode = computed(() => windowStore.searchMode)

const emit = defineEmits<{
  (e: 'height-changed'): void
  (e: 'focus-input'): void
  (e: 'restore-match', state: any): void
}>()

// 使用 store
const commandDataStore = useCommandDataStore()
const { loading } = storeToRefs(commandDataStore)
const {
  getRecentCommands,
  removeFromHistory,
  pinCommand,
  unpinCommand,
  isPinned,
  getPinnedCommands,
  updatePinnedOrder
} = commandDataStore

// 使用搜索结果 composable
const { bestSearchResults, bestMatches, recommendations, allListModeResults } =
  useSearchResults(props)

// 内部状态
const scrollContainerRef = ref<HTMLElement>()
const aggregateViewRef = ref<InstanceType<typeof AggregateView>>()
const showRecentInSearch = computed(() => windowStore.showRecentInSearch)

// 是否有搜索内容
const hasSearchContent = computed(() => {
  return !!(props.searchQuery.trim() || props.pastedImage || props.pastedText || props.pastedFiles)
})

// 访达功能列表
const finderActions = computed(() => {
  if (!windowStore.isFinder()) {
    return []
  }
  return [
    {
      name: '复制路径',
      path: 'finder-action:copy-path',
      icon: '📋',
      type: 'builtin' as const
    },
    {
      name: '在终端打开',
      path: 'finder-action:open-terminal',
      icon: '⌨️',
      type: 'builtin' as const
    }
  ]
})

// 显示的应用列表
const displayApps = computed(() => {
  if (props.pastedImage || props.pastedText || props.pastedFiles) return []
  if (props.searchQuery.trim() === '') {
    return getRecentCommands()
  }
  return []
})

// 固定应用列表
const pinnedApps = computed(() => {
  return getPinnedCommands()
})

// 将一维数组转换为二维数组(每行9个)
function arrayToGrid(arr: any[], cols = 9): any[][] {
  const grid: any[][] = []
  for (let i = 0; i < arr.length; i += cols) {
    grid.push(arr.slice(i, i + cols))
  }
  return grid
}

// 构建导航网格
const navigationGrid = computed(() => {
  const sections: any[] = []

  // 列表模式：使用一维数组（每个项目占一行）
  if (searchMode.value === 'list') {
    if (!hasSearchContent.value) {
      return []
    }
    allListModeResults.value.forEach((item) => {
      sections.push({ type: 'listItem', items: [item] })
    })
    return sections
  }

  // 聚合模式
  if (hasSearchContent.value) {
    // 有搜索：最佳搜索结果 + 最佳匹配 + 匹配推荐
    if (bestSearchResults.value.length > 0) {
      const searchGrid = arrayToGrid(bestSearchResults.value)
      searchGrid.forEach((row) => {
        sections.push({ type: 'bestSearch', items: row })
      })
    }

    if (bestMatches.value.length > 0) {
      const matchGrid = arrayToGrid(bestMatches.value)
      matchGrid.forEach((row) => {
        sections.push({ type: 'bestMatch', items: row })
      })
    }

    if (recommendations.value.length > 0) {
      const recommendGrid = arrayToGrid(recommendations.value)
      recommendGrid.forEach((row) => {
        sections.push({ type: 'recommendation', items: row })
      })
    }
  } else {
    // 无搜索：最近使用 + 固定栏 + 访达
    const appsGrid = arrayToGrid(displayApps.value)
    appsGrid.forEach((row) => {
      sections.push({ type: 'apps', items: row })
    })

    if (pinnedApps.value.length > 0) {
      const pinnedGrid = arrayToGrid(pinnedApps.value)
      pinnedGrid.forEach((row) => {
        sections.push({ type: 'pinned', items: row })
      })
    }

    if (finderActions.value.length > 0) {
      const finderGrid = arrayToGrid(finderActions.value)
      finderGrid.forEach((row) => {
        sections.push({ type: 'finder', items: row })
      })
    }
  }

  return sections
})

// 使用导航 composable
const { selectedRow, selectedCol, selectedItem, handleKeydown: handleNavigationKeydown, resetSelection } =
  useNavigation(searchMode, navigationGrid)

// 列表模式的选中索引（一维索引）
const listModeSelectedIndex = computed(() => {
  if (searchMode.value !== 'list') {
    return -1
  }

  const grid = navigationGrid.value
  if (grid.length === 0 || selectedRow.value >= grid.length) {
    return -1
  }

  // 计算一维索引
  let index = 0
  for (let i = 0; i < selectedRow.value; i++) {
    index += grid[i].items.length
  }
  index += selectedCol.value

  return index
})

// 监听搜索内容变化,重置选中状态
watch(
  [
    () => props.searchQuery,
    () => props.pastedImage,
    () => props.pastedText,
    () => props.pastedFiles
  ],
  () => {
    resetSelection()
    emit('height-changed')
  }
)

// 滚动到选中的项
function scrollToSelectedItem(): void {
  const container = scrollContainerRef.value
  if (!container) {
    return
  }

  nextTick(() => {
    let selectedElement: HTMLElement | null = null

    // 列表模式：查找 .list-item.selected
    if (searchMode.value === 'list') {
      const listItems = container.querySelectorAll('.list-item.selected')
      if (listItems && listItems.length > 0) {
        selectedElement = listItems[0] as HTMLElement
      }
    } else {
      // 聚合模式：查找 .app-item.selected
      const appItems = container.querySelectorAll('.app-item.selected')
      if (appItems && appItems.length > 0) {
        selectedElement = appItems[0] as HTMLElement
      }
    }

    if (!selectedElement) {
      return
    }

    const containerRect = container.getBoundingClientRect()
    const targetRect = selectedElement.getBoundingClientRect()

    // 检查是否在可见区域内
    const isAbove = targetRect.top < containerRect.top
    const isBelow = targetRect.bottom > containerRect.bottom

    if (isAbove) {
      const scrollTop = container.scrollTop + (targetRect.top - containerRect.top)
      container.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'auto'
      })
    } else if (isBelow) {
      const scrollTop = container.scrollTop + (targetRect.bottom - containerRect.bottom)
      container.scrollTo({
        top: scrollTop,
        behavior: 'auto'
      })
    }
  })
}

// 监听选中项变化，自动滚动
watch([selectedRow, selectedCol], () => {
  scrollToSelectedItem()
})

// 监听固定列表变化，调整窗口高度
watch(
  () => pinnedApps.value.length,
  () => {
    emit('height-changed')
  }
)

// 监听历史记录列表变化，调整窗口高度
watch(
  () => displayApps.value.length,
  () => {
    emit('height-changed')
  }
)

// 处理应用右键菜单
async function handleAppContextMenu(
  app: any,
  fromSearch = false,
  fromPinned = false
): Promise<void> {
  const menuItems: any[] = []

  // 只在历史记录中显示"从使用记录删除"
  if (!fromSearch && !fromPinned) {
    menuItems.push({
      id: `remove-from-history:${JSON.stringify({ path: app.path, featureCode: app.featureCode })}`,
      label: '从使用记录删除'
    })
  }

  // 如果是应用（不是插件和系统设置），显示"打开文件位置"
  if (app.type !== 'system-setting' && app.type !== 'plugin' && app.path) {
    menuItems.push({
      id: `reveal-in-finder:${JSON.stringify({ path: app.path })}`,
      label: '打开文件位置'
    })
  }

  // 根据是否已固定显示不同选项
  if (isPinned(app.path, app.featureCode)) {
    menuItems.push({
      id: `unpin-app:${JSON.stringify({ path: app.path, featureCode: app.featureCode })}`,
      label: '取消固定'
    })
  } else {
    menuItems.push({
      id: `pin-app:${JSON.stringify({
        name: app.name,
        path: app.path,
        icon: app.icon,
        pinyin: app.pinyin,
        pinyinAbbr: app.pinyinAbbr,
        type: app.type,
        featureCode: app.featureCode,
        pluginName: app.pluginName,
        pluginExplain: app.pluginExplain
      })}`,
      label: '固定到顶部'
    })
  }

  // 如果是插件，添加插件设置菜单
  if (app.type === 'plugin' && app.pluginName) {
    let outKillPlugins: string[] = []
    let autoDetachPlugins: string[] = []
    try {
      const killData = await window.ztools.dbGet('outKillPlugin')
      if (killData && Array.isArray(killData)) {
        outKillPlugins = killData
      }
      const detachData = await window.ztools.dbGet('autoDetachPlugin')
      if (detachData && Array.isArray(detachData)) {
        autoDetachPlugins = detachData
      }
    } catch (error) {
      console.log('读取配置失败:', error)
    }

    const isAutoKill = outKillPlugins.includes(app.pluginName)
    const isAutoDetach = autoDetachPlugins.includes(app.pluginName)

    menuItems.push({
      label: '插件设置',
      submenu: [
        {
          id: `toggle-auto-kill:${app.pluginName}`,
          label: '退出到后台立即结束运行',
          type: 'checkbox',
          checked: isAutoKill
        },
        {
          id: `toggle-auto-detach:${app.pluginName}`,
          label: '自动分离为独立窗口',
          type: 'checkbox',
          checked: isAutoDetach
        }
      ]
    })
  }

  await window.ztools.showContextMenu(menuItems)
}

// 选择应用
async function handleSelectApp(app: any): Promise<void> {
  try {
    // 如果是"上次匹配"指令，执行恢复逻辑
    if (app.path === 'special:last-match') {
      const state = await window.ztools.restoreLastMatch()
      if (state) {
        emit('restore-match', state)
      }
      return
    }

    // 构造 payload 和 type
    let payload: any = props.searchQuery
    let type = app.cmdType || 'text'

    if (app.cmdType === 'img' && props.pastedImage) {
      payload = props.pastedImage
    } else if (app.cmdType === 'over' && props.pastedText) {
      payload = props.pastedText
    } else if (app.cmdType === 'regex' && props.pastedText) {
      payload = props.pastedText
    } else if (app.cmdType === 'files' && props.pastedFiles) {
      payload = props.pastedFiles.map((file) => ({
        isFile: !file.isDirectory,
        isDirectory: file.isDirectory,
        name: file.name,
        path: file.path
      })) as MatchFile[]
    }

    // 启动应用或插件
    await window.ztools.launch({
      path: app.path,
      type: app.type || 'app',
      featureCode: app.featureCode,
      name: app.name,
      cmdType: app.cmdType || 'text',
      confirmDialog: app.confirmDialog
        ? {
            type: app.confirmDialog.type,
            buttons: [...app.confirmDialog.buttons],
            defaultId: app.confirmDialog.defaultId,
            cancelId: app.confirmDialog.cancelId,
            title: app.confirmDialog.title,
            message: app.confirmDialog.message,
            detail: app.confirmDialog.detail
          }
        : undefined,
      param: {
        payload,
        type,
        inputState: {
          searchQuery: props.searchQuery,
          pastedImage: props.pastedImage,
          pastedFiles: props.pastedFiles
            ? props.pastedFiles.map((file) => ({
                isFile: !file.isDirectory,
                isDirectory: file.isDirectory,
                name: file.name,
                path: file.path
              }))
            : null,
          pastedText: props.pastedText
        }
      }
    })
  } catch (error) {
    console.error('启动失败:', error)
  }
}

// 访达功能选择
async function handleFinderAction(item: any): Promise<void> {
  try {
    const path = await window.ztools.getFinderPath()
    if (!path) {
      console.error('无法获取 Finder 路径')
      return
    }

    if (item.path === 'finder-action:copy-path') {
      await window.ztools.copyToClipboard(path)
      window.ztools.hideWindow()
    } else if (item.path === 'finder-action:open-terminal') {
      await window.ztools.openTerminal(path)
      window.ztools.hideWindow()
    }
  } catch (error) {
    console.error('执行 Finder 操作失败:', error)
  }
}

// 选择推荐项
async function handleRecommendationSelect(item: any): Promise<void> {
  if (item.type === 'plugin') {
    await handleSelectApp(item)
  }
}

// 键盘导航
async function handleKeydown(event: KeyboardEvent): Promise<void> {
  const grid = navigationGrid.value
  if (!grid || grid.length === 0) return

  // 处理 Enter 键的特殊逻辑
  if (event.key === 'Enter') {
    event.preventDefault()
    const item = selectedItem.value
    if (item) {
      const currentRow = grid[selectedRow.value]
      if (currentRow.type === 'finder') {
        handleFinderAction(item)
      } else if (currentRow.type === 'recommendation') {
        handleRecommendationSelect(item)
      } else {
        handleSelectApp(item)
      }
    }
    return
  }

  // 其他导航键交给 useNavigation 处理
  handleNavigationKeydown(event, () => {
    // 这个回调不会被调用，因为 Enter 键已经在上面处理了
  })
}

// 处理上下文菜单命令
async function handleContextMenuCommand(command: string): Promise<void> {
  if (command.startsWith('remove-from-history:')) {
    const jsonStr = command.replace('remove-from-history:', '')
    try {
      const { path, featureCode } = JSON.parse(jsonStr)
      await removeFromHistory(path, featureCode)
      nextTick(() => {
        emit('height-changed')
        emit('focus-input')
      })
    } catch (error) {
      console.error('从历史记录删除失败:', error)
    }
  } else if (command.startsWith('pin-app:')) {
    const appJson = command.replace('pin-app:', '')
    try {
      const app = JSON.parse(appJson)
      await pinCommand(app)
      nextTick(() => {
        emit('height-changed')
        emit('focus-input')
      })
    } catch (error) {
      console.error('固定应用失败:', error)
    }
  } else if (command.startsWith('unpin-app:')) {
    const jsonStr = command.replace('unpin-app:', '')
    try {
      const { path, featureCode } = JSON.parse(jsonStr)
      await unpinCommand(path, featureCode)
      nextTick(() => {
        emit('height-changed')
        emit('focus-input')
      })
    } catch (error) {
      console.error('取消固定失败:', error)
    }
  } else if (command.startsWith('reveal-in-finder:')) {
    const jsonStr = command.replace('reveal-in-finder:', '')
    try {
      const { path: filePath } = JSON.parse(jsonStr)
      await window.ztools.revealInFinder(filePath)
      emit('focus-input')
    } catch (error) {
      console.error('打开文件位置失败:', error)
    }
  } else if (command.startsWith('toggle-auto-kill:')) {
    const pluginName = command.replace('toggle-auto-kill:', '')
    try {
      let outKillPlugins: string[] = []
      try {
        const data = await window.ztools.dbGet('outKillPlugin')
        if (data && Array.isArray(data)) {
          outKillPlugins = data
        }
      } catch (error) {
        console.debug('未找到outKillPlugin配置', error)
      }

      const index = outKillPlugins.indexOf(pluginName)
      if (index !== -1) {
        outKillPlugins.splice(index, 1)
      } else {
        outKillPlugins.push(pluginName)
      }

      await window.ztools.dbPut('outKillPlugin', outKillPlugins)
      console.log('已更新 outKillPlugin 配置:', outKillPlugins)
    } catch (error: any) {
      console.error('切换自动结束配置失败:', error)
    }
  } else if (command.startsWith('toggle-auto-detach:')) {
    const pluginName = command.replace('toggle-auto-detach:', '')
    try {
      let autoDetachPlugins: string[] = []
      try {
        const data = await window.ztools.dbGet('autoDetachPlugin')
        if (data && Array.isArray(data)) {
          autoDetachPlugins = data
        }
      } catch (error) {
        console.debug('未找到 autoDetachPlugin 配置', error)
      }

      const index = autoDetachPlugins.indexOf(pluginName)
      if (index !== -1) {
        autoDetachPlugins.splice(index, 1)
      } else {
        autoDetachPlugins.push(pluginName)
      }

      await window.ztools.dbPut('autoDetachPlugin', autoDetachPlugins)
      console.log('已更新 autoDetachPlugin 配置:', autoDetachPlugins)
    } catch (error: any) {
      console.error('切换自动分离配置失败:', error)
    }
  }
}

// 点击容器聚焦输入框
function handleContainerClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('.app-item')) {
    return
  }
  emit('focus-input')
}

// 重置折叠状态
function resetCollapseState(): void {
  aggregateViewRef.value?.resetCollapseState()
}

// 初始化
onMounted(() => {
  window.ztools.onContextMenuCommand(handleContextMenuCommand)
})

// 导出方法供父组件调用
defineExpose({
  navigationGrid,
  handleKeydown,
  resetSelection,
  resetCollapseState
})
</script>

<style scoped>
.scrollable-content {
  max-height: 541px;
  overflow-y: auto;
  overflow-x: hidden;
  user-select: none;
  padding: 0 0 2px 0;
  border-radius: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.scrollable-content::-webkit-scrollbar {
  width: 6px;
}

.scrollable-content::-webkit-scrollbar-track {
  background: transparent;
}

.scrollable-content::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  transition: background-color 0.2s;
}

.scrollable-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  .scrollable-content {
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .scrollable-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .scrollable-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }
}

.list-mode-results {
  display: flex;
  flex-direction: column;
}
</style>
