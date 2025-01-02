import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/dialog.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
window.Vue = app

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app') 