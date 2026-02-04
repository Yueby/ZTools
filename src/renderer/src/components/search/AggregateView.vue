<template>
  <div class="aggregate-view">
    <!-- 无搜索时：历史记录 + 固定列表 + 访达 -->
    <div v-if="!hasSearchContent" class="content-section">
      <!-- 最近使用 -->
      <CollapsibleList
        v-if="showRecentInSearch"
        v-model:expanded="isRecentExpanded"
        title="最近使用"
        :apps="displayApps"
        :selected-index="getAbsoluteIndexForSection('apps')"
        :empty-text="loading ? '正在加载应用...' : '未找到应用'"
        :default-visible-rows="recentRows"
        :draggable="false"
        @select="$emit('select', $event)"
        @contextmenu="(app) => $emit('contextmenu', app, false, false)"
      />

      <!-- 固定栏 -->
      <CollapsibleList
        v-model:expanded="isPinnedExpanded"
        title="已固定"
        :apps="pinnedApps"
        :selected-index="getAbsoluteIndexForSection('pinned')"
        :default-visible-rows="pinnedRows"
        :draggable="true"
        @select="$emit('select', $event)"
        @contextmenu="(app) => $emit('contextmenu', app, false, true)"
        @update:apps="$emit('update:pinned-order', $event)"
      />

      <!-- 访达 -->
      <CollapsibleList
        v-if="finderActions.length > 0"
        title="访达"
        :apps="finderActions"
        :selected-index="getAbsoluteIndexForSection('finder')"
        :empty-text="''"
        :draggable="false"
        @select="$emit('select-finder', $event)"
      />
    </div>

    <!-- 有搜索时：搜索结果 -->
    <div v-if="hasSearchContent" class="search-results">
      <!-- 最佳搜索结果（模糊搜索） -->
      <CollapsibleList
        v-if="bestSearchResults.length > 0"
        v-model:expanded="isSearchResultsExpanded"
        title="最佳搜索结果"
        :apps="bestSearchResults"
        :selected-index="getAbsoluteIndexForSection('bestSearch')"
        :empty-text="'未找到应用'"
        :default-visible-rows="2"
        :draggable="false"
        :search-query="searchQuery"
        @select="$emit('select', $event)"
        @contextmenu="(app) => $emit('contextmenu', app, true, false)"
      />

      <!-- 最佳匹配（匹配指令：regex/img/files） -->
      <CollapsibleList
        v-if="bestMatches.length > 0"
        v-model:expanded="isBestMatchesExpanded"
        title="最佳匹配"
        :apps="bestMatches"
        :selected-index="getAbsoluteIndexForSection('bestMatch')"
        :empty-text="''"
        :default-visible-rows="2"
        :draggable="false"
        :search-query="searchQuery"
        @select="$emit('select', $event)"
        @contextmenu="(app) => $emit('contextmenu', app, true, false)"
      />

      <!-- 匹配推荐（over 类型） -->
      <CollapsibleList
        v-model:expanded="isRecommendationsExpanded"
        title="匹配推荐"
        :apps="recommendations"
        :selected-index="getAbsoluteIndexForSection('recommendation')"
        :empty-text="''"
        :default-visible-rows="2"
        :draggable="false"
        :search-query="searchQuery"
        @select="$emit('select-recommendation', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CollapsibleList from '../common/CollapsibleList.vue'

interface Props {
  searchQuery: string
  pastedImage?: string | null
  pastedFiles?: any[] | null
  pastedText?: string | null
  bestSearchResults: any[]
  bestMatches: any[]
  recommendations: any[]
  displayApps: any[]
  pinnedApps: any[]
  finderActions: any[]
  navigationGrid: any[]
  selectedRow: number
  selectedCol: number
  loading: boolean
  showRecentInSearch: boolean
  recentRows: number
  pinnedRows: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', app: any): void
  (e: 'select-finder', item: any): void
  (e: 'select-recommendation', item: any): void
  (e: 'contextmenu', app: any, fromSearch: boolean, fromPinned: boolean): void
  (e: 'update:pinned-order', apps: any[]): void
  (e: 'height-changed'): void
}>()

// 展开状态
const isRecentExpanded = ref(false)
const isPinnedExpanded = ref(false)
const isSearchResultsExpanded = ref(false)
const isBestMatchesExpanded = ref(false)
const isRecommendationsExpanded = ref(false)

// 是否有搜索内容
const hasSearchContent = computed(() => {
  return !!(
    props.searchQuery.trim() ||
    props.pastedImage ||
    props.pastedText ||
    props.pastedFiles
  )
})

// 计算指定类型在列表中的绝对索引
function getAbsoluteIndexForSection(sectionType: string): number {
  const grid = props.navigationGrid
  if (grid.length === 0 || props.selectedRow >= grid.length) {
    return -1
  }

  const currentRow = grid[props.selectedRow]
  if (currentRow.type !== sectionType) {
    return -1
  }

  // 找到该类型的起始行
  let startRow = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i].type === sectionType) {
      startRow = i
      break
    }
  }

  // 计算相对于起始行的索引
  return (props.selectedRow - startRow) * 9 + props.selectedCol
}

// 重置所有列表的折叠状态
function resetCollapseState(): void {
  isRecentExpanded.value = false
  isPinnedExpanded.value = false
  isSearchResultsExpanded.value = false
  isBestMatchesExpanded.value = false
  isRecommendationsExpanded.value = false
}

// 监听搜索条件变化，重置折叠状态
watch(
  () => [props.searchQuery, props.pastedImage, props.pastedFiles, props.pastedText],
  () => {
    resetCollapseState()
  }
)

// 监听展开状态变化，通知父组件调整窗口高度
watch(
  [
    isRecentExpanded,
    isPinnedExpanded,
    isSearchResultsExpanded,
    isBestMatchesExpanded,
    isRecommendationsExpanded
  ],
  () => {
    emit('height-changed')
  }
)

// 导出方法供父组件调用
defineExpose({
  resetCollapseState
})
</script>

<style scoped>
.aggregate-view {
  display: flex;
  flex-direction: column;
}

.content-section {
  flex: 1;
}

.search-results {
  display: flex;
  flex-direction: column;
}
</style>
