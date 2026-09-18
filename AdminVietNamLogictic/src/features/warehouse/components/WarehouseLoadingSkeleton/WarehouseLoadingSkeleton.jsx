import { Card, Col, Row, Skeleton, Spin, Typography } from "antd";
import { DatabaseOutlined, LoadingOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

export default function WarehouseLoadingSkeleton() {
  return (
    <div className="admin-warehouse-loading-container">
      {/* Central Glowing Pulse Banner */}
      <div className="admin-warehouse-loading-hero">
        <div className="loading-icon-badge">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: "#2563eb" }} spin />} />
        </div>
        <Title level={4} className="loading-hero-title">
          <DatabaseOutlined style={{ color: "#2563eb", marginRight: 8 }} />
          Đang dựng sơ đồ đồ họa vị trí kho...
        </Title>
        <Text type="secondary" className="loading-hero-subtitle">
          Hệ thống đang tải dữ liệu Khu vực (Zone), Kệ hàng (Shelf), Ô chứa (Bin) và tỷ lệ lấp đầy tồn kho...
        </Text>
      </div>

      {/* Shimmering Skeleton Zone Cards Preview */}
      <div className="admin-warehouse-skeleton-grid" style={{ marginTop: 24 }}>
        {[1, 2].map((zoneIdx) => (
          <Card
            key={zoneIdx}
            className="skeleton-zone-card"
            title={<Skeleton.Input active size="small" style={{ width: 220 }} />}
          >
            <Row gutter={[16, 16]}>
              {[1, 2, 3].map((shelfIdx) => (
                <Col xs={24} sm={12} md={8} key={shelfIdx}>
                  <div className="skeleton-shelf-box">
                    <div className="skeleton-shelf-header">
                      <Skeleton.Input active size="small" style={{ width: 140 }} />
                    </div>
                    <div className="skeleton-bin-list">
                      <Skeleton active paragraph={{ rows: 2 }} title={false} />
                      <Skeleton active paragraph={{ rows: 2 }} title={false} style={{ marginTop: 12 }} />
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        ))}
      </div>
    </div>
  );
}
