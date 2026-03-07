// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/emman/estante-3/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/emman/estante-3/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/emman/estante-3/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\emman\\estante-3";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const useProdApi = env.VITE_USE_PROD_API === "true";
  const useFirebaseEmulators = env.VITE_USE_FIREBASE_EMULATORS === "true";
  const projectId = env.VITE_FIREBASE_PROJECT_ID || "estante-75463";
  const region = env.VITE_FIREBASE_REGION || "us-central1";
  let apiTarget;
  let apiMode;
  if (useProdApi && !useFirebaseEmulators) {
    apiTarget = `https://${region}-${projectId}.cloudfunctions.net/api`;
    apiMode = "PRODU\xC7\xC3O COMPLETA";
  } else if (!useProdApi && useFirebaseEmulators) {
    apiTarget = `http://127.0.0.1:5001/${projectId}/${region}/api`;
    apiMode = "EMULADORES LOCAIS";
  } else {
    apiTarget = "http://127.0.0.1:3000";
    apiMode = "H\xCDBRIDO (API Local + Firebase Produ\xE7\xE3o)";
  }
  console.log(`\u{1F680} API Proxy Target: ${apiTarget}`);
  console.log(`\u{1F4CD} Modo: ${apiMode}`);
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
        manifest: {
          name: "Estante de Bolso",
          short_name: "Estante",
          description: "Sua rede social de leitura - compartilhe livros e resenhas",
          theme_color: "#10b981",
          // emerald-600
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "/pwa-192x192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any maskable"
            },
            {
              src: "/pwa-512x512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable"
            }
          ],
          categories: ["books", "social", "lifestyle"]
        },
        workbox: {
          // Bloqueia a interceptação de rotas nativas do Firebase (ex: __/auth/handler) no ServiceWorker
          navigateFallbackDenylist: [/^\/__/],
          runtimeCaching: [
            {
              // Cache Firebase Storage images
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "firebase-images-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                  // 30 dias
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Cache API calls com NetworkFirst
              urlPattern: /^https:\/\/.*\.cloudfunctions\.net\/api\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5
                  // 5 minutos
                },
                networkTimeoutSeconds: 10
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          // PWA em desenvolvimento também
          type: "module"
        }
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          // Rewrite apenas para Firebase Functions (emulador/produção), não para standalone
          rewrite: !useProdApi && useFirebaseEmulators || useProdApi && !useFirebaseEmulators ? (path2) => path2.replace(/^\/api/, "") : void 0
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks - separados para melhor caching
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "firebase-vendor": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage"],
            "ui-vendor": ["framer-motion", "lucide-react"],
            "query-vendor": ["@tanstack/react-query"]
          }
        }
      },
      chunkSizeWarningLimit: 1e3,
      target: "es2020",
      minify: "esbuild",
      // esbuild é mais rápido e confiável
      sourcemap: false
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxlbW1hblxcXFxlc3RhbnRlLTNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGVtbWFuXFxcXGVzdGFudGUtM1xcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvZW1tYW4vZXN0YW50ZS0zL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICAvLyBDYXJyZWdhIHZhcmlcdTAwRTF2ZWlzIGRlIGFtYmllbnRlIChleDogLmVudiwgLmVudi5sb2NhbClcclxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCkpO1xyXG5cclxuICAvLyBEZWZpbmUgbyB0YXJnZXQgZGEgQVBJIGJhc2VhZG8gbmFzIGNvbmZpZ3VyYVx1MDBFN1x1MDBGNWVzXHJcbiAgY29uc3QgdXNlUHJvZEFwaSA9IGVudi5WSVRFX1VTRV9QUk9EX0FQSSA9PT0gJ3RydWUnO1xyXG4gIGNvbnN0IHVzZUZpcmViYXNlRW11bGF0b3JzID0gZW52LlZJVEVfVVNFX0ZJUkVCQVNFX0VNVUxBVE9SUyA9PT0gJ3RydWUnO1xyXG5cclxuICBjb25zdCBwcm9qZWN0SWQgPSBlbnYuVklURV9GSVJFQkFTRV9QUk9KRUNUX0lEIHx8ICdlc3RhbnRlLTc1NDYzJztcclxuICBjb25zdCByZWdpb24gPSBlbnYuVklURV9GSVJFQkFTRV9SRUdJT04gfHwgJ3VzLWNlbnRyYWwxJztcclxuXHJcbiAgbGV0IGFwaVRhcmdldDogc3RyaW5nO1xyXG4gIGxldCBhcGlNb2RlOiBzdHJpbmc7XHJcblxyXG4gIGlmICh1c2VQcm9kQXBpICYmICF1c2VGaXJlYmFzZUVtdWxhdG9ycykge1xyXG4gICAgLy8gTW9kbyAxOiBUdWRvIGVtIHByb2R1XHUwMEU3XHUwMEUzb1xyXG4gICAgYXBpVGFyZ2V0ID0gYGh0dHBzOi8vJHtyZWdpb259LSR7cHJvamVjdElkfS5jbG91ZGZ1bmN0aW9ucy5uZXQvYXBpYDtcclxuICAgIGFwaU1vZGUgPSAnUFJPRFVcdTAwQzdcdTAwQzNPIENPTVBMRVRBJztcclxuICB9IGVsc2UgaWYgKCF1c2VQcm9kQXBpICYmIHVzZUZpcmViYXNlRW11bGF0b3JzKSB7XHJcbiAgICAvLyBNb2RvIDI6IFR1ZG8gZW0gZW11bGFkb3JlcyBsb2NhaXNcclxuICAgIGFwaVRhcmdldCA9IGBodHRwOi8vMTI3LjAuMC4xOjUwMDEvJHtwcm9qZWN0SWR9LyR7cmVnaW9ufS9hcGlgO1xyXG4gICAgYXBpTW9kZSA9ICdFTVVMQURPUkVTIExPQ0FJUyc7XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIE1vZG8gMzogSFx1MDBDREJSSURPIC0gQmFja2VuZCBBUEkgbG9jYWwgc3RhbmRhbG9uZSArIEZpcmViYXNlIHByb2R1XHUwMEU3XHUwMEUzb1xyXG4gICAgYXBpVGFyZ2V0ID0gJ2h0dHA6Ly8xMjcuMC4wLjE6MzAwMCc7XHJcbiAgICBhcGlNb2RlID0gJ0hcdTAwQ0RCUklETyAoQVBJIExvY2FsICsgRmlyZWJhc2UgUHJvZHVcdTAwRTdcdTAwRTNvKSc7XHJcbiAgfVxyXG5cclxuICBjb25zb2xlLmxvZyhgXHVEODNEXHVERTgwIEFQSSBQcm94eSBUYXJnZXQ6ICR7YXBpVGFyZ2V0fWApO1xyXG4gIGNvbnNvbGUubG9nKGBcdUQ4M0RcdURDQ0QgTW9kbzogJHthcGlNb2RlfWApO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICByZWFjdCgpLFxyXG4gICAgICBWaXRlUFdBKHtcclxuICAgICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcclxuICAgICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ3JvYm90cy50eHQnLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnXSxcclxuXHJcbiAgICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICAgIG5hbWU6ICdFc3RhbnRlIGRlIEJvbHNvJyxcclxuICAgICAgICAgIHNob3J0X25hbWU6ICdFc3RhbnRlJyxcclxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU3VhIHJlZGUgc29jaWFsIGRlIGxlaXR1cmEgLSBjb21wYXJ0aWxoZSBsaXZyb3MgZSByZXNlbmhhcycsXHJcbiAgICAgICAgICB0aGVtZV9jb2xvcjogJyMxMGI5ODEnLCAvLyBlbWVyYWxkLTYwMFxyXG4gICAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyNmZmZmZmYnLFxyXG4gICAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxyXG4gICAgICAgICAgb3JpZW50YXRpb246ICdwb3J0cmFpdCcsXHJcbiAgICAgICAgICBzY29wZTogJy8nLFxyXG4gICAgICAgICAgc3RhcnRfdXJsOiAnLycsXHJcbiAgICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgc3JjOiAnL3B3YS0xOTJ4MTkyLnN2ZycsXHJcbiAgICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcclxuICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2Uvc3ZnK3htbCcsXHJcbiAgICAgICAgICAgICAgcHVycG9zZTogJ2FueSBtYXNrYWJsZSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHNyYzogJy9wd2EtNTEyeDUxMi5zdmcnLFxyXG4gICAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3N2Zyt4bWwnLFxyXG4gICAgICAgICAgICAgIHB1cnBvc2U6ICdhbnkgbWFza2FibGUnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICBjYXRlZ29yaWVzOiBbJ2Jvb2tzJywgJ3NvY2lhbCcsICdsaWZlc3R5bGUnXVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICAgIC8vIEJsb3F1ZWlhIGEgaW50ZXJjZXB0YVx1MDBFN1x1MDBFM28gZGUgcm90YXMgbmF0aXZhcyBkbyBGaXJlYmFzZSAoZXg6IF9fL2F1dGgvaGFuZGxlcikgbm8gU2VydmljZVdvcmtlclxyXG4gICAgICAgICAgbmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9fXy9dLFxyXG4gICAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIC8vIENhY2hlIEZpcmViYXNlIFN0b3JhZ2UgaW1hZ2VzXHJcbiAgICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9maXJlYmFzZXN0b3JhZ2VcXC5nb29nbGVhcGlzXFwuY29tXFwvLiovaSxcclxuICAgICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZmlyZWJhc2UtaW1hZ2VzLWNhY2hlJyxcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAwLFxyXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzMCAvLyAzMCBkaWFzXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgLy8gQ2FjaGUgQVBJIGNhbGxzIGNvbSBOZXR3b3JrRmlyc3RcclxuICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuY2xvdWRmdW5jdGlvbnNcXC5uZXRcXC9hcGlcXC8uKi9pLFxyXG4gICAgICAgICAgICAgIGhhbmRsZXI6ICdOZXR3b3JrRmlyc3QnLFxyXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2FwaS1jYWNoZScsXHJcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDUwLFxyXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDUgLy8gNSBtaW51dG9zXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgbmV0d29ya1RpbWVvdXRTZWNvbmRzOiAxMFxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgXVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGRldk9wdGlvbnM6IHtcclxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsIC8vIFBXQSBlbSBkZXNlbnZvbHZpbWVudG8gdGFtYlx1MDBFOW1cclxuICAgICAgICAgIHR5cGU6ICdtb2R1bGUnXHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgXSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBwcm94eToge1xyXG4gICAgICAgICcvYXBpJzoge1xyXG4gICAgICAgICAgdGFyZ2V0OiBhcGlUYXJnZXQsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgICAgLy8gUmV3cml0ZSBhcGVuYXMgcGFyYSBGaXJlYmFzZSBGdW5jdGlvbnMgKGVtdWxhZG9yL3Byb2R1XHUwMEU3XHUwMEUzbyksIG5cdTAwRTNvIHBhcmEgc3RhbmRhbG9uZVxyXG4gICAgICAgICAgcmV3cml0ZTogKCF1c2VQcm9kQXBpICYmIHVzZUZpcmViYXNlRW11bGF0b3JzKSB8fCAodXNlUHJvZEFwaSAmJiAhdXNlRmlyZWJhc2VFbXVsYXRvcnMpXHJcbiAgICAgICAgICAgID8gKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaS8sICcnKVxyXG4gICAgICAgICAgICA6IHVuZGVmaW5lZCxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgICAvLyBWZW5kb3IgY2h1bmtzIC0gc2VwYXJhZG9zIHBhcmEgbWVsaG9yIGNhY2hpbmdcclxuICAgICAgICAgICAgJ3JlYWN0LXZlbmRvcic6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcclxuICAgICAgICAgICAgJ2ZpcmViYXNlLXZlbmRvcic6IFsnZmlyZWJhc2UvYXBwJywgJ2ZpcmViYXNlL2F1dGgnLCAnZmlyZWJhc2UvZmlyZXN0b3JlJywgJ2ZpcmViYXNlL3N0b3JhZ2UnXSxcclxuICAgICAgICAgICAgJ3VpLXZlbmRvcic6IFsnZnJhbWVyLW1vdGlvbicsICdsdWNpZGUtcmVhY3QnXSxcclxuICAgICAgICAgICAgJ3F1ZXJ5LXZlbmRvcic6IFsnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J10sXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXHJcbiAgICAgIHRhcmdldDogJ2VzMjAyMCcsXHJcbiAgICAgIG1pbmlmeTogJ2VzYnVpbGQnLCAvLyBlc2J1aWxkIFx1MDBFOSBtYWlzIHJcdTAwRTFwaWRvIGUgY29uZmlcdTAwRTF2ZWxcclxuICAgICAgc291cmNlbWFwOiBmYWxzZVxyXG4gICAgfSxcclxuICB9O1xyXG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQWtRLFNBQVMsY0FBYyxlQUFlO0FBQ3hTLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBS3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBRXhDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLENBQUM7QUFHdkMsUUFBTSxhQUFhLElBQUksc0JBQXNCO0FBQzdDLFFBQU0sdUJBQXVCLElBQUksZ0NBQWdDO0FBRWpFLFFBQU0sWUFBWSxJQUFJLDRCQUE0QjtBQUNsRCxRQUFNLFNBQVMsSUFBSSx3QkFBd0I7QUFFM0MsTUFBSTtBQUNKLE1BQUk7QUFFSixNQUFJLGNBQWMsQ0FBQyxzQkFBc0I7QUFFdkMsZ0JBQVksV0FBVyxNQUFNLElBQUksU0FBUztBQUMxQyxjQUFVO0FBQUEsRUFDWixXQUFXLENBQUMsY0FBYyxzQkFBc0I7QUFFOUMsZ0JBQVkseUJBQXlCLFNBQVMsSUFBSSxNQUFNO0FBQ3hELGNBQVU7QUFBQSxFQUNaLE9BQU87QUFFTCxnQkFBWTtBQUNaLGNBQVU7QUFBQSxFQUNaO0FBRUEsVUFBUSxJQUFJLCtCQUF3QixTQUFTLEVBQUU7QUFDL0MsVUFBUSxJQUFJLG1CQUFZLE9BQU8sRUFBRTtBQUVqQyxTQUFPO0FBQUEsSUFDTCxTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsUUFDZCxlQUFlLENBQUMsZUFBZSxjQUFjLHNCQUFzQjtBQUFBLFFBRW5FLFVBQVU7QUFBQSxVQUNSLE1BQU07QUFBQSxVQUNOLFlBQVk7QUFBQSxVQUNaLGFBQWE7QUFBQSxVQUNiLGFBQWE7QUFBQTtBQUFBLFVBQ2Isa0JBQWtCO0FBQUEsVUFDbEIsU0FBUztBQUFBLFVBQ1QsYUFBYTtBQUFBLFVBQ2IsT0FBTztBQUFBLFVBQ1AsV0FBVztBQUFBLFVBQ1gsT0FBTztBQUFBLFlBQ0w7QUFBQSxjQUNFLEtBQUs7QUFBQSxjQUNMLE9BQU87QUFBQSxjQUNQLE1BQU07QUFBQSxjQUNOLFNBQVM7QUFBQSxZQUNYO0FBQUEsWUFDQTtBQUFBLGNBQ0UsS0FBSztBQUFBLGNBQ0wsT0FBTztBQUFBLGNBQ1AsTUFBTTtBQUFBLGNBQ04sU0FBUztBQUFBLFlBQ1g7QUFBQSxVQUNGO0FBQUEsVUFDQSxZQUFZLENBQUMsU0FBUyxVQUFVLFdBQVc7QUFBQSxRQUM3QztBQUFBLFFBRUEsU0FBUztBQUFBO0FBQUEsVUFFUCwwQkFBMEIsQ0FBQyxPQUFPO0FBQUEsVUFDbEMsZ0JBQWdCO0FBQUEsWUFDZDtBQUFBO0FBQUEsY0FFRSxZQUFZO0FBQUEsY0FDWixTQUFTO0FBQUEsY0FDVCxTQUFTO0FBQUEsZ0JBQ1AsV0FBVztBQUFBLGdCQUNYLFlBQVk7QUFBQSxrQkFDVixZQUFZO0FBQUEsa0JBQ1osZUFBZSxLQUFLLEtBQUssS0FBSztBQUFBO0FBQUEsZ0JBQ2hDO0FBQUEsZ0JBQ0EsbUJBQW1CO0FBQUEsa0JBQ2pCLFVBQVUsQ0FBQyxHQUFHLEdBQUc7QUFBQSxnQkFDbkI7QUFBQSxjQUNGO0FBQUEsWUFDRjtBQUFBLFlBQ0E7QUFBQTtBQUFBLGNBRUUsWUFBWTtBQUFBLGNBQ1osU0FBUztBQUFBLGNBQ1QsU0FBUztBQUFBLGdCQUNQLFdBQVc7QUFBQSxnQkFDWCxZQUFZO0FBQUEsa0JBQ1YsWUFBWTtBQUFBLGtCQUNaLGVBQWUsS0FBSztBQUFBO0FBQUEsZ0JBQ3RCO0FBQUEsZ0JBQ0EsdUJBQXVCO0FBQUEsY0FDekI7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxRQUVBLFlBQVk7QUFBQSxVQUNWLFNBQVM7QUFBQTtBQUFBLFVBQ1QsTUFBTTtBQUFBLFFBQ1I7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDdEM7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsVUFDTixRQUFRO0FBQUEsVUFDUixjQUFjO0FBQUEsVUFDZCxRQUFRO0FBQUE7QUFBQSxVQUVSLFNBQVUsQ0FBQyxjQUFjLHdCQUEwQixjQUFjLENBQUMsdUJBQzlELENBQUNBLFVBQVNBLE1BQUssUUFBUSxVQUFVLEVBQUUsSUFDbkM7QUFBQSxRQUNOO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGNBQWM7QUFBQTtBQUFBLFlBRVosZ0JBQWdCLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFlBQ3pELG1CQUFtQixDQUFDLGdCQUFnQixpQkFBaUIsc0JBQXNCLGtCQUFrQjtBQUFBLFlBQzdGLGFBQWEsQ0FBQyxpQkFBaUIsY0FBYztBQUFBLFlBQzdDLGdCQUFnQixDQUFDLHVCQUF1QjtBQUFBLFVBQzFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLHVCQUF1QjtBQUFBLE1BQ3ZCLFFBQVE7QUFBQSxNQUNSLFFBQVE7QUFBQTtBQUFBLE1BQ1IsV0FBVztBQUFBLElBQ2I7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsicGF0aCJdCn0K
