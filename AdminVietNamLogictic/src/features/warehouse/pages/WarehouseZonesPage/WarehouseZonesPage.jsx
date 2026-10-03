import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Col,
  Empty,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  AlertOutlined,
  AppstoreOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  CompassOutlined,
  DatabaseOutlined,
  EditOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  ImportOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  ShopOutlined,
  WarningFilled,
  WarningOutlined,
} from "@ant-design/icons";

import { getActiveWarehousesApi } from "@features/warehouse/api/warehouseService";
import {
  getZoneApiError,
  getZoneTypeMeta,
  listMisplacedParcels,
  listWarehouseZones,
  updateWarehouseZone,
  ZONE_TYPE_OPTIONS,
} from "@features/warehouse/api/warehouseZoneService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import "@features/operations/styles/OperationsPage.css";
import "./WarehouseZonesPage.css";
import { getParcelStatusLabel, textOr } from "@shared/utils/statusLabel";
import { tablePagination } from "@shared/utils/tablePagination";

const { Text } = Typography;

/** Metadata bổ trợ đồ hoạ cho 4 loại khu theo quy chuẩn kho vận */
const ZONE_TYPE_DETAILS = {
  RECEIVING: {
    label: "Khu nhận",
    desc: "Tiếp nhận hàng từ xe/cảng về kho, chờ kiểm đếm & phân loại",
    color: "blue",
    icon: <ImportOutlined />,
    badgeColor: "#2563eb",
    bgColor: "#eff6ff",
  },
  STORAGE: {
    label: "Khu lưu kho",
    desc: "Khu vực duy nhất được phép xếp kiện hàng lưu trữ trên các ô kệ",
    color: "green",
    icon: <ShopOutlined />,
    badgeColor: "#16a34a",
    bgColor: "#f0fdf4",
  },
  QUARANTINE: {
    label: "Khu cách ly",
    desc: "Cách ly kiện hàng hỏng hóc, rách vỡ bao bì hoặc đang chờ xử lý sự cố",
    color: "red",
    icon: <AlertOutlined />,
    badgeColor: "#dc2626",
    bgColor: "#fef2f2",
  },
  OUTBOUND: {
    label: "Khu xuất",
    desc: "Tập kết các kiện hàng đã đóng gói/gom theo phiếu xuất chờ giao tài xế",
    color: "purple",
    icon: <SendOutlined />,
    badgeColor: "#9333ea",
    bgColor: "#faf5ff",
  },
};

const getZoneDetailedMeta = (type) => {
  const upper = String(type || "").toUpperCase();
  const fallback = getZoneTypeMeta(type);
  return (
    ZONE_TYPE_DETAILS[upper] || {
      label: fallback?.label || "Chưa phân loại",
      desc: "Chưa cấu hình loại khu",
      color: fallback?.color || "default",
      icon: <AppstoreOutlined />,
      badgeColor: "#64748b",
      bgColor: "#f1f5f9",
    }
  );
};

/**
 * Khu kho và kiện nằm sai khu — Quản lý kho / Vận hành / Admin.
 *
 * Mỗi khu phải được khai loại (Nhận / Lưu kho / Cách ly / Xuất).
 * Chỉ khu STORAGE đang dùng mới được phép xếp hàng lưu kho (acceptsStorage).
 * Giám sát kiện nằm sai phân khu để nhân viên quét app điều chuyển về ô chuẩn.
 */
