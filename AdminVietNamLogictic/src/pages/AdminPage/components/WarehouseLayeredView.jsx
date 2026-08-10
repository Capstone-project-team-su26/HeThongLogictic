import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Popconfirm,
  Progress,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  BuildOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  PlusOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

const formatNumber = (value, unit = "") => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const formatted = Number(value).toLocaleString("vi-VN");
  return unit ? `${formatted} ${unit}` : formatted;
};

// Zone theme styling mapper
const getZoneThemeClass = (zoneName = "") => {
  const name = String(zoneName).toLowerCase();
  if (name.includes("nhận") || name.includes("inbound") || name.includes("nhap")) return "zone-theme--emerald";
  if (name.includes("xuất") || name.includes("outbound") || name.includes("xuat")) return "zone-theme--amber";
  if (name.includes("b") || name.includes("storage")) return "zone-theme--purple";
  return "zone-theme--blue";
};

// Helper to filter out raw system seed strings from end-user UI
const getCleanUserNote = (note) => {
  if (!note || typeof note !== "string") return null;
  const trimmed = note.trim();
  if (trimmed.startsWith("seed-") || trimmed.includes("ops-locations") || trimmed.includes("mock-")) {
    return null; // Suppress raw technical seed strings
  }
  return trimmed;
};

export default function WarehouseLayeredView({
  tree = [],
  inventories = [],
  openCreateLocation,
  openEditLocation,
  removeLocation,
  getLocationId,
  onInspectBin,
}) {
  if (tree.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        message="Kho này chưa có vị trí phù hợp với bộ lọc."
        description="Nhấn nút 'Thêm Vị Trí Mới' để bắt đầu thiết lập Khu vực, Kệ và Ô chứa hàng."
      />
    );
  }

  const getBinInventories = (bin) => {
    const binId = getLocationId ? getLocationId(bin) : bin.id || bin.locationId;
    const binCode = (bin.binCode || bin.code || "").trim().toLowerCase();

    return inventories.filter((inv) => {
      if (binId && inv.binId && String(inv.binId) === String(binId)) return true;
      if (binCode && inv.binCode && String(inv.binCode).trim().toLowerCase() === binCode) return true;
      return false;
    });
  };

  return (
    <div className="admin-warehouse-layered-view">
      <div className="admin-zone-list">
        {tree.map((zone) => {
          const zoneBinCount = zone.shelves.reduce((sum, s) => sum + s.bins.length, 0);
          const themeClass = getZoneThemeClass(zone.zoneName);

          const displayZoneName = String(zone.zoneName).toLowerCase().startsWith("khu")
            ? zone.zoneName
            : `Khu ${zone.zoneName}`;

          const colSpanLg = zone.shelves.length <= 2 ? 12 : zone.shelves.length === 3 ? 8 : 6;

          return (
            <Card
              key={zone.zoneName}
              className={`admin-zone-card ${themeClass}`}
              title={
                <div className="admin-zone-card__header">
                  <Space align="center" size="middle">
                    <BuildOutlined className="zone-icon-header" />
                    <Title level={4} className="zone-title-text">
                      KHU VỰC (ZONE): {displayZoneName.toUpperCase()}
                    </Title>
                    <Badge count={`${zoneBinCount} ô chứa`} className="zone-badge-count" />
                  </Space>
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<PlusOutlined />}
                    className="btn-add-shelf-to-zone"
                    onClick={() => openCreateLocation(zone.zoneName)}
                  >
                    + Thêm Kệ Vào {displayZoneName}
                  </Button>
                </div>
              }
            >
              <Row gutter={[16, 16]}>
                {zone.shelves.map((shelf) => (
                  <Col xs={24} sm={12} md={12} lg={colSpanLg} key={shelf.shelfCode}>
                    <div className="admin-shelf-rack">
                      <div className="admin-shelf-rack__header">
                        <Text strong className="shelf-title">
                          🏗️ Kệ (Shelf): {shelf.shelfCode}
                        </Text>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => openCreateLocation(zone.zoneName, shelf.shelfCode)}
                        >
                          Thêm Ô
                        </Button>
                      </div>

                      <div className="admin-shelf-rack__bins">
                        {shelf.bins.map((bin, index) => {
                          const binCode = bin.binCode || bin.code || `Ô-${index + 1}`;
                          const isActive = bin.isActive !== false;
                          const binId = getLocationId(bin);
                          const userNote = getCleanUserNote(bin.note);
                          const binInventories = getBinInventories(bin);
                          const parcelCount = binInventories.length;

                          return (
                            <div
                              key={binId || binCode}
                              className={`admin-bin-card ${isActive ? "is-active" : "is-inactive"}`}
                            >
                              <div className="admin-bin-card__top">
                                <Space align="center" size="small">
                                  <span className={`led-dot ${isActive ? "led-active" : "led-inactive"}`} />
                                  <Text strong className="admin-bin-card__title">
                                    Ô {binCode}
                                  </Text>
                                </Space>
                                <Tag color={isActive ? "success" : "default"} style={{ margin: 0 }}>
                                  {isActive ? "Hoạt động" : "Tạm khóa"}
                                </Tag>
                              </div>

                              {/* Capacity Fill Gauge */}
                              <div className="bin-capacity-bar">
                                <Progress
                                  percent={isActive ? (parcelCount > 0 ? Math.min(100, parcelCount * 45) : 15) : 0}
                                  size="small"
                                  showInfo={false}
                                  strokeColor={isActive ? { "0%": "#10b981", "100%": "#3b82f6" } : "#cbd5e1"}
                                />
                              </div>

                              <div className="admin-bin-card__body">
                                <div className="admin-bin-spec">
                                  <span>Dung tích max:</span>
                                  <strong>{formatNumber(bin.maxVolume ?? bin.capacity, "cm³")}</strong>
                                </div>
                                <div className="admin-bin-spec">
                                  <span>Tải trọng max:</span>
                                  <strong>{formatNumber(bin.maxWeight, "kg")}</strong>
                                </div>

                                {/* Clickable Parcels Badge Button */}
                                <div style={{ marginTop: 8 }}>
                                  <Button
                                    type={parcelCount > 0 ? "primary" : "default"}
                                    size="small"
                                    icon={<InboxOutlined />}
                                    onClick={() => onInspectBin(bin, binInventories)}
                                    style={{
                                      width: "100%",
                                      borderRadius: 8,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      background: parcelCount > 0 ? "linear-gradient(135deg, #1d4ed8, #2563eb)" : undefined,
                                    }}
                                  >
                                    📦 Xem kiện hàng ({parcelCount})
                                  </Button>
                                </div>

                                {userNote && (
                                  <Tooltip title={`Ghi chú: ${userNote}`}>
                                    <div className="admin-bin-card__note" style={{ marginTop: 6 }}>
                                      <InfoCircleOutlined /> {userNote}
                                    </div>
                                  </Tooltip>
                                )}
                              </div>

                              <div className="admin-bin-card__footer">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                  className="btn-edit-bin"
                                  onClick={() => openEditLocation(bin)}
                                >
                                  Sửa
                                </Button>
                                <Popconfirm
                                  title={`Xóa Ô ${binCode}?`}
                                  description="Thao tác xóa không thể hoàn tác."
                                  okText="Xóa"
                                  cancelText="Hủy"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => removeLocation(bin)}
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    className="btn-delete-bin"
                                  >
                                    Xóa
                                  </Button>
                                </Popconfirm>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
