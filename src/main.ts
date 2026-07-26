import './spa-redirect'
import './styles/theme.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import router from './routes'
import { useAuthStore } from './stores/auth'
import { applyAppTheme } from './utils/userPreferences'

applyAppTheme()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(Antd)

const auth = useAuthStore()
auth.init()

app.mount('#app')
