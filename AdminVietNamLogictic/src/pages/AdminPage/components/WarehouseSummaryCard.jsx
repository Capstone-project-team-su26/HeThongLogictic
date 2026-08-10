import { Tag, Typography } from "antd";
import {
  BuildOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  TagOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

export default function WarehouseSummaryCard({
  selectedWarehouse,
  totalZones,
  totalShelves,
  activeBins,
  totalBins,
}) {
  if (!selectedWarehouse) return null;

  const inactiveBins = totalBins - activeBins;
  const rawType = selectedWarehouse.warehouseType || "KHO VẬN HÀNH";
  const warehouseTypeLabel =
    rawType === "DESTINATION"
      ? "Kho Đích (Destination)"
      : rawType === "ORIGIN"
      ? "Kho Nguồn (Origin)"
      : rawType;

  return (
    <div className="admin-warehouse-summary-card">
      <div className="admin-warehouse-summary-card__left">
        <div className="warehouse-avatar-icon">
          <HomeOutlined />
        </div>

        <div className="warehouse-details-container">
          <div className="warehouse-title-row">
            <Title level={4} className="warehouse-name-text">
              {selectedWarehouse.name}
            </Title>
            <Tag color="blue" className="warehouse-code-badge">
              {selectedWarehouse.code || "VN_WH"}
            </Tag>
            <Tag color="cyan" className="warehouse-type-badge">
              <TagOutlined /> {warehouseTypeLabel}
            </Tag>
          </div>

          <div className="warehouse-address-row">
            <EnvironmentOutlined className="address-icon" />
            <Text className="address-text">
              {selectedWarehouse.address || "Chưa cập nhật địa chỉ kho vận hành"}
            </Text>
          </div>
        </div>
      </div>

      <div className="admin-warehouse-summary-card__right">
        <div className="kpi-mini-pill">
          <span className="kpi-mini-pill__val color-blue" style={{ fontSize: 24, fontWeight: 900 }}>
            {totalZones}
          </span>
          <span className="kpi-mini-pill__lbl" style={{ fontSize: 13, fontWeight: 800 }}>
            Khu Vực
          </span>
        </div>

        <div className="kpi-mini-pill">
          <span className="kpi-mini-pill__val color-purple" style={{ fontSize: 24, fontWeight: 900 }}>
            {totalShelves}
          </span>
          <span className="kpi-mini-pill__lbl" style={{ fontSize: 13, fontWeight: 800 }}>
            Kệ Hàng
          </span>
        </div>

        <div className="kpi-mini-pill">
          <span className="kpi-mini-pill__val color-green" style={{ fontSize: 24, fontWeight: 900 }}>
            {activeBins}
          </span>
          <span className="kpi-mini-pill__lbl" style={{ fontSize: 13, fontWeight: 800 }}>
            Ô Sẵn Sàng
          </span>
        </div>

        <div className="kpi-mini-pill">
          <span className="kpi-mini-pill__val color-orange" style={{ fontSize: 24, fontWeight: 900 }}>
            {inactiveBins}
          </span>
          <span className="kpi-mini-pill__lbl" style={{ fontSize: 13, fontWeight: 800 }}>
            Tạm Ngừng
          </span>
        </div>
      </div>
    </div>
  );
}
