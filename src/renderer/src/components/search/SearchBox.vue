<template>
  <div class="search-box">
    <!-- 隐藏的测量元素,用于计算文本宽度 -->
    <div class="search-input-container">
      <!-- 粘贴的图片缩略图 -->
      <div v-if="pastedImage" class="pasted-image-thumbnail" @click="clearPastedImage">
        <img :src="pastedImage" alt="粘贴的图片" />
        <div class="clear-icon">×</div>
      </div>
      <!-- 粘贴的文件显示 -->
      <div
        v-if="pastedFiles && pastedFiles.length > 0"
        class="pasted-files"
        @click="clearPastedFiles"
      >
        <div class="file-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M13 2V9H20"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="file-info">
          <span class="file-name">{{ getFirstFileName(pastedFiles) }}</span>
          <span v-if="pastedFiles.length > 1" class="file-count"
            >+{{ pastedFiles.length - 1 }}</span
          >
        </div>
        <div class="clear-icon">×</div>
      </div>
      <!-- 粘贴的文本显示 -->
      <div v-if="pastedText" class="pasted-text" @click="clearPastedText">
        <div class="text-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M14 2V8H20M16 13H8M16 17H8M10 9H8"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="text-info">
          <span class="text-content">{{ truncatedPastedText }}</span>
        </div>
        <div class="clear-icon">×</div>
      </div>
      <span ref="measureRef" class="measure-text"></span>
      <input
        ref="inputRef"
        type="text"
        :value="modelValue"
        :placeholder="placeholderText"
        class="search-input"
        @input="onInput"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
        @keydown="onKeydown"
        @keydown.left="(e) => keydownEvent(e, 'left')"
        @keydown.right="(e) => keydownEvent(e, 'right')"
        @keydown.down="(e) => keydownEvent(e, 'down')"
        @keydown.up="(e) => keydownEvent(e, 'up')"
        @paste="handlePaste"
      />
    </div>
    <!-- 操作栏 -->
    <div class="search-actions">
      <!-- 更新提示（有下载好的更新时显示） -->
      <div
        v-if="windowStore.updateDownloadInfo.hasDownloaded && !windowStore.currentPlugin"
        class="update-notification"
        @click="handleUpdateClick"
      >
        <span class="update-text">新版本已下载，点击升级</span>
        <UpdateIcon />
      </div>
      <!-- 头像按钮（无更新或插件模式时显示） -->
      <img
        v-else
        :src="avatarUrl"
        :class="[
          'search-btn',
          { 'default-avatar': isDefaultAvatar },
          { 'plugin-logo': windowStore.currentPlugin?.logo }
        ]"
        @click="handleSettingsClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useWindowStore } from '../../stores/windowStore'
import UpdateIcon from './UpdateIcon.vue'

// FileItem 接口（从剪贴板管理器返回的格式）
interface FileItem {
  path: string
  name: string
  isDirectory: boolean
}

const props = defineProps<{
  modelValue: string
  pastedImage?: string | null
  pastedFiles?: FileItem[] | null
  pastedText?: string | null
  currentView?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:pastedImage', value: string | null): void
  (e: 'update:pastedFiles', value: FileItem[] | null): void
  (e: 'update:pastedText', value: string | null): void
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'arrow-keydown', event: KeyboardEvent, direction: 'left' | 'right' | 'up' | 'down'): void
  (e: 'composing', isComposing: boolean): void
  (e: 'settings-click'): void
}>()

const windowStore = useWindowStore()

const placeholderText = computed(() => {
  // 如果在插件模式下,使用子输入框的 placeholder
  if (windowStore.currentPlugin) {
    return windowStore.subInputPlaceholder
  }
  // 否则使用全局 placeholder
  return windowStore.placeholder
})
const avatarUrl = computed(() => {
  // 优先显示插件图标
  if (windowStore.currentPlugin?.logo) {
    return windowStore.currentPlugin.logo
  }
  // 否则显示用户头像
  return windowStore.avatar
})

// 判断是否是默认头像
const isDefaultAvatar = computed(() => {
  return avatarUrl.value.includes('default.png')
})

// 截断显示的粘贴文本（最多显示30个字符）
const truncatedPastedText = computed(() => {
  if (!props.pastedText) return ''
  if (props.pastedText.length <= 30) return props.pastedText
  return props.pastedText.substring(0, 30) + '...'
})

const inputRef = ref<HTMLInputElement>()
const measureRef = ref<HTMLSpanElement>()
const isComposing = ref(false) // 是否正在输入法组合
const composingText = ref('') // 正在组合的文本

