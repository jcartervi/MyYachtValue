import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./theme.css";

// TypeScript declarations for build metadata
declare const MYV_BUILD_SHA: string;
declare const MYV_BUILD_TIME: string;

// Log build metadata in production
if (import.meta.env.PROD) {
  console.info("MYV build", MYV_BUILD_SHA, MYV_BUILD_TIME);
}

createRoot(document.getElementById("root")!).render(<App />);
