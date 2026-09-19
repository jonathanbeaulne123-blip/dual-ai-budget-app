import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.hearth.hearthside", appName: "Hearth", webDir: "../dist",
  server: { hostname: "localhost", androidScheme: "https" },
  ios: { contentInset: "automatic", limitsNavigationsToAppBoundDomains: true },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
