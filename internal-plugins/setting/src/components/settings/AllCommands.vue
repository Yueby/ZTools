<template>
  <div class="all-commands-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span class="loading-text">加载指令数据...</span>
    </div>

    <!-- 左侧：来源列表 -->
    <div v-show="!loading" class="sources-panel">
      <div class="panel-header">
        <h3>指令来源</h3>
      </div>
      <div class="sources-list">
        <!-- 内置分组标题 -->
        <div class="section-divider">
          <span>内置</span>
        </div>

        <!-- 系统应用 -->
        <div
          :class="['source-item', { active: selectedSource?.subType === 'app' }]"
          @click="selectSource({ subType: 'app', name: '系统应用' })"
        >
          <span class="source-icon">💻</span>
          <span class="source-name">系统应用</span>
          <span class="source-badge">{{ appCount }}</span>
        </div>

        <!-- 系统设置 -->
        <div
          v-if="settingCount > 0"
          :class="['source-item', { active: selectedSource?.subType === 'system-setting' }]"
          @click="selectSource({ subType: 'system-setting', name: '系统设置' })"
        >
          <span class="source-icon">⚙️</span>
          <span class="source-name">系统设置</span>
          <span class="source-badge">{{ settingCount }}</span>
        </div>

        <!-- 内置插件列表 -->
        <div
          v-for="plugin in internalPlugins"
          :key="plugin.path"
          :class="['source-item', { active: selectedSource?.path === plugin.path }]"
          @click="selectSource(plugin)"
        >
          <AdaptiveIcon
            v-if="plugin.logo"
            :src="plugin.logo"
            class="source-icon plugin-icon"
            draggable="false"
          />
          <span v-else class="source-icon">🧩</span>
          <span class="source-name">{{ plugin.title }}</span>
          <span class="source-badge">{{ getPluginCommandCount(plugin) }}</span>
        </div>

        <!-- 第三方插件分组标题 -->
        <div v-if="thirdPartyPlugins.length > 0" class="section-divider">
          <span>插件</span>
        </div>

        <!-- 第三方插件列表 -->
        <div
          v-for="plugin in thirdPartyPlugins"
          :key="plugin.path"
          :class="['source-item', { active: selectedSource?.path === plugin.path }]"
          @click="selectSource(plugin)"
        >
          <AdaptiveIcon
            v-if="plugin.logo"
            :src="plugin.logo"
            class="source-icon plugin-icon"
            draggable="false"
          />
          <span v-else class="source-icon">🧩</span>
          <span class="source-name">{{ plugin.title || plugin.name }}</span>
          <span class="source-badge">{{ getPluginCommandCount(plugin) }}</span>
        </div>
      </div>
    </div>

    <!-- 右侧：指令详情 -->
    <div v-show="!loading" class="commands-panel">
      <!-- 头部 -->
      <div class="panel-header">
        <!-- Tab 切换 -->
        <div v-if="hasCommands" class="tab-group">
          <button
            :class="['tab-btn', { active: activeTab === 'text' }]"
            @click="activeTab = 'text'"
          >
            功能指令
            <span class="tab-count">{{ textFeaturesCount }}</span>
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'match' }]"
            @click="activeTab = 'match'"
          >
            匹配指令
            <span class="tab-count">{{ matchFeaturesCount }}</span>
          </button>
        </div>
      </div>

      <!-- 指令列表 -->
      <div class="commands-content">
        <!-- 未选择来源 -->
        <div v-if="!selectedSource" class="empty-state">
          <span class="empty-icon">📋</span>
          <p>从左侧选择一个来源查看指令</p>
        </div>

        <!-- 功能指令 Tab -->
        <div v-else-if="activeTab === 'text'" class="command-list">
          <div v-if="textFeaturesCount === 0" class="empty-state">
            <span class="empty-icon">🔍</span>
            <p>暂无功能指令</p>
          </div>

          <!-- 系统应用/设置：单个显示 -->
          <template
            v-if="selectedSource?.subType === 'app' || selectedSource?.subType === 'system-setting'"
          >
            <CommandCard v-for="(cmd, index) in systemCommands" :key="index" :command="cmd" />
          </template>

          <!-- 插件：按 feature 分组显示 -->
          <template v-else>
            <FeatureCard
              v-for="feature in groupedFeatures"
              v-show="feature.textCmds.length > 0"
              :key="feature.code"
              :feature="feature"
            >
              <TagDropdown
                v-for="(cmd, idx) in feature.textCmds"
                :key="idx"
                :menu-items="
                  getMenuItems(
                    isCommandDisabled(selectedSource?.name || '', feature.code, cmd.name, 'text'),
                    'text',
                    selectedSource?.name || '',
                    feature.code,
                    cmd.name
                  )
                "
                @select="
                  (key) =>
                    handleMenuSelect(
                      key,
                      selectedSource?.name || '',
                      feature.code,
                      cmd.name,
                      'text'
                    )
                "
              >
                <CommandTag
                  :command="cmd"
                  :disabled="
                    isCommandDisabled(selectedSource?.name || '', feature.code, cmd.name, 'text')
                  "
                  show-arrow
                />
              </TagDropdown>
            </FeatureCard>
          </template>
        </div>

        <!-- 匹配指令 Tab -->
        <div v-else-if="activeTab === 'match'" class="command-list">
          <div v-if="matchFeaturesCount === 0" class="empty-state">
            <span class="empty-icon">🔍</span>
            <p>暂无匹配指令</p>
          </div>

          <!-- 插件：按 feature 分组显示 -->
          <FeatureCard
            v-for="feature in groupedFeatures"
            v-show="feature.matchCmds.length > 0"
            :key="feature.code"
            :feature="feature"
          >
            <TagDropdown
              v-for="(cmd, idx) in feature.matchCmds"
              :key="idx"
              :menu-items="
                getMenuItems(
                  isCommandDisabled(selectedSource?.name || '', feature.code, cmd.name, cmd.type),
                  cmd.type
                )
              "
              @select="
                (key) =>
                  handleMenuSelect(
                    key,
                    selectedSource?.name || '',
                    feature.code,
                    cmd.name,
                    cmd.type
                  )
              "
            >
              <CommandTag
                :command="cmd"
                :disabled="
                  isCommandDisabled(selectedSource?.name || '', feature.code, cmd.name, cmd.type)
                "
                show-arrow
              />
            </TagDropdown>
          </FeatureCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import settingsFillIcon from '../../assets/image/settings-fill.png'
