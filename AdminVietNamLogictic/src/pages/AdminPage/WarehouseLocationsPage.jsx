import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
} from "@ant-design/icons";

import {
  createWarehouseLocation,
  createWarehouseLayoutItem,
  deleteWarehouseLocation,
  deleteWarehouseLayoutItem,
  getAdminApiError,
  getWarehouses,
  getWarehouseLocations,
  getWarehouseLayout,
  getWarehouseLayoutZones,
  getWarehouseLayoutStatus,
  getInventories,
  updateWarehouseLocation,
  updateWarehouseLayoutItem,
} from "../../api/AdminAPI/adminService";
import AuthNotify from "../../utils/Common/AuthNotify";
import { formatVietnamDateTime } from "../../utils/timeUtc";
import WarehouseHeroHeader from "./components/WarehouseHeroHeader";
import WarehouseToolbar from "./components/WarehouseToolbar";
import WarehouseSummaryCard from "./components/WarehouseSummaryCard";
import WarehouseLoadingSkeleton from "./components/WarehouseLoadingSkeleton";
import WarehouseLayeredView from "./components/WarehouseLayeredView";
import WarehouseOccupancyStatusView from "./components/WarehouseOccupancyStatusView";
import WarehouseLayoutGridView from "./components/WarehouseLayoutGridView";
import WarehouseLocationModal from "./components/WarehouseLocationModal";
import WarehouseLayoutModal from "./components/WarehouseLayoutModal";
import BinInventoryModal from "./components/BinInventoryModal";
import "./AdminPage.css";

const { Text, Title, Paragraph } = Typography;

const INITIAL_LOCATION_FORM = {
  zoneName: "",
  shelfCode: "",
  binCode: "",
  maxVolume: null,
  maxWeight: null,
  isActive: true,
  note: "",
};

const INITIAL_LAYOUT_FORM = {
  zoneCode: "",
  label: "",
  gridRow: 1,
  gridColumn: 1,
  maxVolume: null,
  maxWeight: null,
  isActive: true,
  note: "",
};

const getLocationId = (record) => record?.id || record?.locationId || "";
const getLayoutId = (record) => record?.id || record?.layoutId || "";

const formatNumber = (value, unit = "") => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const formatted = Number(value).toLocaleString("vi-VN");
  return unit ? `${formatted} ${unit}` : formatted;
};

const buildLocationPayload = (form) => ({
  zoneName: form.zoneName.trim() || null,
  shelfCode: form.shelfCode.trim() || null,
  binCode: form.binCode.trim() || null,
  maxVolume: form.maxVolume === "" || form.maxVolume == null ? null : Number(form.maxVolume),
  maxWeight: form.maxWeight === "" || form.maxWeight == null ? null : Number(form.maxWeight),
  isActive: Boolean(form.isActive),
  note: form.note ? form.note.trim() : null,
});

const buildLayoutPayload = (form) => ({
  zoneCode: form.zoneCode.trim() || null,
  label: form.label.trim() || null,
  gridRow: form.gridRow ? Number(form.gridRow) : 1,
  gridColumn: form.gridColumn ? Number(form.gridColumn) : 1,
  maxVolume: form.maxVolume === "" || form.maxVolume == null ? null : Number(form.maxVolume),
  maxWeight: form.maxWeight === "" || form.maxWeight == null ? null : Number(form.maxWeight),
  isActive: Boolean(form.isActive),
  note: form.note ? form.note.trim() : null,
});

function groupLocations(locations = []) {
  const zones = new Map();
  for (const loc of locations) {
    const zoneName = loc.zoneName || loc.zoneCode || "Chung";
    const shelfCode = loc.shelfCode || "Shelf A";
    if (!zones.has(zoneName)) zones.set(zoneName, new Map());
    const shelves = zones.get(zoneName);
    if (!shelves.has(shelfCode)) shelves.set(shelfCode, []);
    shelves.get(shelfCode).push(loc);
  }

  return [...zones.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "vi"))
    .map(([zoneName, shelves]) => ({
      zoneName,
      shelves: [...shelves.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "vi"))
        .map(([shelfCode, bins]) => ({
          shelfCode,
          bins: bins.sort((a, b) =>
            String(a.binCode || a.code || "").localeCompare(
              String(b.binCode || b.code || ""),
              "vi"
            )
          ),
        })),
    }));
}

