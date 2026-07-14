import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { resolveBuildSha } from './buildIdentity';

function readGitSha(): string | undefined {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch {
    return undefined;
  }
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const sha = resolveBuildSha({ ...process.env, ...env }, readGitSha());
    const buildTime = new Date().toISOString();
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__AURA_BUILD_SHA__': JSON.stringify(sha),
        '__AURA_BUILD_TIME__': JSON.stringify(buildTime),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'webllm': ['@mlc-ai/web-llm'],
              'vendor': ['react', 'react-dom', 'recharts', 'lucide-react'],
              'pdf': ['jspdf', 'jspdf-autotable'],
            }
          }
        }
      }
    };
});
