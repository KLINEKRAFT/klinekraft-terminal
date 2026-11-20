import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import App from "./App";
import { DesktopAway } from "./components/AwayPanel";
import "./styles.css";
import "./ui.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("desktop-away") === "1" ? <DesktopAway /> : <App />}
  </React.StrictMode>,
);
