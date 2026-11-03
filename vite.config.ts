import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiKey = env.GEMINI_API_KEY || env.API_KEY || '';

    return {
        base: '/nectarinjector/',
        define: {
            'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
            'process.env.API_KEY': JSON.stringify(apiKey),
        },
        plugins: [
            react(),
            {
                name: 'serve-binary-tmp-assets',
                configureServer(server) {
                    server.middlewares.use((req, res, next) => {
                        if (!req.url) return next();
                        // Never intercept Vite's internal module wrapper requests (?import, ?url, ?inline)
                        if (req.url.includes('?import') || req.url.includes('&import')) {
                            return next();
                        }
                        const cleanPath = decodeURIComponent(req.url.split('?')[0]);
                        if (/\.(tem|sno|tmp|pal|glb)$/i.test(cleanPath)) {
                            const relPath = cleanPath.replace(/^\/+/, '');
                            const fullPath = path.resolve(process.cwd(), relPath);
                            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                                const buf = fs.readFileSync(fullPath);
                                res.statusCode = 200;
                                res.setHeader('Content-Type', 'application/octet-stream');
                                res.setHeader('Content-Length', buf.byteLength);
                                res.end(buf);
                                return;
                            }
                        }
                        next();
                    });
                },
            },
        ],
        assetsInclude: [
            '**/*.tem',
            '**/*.TEM',
            '**/*.sno',
            '**/*.SNO',
            '**/*.tmp',
            '**/*.TMP',
            '**/*.pal',
            '**/*.PAL',
            '**/*.glb',
            '**/*.GLB',
        ],
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
    };
});
