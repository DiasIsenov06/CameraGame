import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], build: { rollupOptions: { output: { manualChunks: { vision: ['@mediapipe/tasks-vision'], react: ['react', 'react-dom', 'react-dom/client'], three: ['three'] } } } } });
