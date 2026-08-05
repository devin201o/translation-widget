import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import DetachedResultsApp from "./DetachedResultsApp";
import RegionSelectApp from "./components/RegionSelectApp";

const params = new URLSearchParams(window.location.search);
const view = params.get("view");

function Root() {
  if (view === "results") return <DetachedResultsApp />;
  if (view === "region-select") return <RegionSelectApp />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
