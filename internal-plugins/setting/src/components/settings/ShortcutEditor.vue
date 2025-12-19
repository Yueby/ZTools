<template>
  <DetailPanel :title="editingShortcut ? '编辑全局快捷键' : '添加全局快捷键'" @back="emit('back')">
    <div class="editor-wrapper">
      <div class="editor-content">
        <!-- 快捷键录制 -->
        <div class="form-item">
          <label class="form-label">快捷键</label>
          <div
            class="input hotkey-recorder"
            :class="{ recording: isRecording }"
            @click="startRecording"
          >
            {{ displayHotkey }}
          </div>
          <span class="form-hint">点击上方输入框录制快捷键</span>
        </div>

        <!-- 目标指令输入 -->
        <div class="form-item">
          <label class="form-label">目标指令</label>
          <input
            v-model="targetCommand"
            type="text"
            class="input"
            placeholder="格式: 插件名称/指令名称，例如: 翻译/translate"
          />
          <span class="form-hint">格式: 插件名称/指令名称（支持动态指令）</span>
        </div>
      </div>

      <div class="editor-footer">
        <button class="btn" @click="emit('back')">取消</button>
        <button class="btn" :disabled="!recordedShortcut || !targetCommand" @click="handleSave">
          确定
        </button>
      </div>
    </div>
  </DetailPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import DetailPanel from '../common/DetailPanel.vue'

interface GlobalShortcut {
  id: string
  shortcut: string
  target: string
  enabled: boolean
}

const props = defineProps<{
  editingShortcut?: GlobalShortcut | null
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'save', shortcut: string, target: string): void
}>()

// 平台信息（用于区分 Alt/Option 显示）
const platform = ref<'darwin' | 'win32' | 'linux'>('darwin')

// 录制状态
const isRecording = ref(false)
const recordedShortcut = ref('')
const recordedKeys = ref<string[]>([])
const targetCommand = ref('')

// 显示的快捷键文本
const displayHotkey = computed(() => {
  if (isRecording.value) {
    return recordedKeys.value.length > 0 ? recordedKeys.value.join('+') : '请按下快捷键组合...'
  }
  return recordedShortcut.value || '点击录制快捷键'
})

// 初始化编辑数据
watch(
  () => props.editingShortcut,
  (newVal) => {
    if (newVal) {
      recordedShortcut.value = newVal.shortcut
      targetCommand.value = newVal.target
    } else {
      recordedShortcut.value = ''
      targetCommand.value = ''
    }
  },
  { immediate: true }
)

// 开始录制快捷键
function startRecording(): void {
  isRecording.value = true
  recordedKeys.value = []
  recordedShortcut.value = ''
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
}

// 停止录制
function stopRecording(): void {
  isRecording.value = false
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
}

// 处理按键
function handleKeyDown(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopPropagation()

  const keys: string[] = []

  // 修饰键（Alt 在 Windows 上显示为 Alt，其它平台显示为 Option）
  if (e.metaKey) keys.push('Command')
  if (e.ctrlKey) keys.push('Ctrl')
  if (e.altKey) keys.push(platform.value === 'win32' ? 'Alt' : 'Option')
  if (e.shiftKey) keys.push('Shift')

  // 主键
  if (
    e.code &&
    ![
      'MetaLeft',
      'MetaRight',
      'ControlLeft',
      'ControlRight',
      'AltLeft',
      'AltRight',
      'ShiftLeft',
      'ShiftRight'
    ].includes(e.code)
  ) {
    let mainKey = ''

    if (e.code.startsWith('Key')) {
      mainKey = e.code.replace('Key', '')
    } else if (e.code.startsWith('Digit')) {
      mainKey = e.code.replace('Digit', '')
    } else if (e.code.startsWith('Numpad')) {
      mainKey = e.code
    } else {
      mainKey = e.code
    }

    if (mainKey) {
      keys.push(mainKey)
    }
  }

  recordedKeys.value = keys
}

// 按键抬起时确认快捷键
function handleKeyUp(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopPropagation()

  if (recordedKeys.value.length > 1) {
    // 至少需要一个修饰键 + 一个主键
    recordedShortcut.value = recordedKeys.value.join('+')
    stopRecording()
  }
}

// 保存
function handleSave(): void {
  if (!recordedShortcut.value || !targetCommand.value) {
    return
  }
  emit('save', recordedShortcut.value, targetCommand.value)
}

// 清理
onUnmounted(() => {
  stopRecording()
})

// 初始化平台信息
onMounted(() => {
  const pf = window.ztools.internal.getPlatform()
  if (pf === 'darwin' || pf === 'win32' || pf === 'linux') {
    platform.value = pf
  }
})
</script>

<style scoped>
.editor-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-content {
  flex: 1;
  padding: 24px;
}

.form-item {
  margin-bottom: 24px;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 8px;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.hotkey-recorder {
  font-weight: 500;
  text-align: center;
  cursor: pointer;
}

.hotkey-recorder.recording {
  border-color: color-mix(in srgb, var(--primary-color), black 15%);
  background: var(--primary-light-bg);
  color: var(--primary-color);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--divider-color);
  background: var(--bg-color);
}
</style>
