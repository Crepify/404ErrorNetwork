import {defineConfig,loadEnv} from 'vite';
import {resolveCloudConfig} from './src/cloud-config.js';
export default defineConfig(({mode})=>({define:{__STORY_CLOUD_CONFIG__:JSON.stringify(resolveCloudConfig({...loadEnv(mode,process.cwd(),''),...process.env}))},server:{host:'0.0.0.0',allowedHosts:true},preview:{host:'0.0.0.0',allowedHosts:true}}));
