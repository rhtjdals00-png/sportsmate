// Previous local Vite setup kept for merge/reference.
// import { defineConfig, loadEnv } from "vite";
// import react from "@vitejs/plugin-react";

//export default defineConfig(({ mode }) => {
//  const env = loadEnv(mode, process.cwd(), "");
//  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5001";

//  return {
//    plugins: [react()],
//    server: {
//      port: 5173,
//      proxy: {
//        "/api": {
//          target: apiProxyTarget,
//          changeOrigin: true
//        }
//      }
//    }
//  };
// });
////////////////////////////////////////////////////

// import { defineConfig, loadEnv } from "vite";
// import react from "@vitejs/plugin-react";

// function requiredEnv(env, name) {
//   const value = env[name];
//   if (!value) {
//     throw new Error(`${name} is required. Check frontend/.env.`);
//   }
//   return value;
// }

// export default defineConfig(({ mode }) => {
//   const env = loadEnv(mode, process.cwd(), "");
//   const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5001";
//
//   return {
//     plugins: [react()],
//     server: {
//       port: 5173,
//       proxy: {
//         "/api": {
//           target: apiProxyTarget,
//           changeOrigin: true
//         }
//       }
//     }
//   };
// });


import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devHost = env.VITE_DEV_HOST || "0.0.0.0";
  const devPort = Number(env.VITE_DEV_PORT || 5174);
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5002";

  return {
    plugins: [react()],
    server: {
      host: devHost,
      port: devPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
