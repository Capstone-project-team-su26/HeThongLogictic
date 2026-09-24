import { Outlet } from "react-router-dom";
import Header from "@layouts/Header/Header";
import Sidebar from "@layouts/Sidebar/Sidebar";
import SaleBadgeProvider from "@features/workspace/context/SaleBadgeProvider";

import "./MainLayout.css";

export default function MainLayout() {
  const normalizedRole = String(sessionStorage.getItem("role") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const isSale = normalizedRole === "sale";

  return (
    /* Bọc cả sidebar lẫn nội dung: số việc chờ đếm MỘT lần, menu và thanh tab cùng đọc. */
    <SaleBadgeProvider enabled={isSale}>
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
    </SaleBadgeProvider>
  );
}
