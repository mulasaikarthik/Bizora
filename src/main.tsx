import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { AuthProvider } from "./context/AuthContext";
import { StoreProvider } from "./services/store";
import { ThemeProvider } from "./context/ThemeContext";
import { BrokenGlassTransition } from "./components/BrokenGlassTransition";
import "./styles/theme.css";
import "./styles/global.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <StoreProvider>
            <ToastProvider>
              <BrokenGlassTransition />
              <App />
            </ToastProvider>
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
