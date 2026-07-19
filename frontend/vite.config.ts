import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { voskModelPlugin } from './plugins/vosk-model-plugin';

function buildManualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  // 拆出运行时框架层，减少主包体积并提升浏览器缓存复用率
  if (id.includes('\u0000')) {
    return undefined;
  }
  if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/@vue')) {
    return 'framework';
  }

  // 数学公式渲染单独拆包：KaTeX JS + 字体/CSS 资源会一起形成较明显体积
  if (id.includes('node_modules/katex')) {
    return 'katex';
  }

  // 图标库单独拆包：lucide 使用广泛，但与业务代码解耦，适合独立缓存
  if (id.includes('node_modules/@lucide')) {
    return 'icons';
  }

  // 语音识别相关依赖单独拆包，避免不使用语音功能时增加主包解析压力
  if (id.includes('node_modules/vosk-browser')) {
    return 'vosk';
  }

  // 其余第三方依赖统一进 vendor
  return 'vendor';
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const proxyTarget =
        env.VITE_DEV_PROXY_TARGET?.trim()
        || env.VITE_API_BASE_URL?.trim()
        || 'http://127.0.0.1:18765';

    return {
        base: './',
        plugins: [vue(), voskModelPlugin()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: buildManualChunks,
                },
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