import AdaptiveIcon from '../common/AdaptiveIcon.vue'
import CommandCard from './common/CommandCard.vue'
import CommandTag from './common/CommandTag.vue'
import FeatureCard from './common/FeatureCard.vue'
import TagDropdown, { type MenuItem } from './common/TagDropdown.vue'

// 定义 Command 类型（从 commandDataStore 复制）
export type CommandType = 'direct' | 'plugin' | 'builtin'
export type CommandSubType = 'app' | 'system-setting'
export type CommandCmdType = 'text' | 'regex' | 'over'

export interface Command {
  name: string
  path?: string
  icon?: string
  type: CommandType
  subType?: CommandSubType
  pinyin?: string
  pinyinAbbr?: string
  featureCode?: string
  pluginExplain?: string
  cmdType?: CommandCmdType
  matchCmd?: {
    type: string
    match: string
  }
}

interface Source {
  type?: string
  subType?: string
  name: string
  path?: string
  logo?: string
}

// 本地状态：指令数据
const loading = ref(true)
const commands = ref<Command[]>([])
const regexCommands = ref<Command[]>([])

const plugins = ref<any[]>([])
const selectedSource = ref<Source | null>(null)
const activeTab = ref<'text' | 'match'>('text')

// 禁用指令列表
const disabledCommands = ref<string[]>([])
const DISABLED_COMMANDS_KEY = 'disable-commands'

// 超级面板固定列表
const superPanelPinned = ref<any[]>([])
const SUPER_PANEL_PINNED_KEY = 'super-panel-pinned'

// 生成指令唯一标识
// 格式: pluginName:featureCode:cmdName:cmdType
function getCommandId(
  pluginName: string,
  featureCode: string,
  cmdName: string,
  cmdType: string
): string {
  return `${pluginName}:${featureCode}:${cmdName}:${cmdType}`
}

