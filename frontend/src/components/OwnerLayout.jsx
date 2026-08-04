import { Outlet } from "react-router-dom";
import OwnerSidebar from "./OwnerSidebar";
import OwnerTopbar from "./OwnerTopbar";
import "./AppLayout.css";

export default function OwnerLayout() {
  return (
    <div className="app-shell">
      <OwnerSidebar />
      <div className="app-content">
        <OwnerTopbar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
