import { Alert, Button, Card, Col, Popconfirm, Row, Typography } from "antd";
import { AppstoreOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";

const { Text } = Typography;

const formatNumber = (value, unit = "") => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const formatted = Number(value).toLocaleString("vi-VN");
  return unit ? `${formatted} ${unit}` : formatted;
};

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
                    title={`Khu ${item.zoneCode || item.zoneName || "A"} — ${item.label}`}
                    description={
                      <div>
                        <div>Tọa độ: Hàng {item.gridRow || 1}, Cột {item.gridColumn || 1}</div>
                        <div>Dung tích max: {formatNumber(item.maxVolume, "cm³")}</div>
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