// 检查指令是否被禁用
function isCommandDisabled(
  pluginName: string,
  featureCode: string,
  cmdName: string,
  cmdType: string
): boolean {
  const id = getCommandId(pluginName, featureCode, cmdName, cmdType)
  return disabledCommands.value.includes(id)
}

// 切换指令禁用状态
async function toggleCommandDisabled(
  pluginName: string,
  featureCode: string,
  cmdName: string,
  cmdType: string
): Promise<void> {
  const id = getCommandId(pluginName, featureCode, cmdName, cmdType)
  const index = disabledCommands.value.indexOf(id)

  if (index === -1) {
    // 添加到禁用列表
    disabledCommands.value.push(id)
  } else {
    // 从禁用列表移除
    disabledCommands.value.splice(index, 1)
  }

  // 保存到数据库
  await saveDisabledCommands()
}

// 保存禁用指令列表到数据库
async function saveDisabledCommands(): Promise<void> {
  try {
    // 将 Vue 响应式数组转换为普通数组，避免 IPC 克隆错误
    const plainArray = [...disabledCommands.value]
    await window.ztools.internal.dbPut(DISABLED_COMMANDS_KEY, plainArray)
    // 通知主渲染进程禁用指令列表已更改
    await window.ztools.internal.notifyDisabledCommandsChanged()
  } catch (error) {
    console.error('保存禁用指令列表失败:', error)
  }
}

// 加载禁用指令列表
async function loadDisabledCommands(): Promise<void> {
  try {
    const data = await window.ztools.internal.dbGet(DISABLED_COMMANDS_KEY)
    if (data && Array.isArray(data)) {
      disabledCommands.value = data
    }
  } catch (error) {
    console.error('加载禁用指令列表失败:', error)
  }
}

// 加载超级面板固定列表
async function loadSuperPanelPinned(): Promise<void> {
  try {
    const data = await window.ztools.internal.dbGet(SUPER_PANEL_PINNED_KEY)
    if (data && Array.isArray(data)) {
      superPanelPinned.value = data
    }
  } catch (error) {
    console.error('加载超级面板固定列表失败:', error)
  }
}

// 检查指令是否已固定到超级面板
function isPinnedToSuperPanel(pluginName: string, featureCode: string, cmdName: string): boolean {
  return superPanelPinned.value.some(
    (item) =>
      item.name === cmdName && item.featureCode === featureCode && item.pluginName === pluginName
  )
}

// 固定/取消固定到超级面板
async function toggleSuperPanelPin(
  pluginName: string,
  featureCode: string,
  cmdName: string
): Promise<void> {
  const isPinned = isPinnedToSuperPanel(pluginName, featureCode, cmdName)

  if (isPinned) {
    // 取消固定
    superPanelPinned.value = superPanelPinned.value.filter(
      (item) =>
        !(
          item.name === cmdName &&
          item.featureCode === featureCode &&
          item.pluginName === pluginName
        )
    )
  } else {
    // 查找对应的指令信息
    const command = commands.value.find(
      (c) =>
        c.path === selectedSource.value?.path && c.featureCode === featureCode && c.name === cmdName
    )

    if (command) {
      superPanelPinned.value.push({
        name: command.name,
        path: command.path || '',
        icon: command.icon || '',
        type: command.type,
        featureCode: command.featureCode || '',
        pluginName: pluginName,
        pluginExplain: command.pluginExplain || '',
        cmdType: command.cmdType || 'text'
      })
    }
  }

  // 保存到数据库
  try {
    const plainArray = JSON.parse(JSON.stringify(superPanelPinned.value))
    await window.ztools.internal.dbPut(SUPER_PANEL_PINNED_KEY, plainArray)
  } catch (error) {
    console.error('保存超级面板固定列表失败:', error)
  }
}

