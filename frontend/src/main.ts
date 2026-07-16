import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { useAppearanceStore } from '@/stores/appearanceStore';
import './styles/global.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
useAppearanceStore().initializeAppearance();
app.mount('#app');
