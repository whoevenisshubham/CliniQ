import { defineConfig } from "vitest/config";
import base from "./vitest.config";
export default defineConfig({...base,test:{environment:"node",include:["tests/integration/**/*.test.ts"],testTimeout:30000,hookTimeout:60000,fileParallelism:false,restoreMocks:true}});