export default function WarehouseZonesPage({ eyebrow = "BỘ PHẬN VẬN HÀNH (OPS)" }) {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [zones, setZones] = useState([]);
  const [misplaced, setMisplaced] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /* Quản lý tìm kiếm & bộ lọc */
  const [activeTab, setActiveTab] = useState("all-zones");
  const [zoneSearchText, setZoneSearchText] = useState("");
  const [zoneTypeFilter, setZoneTypeFilter] = useState("ALL");
  const [zoneStatusFilter, setZoneStatusFilter] = useState("ALL");
  const [misplacedSearchText, setMisplacedSearchText] = useState("");

  /* Modal chỉnh sửa khu */
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Tải danh mục kho hoạt động
  useEffect(() => {
    let cancelled = false;
    getActiveWarehousesApi()
      .then((items) => {
        if (cancelled) return;
        setWarehouses(items);
        setWarehouseId((current) => current || items[0]?.id || "");
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(getZoneApiError(error, "Không tải được danh sách kho."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tải danh sách khu và kiện sai khu
  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    setErrorMessage("");
    const [zoneResult, misplacedResult] = await Promise.allSettled([
      listWarehouseZones(warehouseId),
      listMisplacedParcels(warehouseId),
    ]);
    if (zoneResult.status === "fulfilled") {
      setZones(zoneResult.value);
    } else {
      setErrorMessage(getZoneApiError(zoneResult.reason, "Không tải được danh sách khu kho."));
    }
    setMisplaced(misplacedResult.status === "fulfilled" ? misplacedResult.value : []);
    setLoading(false);
  }, [warehouseId]);

  useEffect(() => {
    load();
  }, [load]);

  // Lưu thông tin khu
  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateWarehouseZone(editing.zoneId, editing);
      AuthNotify.success("Đã cập nhật khu kho", editing.zoneName || editing.zoneCode || "");
      setEditing(null);
      load();
    } catch (error) {
      AuthNotify.error("Không cập nhật được khu", getZoneApiError(error, "Vui lòng kiểm tra lại."));
    } finally {
      setSaving(false);
    }
  };

  // Thông tin kho đang chọn
  const currentWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === warehouseId) || null;
  }, [warehouses, warehouseId]);

  // Thống kê nhanh KPI
  const stats = useMemo(() => {
    const total = zones.length;
    const active = zones.filter((z) => String(z.status).toUpperCase() === "ACTIVE").length;
    const inactive = total - active;
    const storage = zones.filter(
      (z) => String(z.zoneType).toUpperCase() === "STORAGE" || z.acceptsStorage,
    ).length;
    const totalShelves = zones.reduce((sum, z) => sum + (Number(z.shelfCount) || 0), 0);
    const totalBins = zones.reduce((sum, z) => sum + (Number(z.binCount) || 0), 0);
    const activeBins = zones.reduce((sum, z) => sum + (Number(z.activeBinCount) || 0), 0);
    const totalParcels = zones.reduce((sum, z) => sum + (Number(z.parcelCount) || 0), 0);
    const misplacedCount = misplaced.length;

    const binOccupancyRate = totalBins > 0 ? Math.round((activeBins / totalBins) * 100) : 0;

    return {
      total,
      active,
      inactive,
      storage,
      totalShelves,
      totalBins,
      activeBins,
      binOccupancyRate,
      totalParcels,
      misplacedCount,
    };
  }, [zones, misplaced]);

  // Lọc danh sách phân khu
  const filteredZones = useMemo(() => {
    return zones.filter((item) => {
      // Tìm kiếm theo từ khóa
      if (zoneSearchText) {
        const query = zoneSearchText.toLowerCase().trim();
        const name = (item.zoneName || "").toLowerCase();
        const code = (item.zoneCode || "").toLowerCase();
        if (!name.includes(query) && !code.includes(query)) return false;
      }
      // Lọc theo loại khu
      if (zoneTypeFilter !== "ALL" && String(item.zoneType).toUpperCase() !== zoneTypeFilter) {
        return false;
      }
      // Lọc theo trạng thái
      if (zoneStatusFilter !== "ALL" && String(item.status).toUpperCase() !== zoneStatusFilter) {
        return false;
      }
      return true;
    });
  }, [zones, zoneSearchText, zoneTypeFilter, zoneStatusFilter]);

  // Lọc danh sách kiện nằm sai khu
  const filteredMisplaced = useMemo(() => {
    if (!misplacedSearchText) return misplaced;
    const query = misplacedSearchText.toLowerCase().trim();
    return misplaced.filter((item) => {
      const pkg = (item.packageCode || "").toLowerCase();
      const csg = (item.consignmentCode || "").toLowerCase();
      const bin = (item.binCode || "").toLowerCase();
      const zone = (item.zoneName || "").toLowerCase();
      return pkg.includes(query) || csg.includes(query) || bin.includes(query) || zone.includes(query);
    });
  }, [misplaced, misplacedSearchText]);

  // Cấu hình cột bảng phân khu
  const zoneColumns = [
    {
      title: "Phân khu",
      key: "zone",
      width: 250,
      render: (_, row) => {
        const typeMeta = getZoneDetailedMeta(row.zoneType);
        return (
          <div className="warehouse-zone-item">
            <div
              className="warehouse-zone-item__icon"
              style={{ backgroundColor: typeMeta.bgColor, color: typeMeta.badgeColor }}
            >
              {typeMeta.icon}
            </div>
            <div className="warehouse-zone-item__text">
              <span className="warehouse-zone-item__name">{row.zoneName || "—"}</span>
              <span className="warehouse-zone-item__code">{row.zoneCode || "Chưa có mã"}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Loại phân khu",
      dataIndex: "zoneType",
      width: 170,
      render: (value, row) => {
        const meta = getZoneDetailedMeta(value);
        return (
          <Tag
            color={meta.color}
            icon={meta.icon}
            style={{ borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}
          >
            {textOr(row.zoneTypeText, meta.label)}
          </Tag>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      render: (value) => {
        const isActive = String(value).toUpperCase() === "ACTIVE";
        return (
          <Badge
            status={isActive ? "success" : "default"}
            text={
              <Text style={{ fontWeight: 600, color: isActive ? "#15803d" : "#64748b" }}>
                {isActive ? "Đang hoạt động" : "Ngừng sử dụng"}
              </Text>
            }
          />
        );
      },
    },
    {
      title: "Xếp hàng lưu kho",
      dataIndex: "acceptsStorage",
      width: 170,
      render: (value) => {
        if (value) {
          return (
            <Tooltip title="Chỉ các ô kệ thuộc khu STORAGE đang hoạt động mới được xếp hàng lưu trữ">
              <Tag
                color="green"
                icon={<CheckCircleFilled />}
                style={{ borderRadius: 6, padding: "3px 8px", fontWeight: 600 }}
              >
                Cho phép lưu kho
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="Không được xếp hàng lưu kho vào khu vực này (hệ thống sẽ chặn thao tác)">
            <Tag
              color="default"
              icon={<CloseCircleOutlined />}
              style={{ borderRadius: 6, padding: "3px 8px", color: "#64748b" }}
            >
              Không lưu kho
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Số kệ",
      dataIndex: "shelfCount",
      align: "center",
      width: 90,
      render: (val) => (
        <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 700 }}>
          {val ?? 0}
        </Tag>
      ),
    },
    {
      title: "Ô kệ (Đang dùng / Tổng)",
      key: "bins",
      width: 220,
      render: (_, row) => {
        const active = row.activeBinCount ?? 0;
        const total = row.binCount ?? 0;
        const percent = total > 0 ? Math.round((active / total) * 100) : 0;
        return (
          <div className="warehouse-zone-capacity">
            <div className="warehouse-zone-capacity__text">
              <span>
                <strong>{active}</strong> / {total} ô
              </span>
              <span style={{ fontSize: 11, color: percent > 85 ? "#dc2626" : "#64748b" }}>
                {percent}%
              </span>
            </div>
            <Progress
              percent={percent}
              size="small"
              showInfo={false}
              strokeColor={percent > 85 ? "#ef4444" : percent > 60 ? "#f59e0b" : "#2563eb"}
            />
          </div>
        );
      },
    },
    {
      title: "Kiện lưu trữ",
      dataIndex: "parcelCount",
      align: "center",
      width: 130,
      render: (count) => {
        const val = count ?? 0;
        return (
          <Tag
            color={val > 0 ? "geekblue" : "default"}
            style={{ borderRadius: 6, fontWeight: 700, padding: "2px 8px" }}
          >
            {val} kiện
          </Tag>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "center",
      width: 100,
      render: (_, row) => (
        <Tooltip title="Chỉnh sửa cấu hình phân khu">
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EditOutlined />}
            style={{ borderRadius: 6, fontWeight: 600 }}
            onClick={() =>
              setEditing({
                zoneId: row.zoneId,
                zoneName: row.zoneName || "",
                zoneCode: row.zoneCode || "",
                zoneType: row.zoneType || "STORAGE",
                status: row.status || "ACTIVE",
              })
            }
          >
            Sửa
          </Button>
        </Tooltip>
      ),
    },
  ];

  // Cấu hình cột bảng kiện nằm sai khu
  const misplacedColumns = [
    {
      title: "Mã kiện hàng",
      dataIndex: "packageCode",
      width: 170,
      render: (v) => (
        <div className="misplaced-code-badge">
          <span>{v}</span>
          <Typography.Paragraph
            copyable={{ text: v, tooltips: ["Sao chép", "Đã sao chép"] }}
            style={{ display: "inline", margin: 0 }}
          />
        </div>
      ),
    },
    {
      title: "Mã đơn hàng",
      dataIndex: "consignmentCode",
      width: 160,
      render: (v) => (
        <Text strong style={{ color: "#1d4ed8" }}>
          {v || "—"}
        </Text>
      ),
    },
    {
      title: "Trạng thái kiện",
      dataIndex: "packageStatus",
      width: 150,
      render: (v, row) => (
        <Tag color="gold" style={{ borderRadius: 6, fontWeight: 600 }}>
          {textOr(row.packageStatusText, getParcelStatusLabel(v))}
        </Tag>
      ),
    },
    {
      title: "Vị trí ô kệ",
      dataIndex: "binCode",
      width: 130,
      render: (v) => (
        <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 700 }}>
          {v || "Chưa gán ô"}
        </Tag>
      ),
    },
    {
      title: "Khu vực hiện tại",
      key: "zone",
      width: 200,
      render: (_, row) => {
        const meta = getZoneDetailedMeta(row.zoneType);
        return (
          <Space size={6}>
            <Text strong>{row.zoneName || "—"}</Text>
            <Tag color={meta.color} icon={meta.icon} style={{ borderRadius: 4 }}>
              {meta.label}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: "Nguyên nhân cảnh báo",
      dataIndex: "reason",
      render: (v) => (
        <div className="misplaced-reason-box">
          <WarningOutlined style={{ marginRight: 6 }} />
          {v || "Nằm sai phân khu quy định"}
        </div>
      ),
    },
  ];

  return (
    <div className="ops-page warehouse-zones-page">
      {/* --- HERO BANNER --- */}
      <section className="warehouse-zones-hero">
        <div className="warehouse-zones-hero__content">
          <div className="warehouse-zones-hero__info">
            <div className="warehouse-zones-hero__eyebrow">
              <CompassOutlined />
              <span>{eyebrow}</span>
            </div>
            <h1 className="warehouse-zones-hero__title">Quản Lý Phân Khu & Giám Sát Kiện Sai Vị Trí</h1>
            <p className="warehouse-zones-hero__desc">
              Khai báo và chuẩn hóa phân loại chức năng cho từng khu vực kho (Nhận hàng, Lưu kho, Cách
              ly, Xuất kho). Hàng lưu kho chỉ được phép xếp vào ô thuộc khu lưu kho đang hoạt động —
              hệ thống tự động phát hiện và cảnh báo các kiện nằm sai vị trí quy chuẩn.
            </p>
          </div>

          <div className="warehouse-zones-hero__actions">
            <div className="warehouse-zones-hero__selector">
              <Select
                size="large"
                style={{ width: "100%" }}
                value={warehouseId || undefined}
                placeholder="Chọn kho cần quản lý"
                onChange={setWarehouseId}
                options={warehouses.map((item) => ({
                  value: item.id,
                  label: (
                    <Space>
                      <HomeOutlined style={{ color: "#2563eb" }} />
                      <span>{item.name}</span>
                      {item.warehouseType ? (
                        <Tag color="blue" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                          {item.warehouseType}
                        </Tag>
                      ) : null}
                    </Space>
                  ),
                }))}
              />
            </div>
            <Button
              size="large"
              type="primary"
              icon={<ReloadOutlined spin={loading} />}
              onClick={load}
              disabled={loading || !warehouseId}
              style={{
                borderRadius: 10,
                fontWeight: 700,
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              Làm mới
            </Button>
          </div>
        </div>

        {/* Thông tin nhanh kho */}
        {currentWarehouse && (
          <div className="warehouse-zones-hero__chips">
            <div className="warehouse-zones-hero__chip">
              <EnvironmentOutlined />
              <span>
                Kho: <strong>{currentWarehouse.name}</strong>
              </span>
            </div>
            {currentWarehouse.code && (
              <div className="warehouse-zones-hero__chip">
                <span>
                  Mã kho: <strong>{currentWarehouse.code}</strong>
                </span>
              </div>
            )}
            {currentWarehouse.region && (
              <div className="warehouse-zones-hero__chip">
                <span>
                  Khu vực: <strong>{currentWarehouse.region}</strong>
                </span>
              </div>
            )}
            <div className="warehouse-zones-hero__chip">
              <AppstoreOutlined />
              <span>
                Quy mô: <strong>{stats.total} phân khu</strong> ({stats.storage} khu lưu kho)
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Thông báo lỗi nếu có */}
      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message="Lỗi tải dữ liệu kho"
          description={errorMessage}
          style={{ borderRadius: 12 }}
        />
      )}

      {/* --- KPI SUMMARY CARDS --- */}
      <div className="warehouse-zones-kpi-grid">
        {/* Card 1: Tổng số phân khu */}
        <div className="warehouse-zones-kpi-card">
          <div className="warehouse-zones-kpi-card__main">
            <span className="warehouse-zones-kpi-card__label">Tổng phân khu</span>
            <span className="warehouse-zones-kpi-card__value">{stats.total}</span>
            <span className="warehouse-zones-kpi-card__sub">
              {stats.active} đang dùng · {stats.inactive} ngừng dùng
            </span>
          </div>
          <div className="warehouse-zones-kpi-card__icon-wrap warehouse-zones-kpi-card__icon-wrap--blue">
            <AppstoreOutlined />
          </div>
        </div>

        {/* Card 2: Khu lưu kho chuẩn */}
        <div className="warehouse-zones-kpi-card">
          <div className="warehouse-zones-kpi-card__main">
            <span className="warehouse-zones-kpi-card__label">Khu lưu kho (STORAGE)</span>
            <span className="warehouse-zones-kpi-card__value">{stats.storage}</span>
            <span className="warehouse-zones-kpi-card__sub">
              {stats.storage > 0 ? "Cho phép xếp hàng lưu kho" : "Chưa có khu lưu kho"}
            </span>
          </div>
          <div className="warehouse-zones-kpi-card__icon-wrap warehouse-zones-kpi-card__icon-wrap--green">
            <ShopOutlined />
          </div>
        </div>

        {/* Card 3: Hạ tầng Kệ & Ô chứa */}
        <div className="warehouse-zones-kpi-card">
          <div className="warehouse-zones-kpi-card__main">
            <span className="warehouse-zones-kpi-card__label">Ô kệ khả dụng</span>
            <span className="warehouse-zones-kpi-card__value">
              {stats.activeBins}
              <span style={{ fontSize: 16, color: "#94a3b8", fontWeight: 600 }}> / {stats.totalBins}</span>
            </span>
            <span className="warehouse-zones-kpi-card__sub">
              {stats.totalShelves} kệ · {stats.binOccupancyRate}% tỷ lệ sử dụng
            </span>
          </div>
          <div className="warehouse-zones-kpi-card__icon-wrap warehouse-zones-kpi-card__icon-wrap--purple">
            <DatabaseOutlined />
          </div>
        </div>

        {/* Card 4: Cảnh báo kiện sai khu */}
        <div
          className={`warehouse-zones-kpi-card ${
            stats.misplacedCount > 0 ? "warehouse-zones-kpi-card--warning" : ""
          }`}
        >
          <div className="warehouse-zones-kpi-card__main">
            <span className="warehouse-zones-kpi-card__label">Kiện nằm sai khu</span>
            <span
              className="warehouse-zones-kpi-card__value"
              style={{ color: stats.misplacedCount > 0 ? "#dc2626" : "#16a34a" }}
            >
              {stats.misplacedCount}
            </span>
            <span className="warehouse-zones-kpi-card__sub">
              {stats.misplacedCount > 0
                ? "Cần điều chuyển về ô lưu kho"
                : "100% kiện đúng phân khu chuẩn"}
            </span>
          </div>
          <div
            className={`warehouse-zones-kpi-card__icon-wrap ${
              stats.misplacedCount > 0
                ? "warehouse-zones-kpi-card__icon-wrap--red"
                : "warehouse-zones-kpi-card__icon-wrap--green"
            }`}
          >
            {stats.misplacedCount > 0 ? <WarningOutlined /> : <SafetyCertificateOutlined />}
          </div>
        </div>
      </div>

      {/* --- TAB VIEW HOẶC DANH SÁCH KHU & KIỆN SAI KHU --- */}
      <div className="warehouse-zones-section-card">
        {/* Header Tabs */}
        <div className="warehouse-zones-section-card__head">
          <div className="warehouse-zones-section-card__title">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              style={{ margin: 0 }}
              items={[
                {
                  key: "all-zones",
                  label: (
                    <Space size={6}>
                      <AppstoreOutlined />
                      <span>Danh sách phân khu kho</span>
                      <Badge
                        count={filteredZones.length}
                        overflowCount={999}
                        style={{ backgroundColor: "#2563eb" }}
                      />
                    </Space>
                  ),
                },
                {
                  key: "misplaced-parcels",
                  label: (
                    <Space size={6}>
                      <WarningOutlined style={{ color: stats.misplacedCount > 0 ? "#dc2626" : undefined }} />
                      <span>Kiện nằm sai phân khu</span>
                      <Badge
                        count={stats.misplacedCount}
                        overflowCount={999}
                        style={{
                          backgroundColor: stats.misplacedCount > 0 ? "#dc2626" : "#10b981",
                        }}
                      />
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        </div>

        {/* --- NỘI DUNG TAB 1: DANH SÁCH KHU KHO --- */}
        {activeTab === "all-zones" && (
          <div>
            {/* Toolbar lọc phân khu */}
            <div className="warehouse-zones-toolbar">
              <Input
                placeholder="Tìm theo tên hoặc mã khu kho..."
                prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                value={zoneSearchText}
                onChange={(e) => setZoneSearchText(e.target.value)}
                allowClear
                style={{ width: 280, borderRadius: 8 }}
              />

              <div className="warehouse-zones-toolbar__filters">
                <Select
                  style={{ width: 180 }}
                  value={zoneTypeFilter}
                  onChange={setZoneTypeFilter}
                  options={[
                    { value: "ALL", label: "Tất cả loại khu" },
                    { value: "STORAGE", label: "Khu lưu kho (STORAGE)" },
                    { value: "RECEIVING", label: "Khu nhận (RECEIVING)" },
                    { value: "QUARANTINE", label: "Khu cách ly (QUARANTINE)" },
                    { value: "OUTBOUND", label: "Khu xuất (OUTBOUND)" },
                  ]}
                />

                <Select
                  style={{ width: 160 }}
                  value={zoneStatusFilter}
                  onChange={setZoneStatusFilter}
                  options={[
                    { value: "ALL", label: "Tất cả trạng thái" },
                    { value: "ACTIVE", label: "Đang hoạt động" },
                    { value: "INACTIVE", label: "Ngừng sử dụng" },
                  ]}
                />
              </div>
            </div>

            {/* Bảng phân khu */}
            <Table
              className="warehouse-zones-table"
              rowKey="zoneId"
              size="middle"
              loading={loading}
              columns={zoneColumns}
              dataSource={filteredZones}
              pagination={tablePagination({ unit: "khu", pageSize: 10 })}
              scroll={{ x: 1050 }}
              rowClassName={(row) => (row.acceptsStorage ? "ops-row--storage" : "")}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Không tìm thấy phân khu nào phù hợp."
                  />
                ),
              }}
            />
          </div>
        )}

        {/* --- NỘI DUNG TAB 2: KIỆN NẰM SAI PHÂN KHU --- */}
        {activeTab === "misplaced-parcels" && (
          <div>
            {/* Hướng dẫn nghiệp vụ */}
            <div className="misplaced-alert-banner">
              <WarningFilled className="misplaced-alert-banner__icon" />
              <div>
                <strong>Quy trình xử lý kiện hàng sai vị trí:</strong>
                <div>
                  Kiện nằm ở khu nhận, khu xuất, khu cách ly hoặc khu/ô ngừng dùng cần được nhân viên
                  kho dùng app quét mã barcode để thực hiện <em>thao tác chuyển ô</em> về khu lưu kho
                  (STORAGE) tiêu chuẩn. Kiện đã nằm trong phiếu xuất kho (tồn PICKED) sẽ do luồng xuất
                  kho tự động xử lý và không liệt kê tại đây.
                </div>
              </div>
            </div>

            {/* Toolbar lọc kiện sai khu */}
            <div className="warehouse-zones-toolbar">
              <Input
                placeholder="Tìm theo mã kiện, mã đơn, ô kệ, tên khu..."
                prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                value={misplacedSearchText}
                onChange={(e) => setMisplacedSearchText(e.target.value)}
                allowClear
                style={{ width: 340, borderRadius: 8 }}
              />

              <Tag color={filteredMisplaced.length > 0 ? "error" : "success"} style={{ padding: "4px 10px" }}>
                {filteredMisplaced.length > 0
                  ? `Có ${filteredMisplaced.length} kiện cần xử lý`
                  : "Toàn bộ kiện đúng vị trí"}
              </Tag>
            </div>

            {/* Bảng kiện sai khu */}
            <Table
              className="warehouse-zones-table"
              rowKey="parcelId"
              size="middle"
              loading={loading}
              columns={misplacedColumns}
              dataSource={filteredMisplaced}
              pagination={tablePagination({ unit: "kiện", pageSize: 10 })}
              scroll={{ x: 950 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div style={{ padding: "20px 0" }}>
                        <CheckCircleFilled style={{ fontSize: 36, color: "#10b981", marginBottom: 8 }} />
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>
                          Không có kiện hàng nào nằm sai khu vực!
                        </div>
                        <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                          Toàn bộ kiện lưu trữ trong kho đang được sắp xếp đúng phân khu quy chuẩn.
                        </div>
                      </div>
                    }
                  />
                ),
              }}
            />
          </div>
        )}
      </div>

      {/* --- MODAL CHỈNH SỬA PHÂN KHU KHO --- */}
      <Modal
        open={Boolean(editing)}
        title={
          <Space>
            <EditOutlined style={{ color: "#2563eb" }} />
            <span>Cập nhật cấu hình phân khu kho</span>
          </Space>
        }
        okText="Lưu thay đổi"
        cancelText="Hủy bỏ"
        width={560}
        okButtonProps={{
          loading: saving,
          disabled: !editing?.zoneType,
          style: { borderRadius: 8, fontWeight: 700 },
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        onOk={save}
        onCancel={() => setEditing(null)}
        destroyOnClose
      >
        {editing && (
          <Space direction="vertical" size={16} style={{ width: "100%", marginTop: 12 }}>
            {/* Tên khu & Mã khu */}
            <Row gutter={12}>
              <Col span={14}>
                <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 12, color: "#475569" }}>
                  Tên phân khu <span style={{ color: "#ef4444" }}>*</span>
                </div>
                <Input
                  placeholder="Ví dụ: Khu Lưu Kho A"
                  value={editing.zoneName}
                  onChange={(event) => setEditing((e) => ({ ...e, zoneName: event.target.value }))}
                  style={{ borderRadius: 8 }}
                />
              </Col>
              <Col span={10}>
                <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 12, color: "#475569" }}>
                  Mã phân khu
                </div>
                <Input
                  placeholder="Ví dụ: ZONE-STORAGE-A"
                  value={editing.zoneCode}
                  onChange={(event) => setEditing((e) => ({ ...e, zoneCode: event.target.value }))}
                  style={{ borderRadius: 8 }}
                />
              </Col>
            </Row>

            {/* Phân loại chức năng khu */}
            <div>
              <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12, color: "#475569" }}>
                Phân loại chức năng khu <span style={{ color: "#ef4444" }}>*</span>
              </div>
              <div className="zone-type-cards-grid">
                {ZONE_TYPE_OPTIONS.map((item) => {
                  const meta = getZoneDetailedMeta(item.value);
                  const isSelected = String(editing.zoneType).toUpperCase() === item.value;
                  return (
                    <div
                      key={item.value}
                      className={`zone-type-card-option ${
                        isSelected ? "zone-type-card-option--selected" : ""
                      }`}
                      onClick={() => setEditing((e) => ({ ...e, zoneType: item.value }))}
                    >
                      <div
                        className="zone-type-card-option__icon"
                        style={{ backgroundColor: meta.bgColor, color: meta.badgeColor }}
                      >
                        {meta.icon}
                      </div>
                      <div className="zone-type-card-option__body">
                        <div className="zone-type-card-option__title">{meta.label}</div>
                        <div className="zone-type-card-option__desc">{meta.desc}</div>
                      </div>
                      {isSelected && (
                        <div className="zone-type-card-option__badge">
                          <CheckCircleFilled style={{ color: "#2563eb", fontSize: 14 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trạng thái hoạt động */}
            <div>
              <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 12, color: "#475569" }}>
                Trạng thái vận hành
              </div>
              <Select
                style={{ width: "100%", borderRadius: 8 }}
                value={String(editing.status || "ACTIVE").toUpperCase()}
                onChange={(value) => setEditing((e) => ({ ...e, status: value }))}
                options={[
                  { value: "ACTIVE", label: "Đang hoạt động (ACTIVE)" },
                  { value: "INACTIVE", label: "Ngừng sử dụng (INACTIVE)" },
                ]}
              />
            </div>

            {/* Cảnh báo an toàn dữ liệu từ backend */}
            <Alert
              type="info"
              showIcon
              message="Quy tắc an toàn kho vận"
              description="Khu lưu kho đang chứa hàng không thể đổi sang loại khác và không thể ngừng dùng. Cần chuyển hết hàng trong khu ra ngoài trước khi thay đổi."
              style={{ borderRadius: 10, fontSize: 12 }}
            />
          </Space>
        )}
      </Modal>
    </div>
  );
}
