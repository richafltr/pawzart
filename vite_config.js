import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        
        // Manual chunks for better caching
        manualChunks: {
          'three': ['three'],
          'mujoco': ['./lib/mujoco_wasm.js'],
          'enhancements': [
            './examples/utils/adaptiveMotionFilter.js',
            './examples/utils/tempoSync.js',
            './examples/utils/expressiveDynamics.js'
          ]
        }
      }
    },
    
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      },
      format: {
        comments: false
      }
    },
    
    // Target modern browsers
    target: 'es2020',
    
    // Source maps for debugging (disable in production)
    sourcemap: false
  },
  
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  
  optimizeDeps: {
    include: ['three', 'dat.gui']
  }
});