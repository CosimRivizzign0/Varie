import { defineConfig, devices } from '@playwright/test';

// CHROMIUM_PATH: percorso opzionale di un Chromium già installato (se la revisione attesa da Playwright non è presente).
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  // In CI anche il report HTML (caricato come artefatto se il job fallisce).
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    // Diagnostica dei fallimenti: traccia e screenshot finiscono in test-results/.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
});
