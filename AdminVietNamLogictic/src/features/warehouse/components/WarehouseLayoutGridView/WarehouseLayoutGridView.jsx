import { Alert, Button, Card, Col, Popconfirm, Row, Typography } from "antd";
import { AppstoreOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";

const { Text } = Typography;

const LAYOUT_TYPE_LABEL = { BIN: "Ô kệ", SHELF: "Kệ", ZONE: "Khu" };

/* Ô sơ đồ gắn vào ô kệ / kệ / khu nào (backend trả binCode, shelfCode, zoneName). */
const describeLink = (item) => {
  if (item.binCode) return `Ô kệ ${item.binCode}${item.shelfCode ? ` · kệ ${item.shelfCode}` : ""}`;
  if (item.shelfCode) return `Kệ ${item.shelfCode}`;
  if (item.zoneName) return `Cả khu ${item.zoneName}`;
  return "Chưa gắn khu/kệ/ô";
};

const formatCoord = (value) => (value == null || value === "" ? "—" : value);

export default function WarehouseLayoutGridView({
  layoutItems = [],
  openCreateLayout,
  openEditLayout,
  removeLayout,
  getLayoutId,
}) {
  return (
    <div className="admin-warehouse-layout-view">
      <div className="layout-view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text type="secondary">
          Danh sách các ô thuộc sơ đồ kho (Layout Items). Cấu hình theo tọa độ Hàng và Cột (Grid Row / Column).
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateLayout}>
          Thêm Ô Sơ Đồ Kho
        </Button>
      </div>

      {layoutItems.length === 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="Kho này chưa khai báo ô sơ đồ kho (Layout Items)."
          description="Bấm 'Thêm Ô Sơ Đồ Kho' để bắt đầu tạo vị trí trên sơ đồ."
        />
      ) : (
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          {layoutItems.map((item) => {
            const layoutId = getLayoutId(item);
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={layoutId || item.label}>
                <Card
                  size="small"
                  className="layout-item-card"
                  actions={[
                    <EditOutlined key="edit" onClick={() => openEditLayout(item)} />,
                    <Popconfirm
                      key="delete"
                      title="Xóa ô sơ đồ này?"
                      onConfirm={() => removeLayout(item)}
                    >
                      <DeleteOutlined style={{ color: "#ef4444" }} />
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    avatar={<AppstoreOutlined style={{ fontSize: 24, color: "#2563eb" }} />}
                    title={`${item.zoneCode || item.zoneName ? `Khu ${item.zoneCode || item.zoneName} — ` : ""}${item.label}`}
                    description={
                      <div>
                        <div>Tọa độ: Hàng {formatCoord(item.gridRow)}, Cột {formatCoord(item.gridColumn)}</div>
                        <div>
                          {LAYOUT_TYPE_LABEL[item.layoutType] || item.layoutType || "Ô sơ đồ"}: {describeLink(item)}
                        </div>
                        {item.isActive === false && <Text type="secondary">Ngừng sử dụng</Text>}
                      </div>
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
