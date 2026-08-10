import { Badge, Card, Col, Empty, Modal, Row, Table, Tag, Typography } from "antd";
import {
  InboxOutlined,
  UserOutlined,
  CalendarOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { formatVietnamDateTime } from "../../../utils/timeUtc";

const { Text, Title } = Typography;

const formatNumber = (num, decimals = 0) => {
  if (num == null || isNaN(num)) return "0";
  return Number(num).toLocaleString("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export default function BinInventoryModal({
  open,
  binData,
  inventoryItems = [],
  onClose,
}) {
  if (!binData) return null;

  const binCode = binData.binCode || binData.code || "Ô CHỨA HÀNG";
  const zoneName = binData.zoneName || binData.zoneCode || "Khu vực";
  const shelfCode = binData.shelfCode || "Kệ";

  // Calculate stats for items in this bin
  const totalQuantity = inventoryItems.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
  const totalWeight = inventoryItems.reduce((acc, item) => acc + (Number(item.actualWeight) || 0), 0);
  const totalVolume = inventoryItems.reduce((acc, item) => acc + (Number(item.actualVolume) || 0), 0);

  const columns = [
    {
      title: "Mã Kiện & Lô Ký Gửi",
      key: "packageCode",
      width: 220,
      render: (_, record) => (
        <div>
          <div>
            <Text strong style={{ color: "#1e40af", fontSize: 14 }}>
              📦 {record.packageCode || record.parcelId || "KHIEN_HANG"}
            </Text>
          </div>
          {record.consignmentCode && (
            <div style={{ marginTop: 2 }}>
              <Tag color="cyan" style={{ fontSize: 11 }}>
                Lô: {record.consignmentCode}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Khách Hàng Owning",
      key: "customer",
      width: 200,
      render: (_, record) => (
        <div>
          <div>
            <UserOutlined style={{ color: "#2563eb", marginRight: 4 }} />
            <Text strong style={{ color: "#0f172a" }}>
              {record.customerName || "Khách hàng VCL"}
            </Text>
          </div>
          {record.customerCode && (
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Mã KH: {record.customerCode}
            </div>
          )}
          {record.customerPhone && (
            <div style={{ fontSize: 11, color: "#475569" }}>
              <PhoneOutlined style={{ marginRight: 3, fontSize: 10 }} />
              {record.customerPhone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Số Lượng",
      dataIndex: "quantity",
      key: "quantity",
      width: 90,
      align: "center",
      render: (val) => <Tag color="blue" style={{ fontWeight: 700 }}>{val || 1} kiện</Tag>,
    },
    {
      title: "Trạng Thái Kho",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status) => {
        if (status === "RESERVED") {
          return <Tag color="gold" style={{ fontWeight: 700 }}>Đã Giữ Chỗ (RESERVED)</Tag>;
        }
        if (status === "AVAILABLE") {
          return <Tag color="green" style={{ fontWeight: 700 }}>Sẵn Sàng (AVAILABLE)</Tag>;
        }
        return <Tag color="blue" style={{ fontWeight: 700 }}>{status || "LƯU KHO"}</Tag>;
      },
    },
    {
      title: "Trọng Lượng & Thể Tích",
      key: "dimensions",
      width: 180,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>⚖️ Trọng lượng: <Text strong>{formatNumber(record.actualWeight, 2)} kg</Text></div>
          <div>📐 Thể tích: <Text strong style={{ color: "#2563eb" }}>{formatNumber(record.actualVolume)} cm³</Text></div>
        </div>
      ),
    },
    {
      title: "Thời Gian Nhập Kho (UTC+7)",
      key: "storageTime",
      width: 180,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>
            <CalendarOutlined style={{ color: "#2563eb", marginRight: 4 }} />
            <Text type="secondary" style={{ fontWeight: 600 }}>
              {formatVietnamDateTime(record.storedAt || record.createdAt)}
            </Text>
          </div>
          {(record.storageDays > 0 || record.storageHours > 0) && (
            <div style={{ marginTop: 2 }}>
              <Tag color="purple" style={{ fontSize: 11 }}>
                Lưu: {record.storageDays || 0} ngày {record.storageHours || 0} giờ
              </Tag>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 18,
            }}
          >
            <InboxOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: "#0f172a" }}>
              Danh Sách Kiện Hàng Tại Ô: <Text style={{ color: "#2563eb" }}>{binCode}</Text>
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Thuộc Khu Vực: <Text strong>{zoneName}</Text> · Kệ Lưu Trữ: <Text strong>{shelfCode}</Text>
            </Text>
          </div>
        </div>
      }
      width={980}
      footer={null}
      onCancel={onClose}
      className="admin-bin-inventory-modal"
    >
      {/* Bin Summary KPI Pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          borderRadius: 14,
          border: "1px solid #cbd5e1",
          margin: "16px 0 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tag color="blue" style={{ fontSize: 13, padding: "4px 12px", borderRadius: 8, fontWeight: 700 }}>
            📦 Tổng Số Kiện: {inventoryItems.length} mã ({totalQuantity} đơn)
          </Tag>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 13, color: "#475569" }}>
            ⚖️ Tổng trọng lượng: <Text strong style={{ color: "#0f172a" }}>{formatNumber(totalWeight, 2)} kg</Text>
          </div>
          <div style={{ fontSize: 13, color: "#475569" }}>
            📐 Tổng thể tích: <Text strong style={{ color: "#2563eb" }}>{formatNumber(totalVolume)} cm³</Text>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      {inventoryItems.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              Hiện chưa có kiện hàng nào được nhập vào ô <Text strong>{binCode}</Text>.
            </span>
          }
          style={{ margin: "32px 0" }}
        />
      ) : (
        <Table
          rowKey={(record) => record.inventoryId || record.parcelId}
          columns={columns}
          dataSource={inventoryItems}
          pagination={false}
          size="middle"
          bordered
          scroll={{ x: 800 }}
        />
      )}
    </Modal>
  );
}
