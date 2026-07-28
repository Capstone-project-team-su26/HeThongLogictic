import { Outlet } from "react-router-dom";
import Header from "../layouts/HeaderLayout/Header";
import Sidebar from "../layouts/SidebarLayout/Sidebar";

import "./app-layout.css";

export default function MainLayout() {
  return (
    <div className="app-layout">
      {/* FIXED HEADER */}
      <Header />

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