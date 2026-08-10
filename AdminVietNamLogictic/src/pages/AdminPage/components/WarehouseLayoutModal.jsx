import { Col, Form, Input, InputNumber, Modal, Row, Switch } from "antd";

export default function WarehouseLayoutModal({
  open,
  editingLayout,
  saving,
  layoutForm,
  setLayoutForm,
  onSubmit,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      title={editingLayout ? "Chỉnh Sửa Ô Sơ Đồ Kho" : "Tạo Mới Ô Sơ Đồ Kho (Layout Item)"}
      okText={editingLayout ? "Lưu Cập Nhật" : "Tạo Mới"}
      cancelText="Hủy Bỏ"
      confirmLoading={saving}
      mask={{ closable: !saving }}
      destroyOnHidden
      onOk={onSubmit}
      onCancel={onCancel}
      className="admin-editor-modal"
    >
      <Form layout="vertical">
        <Form.Item label="Mã Khu Vực (Zone Code)" required>
          <Input
            placeholder="VD: A, B, ZONE-01"
            value={layoutForm.zoneCode}
            onChange={(e) => setLayoutForm((prev) => ({ ...prev, zoneCode: e.target.value }))}
          />
        </Form.Item>

        <Form.Item label="Nhãn Hiển Thị (Label)" required>
          <Input
            placeholder="VD: Kệ A-1, Ô B-02"
            value={layoutForm.label}
            onChange={(e) => setLayoutForm((prev) => ({ ...prev, label: e.target.value }))}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Tọa độ Hàng (Grid Row)">
              <InputNumber
                style={{ width: "100%" }}
                min={1}
                value={layoutForm.gridRow}
                onChange={(val) => setLayoutForm((prev) => ({ ...prev, gridRow: val }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Tọa độ Cột (Grid Column)">
              <InputNumber
                style={{ width: "100%" }}
                min={1}
                value={layoutForm.gridColumn}
                onChange={(val) => setLayoutForm((prev) => ({ ...prev, gridColumn: val }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Dung tích tối đa (cm³)">
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={layoutForm.maxVolume}
                onChange={(val) => setLayoutForm((prev) => ({ ...prev, maxVolume: val }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Tải trọng tối đa (kg)">
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={layoutForm.maxWeight}
                onChange={(val) => setLayoutForm((prev) => ({ ...prev, maxWeight: val }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Trạng Thái">
          <Switch
            checked={layoutForm.isActive}
            onChange={(val) => setLayoutForm((prev) => ({ ...prev, isActive: val }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