// 下拉菜单项
function getMenuItems(
  isDisabled: boolean,
  cmdType?: string,
  pluginName?: string,
  featureCode?: string,
  cmdName?: string
): MenuItem[] {
  const items: MenuItem[] = []

  // 只有功能指令（text 类型）才显示"打开指令"
  if (cmdType === 'text') {
    items.push({
      key: 'open',
      label: '打开指令',
      icon: 'play'
    })

    // 功能指令支持固定到超级面板
    if (pluginName && featureCode && cmdName) {
      const pinned = isPinnedToSuperPanel(pluginName, featureCode, cmdName)
      items.push({
        key: 'pin-super-panel',
        label: pinned ? '取消固定超级面板' : '固定到超级面板',
        icon: 'pin'
      })
    }
  }

  // 启用/禁用指令（所有类型都支持）
  items.push({
    key: 'toggle',
    label: isDisabled ? '启用指令' : '禁用指令',
    icon: isDisabled ? 'check' : 'ban',
    danger: !isDisabled
  })

  return items
}

// 处理下拉菜单选择
async function handleMenuSelect(
  key: string,
  pluginName: string,
  featureCode: string,
  cmdName: string,
  cmdType: string
): Promise<void> {
  if (key === 'toggle') {
    toggleCommandDisabled(pluginName, featureCode, cmdName, cmdType)
  } else if (key === 'open') {
    // 打开指令
    await openCommand(pluginName, featureCode, cmdName, cmdType)
  } else if (key === 'pin-super-panel') {
    // 固定/取消固定到超级面板
    await toggleSuperPanelPin(pluginName, featureCode, cmdName)
  }
}

// 打开指令
async function openCommand(
  pluginName: string,
  featureCode: string,
  cmdName: string,
  cmdType: string
): Promise<void> {
  try {
    // 查找对应的指令
    const command = commands.value.find(
      (c) =>
        c.path === selectedSource.value?.path &&
        c.featureCode === featureCode &&
        c.name === cmdName &&
        c.cmdType === cmdType
    )

    if (!command) {
      console.error('未找到指令:', { pluginName, featureCode, cmdName, cmdType })
      return
    }

    console.log('打开指令:', command)

    // 启动指令（使用内置插件 API）
    await window.ztools.internal.launch({
      path: command.path || '',
      type: command.type,
      featureCode: command.featureCode,
      name: command.name,
      param: {
        payload: '' // 功能指令默认空 payload
      }
    })
  } catch (error) {
    console.error('打开指令失败:', error)
  }
}

// 内置插件名称列表（与主进程保持一致）
const INTERNAL_PLUGIN_NAMES = ['setting', 'system']

// 判断是否为内置插件
function isInternalPlugin(pluginName: string): boolean {
  return INTERNAL_PLUGIN_NAMES.includes(pluginName)
}

// 内置插件列表
const internalPlugins = computed(() => {
  return plugins.value.filter((p) => isInternalPlugin(p.name))
})

// 第三方插件列表
const thirdPartyPlugins = computed(() => {
  return plugins.value.filter((p) => !isInternalPlugin(p.name))
})

// 所有指令
const allCommands = computed(() => commands.value)
const allRegexCommands = computed(() => regexCommands.value)

// 统计
const appCount = computed(
  () => allCommands.value.filter((c) => c.type === 'direct' && c.subType === 'app').length
)

const settingCount = computed(
  () =>
    allCommands.value.filter((c) => c.type === 'direct' && c.subType === 'system-setting').length
)

// 当前选中来源的指令（系统应用/设置）
const systemCommands = computed(() => {
  if (!selectedSource.value) return []

  const source = selectedSource.value

  let filteredCommands: Command[] = []

  if (source.subType === 'app') {
    filteredCommands = allCommands.value.filter((c) => c.type === 'direct' && c.subType === 'app')
  } else if (source.subType === 'system-setting') {
    filteredCommands = allCommands.value.filter(
      (c) => c.type === 'direct' && c.subType === 'system-setting'
    )
    // 为系统设置添加统一图标
    filteredCommands = filteredCommands.map((cmd) => ({
      ...cmd,
      icon: cmd.icon || settingsFillIcon
    }))
  }

  return filteredCommands
})

