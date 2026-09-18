import { DatabaseOutlined } from "@ant-design/icons";

export default function WarehouseHeroHeader({ totalZones, totalShelves, activeBins, totalBins }) {
  return (
    <section className="admin-page__hero admin-warehouse-hero">
      <div className="admin-warehouse-hero__text">
        <div className="admin-warehouse-hero__badge">
          <DatabaseOutlined /> HỆ THỐNG QUẢN LÝ KHO THÔNG MINH VCL LOGISTICS
        </div>
        <h1>Sơ Đồ Kho Phân Tầng & Vị Trí Lưu Trữ</h1>
        <p>
          Quản lý và trực quan hóa từng Khu vực (Zone), Kệ hàng công nghiệp (Shelf) và Ô chứa kỹ thuật số (Bin Slot).
          Theo dõi sức chứa dung tích, tải trọng và tỷ lệ lấp đầy tồn kho tức thời.
        </p>
      </div>

      <div className="admin-warehouse-hero__stats">
        <div className="hero-stat-card">
          <span
            className="hero-stat-card__val"
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#ffffff",
              textShadow: "0 4px 14px rgba(0,0,0,0.8), 0 0 16px rgba(56, 189, 248, 0.7)",
              lineHeight: 1,
            }}
          >
            {totalZones}
          </span>
          <span
            className="hero-stat-card__lbl"
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#f1f5f9",
              marginTop: 8,
              letterSpacing: "0.8px",
            }}
          >
            Khu Vực (Zones)
          </span>
        </div>
        <div className="hero-stat-card">
          <span
            className="hero-stat-card__val"
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#ffffff",
              textShadow: "0 4px 14px rgba(0,0,0,0.8), 0 0 16px rgba(56, 189, 248, 0.7)",
              lineHeight: 1,
            }}
          >
            {totalShelves}
          </span>
          <span
            className="hero-stat-card__lbl"
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#f1f5f9",
              marginTop: 8,
              letterSpacing: "0.8px",
            }}
          >
            Kệ Hàng (Shelves)
          </span>
        </div>
        <div className="hero-stat-card hero-stat-card--highlight">
          <span
            className="hero-stat-card__val"
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#38bdf8",
              textShadow: "0 4px 14px rgba(0,0,0,0.8), 0 0 20px rgba(56, 189, 248, 0.9)",
              lineHeight: 1,
            }}
          >
            {activeBins}/{totalBins}
          </span>
          <span
            className="hero-stat-card__lbl"
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#f1f5f9",
              marginTop: 8,
              letterSpacing: "0.8px",
            }}
          >
            Ô Sẵn Sàng (Bins)
          </span>
        </div>
      </div>
    </section>
  );
}
