
import "./index.css";
// main.tsx ou main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom"; // <- import nécessaire

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter> {/* <- encapsule ton app ici */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);


