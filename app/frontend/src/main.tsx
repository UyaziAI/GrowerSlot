import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize global error handlers for structured logging
import { setupGlobalErrorHandlers } from "./lib/global-error-handlers";
setupGlobalErrorHandlers();

// Initialize logging
import { logger } from "./lib/logger";
logger.info('app_start', 'Application starting', {
  env: import.meta.env.MODE,
  debug_logs: import.meta.env.VITE_FEATURE_DEBUG_LOGS === 'true'
});

createRoot(document.getElementById("root")!).render(<App />);
