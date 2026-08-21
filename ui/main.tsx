import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app";

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root container "#root" was not found in the document.');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
