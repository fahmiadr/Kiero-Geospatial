import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import zlib from 'node:zlib';

/**
 * Custom Native Compression Plugin for Vite 7
 * Uses Node.js native zlib (v22+) for maximum performance without external dependencies.
 * Tracks processed files to completely eliminate Vite 7 'overwrite' warnings and duplicate work.
 */
function nativeCompression() {
    // Track files to ensure we only compress each unique file EXACTLY ONCE
    const processedFiles = new Set();

    return {
        name: 'vite-plugin-native-compression',
        apply: 'build',
        enforce: 'post',
        generateBundle(options, bundle) {
            for (const [fileName, chunk] of Object.entries(bundle)) {
                // Only target specific uncompressed assets
                if (!/\.(js|css|html|svg|json|xml)$/.test(fileName)) continue;

                // If Vite 7 runs multiple passes over the same chunk, skip if already processed
                if (processedFiles.has(fileName)) continue;
                processedFiles.add(fileName);

                // Get the file content buffer
                const source = chunk.type === 'asset' ? chunk.source : chunk.code;
                const buf = Buffer.isBuffer(source) ? source : Buffer.from(source);

                // Skip very small files (less than 1KB) as compression might increase size
                if (buf.length < 1024) continue;

                try {
                    // 1. Gzip (Level 9 - Sweet spot for pre-compression)
                    const gz = zlib.gzipSync(buf, { level: 9 });
                    this.emitFile({ type: 'asset', fileName: `${fileName}.gz`, source: gz });

                    // 2. Brotli (Level 11 - Sweet spot for pre-compression)
                    const br = zlib.brotliCompressSync(buf, {
                        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 }
                    });
                    this.emitFile({ type: 'asset', fileName: `${fileName}.br`, source: br });

                    // 3. Zstd (Level 22 - Sweet spot for Compression)
                    const zst = zlib.zstdCompressSync(buf, {
                        params: { [zlib.constants.ZSTD_c_compressionLevel]: 22 }
                    });
                    this.emitFile({ type: 'asset', fileName: `${fileName}.zst`, source: zst });

                } catch (err) {
                    console.error(`[Compression Error] Failed to compress ${fileName}:`, err);
                }
            }
        }
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            react(),
            nativeCompression()
        ],
        base: env.VITE_APP_BASE_URL || '/',
        build: {
            target: 'es2020',
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                output: {
                    // Separate JS and Assets for cleaner production structure
                    entryFileNames: 'assets/js/[name]-[hash].js',
                    chunkFileNames: 'assets/js/[name]-[hash].js',
                    assetFileNames: (assetInfo) => {
                        const info = assetInfo.name.split('.');
                        const ext = info[info.length - 1];
                        if (/\.(css)$/.test(assetInfo.name)) {
                            return `assets/css/[name]-[hash].[ext]`;
                        }
                        return `assets/[name]-[hash].[ext]`;
                    },
                    manualChunks: {
                        vendor: ['react', 'react-dom', 'react-router-dom'],
                        ui: ['@vis.gl/react-google-maps', '@floating-ui/react'],
                        utils: ['axios', 'date-fns', 'screenfull']
                    }
                }
            }
        },
        optimizeDeps: {
            esbuildOptions: {
                target: 'es2020'
            }
        },
        server: {
            allowedHosts: true,
            host: '0.0.0.0',
        }
    };
});