watch(
  () => composingText.value,
  (newValue) => {
    console.log('composingText 更改了', newValue)
    measureRef.value!.textContent = newValue || placeholderText.value
    updateInputWidth()
  }
)

function onCompositionStart(): void {
  isComposing.value = true
  emit('composing', true)
}

function onCompositionEnd(event: Event): void {
  isComposing.value = false
  emit('composing', false)
  // 组合结束后触发一次输入事件
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
}

function onInput(event: Event): void {
  console.log('onInput', event)
  // 如果正在输入法组合中,不触发更新
  if (isComposing.value) {
    composingText.value = (event.target as HTMLInputElement).value
    return
  }
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent): void {
  // 如果正在输入法组合中,不触发键盘事件
  if (isComposing.value && event.key === 'Enter') {
    return
  }

  // 如果有粘贴的图片、文件或文本，按 Backspace 或 Delete 键清除
  if (
    (props.pastedImage || props.pastedFiles || props.pastedText) &&
    (event.key === 'Backspace' || event.key === 'Delete')
  ) {
    // 如果输入框为空，清除图片、文件或文本
    if (!props.modelValue) {
      event.preventDefault()
      if (props.pastedImage) {
        clearPastedImage()
      } else if (props.pastedFiles) {
        clearPastedFiles()
      } else if (props.pastedText) {
        clearPastedText()
      }
      return
    }
  }

  emit('keydown', event)
}

function keydownEvent(event: KeyboardEvent, direction: 'left' | 'right' | 'up' | 'down'): void {
  // 如果正在输入法组合中,不触发键盘事件
  if (isComposing.value) {
    return
  }
  emit('arrow-keydown', event, direction)
}

// 处理粘贴事件
async function handlePaste(event: ClipboardEvent): Promise<void> {
  try {
    // 手动粘贴不需要时间限制
    const copiedContent = await window.ztools.getLastCopiedContent()

    if (copiedContent?.type === 'image') {
      // 粘贴的是图片
      event.preventDefault() // 阻止默认粘贴行为
      emit('update:pastedImage', copiedContent.data as string)
    } else if (copiedContent?.type === 'file') {
      // 粘贴的是文件
      event.preventDefault() // 阻止默认粘贴行为
      emit('update:pastedFiles', copiedContent.data as FileItem[])
    } else if (copiedContent?.type === 'text') {
      // 粘贴的是文本
      event.preventDefault() // 阻止默认粘贴行为
      emit('update:pastedText', copiedContent.data as string)
    }
  } catch (error) {
    console.error('处理粘贴失败:', error)
  }
}

