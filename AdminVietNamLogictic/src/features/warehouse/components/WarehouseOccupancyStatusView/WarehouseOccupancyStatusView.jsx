import { Card, Col, Progress, Row, Space, Tag, Typography } from "antd";
import {
  DashboardOutlined,
  HddOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

/* Kiện còn nằm trên kệ (RELEASED đã xuất khỏi kho, service đã bỏ sẵn). */
const ON_SHELF_STATUSES = new Set(["AVAILABLE", "RESERVED", "PICKED"]);

export default function WarehouseOccupancyStatusView({
  totalBins,
  activeBins,
  tree = [],
  statusData = null,
  inventories = [],
}) {
  const inactiveBins = totalBins - activeBins;
  const occupancyPercent = totalBins ? Math.round((activeBins / totalBins) * 100) : 0;

  /* Số liệu THẬT: ô đang có hàng đếm từ GET /api/inventories của kho; ô đầy / tỷ lệ lấp
     đầy lớn nhất lấy từ GET /layout/status (chỉ có với ô sơ đồ đã gắn ô kệ). */
  const onShelf = inventories.filter((inv) => ON_SHELF_STATUSES.has(String(inv.status || "").toUpperCase()));
  const occupiedBins = new Set(onShelf.map((inv) => inv.binId || inv.binCode).filter(Boolean)).size;
  const fullBins = statusData?.fullBins ?? 0;
  const maxUtilization = statusData?.maxUtilizationRate;
  const maxUtilizationPercent = maxUtilization == null ? null : Math.round(Number(maxUtilization) * 100);
  const hasLayoutStatus = (statusData?.binLayoutItems ?? 0) > 0;
  const capacityTag = !hasLayoutStatus
    ? { color: "default", text: "Chưa có ô sơ đồ gắn ô kệ" }
    : fullBins > 0
      ? { color: "error", text: `${fullBins} ô đã đầy` }
      : maxUtilizationPercent != null && maxUtilizationPercent >= 80
        ? { color: "warning", text: `Ô đầy nhất ${maxUtilizationPercent}%` }
        : { color: "processing", text: `An toàn (ô đầy nhất ${maxUtilizationPercent ?? 0}%)` };

  return (
    <div className="admin-warehouse-status-view">
      <Row gutter={[16, 16]}>
        {/* Left Card: Warehouse Capacity Overview */}
        <Col xs={24} md={8}>
          <Card title="Tổng Quan Sức Chứa Tồn Kho" className="status-summary-card">
            <div className="status-metric">
              <Text type="secondary">Tổng số Ô lưu trữ (Bins):</Text>
              <Title level={3} style={{ marginTop: 4 }}>{totalBins} vị trí</Title>
            </div>
            <div className="status-metric" style={{ marginTop: 16 }}>
              <Text type="secondary">Tỷ lệ Ô đang sẵn sàng hoạt động:</Text>
              <Progress
                percent={occupancyPercent}
                status="active"
                strokeColor={{ "0%": "#10b981", "100%": "#2563eb" }}
              />
            </div>
            <div className="status-metric-list" style={{ marginTop: 24 }}>
              <div className="status-item">
                <span className="dot dot-active" />
                <span>Đang hoạt động: <strong>{activeBins}</strong> ô</span>
              </div>
              <div className="status-item">
                <span className="dot dot-inactive" />
                <span>Ngừng sử dụng: <strong>{inactiveBins}</strong> ô</span>
              </div>
            </div>
          </Card>
        </Col>

        {/* Right Card: Zone Occupancy Breakdown */}
        <Col xs={24} md={16}>
          <Card title="Trạng Thái Từng Khu Vực (Occupancy Status)" className="status-zones-card">
            {tree.length === 0 ? (
              <Text type="secondary">Chưa có thông tin khu vực kho.</Text>
            ) : (
              tree.map((zone) => {
                const total = zone.shelves.reduce((s, sh) => s + sh.bins.length, 0);
                const active = zone.shelves.reduce(
                  (s, sh) => s + sh.bins.filter((b) => b.isActive !== false).length,
                  0
                );
                const percent = total ? Math.round((active / total) * 100) : 0;

                return (
                  <div key={zone.zoneName} className="zone-status-row">
                    <div className="zone-status-row__info">
                      <Space>
                        <HddOutlined style={{ color: "#2563eb" }} />
                        <Text strong style={{ fontSize: 15 }}>Khu Vực (Zone) {zone.zoneName}</Text>
                      </Space>
                      <Text type="secondary">
                        ({active}/{total} ô sẵn sàng)
                      </Text>
                    </div>
                    <Progress percent={percent} size="small" strokeColor="#2563eb" />
                  </div>
                );
              })
            )}
          </Card>
        </Col>
      </Row>

      {/* End-User Friendly Realtime Status Analytics Card (Replaces Debug JSON viewer) */}
      <Card
        title={
          <Space>
            <DashboardOutlined style={{ color: "#2563eb" }} />
            <span>Phân Tích Chi Tiết Tồn Kho & Tải Trọng Tức Thời</span>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <div className="user-kpi-box">
              <Text type="secondary">Số Khu Vực Vận Hành</Text>
              <Title level={3} style={{ margin: "4px 0 0", color: "#1e3a8a" }}>
                {tree.length} Khu
              </Title>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="user-kpi-box">
              <Text type="secondary">Ô Đang Có Hàng</Text>
              <Title level={3} style={{ margin: "4px 0 0", color: "#1e3a8a" }}>
                {occupiedBins} ô · {onShelf.length} kiện
              </Title>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="user-kpi-box">
              <Text type="secondary">Cảnh Báo Sức Chứa</Text>
              <div style={{ marginTop: 6 }}>
                <Tag color={capacityTag.color}>{capacityTag.text}</Tag>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="user-kpi-box">
              <Text type="secondary">Tổng Ô Kho Hoạt Động</Text>
              <Title level={3} style={{ margin: "4px 0 0", color: "#10b981" }}>
                {activeBins} Bins
              </Title>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
