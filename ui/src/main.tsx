import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AmiraShell } from "./components/AmiraShell";
import { CheckEvidence } from "./pages/CheckEvidence";
import { ResearchMap } from "./pages/ResearchMap";
import { OpenBenchmark } from "./pages/OpenBenchmark";
import { Methodology } from "./pages/Methodology";
import "./theme.css";
import "./clinical.css";
import "./mockup.css";
import "./polish.css";

const withShell = (el: React.ReactNode) => <AmiraShell>{el}</AmiraShell>;

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/amira/check-evidence" replace /> },
  { path: "/amira", element: <Navigate to="/amira/check-evidence" replace /> },
  { path: "/amira/check-evidence", element: withShell(<CheckEvidence />) },
  { path: "/amira/research-map", element: withShell(<ResearchMap />) },
  { path: "/amira/open-benchmark", element: withShell(<OpenBenchmark />) },
  { path: "/amira/methodology", element: withShell(<Methodology />) },
  { path: "*", element: <Navigate to="/amira/check-evidence" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
