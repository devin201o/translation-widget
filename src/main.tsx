import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import DetachedResultsApp from "./DetachedResultsApp";

const params = new URLSearchParams(window.location.search);
const isResultsView = params.get("view") === "results";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isResultsView ? <DetachedResultsApp /> : <App />}
  </React.StrictMode>,
);
