import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Vosk 模型静态服务插件
 *
 * 发现：vosk-browser 的 createModel(url) 既能加载 tar.gz 也能加载 zip
 *      Worker 直接 fetch 同源 URL 最稳定（blob: URL 会卡住）
 *
 * 方案：把 ModelScope 的 zip 文件缓存到磁盘，通过 Vite 提供同源 URL
 *   - HEAD /vosk-model.zip   - 检查本地是否已有 zip
 *   - GET  /vosk-model.zip    - 返回 zip 文件
 *   - POST /vosk-model-zip    - 接收前端上传的 zip 保存到磁盘
 */
export function voskModelPlugin(): Plugin {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const modelDir = path.join(localAppData, 'DesktopFairy', 'models');
    const modelPath = path.join(modelDir, 'vosk-model-small-cn-0.22.zip');

    return {
        name: 'vosk-model-server',
        configureServer(server: ViteDevServer) {
            server.middlewares.use((req, res, next) => {
                const url = req.url || '';

                // HEAD /vosk-model.zip - 检查模型是否已存在
                if (url === '/vosk-model.zip' && req.method === 'HEAD') {
                    if (fs.existsSync(modelPath)) {
                        const stat = fs.statSync(modelPath);
                        res.setHeader('Content-Type', 'application/zip');
                        res.setHeader('Content-Length', stat.size);
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.statusCode = 200;
                        res.end();
                    } else {
                        res.statusCode = 404;
                        res.end();
                    }
                    return;
                }

                // GET /vosk-model.zip - 返回模型文件
                if (url === '/vosk-model.zip' && req.method === 'GET') {
                    if (!fs.existsSync(modelPath)) {
                        res.statusCode = 404;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Model not found' }));
                        return;
                    }
                    const stat = fs.statSync(modelPath);
                    res.setHeader('Content-Type', 'application/zip');
                    res.setHeader('Content-Length', stat.size);
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Cache-Control', 'no-cache');
                    const stream = fs.createReadStream(modelPath);
                    stream.pipe(res);
                    return;
                }

                // POST /vosk-model-zip - 接收 zip 保存到磁盘
                if (url === '/vosk-model-zip' && req.method === 'POST') {
                    // 确保目录存在
                    if (!fs.existsSync(modelDir)) {
                        fs.mkdirSync(modelDir, { recursive: true });
                    }
                    const tmpPath = modelPath + '.tmp';
                    const writeStream = fs.createWriteStream(tmpPath);
                    req.pipe(writeStream);
                    writeStream.on('finish', () => {
                        // 下载完成，重命名
                        if (fs.existsSync(modelPath)) {
                            fs.unlinkSync(modelPath);
                        }
                        fs.renameSync(tmpPath, modelPath);
                        const stat = fs.statSync(modelPath);
                        console.log(`[vosk-model-plugin] 模型已保存: ${modelPath}, ${stat.size} 字节`);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, size: stat.size }));
                    });
                    writeStream.on('error', (err) => {
                        console.error(`[vosk-model-plugin] 保存失败:`, err);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: err.message }));
                    });
                    return;
                }

                next();
            });
        },
    };
}