// 按 feature 分组的插件功能
const groupedFeatures = computed(() => {
  if (!selectedSource.value || !selectedSource.value.path) return []

  const source = selectedSource.value
  const featureMap = new Map<
    string,
    {
      code: string
      name: string
      explain: string
      icon: string
      textCmds: any[]
      matchCmds: any[]
    }
  >()

  // 收集功能指令
  allCommands.value
    .filter((c) => c.type === 'plugin' && c.path === source.path && c.featureCode)
    .forEach((cmd) => {
      const key = cmd.featureCode || ''
      if (!featureMap.has(key)) {
        featureMap.set(key, {
          code: cmd.featureCode || '',
          name: cmd.name,
          explain: cmd.pluginExplain || '',
          icon: cmd.icon || '',
          textCmds: [],
          matchCmds: []
        })
      }
      const feature = featureMap.get(key)!
      if (cmd.cmdType === 'text') {
        // 对于功能指令，name 就是指令文本
        feature.textCmds.push({
          text: cmd.name,
          name: cmd.name
        })
      }
    })

  // 收集匹配指令
  allRegexCommands.value
    .filter((c) => c.path === source.path)
    .forEach((cmd) => {
      const key = cmd.featureCode || ''
      if (!featureMap.has(key)) {
        featureMap.set(key, {
          code: cmd.featureCode || '',
          name: cmd.name,
          explain: cmd.pluginExplain || '',
          icon: cmd.icon || '',
          textCmds: [],
          matchCmds: []
        })
      }
      const feature = featureMap.get(key)!
      feature.matchCmds.push({
        type: cmd.cmdType,
        match: cmd.matchCmd || { type: '', match: '' },
        name: cmd.name
      })
    })

  return Array.from(featureMap.values())
})

const hasCommands = computed(() => {
  return (
    systemCommands.value.length > 0 ||
    groupedFeatures.value.some((f) => f.textCmds.length > 0 || f.matchCmds.length > 0)
  )
})

const textFeaturesCount = computed(() => {
  if (
    selectedSource.value?.subType === 'app' ||
    selectedSource.value?.subType === 'system-setting'
  ) {
    return systemCommands.value.length
  }
  // 统计有功能指令的功能数量
  return groupedFeatures.value.filter((f) => f.textCmds.length > 0).length
})

const matchFeaturesCount = computed(() => {
  // 统计有匹配指令的功能数量
  return groupedFeatures.value.filter((f) => f.matchCmds.length > 0).length
})

// 预计算每个插件的指令数量（一次遍历，避免 N 次全量 filter）
const pluginCommandCountMap = computed(() => {
  const map = new Map<string, number>()
  for (const c of allCommands.value) {
    if (c.type === 'plugin' && c.featureCode && c.path) {
      map.set(c.path, (map.get(c.path) || 0) + 1)
    }
  }
  for (const c of allRegexCommands.value) {
    if (c.featureCode && c.path) {
      map.set(c.path, (map.get(c.path) || 0) + 1)
    }
  }
  return map
})

function getPluginCommandCount(plugin: any): number {
  return pluginCommandCountMap.value.get(plugin.path) || 0
}

// 加载指令数据（包含 commands、regexCommands、plugins）
async function loadCommands(): Promise<void> {
  try {
    const result = await window.ztools.internal.getCommands()
    commands.value = result.commands
    regexCommands.value = result.regexCommands
    // 直接使用 getCommands 返回的 plugins，避免额外 IPC 请求
    if (result.plugins) {
      plugins.value = result.plugins
    }
  } catch (error) {
    console.error('加载指令数据失败:', error)
  }
}

// 选择来源
function selectSource(source: Source): void {
  selectedSource.value = source
  activeTab.value = 'text'
}

