import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const proxyTarget =
        env.VITE_DEV_PROXY_TARGET?.trim()
        || env.VITE_API_BASE_URL?.trim()
        || 'http://127.0.0.1:18765';

    return {
        base: './',
        plugins: [vue()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        server: {
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                },
                '/fairy': {
                    target: proxyTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
