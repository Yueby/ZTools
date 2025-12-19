<script setup lang="ts">
import { onMounted } from 'vue'
import Settings from './components/settings/Settings.vue'

onMounted(() => {
  // 插件进入时直接显示设置页面
  window.ztools.onPluginEnter((action) => {
    console.log('设置插件启动:', action)
  })

  window.ztools.onPluginOut(() => {
    console.log('设置插件退出')
  })
})
</script>

<template>
  <Settings />
</template>