// 初始化
onMounted(async () => {
  loading.value = true
  try {
    // 并行加载禁用指令和超级面板固定列表（互不依赖）
    await Promise.all([loadDisabledCommands(), loadSuperPanelPinned()])
    // 加载指令数据（内含 plugins，无需再单独请求）
    await loadCommands()
    // 默认选中系统应用
    if (appCount.value > 0) {
      selectSource({ subType: 'app', name: '系统应用' })
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.all-commands-container {
  display: flex;
  height: 100%;
  background: var(--bg-color);
}

/* === 加载状态 === */
.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 12px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--divider-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 13px;
  color: var(--text-color-secondary);
}

/* === 左侧面板 === */
.sources-panel {
  width: 220px;
  border-right: 1px solid var(--divider-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--divider-color);
  background: var(--bg-color);
  height: 56px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.panel-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.sources-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.source-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-color);
}

.source-item:hover {
  background: var(--hover-bg);
}

.source-item.active {
  background: var(--active-bg);
  color: var(--primary-color);
  font-weight: 500;
}

.source-icon {
  width: 20px;
  height: 20px;
  margin-right: 10px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.plugin-icon {
  border-radius: 4px;
  object-fit: contain;
}

.source-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-badge {
  padding: 2px 6px;
  font-size: 11px;
  background: var(--control-bg);
  color: var(--text-secondary);
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.source-item.active .source-badge {
  background: var(--primary-light-bg);
  color: var(--primary-color);
}

.section-divider {
  margin: 12px 0 8px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* === 右侧面板 === */
.commands-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.commands-panel .panel-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--divider-color);
  background: var(--bg-color);
  height: 56px;
  box-sizing: border-box;
}

/* Tab 切换组 */
.tab-group {
  display: flex;
  gap: 6px;
  background: var(--control-bg);
  padding: 3px;
  border-radius: 8px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.tab-btn:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.tab-btn.active {
  background: var(--active-bg);
  color: var(--primary-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab-count {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--control-bg);
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.tab-btn.active .tab-count {
  background: var(--primary-light-bg);
  color: var(--primary-color);
}

/* === 指令列表 === */
.commands-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.command-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.command-card {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  cursor: default;
  transition: all 0.2s;
}

.command-card:hover {
  background: var(--hover-bg);
  transform: translateX(2px);
}

/* Feature 卡片 */
.feature-card {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  cursor: default;
  transition: all 0.2s;
  gap: 8px;
}

.feature-card:hover {
  background: var(--hover-bg);
}

.feature-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feature-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
}

.feature-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.feature-icon .icon-emoji {
  font-size: 16px;
  line-height: 1;
}

.feature-icon .icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--control-bg);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
}

.feature-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
  line-height: 1.4;
}

.feature-commands {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.command-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 4px;
  font-size: 12px;
  color: #0ea5e9;
  font-weight: 500;
  transition: all 0.2s;
  cursor: default;
  user-select: none;
}

.command-tag:hover {
  background: #0ea5e9;
  color: white;
  border-color: #0ea5e9;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* 暗色模式下的功能指令标签 */
@media (prefers-color-scheme: dark) {
  .command-tag {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #7dd3fc;
  }

  .command-tag:hover {
    background: #38bdf8;
    color: #1f2937;
    border-color: #38bdf8;
  }
}

/* 统一的标签徽章 */
.tag-badge {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.command-tag:hover .tag-badge {
  background: rgba(255, 255, 255, 0.35);
}

/* 暗色模式下的标签徽章 */
@media (prefers-color-scheme: dark) {
  .tag-badge {
    background: rgba(255, 255, 255, 0.15);
  }

  .command-tag:hover .tag-badge {
    background: rgba(255, 255, 255, 0.25);
  }
}

.command-icon {
  width: 36px;
  height: 36px;
  margin-right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.command-icon img,
.command-icon .adaptive-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

/* 自适应图标样式由全局 CSS 处理（style.css） */

.icon-emoji {
  font-size: 24px;
}

.icon-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  font-weight: 600;
}

.command-details {
  flex: 1;
  min-width: 0;
}

.command-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 4px;
}

.command-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.meta-tag {
  padding: 3px 8px;
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  background: var(--control-bg);
  color: var(--primary-color);
  border-radius: 4px;
  font-weight: 500;
}

.meta-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.meta-path {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--text-secondary);
  opacity: 0.6;
  word-break: break-all;
  line-height: 1.4;
}

.match-rule {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.match-rule code {
  font-family: 'Consolas', 'Monaco', monospace;
  padding: 3px 8px;
  background: var(--control-bg);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-color);
  font-weight: 500;
}

.length-info {
  font-size: 11px;
  color: var(--text-secondary);
}

.type-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.badge-text {
  background: var(--primary-light-bg);
  color: var(--primary-color);
}

.badge-regex {
  background: var(--warning-light-bg);
  color: var(--warning-color);
}

.badge-over {
  background: var(--purple-light-bg);
  color: var(--purple-color);
}

/* === 空状态 === */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
