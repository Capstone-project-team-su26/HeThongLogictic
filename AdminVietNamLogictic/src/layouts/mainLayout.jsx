import { Outlet } from "react-router-dom";
import Header from "../layouts/HeaderLayout/Header";
import Sidebar from "../layouts/SidebarLayout/Sidebar";

import "./app-layout.css";

export default function MainLayout() {
  const normalizedRole = String(sessionStorage.getItem("role") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const isSale = normalizedRole === "sale";

  return (
    <div className={`app-layout${isSale ? " app-layout--without-header" : ""}`}>
      {/* FIXED HEADER */}
      {!isSale && <Header />}

      <div className="app-layout__body">
        {/* FIXED SIDEBAR */}
        <Sidebar />

        {/* SCROLL CONTENT */}
        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