// 清除粘贴的图片
function clearPastedImage(): void {
  emit('update:pastedImage', null)
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 清除粘贴的文件
function clearPastedFiles(): void {
  emit('update:pastedFiles', null)
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 清除粘贴的文本
function clearPastedText(): void {
  emit('update:pastedText', null)
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 获取第一个文件的名称（用于显示）
function getFirstFileName(files: FileItem[]): string {
  if (files.length === 0) return ''
  return files[0].name
}

function updateInputWidth(): void {
  nextTick(() => {
    if (measureRef.value) {
      const width = measureRef.value.offsetWidth
      // 使用原生设置宽度
      inputRef.value!.style.width = `${width}px`
      console.log('inputWidth.value', width)
    }
  })
}

// 监听 modelValue 变化
watch(
  () => props.modelValue,
  () => {
    measureRef.value!.textContent = props.modelValue || placeholderText.value
    updateInputWidth()
  }
)

// 监听 currentPlugin 变化
watch(
  () => windowStore.currentPlugin,
  () => {
    measureRef.value!.textContent = props.modelValue || placeholderText.value
    updateInputWidth()
  }
)

onMounted(() => {
  inputRef.value?.focus()

  // 监听菜单命令
  window.ztools.onContextMenuCommand(async (command) => {
    if (command === 'open-devtools') {
      window.ztools.openPluginDevTools()
    } else if (command === 'kill-plugin') {
      try {
        // 调用新接口：终止插件并返回搜索页面
        const result = await window.ztools.killPluginAndReturn(windowStore.currentPlugin!.path)
        if (!result.success) {
          alert(`终止插件失败: ${result.error}`)
        }
      } catch (error: any) {
        console.error('终止插件失败:', error)
        alert(`终止插件失败: ${error.message || '未知错误'}`)
      }
    } else if (command === 'detach-plugin') {
      try {
        const result = await window.ztools.detachPlugin()
        if (!result.success) {
          alert(`分离插件失败: ${result.error}`)
        }
      } catch (error: any) {
        console.error('分离插件失败:', error)
        alert(`分离插件失败: ${error.message || '未知错误'}`)
      }
    }
  })
})

async function handleSettingsClick(): Promise<void> {
  console.log('点击设置按钮:', {
    currentView: props.currentView,
    currentPlugin: windowStore.currentPlugin
  })

  // 只有在插件视图真正显示时才显示插件菜单
  if (props.currentView === 'plugin' && windowStore.currentPlugin) {
    console.log('显示插件菜单')
    const menuItems = [
      { id: 'detach-plugin', label: '分离到独立窗口 (⌘+D)' },
      { id: 'open-devtools', label: '打开开发者工具' },
      { id: 'kill-plugin', label: '结束运行' }
    ]

    await window.ztools.showContextMenu(menuItems)
  } else {
    // 否则打开设置页面
    console.log('触发设置点击事件')
    emit('settings-click')
  }
}

async function handleUpdateClick(): Promise<void> {
  try {
    // 确认升级
    const confirmed = confirm(
      `确定要升级到版本 ${windowStore.updateDownloadInfo.version} 吗？\n\n应用将重启以完成升级。`
    )
    if (!confirmed) {
      return
    }

    // 执行升级
    const result = await window.ztools.updater.installDownloadedUpdate()
    if (!result.success) {
      alert(`升级失败: ${result.error}`)
    }
  } catch (error: any) {
    console.error('升级失败:', error)
    alert(`升级失败: ${error.message || '未知错误'}`)
  }
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  selectAll: () => inputRef.value?.select()
})
</script>

<style scoped>
.search-box {
  padding: 5px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: drag;
  /* 整个区域默认可拖动 */
  position: relative;
  overflow: hidden; /* 防止内容溢出 */
  width: 100%; /* 确保宽度不超过父容器 */
}

.measure-text {
  position: absolute;
  white-space: pre;
  font-size: 24px;
  font-family: inherit;
  pointer-events: none;
  opacity: 0;
}

.search-input {
  flex: 1;
  min-width: 0; /* 允许缩小到最小 */
  max-width: 720px;
  height: 48px;
  line-height: 48px;
  font-size: 24px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-color);
  -webkit-app-region: no-drag;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.search-input::placeholder {
  color: #7a7a7a;
  font-size: 24px;
  font-weight: 300;
}

/* 暗色模式下的 placeholder 颜色 */
@media (prefers-color-scheme: dark) {
  .search-input::placeholder {
    color: #aaaaaa;
  }
}

.search-input-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0; /* 允许 flex 子元素缩小 */
  overflow: hidden; /* 防止内容溢出 */
}

.pasted-image-thumbnail {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0; /* 图片缩略图不允许缩小，保持尺寸 */
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-app-region: no-drag;
}

.pasted-image-thumbnail:hover {
  opacity: 0.8;
}

.pasted-image-thumbnail:hover .clear-icon {
  opacity: 1;
}

.pasted-image-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pasted-files,
.pasted-text {
  position: relative;
  max-width: 200px;
  min-width: 100px; /* 最小宽度 */
  height: 35px;
  flex-shrink: 1; /* 允许缩小 */
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 4px;
  background: var(--control-bg);
  border: 1px solid var(--control-border);
  cursor: pointer;
  transition: all 0.2s;
  -webkit-app-region: no-drag;
}

.pasted-files:hover,
.pasted-text:hover {
  background: var(--hover-bg);
}

.pasted-files:hover .clear-icon,
.pasted-text:hover .clear-icon {
  opacity: 1;
}

.file-icon,
.text-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-color);
  opacity: 0.7;
}

.file-info,
.text-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.file-name,
.text-content {
  font-size: 14px;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-count {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.clear-icon {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border-radius: 0 0 0 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0; /* 右侧按钮区域不允许缩小 */
}

.update-notification {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.1);
  transition: all 0.2s;
  -webkit-app-region: no-drag;
}

.update-notification:hover {
  background: rgba(16, 185, 129, 0.2);
  transform: scale(1.02);
}

.update-notification:active {
  transform: scale(0.98);
}

.update-text {
  font-size: 13px;
  color: #10b981;
  font-weight: 500;
  white-space: nowrap;
}

.search-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-app-region: no-drag;
  /* 按钮不可拖动 */
}

/* 插件图标：保持原本形状，不使用圆形遮罩 */
.search-btn.plugin-logo {
  border-radius: 6px;
  object-fit: contain;
}

.search-btn:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

.search-btn:active {
  transform: scale(0.95);
}

/* 暗色模式下默认头像反色 */
@media (prefers-color-scheme: dark) {
  .search-btn.default-avatar {
    filter: invert(1);
  }
}
</style>