export default function WarehouseLocationsPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [viewMode, setViewMode] = useState("layered"); // "layered" | "layout" | "status" | "table"

  // Data states
  const [locations, setLocations] = useState([]);
  const [layoutItems, setLayoutItems] = useState([]);
  const [zoneData, setZoneData] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [inventories, setInventories] = useState([]);

  // Bin Inventory Inspection Modal State
  const [binModalOpen, setBinModalOpen] = useState(false);
  const [selectedBinData, setSelectedBinData] = useState(null);
  const [selectedBinInventories, setSelectedBinInventories] = useState([]);

  const handleInspectBin = (bin, binInventories = []) => {
    setSelectedBinData(bin);
    setSelectedBinInventories(binInventories);
    setBinModalOpen(true);
  };

  // Filters & Loading
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editor Modal states
  const [locationEditorOpen, setLocationEditorOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationPreset, setLocationPreset] = useState({ isZonePreset: false, isShelfPreset: false });
  const [locationForm, setLocationForm] = useState(INITIAL_LOCATION_FORM);

  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [editingLayout, setEditingLayout] = useState(null);
  const [layoutForm, setLayoutForm] = useState(INITIAL_LAYOUT_FORM);

  // Load Warehouses
  const loadWarehouses = useCallback(async () => {
    try {
      const data = await getWarehouses();
      setWarehouses(data || []);
      setWarehouseId((current) => current || data?.[0]?.id || "");
    } catch (error) {
      AuthNotify.error("Tải danh sách kho thất bại", getAdminApiError(error, "Không thể kết nối danh sách kho vận hành."));
    }
  }, []);

  // Load All Warehouse Location & Layout Data
  const loadAllData = useCallback(async (isInitial = false) => {
    if (!warehouseId) {
      setLocations([]);
      setLayoutItems([]);
      setZoneData(null);
      setStatusData(null);
      setInventories([]);
      return;
    }

    if (isInitial) {
      setInitialLoading(true);
      setLocations([]);
      setLayoutItems([]);
      setZoneData(null);
      setStatusData(null);
      setInventories([]);
    }
    setLoading(true);

    try {
      const [locsRes, layoutRes, zonesRes, statusRes, invRes] = await Promise.allSettled([
        getWarehouseLocations(warehouseId),
        getWarehouseLayout(warehouseId),
        getWarehouseLayoutZones(warehouseId),
        getWarehouseLayoutStatus(warehouseId),
        getInventories({ warehouseId }),
      ]);

      if (locsRes.status === "fulfilled") setLocations(locsRes.value || []);
      if (layoutRes.status === "fulfilled") setLayoutItems(layoutRes.value || []);
      if (zonesRes.status === "fulfilled") setZoneData(zonesRes.value || null);
      if (statusRes.status === "fulfilled") setStatusData(statusRes.value || null);
      if (invRes.status === "fulfilled") setInventories(invRes.value || []);
      else setInventories([]);
    } catch (error) {
      AuthNotify.error("Tải dữ liệu thất bại", getAdminApiError(error, "Không thể tải dữ liệu sơ đồ kho."));
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    const timer = window.setTimeout(loadWarehouses, 0);
    return () => window.clearTimeout(timer);
  }, [loadWarehouses]);

  useEffect(() => {
    if (warehouseId) {
      setQuery("");
      setZoneFilter(null);
      setStatusFilter(null);
      loadAllData(true);
    }
  }, [warehouseId]);

  // Derived Filtered Data
  const filteredLocations = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");

    return locations.filter((item) => {
      if (zoneFilter && (item.zoneName || item.zoneCode) !== zoneFilter) return false;
      if (statusFilter === "true" && !item.isActive) return false;
      if (statusFilter === "false" && item.isActive) return false;
      if (!keyword) return true;
      return [item.zoneName, item.shelfCode, item.binCode, item.note].some((value) =>
        String(value ?? "").toLocaleLowerCase("vi").includes(keyword)
      );
    });
  }, [locations, query, statusFilter, zoneFilter]);

  const tree = useMemo(() => groupLocations(filteredLocations), [filteredLocations]);

  // Stats calculation
  const totalBins = locations.length;
  const activeBins = useMemo(() => locations.filter((l) => l.isActive !== false).length, [locations]);
  const totalZones = useMemo(() => new Set(locations.map((l) => l.zoneName || l.zoneCode)).size, [locations]);
  const totalShelves = useMemo(() => {
    const shelves = new Set();
    locations.forEach((l) => shelves.add(`${l.zoneName || l.zoneCode}-${l.shelfCode}`));
    return shelves.size;
  }, [locations]);

  const zoneOptions = useMemo(() => {
    const names = [
      ...new Set(
        locations
          .map((item) => item.zoneName || item.zoneCode)
          .filter((name) => Boolean(name))
      ),
    ].sort((a, b) => a.localeCompare(b, "vi"));
    return names.map((name) => ({ label: `Khu vực ${name}`, value: name }));
  }, [locations]);

  const existingZones = useMemo(
    () =>
      groupLocations(locations)
        .map((zone) => zone.zoneName)
        .filter((name) => name !== "Chung"),
    [locations]
  );

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === warehouseId),
    [warehouses, warehouseId]
  );

  // Handlers Location Modal
  const openCreateLocation = (presetZone = "", presetShelf = "") => {
    setEditingLocation(null);
    setLocationPreset({
      isZonePreset: Boolean(presetZone),
      isShelfPreset: Boolean(presetShelf),
    });
    setLocationForm({
      ...INITIAL_LOCATION_FORM,
      zoneName: presetZone || "",
      shelfCode: presetShelf || "",
    });
    setLocationEditorOpen(true);
  };

  const openEditLocation = (record) => {
    setEditingLocation(record);
    setLocationPreset({
      isZonePreset: true,
      isShelfPreset: true,
    });
    setLocationForm({
      zoneName: record.zoneName || record.zoneCode || "",
      shelfCode: record.shelfCode || "",
      binCode: record.binCode || record.code || "",
      maxVolume: record.maxVolume ?? record.capacity ?? null,
      maxWeight: record.maxWeight ?? null,
      isActive: record.isActive !== false,
      note: record.note || "",
    });
    setLocationEditorOpen(true);
  };

  const submitLocation = async () => {
    if (!warehouseId) {
      AuthNotify.warning("Chưa chọn kho", "Vui lòng chọn kho vận hành.");
      return;
    }
    if (
      !locationForm.zoneName?.trim() ||
      !locationForm.shelfCode?.trim() ||
      !locationForm.binCode?.trim() ||
      locationForm.maxVolume == null ||
      locationForm.maxVolume === "" ||
      locationForm.maxWeight == null ||
      locationForm.maxWeight === "" ||
      !locationForm.note?.trim()
    ) {
      AuthNotify.warning(
        "Thiếu thông tin bắt buộc",
        "Vui lòng nhập đầy đủ tất cả thông tin: Khu vực, Mã kệ, Mã ô, Dung tích max (cm³), Tải trọng max (kg) và Ghi chú vị trí."
      );
      return;
    }

    setSaving(true);
    try {
      const payload = buildLocationPayload(locationForm);
      if (editingLocation) {
        await updateWarehouseLocation(getLocationId(editingLocation), payload);
        AuthNotify.success("Cập nhật thành công", `Đã cập nhật thông tin Ô chứa ${locationForm.binCode}.`);
      } else {
        await createWarehouseLocation(warehouseId, payload);
        AuthNotify.success("Tạo vị trí thành công", `Đã thêm mới Ô chứa ${locationForm.binCode}.`);
      }
      setLocationEditorOpen(false);
      await loadAllData();
    } catch (error) {
      AuthNotify.error("Lưu vị trí thất bại", getAdminApiError(error, "Không thể lưu vị trí kho."));
    } finally {
      setSaving(false);
    }
  };

  const removeLocation = async (record) => {
    try {
      await deleteWarehouseLocation(getLocationId(record));
      AuthNotify.success("Xóa vị trí thành công", "Đã xóa vị trí khỏi sơ đồ kho.");
      await loadAllData();
    } catch (error) {
      AuthNotify.error("Xóa thất bại", getAdminApiError(error, "Không thể xóa vị trí kho."));
    }
  };

  // Handlers Layout Modal
  const openCreateLayout = () => {
    setEditingLayout(null);
    setLayoutForm({
      ...INITIAL_LAYOUT_FORM,
      zoneCode: existingZones[0] || "A",
    });
    setLayoutEditorOpen(true);
  };

  const openEditLayout = (item) => {
    setEditingLayout(item);
    setLayoutForm({
      zoneCode: item.zoneCode || item.zoneName || "",
      label: item.label || item.code || "",
      gridRow: item.gridRow || item.row || 1,
      gridColumn: item.gridColumn || item.column || 1,
      maxVolume: item.maxVolume ?? null,
      maxWeight: item.maxWeight ?? null,
      isActive: item.isActive !== false,
      note: item.note || "",
    });
    setLayoutEditorOpen(true);
  };

  const submitLayout = async () => {
    if (!warehouseId) return;
    if (!layoutForm.label.trim()) {
      AuthNotify.warning("Thiếu thông tin", "Vui lòng nhập nhãn hiển thị cho ô sơ đồ kho.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildLayoutPayload(layoutForm);
      if (editingLayout) {
        await updateWarehouseLayoutItem(warehouseId, getLayoutId(editingLayout), payload);
        AuthNotify.success("Cập nhật ô sơ đồ thành công", "Đã cập nhật ô tọa độ kho.");
      } else {
        await createWarehouseLayoutItem(warehouseId, payload);
        AuthNotify.success("Tạo ô sơ đồ thành công", "Đã tạo mới ô tọa độ kho.");
      }
      setLayoutEditorOpen(false);
      await loadAllData();
    } catch (error) {
      AuthNotify.error("Lưu ô sơ đồ thất bại", getAdminApiError(error, "Không thể lưu ô tọa độ sơ đồ."));
    } finally {
      setSaving(false);
    }
  };

  const removeLayout = async (item) => {
    try {
      await deleteWarehouseLayoutItem(warehouseId, getLayoutId(item));
      AuthNotify.success("Xóa ô sơ đồ thành công", "Đã xóa ô khỏi lưới sơ đồ kho.");
      await loadAllData();
    } catch (error) {
      AuthNotify.error("Xóa thất bại", getAdminApiError(error, "Không thể xóa ô sơ đồ kho."));
    }
  };

  // Antd Table Columns Configuration
  const tableColumns = [
    {
      title: "Mã Vị Trí Tổng Hợp",
      key: "code",
      render: (_, record) => (
        <Space size="small">
          <Tag color="blue" style={{ fontWeight: 700 }}>
            Khu {record.zoneName || record.zoneCode || "Chung"}
          </Tag>
          <Text strong>Kệ {record.shelfCode || "—"}</Text>
          <Tag color="cyan">Ô {record.binCode || record.code || "—"}</Tag>
        </Space>
      ),
    },
    {
      title: "Khu Vực (Zone)",
      dataIndex: "zoneName",
      key: "zoneName",
      render: (val, record) => val || record.zoneCode || "Chưa phân khu",
    },
    {
      title: "Kệ Lưu Trữ (Shelf)",
      dataIndex: "shelfCode",
      key: "shelfCode",
      render: (val) => `Kệ ${val}`,
    },
    {
      title: "Ô Chứa Hàng (Bin)",
      dataIndex: "binCode",
      key: "binCode",
      render: (val, record) => val || record.code || "—",
    },
    {
      title: "Dung Tích Tối Đa",
      dataIndex: "maxVolume",
      key: "maxVolume",
      render: (val, record) => formatNumber(val ?? record.capacity, "cm³"),
    },
    {
      title: "Tải Trọng Tối Đa",
      dataIndex: "maxWeight",
      key: "maxWeight",
      render: (val) => formatNumber(val, "kg"),
    },
    {
      title: "Trạng Thái",
      dataIndex: "isActive",
      key: "isActive",
      render: (active) =>
        active !== false ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Đang hoạt động
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            Ngừng sử dụng
          </Tag>
        ),
    },
    {
      title: "Ghi Chú",
      dataIndex: "note",
      key: "note",
      ellipsis: true,
      render: (text) => text || <Text type="secondary">—</Text>,
    },
    {
      title: "Thời Gian Tạo (UTC+7)",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (val) => (
        <Text style={{ fontSize: 12, color: "#475569" }}>
          {formatVietnamDateTime(val)}
        </Text>
      ),
    },
    {
      title: "Thao Tác",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa vị trí">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: "#2563eb" }} />}
              onClick={() => openEditLocation(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa vị trí lưu trữ này?"
            description="Thao tác này sẽ xóa vị trí khỏi sơ đồ kho."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => removeLocation(record)}
          >
            <Tooltip title="Xóa vị trí">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="admin-page admin-warehouse-page">
      {/* Hero Header Section Component */}
      <WarehouseHeroHeader
        totalZones={totalZones}
        totalShelves={totalShelves}
        activeBins={activeBins}
        totalBins={totalBins}
      />

      {/* Main Panel */}
      <section className="admin-page__panel admin-warehouse-panel">
        {/* Toolbar Component */}
        <WarehouseToolbar
          warehouses={warehouses}
          warehouseId={warehouseId}
          setWarehouseId={setWarehouseId}
          query={query}
          setQuery={setQuery}
          zoneFilter={zoneFilter}
          setZoneFilter={setZoneFilter}
          zoneOptions={zoneOptions}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
          loading={loading}
          loadAllData={loadAllData}
          openCreateLocation={openCreateLocation}
        />

        {/* Dynamic Content Area */}
        <div className="admin-warehouse-content">
          {!warehouseId ? (
            <div className="admin-warehouse-empty">
              <InboxOutlined className="admin-warehouse-empty__icon" />
              <Title level={4} style={{ color: "#0f172a" }}>Chưa Chọn Kho Vận Hành</Title>
              <Paragraph type="secondary" style={{ maxWidth: 460 }}>
                Vui lòng chọn một kho vận hành từ danh sách thả xuống ở góc trên để bắt đầu khám phá sơ đồ phân tầng lưu trữ.
              </Paragraph>
            </div>
          ) : initialLoading ? (
            <WarehouseLoadingSkeleton />
          ) : (
            <>
              {/* Warehouse Header Summary Card Component */}
              <WarehouseSummaryCard
                selectedWarehouse={selectedWarehouse}
                totalZones={totalZones}
                totalShelves={totalShelves}
                activeBins={activeBins}
                totalBins={totalBins}
              />

              {/* VIEW MODE 1: LAYERED VISUAL DIAGRAM */}
              {viewMode === "layered" && (
                <WarehouseLayeredView
                  tree={tree}
                  inventories={inventories}
                  openCreateLocation={openCreateLocation}
                  openEditLocation={openEditLocation}
                  removeLocation={removeLocation}
                  getLocationId={getLocationId}
                  onInspectBin={handleInspectBin}
                />
              )}

              {/* VIEW MODE 2: REALTIME INVENTORY & STATUS OCCUPANCY */}
              {viewMode === "status" && (
                <WarehouseOccupancyStatusView
                  totalBins={totalBins}
                  activeBins={activeBins}
                  tree={tree}
                  statusData={statusData}
                />
              )}

              {/* VIEW MODE 3: LAYOUT ITEMS GRID */}
              {viewMode === "layout" && (
                <WarehouseLayoutGridView
                  layoutItems={layoutItems}
                  openCreateLayout={openCreateLayout}
                  openEditLayout={openEditLayout}
                  removeLayout={removeLayout}
                  getLayoutId={getLayoutId}
                />
              )}

              {/* VIEW MODE 4: TABLE VIEW */}
              {viewMode === "table" && (
                <div className="admin-page__table" style={{ marginTop: 16 }}>
                  <Table
                    rowKey={getLocationId}
                    columns={tableColumns}
                    dataSource={filteredLocations}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    scroll={{ x: 1000 }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* MODAL 1: Create / Edit Location (Zone, Shelf, Bin) */}
      <WarehouseLocationModal
        open={locationEditorOpen}
        editingLocation={editingLocation}
        saving={saving}
        locationForm={locationForm}
        setLocationForm={setLocationForm}
        existingZones={existingZones}
        isZonePreset={locationPreset.isZonePreset}
        isShelfPreset={locationPreset.isShelfPreset}
        onSubmit={submitLocation}
        onCancel={() => !saving && setLocationEditorOpen(false)}
      />

      {/* MODAL 2: Bin Inventory Items Inspector */}
      <BinInventoryModal
        open={binModalOpen}
        binData={selectedBinData}
        inventoryItems={selectedBinInventories}
        onClose={() => setBinModalOpen(false)}
      />

      {/* MODAL 2: Create / Edit Layout Item Grid */}
      <WarehouseLayoutModal
        open={layoutEditorOpen}
        editingLayout={editingLayout}
        saving={saving}
        layoutForm={layoutForm}
        setLayoutForm={setLayoutForm}
        onSubmit={submitLayout}
        onCancel={() => !saving && setLayoutEditorOpen(false)}
      />
    </div>
  );
}
