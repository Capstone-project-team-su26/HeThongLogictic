import { AutoComplete, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Typography } from "antd";

const { Text } = Typography;

const renderFieldLabel = (label, isRequired = true) => (
  <span className="custom-label-right-star">
    {label}
    {isRequired && (
      <span style={{ color: "#ff4d4f", fontWeight: "bold", marginLeft: 4 }}>*</span>
    )}
  </span>
);

export default function WarehouseLocationModal({
  open,
  editingLocation,
  saving,
  locationForm,
  setLocationForm,
  existingZones = [],
  isZonePreset = false,
  isShelfPreset = false,
  onSubmit,
  onCancel,
}) {
  const zoneOptions = existingZones.map((z) => ({ value: z, label: `Khu vực ${z}` }));

  return (
    <Modal
      open={open}
      title={editingLocation ? "Chỉnh Sửa Vị Trí Lưu Trữ Kho" : "Thêm Mới Vị Trí Kho (Location)"}
      okText={editingLocation ? "Lưu Thay Đổi" : "Tạo Vị Trí"}
      cancelText="Hủy Bỏ"
      confirmLoading={saving}
      mask={{ closable: !saving }}
      destroyOnHidden
      onOk={onSubmit}
      onCancel={onCancel}
      className="admin-editor-modal"
    >
      <Form layout="vertical" requiredMark={false}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label={renderFieldLabel("Khu Vực (Zone)", !isZonePreset)}>
              <Input
                disabled={isZonePreset}
                placeholder="VD: Khu A, Khu B, KHO_NHAN"
                value={locationForm.zoneName}
                onChange={(e) =>
                  setLocationForm((prev) => ({ ...prev, zoneName: e.target.value }))
                }
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label={renderFieldLabel("Mã Kệ Lưu Trữ (Shelf)", !isShelfPreset)}>
              <Input
                disabled={isShelfPreset}
                placeholder="VD: S01, S02, K01"
                value={locationForm.shelfCode}
                onChange={(e) =>
                  setLocationForm((prev) => ({ ...prev, shelfCode: e.target.value }))
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label={renderFieldLabel("Mã Ô Chứa Hàng (Bin Code)", true)}>
          <Input
            placeholder="VD: B01, B02, A-01-02"
            value={locationForm.binCode}
            onChange={(e) =>
              setLocationForm((prev) => ({ ...prev, binCode: e.target.value }))
            }
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label={renderFieldLabel("Dung tích tối đa (cm³)", true)}>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                placeholder="VD: 5000"
                value={locationForm.maxVolume}
                onChange={(val) => setLocationForm((prev) => ({ ...prev, maxVolume: val }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={renderFieldLabel("Tải trọng tối đa (kg)", true)}>
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                placeholder="VD: 500"
                value={locationForm.maxWeight}
                onChange={(val) => setLocationForm((prev) => ({ ...prev, maxWeight: val }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Trạng Thái Hoạt Động">
          <Space align="center">
            <Switch
              checked={locationForm.isActive}
              onChange={(val) => setLocationForm((prev) => ({ ...prev, isActive: val }))}
            />
            <Text>{locationForm.isActive ? "Hoạt động (Cho phép chứa hàng)" : "Tạm khóa (Ngừng sử dụng)"}</Text>
          </Space>
        </Form.Item>

        <Form.Item label={renderFieldLabel("Ghi Chú Vị Trí", true)}>
          <Input.TextArea
            rows={2}
            placeholder="Nhập ghi chú bắt buộc cho vị trí kho này (VD: Khu vực dễ vỡ, bảo quản thoáng mát...)"
            value={locationForm.note}
            onChange={(e) => setLocationForm((prev) => ({ ...prev, note: e.target.value }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
