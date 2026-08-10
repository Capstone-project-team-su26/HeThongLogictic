import { Button, Input, Select, Typography } from "antd";
import {
  BuildOutlined,
  CompassOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

export default function WarehouseToolbar({
  warehouses = [],
  warehouseId,
  setWarehouseId,
  query,
  setQuery,
  zoneFilter,
  setZoneFilter,
  zoneOptions = [],
  statusFilter,
  setStatusFilter,
  viewMode,
  setViewMode,
  loading,
  loadAllData,
  openCreateLocation,
}) {
  return (
    <div className="admin-warehouse-toolbar-container">
      {/* Row 1: Warehouse Selector & Main Actions */}
      <div className="admin-warehouse-toolbar-row1">
        <div className="admin-warehouse-select-container">
          <Text strong className="admin-warehouse-select-label">
            <CompassOutlined style={{ color: "#2563eb", fontSize: 18 }} /> Kho Vận Hành:
          </Text>
          <Select
            showSearch
            optionFilterProp="label"
            value={warehouseId || undefined}
            placeholder="Chọn kho vận hành để xem sơ đồ..."
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: `${warehouse.name} (${warehouse.code || "Chưa có mã"})`,
            }))}
            onChange={setWarehouseId}
            className="admin-warehouse-select-main"
          />
        </div>

        <div className="admin-warehouse-actions-main">
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadAllData}>
            Làm mới sơ đồ
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!warehouseId}
            onClick={() => openCreateLocation()}
            className="btn-create-location-primary"
          >
            + Thêm Vị Trí Mới
          </Button>
        </div>
      </div>

      {/* Row 2: Search, Filters & View Mode Tabs */}
      <div className="admin-warehouse-toolbar-row2">
        <div className="admin-warehouse-filters-group">
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo Khu vực, Kệ, Ô..."
            className="admin-warehouse-search-input"
          />

          <Select
            allowClear
            placeholder="Lọc Khu Vực"
            value={zoneFilter}
            options={zoneOptions}
            onChange={setZoneFilter}
            className="admin-warehouse-filter-select"
          />

          <Select
            allowClear
            placeholder="Trạng thái"
            value={statusFilter}
            options={[
              { label: "Đang hoạt động", value: "true" },
              { label: "Ngừng hoạt động", value: "false" },
            ]}
            onChange={setStatusFilter}
            className="admin-warehouse-filter-select"
          />
        </div>

        {/* Active View Badge for Sơ Đồ Phân Tầng */}
        <div className="admin-warehouse-view-indicator">
          <Button
            type="primary"
            icon={<BuildOutlined />}
            style={{
              height: 38,
              borderRadius: 10,
              fontWeight: 700,
              background: "#0f172a",
              borderColor: "#0f172a",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.25)",
              cursor: "default",
            }}
          >
            Sơ Đồ Phân Tầng
          </Button>
        </div>
      </div>
    </div>
  );
}
