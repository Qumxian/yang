/* 10.9 update */
import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'
import router from './router'

const app = createApp(App)
app.use(ElementPlus, {
  locale: zhCn, // Element组件显示中文
})
app.use(router)
app.mount('#app')
