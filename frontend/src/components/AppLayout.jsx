import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./AppLayout.css";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <Topbar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
