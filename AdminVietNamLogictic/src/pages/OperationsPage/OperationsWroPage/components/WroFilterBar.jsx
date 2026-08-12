import React, { useState } from "react";
import {
  Button,
  DatePicker,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ClearOutlined,
  FilterOutlined,
  SearchOutlined,
  DownOutlined,
  UpOutlined,
} from "@ant-design/icons";

import { WRO_STATUS_META } from "../../../../api/OperationsAPI/consolidationWorkflowService";

const { RangePicker } = DatePicker;

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "NEEDS_APPROVAL", label: "Cần duyệt (Chờ xử lý)" },
  ...Object.entries(WRO_STATUS_META).map(([value, meta]) => ({
    value,
    label: `${meta.label} (${value})`,
  })),
];

const CUSTOMS_STATUS_OPTIONS = [
  { value: "", label: "Tất cả thông quan" },
  { value: "CUSTOMS_PENDING", label: "Chờ thông quan" },
  { value: "CUSTOMS_CLEARED", label: "Đã thông quan" },
];

export default function WroFilterBar({
  filters,
  onChangeFilter,
  onResetFilters,
  warehouses = [],
  carriers = [],
  totalResultCount = 0,
}) {
  const [expanded, setExpanded] = useState(false);

  const hasAdvancedFilters = Boolean(
    filters.warehouseId || filters.carrierId || filters.dateRange
  );

  const hasAnyActiveFilters = Boolean(
    filters.status ||
      filters.search ||
      filters.customsStatus ||
      filters.warehouseId ||
      filters.carrierId ||
      filters.exportType ||
      filters.dateRange
  );

  return (
    <div className="wro-filter-panel">
      {/* 1. Main Primary Filter Row */}
      <div className="wro-filter-panel__top">
        <div style={{ flex: 1, minWidth: 260 }}>
          <Input
            allowClear
            size="middle"
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Tìm kiếm mã WRO, mã vạch, mã đơn hàng, tên khách hàng, SĐT..."
            value={filters.search}
            onChange={(e) => onChangeFilter("search", e.target.value)}
            style={{ borderRadius: 8 }}
          />
        </div>

        <Select
          style={{ width: 190 }}
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(val) => onChangeFilter("status", val)}
        />

        <Select
          style={{ width: 170 }}
          value={filters.customsStatus}
          options={CUSTOMS_STATUS_OPTIONS}
          onChange={(val) => onChangeFilter("customsStatus", val)}
        />

        <Button
          type={expanded || hasAdvancedFilters ? "primary" : "default"}
          ghost={expanded || hasAdvancedFilters}
          icon={expanded ? <UpOutlined /> : <DownOutlined />}
          onClick={() => setExpanded(!expanded)}
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          {expanded ? "Thu gọn" : "Mở rộng"}
        </Button>

        {hasAnyActiveFilters ? (
          <Button
            type="text"
            danger
            icon={<ClearOutlined />}
            onClick={onResetFilters}
            style={{ fontWeight: 600 }}
          >
            Đặt lại
          </Button>
        ) : null}
      </div>

      {/* 2. Expanded Advanced Filter Fields */}
      {expanded || hasAdvancedFilters ? (
        <div className="wro-filter-panel__advanced">
          <div className="wro-filter-field">
            <label htmlFor="filter-warehouse">Kho xuất hàng</label>
            <Select
              id="filter-warehouse"
              style={{ width: "100%" }}
              value={filters.warehouseId}
              placeholder="Tất cả kho xuất"
              allowClear
              onChange={(val) => onChangeFilter("warehouseId", val || "")}
              options={[
                { value: "", label: "Tất cả kho xuất" },
                ...warehouses.map((w) => ({
                  value: w.id || w.warehouseId,
                  label: w.name || w.warehouseName || w.code,
                })),
              ]}
            />
          </div>

          <div className="wro-filter-field">
            <label htmlFor="filter-carrier">Hãng vận chuyển</label>
            <Select
              id="filter-carrier"
              style={{ width: "100%" }}
              value={filters.carrierId}
              placeholder="Tất cả hãng vận chuyển"
              allowClear
              onChange={(val) => onChangeFilter("carrierId", val || "")}
              options={[
                { value: "", label: "Tất cả hãng vận chuyển" },
                ...carriers.map((c) => ({
                  value: c.id || c.carrierId,
                  label: c.name || c.carrierName || c.code,
                })),
              ]}
            />
          </div>

          <div className="wro-filter-field">
            <label htmlFor="filter-daterange">Thời gian tạo</label>
            <RangePicker
              id="filter-daterange"
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              value={filters.dateRange}
              onChange={(dates) => onChangeFilter("dateRange", dates)}
            />
          </div>
        </div>
      ) : null}

      {/* 3. Quick Filter Tag Chips Bar */}
      <div className="wro-filter-panel__bottom">
        <Space wrap size={6}>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 700, marginRight: 4 }}>
            Lọc nhanh:
          </Typography.Text>

          <Tag.CheckableTag
            checked={!filters.status && !filters.customsStatus && !filters.exportType}
            onChange={() => {
              onChangeFilter("status", "");
              onChangeFilter("customsStatus", "");
              onChangeFilter("exportType", "");
            }}
            className="wro-chip-btn"
          >
            Tất cả
          </Tag.CheckableTag>

          <Tag.CheckableTag
            checked={filters.status === "NEEDS_APPROVAL"}
            onChange={(checked) =>
              onChangeFilter("status", checked ? "NEEDS_APPROVAL" : "")
            }
            className="wro-chip-btn"
          >
            Cần duyệt
          </Tag.CheckableTag>

          <Tag.CheckableTag
            checked={filters.customsStatus === "CUSTOMS_PENDING"}
            onChange={(checked) =>
              onChangeFilter("customsStatus", checked ? "CUSTOMS_PENDING" : "")
            }
            className="wro-chip-btn"
          >
            Chờ thông quan
          </Tag.CheckableTag>

          <Tag.CheckableTag
            checked={filters.exportType === "BATCH"}
            onChange={(checked) =>
              onChangeFilter("exportType", checked ? "BATCH" : "")
            }
            className="wro-chip-btn"
          >
            Gom Lô (BATCH)
          </Tag.CheckableTag>

          <Tag.CheckableTag
            checked={filters.exportType === "SINGLE"}
            onChange={(checked) =>
              onChangeFilter("exportType", checked ? "SINGLE" : "")
            }
            className="wro-chip-btn"
          >
            Đơn Lẻ (SINGLE)
          </Tag.CheckableTag>
        </Space>

        <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>
          Tìm thấy <strong style={{ color: "#2563eb" }}>{totalResultCount}</strong> phiếu
        </Typography.Text>
      </div>
    </div>
  );
}
