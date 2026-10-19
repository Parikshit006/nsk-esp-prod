import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),server:{host:'127.0.0.1',port:Number(process.env.ESP_WEB_PORT??5173),strictPort:true,proxy:{'/api':`http://127.0.0.1:${Number(process.env.ESP_API_PORT??3000)}`}},build:{outDir:'dist'}});
