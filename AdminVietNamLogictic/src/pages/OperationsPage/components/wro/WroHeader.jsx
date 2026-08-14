import React from "react";
import { Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

export default function WroHeader({
  totalCount = 0,
  pendingCount = 0,
  batchCount = 0,
  singleCount = 0,
  isLoading = false,
  isRefreshing = false,
  onRefresh = () => {},
}) {
  return (
    <>
      <section className="ops-page__hero">
        <div>
          <span>Xuất kho</span>
          <h1>Quản Lý Phiếu Xuất Kho (WRO)</h1>
          <p>
            Kiểm duyệt, theo dõi và quản lý xuất kho theo Lô gom hàng (BATCH) hoặc Đơn lẻ (SINGLE).
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt</small>
            <strong>{pendingCount} phiếu</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={isRefreshing || isLoading}
            onClick={onRefresh}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {/* KPI Overview Grid */}
      <section className="ops-kpi-grid">
        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Tổng số phiếu WRO</p>
          <p className="ops-kpi-card__value" style={{ color: "#2563eb" }}>
            {isLoading ? "…" : totalCount}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Theo điều kiện lọc hiện tại</p>
          </div>
        </article>

        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Phiếu cần duyệt</p>
          <p className="ops-kpi-card__value" style={{ color: "#d97706" }}>
            {isLoading ? "…" : pendingCount}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Cần kiểm kê & làm thông quan</p>
          </div>
        </article>

        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Xuất gom lô (BATCH)</p>
          <p className="ops-kpi-card__value" style={{ color: "#7c3aed" }}>
            {isLoading ? "…" : batchCount}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Phiếu xuất gom theo lô/chuyến hàng</p>
          </div>
        </article>

        <article className="ops-kpi-card">
          <p className="ops-kpi-card__label">Xuất đơn lẻ (SINGLE)</p>
          <p className="ops-kpi-card__value" style={{ color: "#0891b2" }}>
            {isLoading ? "…" : singleCount}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Phiếu xuất đơn lẻ / hỏa tốc</p>
          </div>
        </article>
      </section>
    </>
  );
}
