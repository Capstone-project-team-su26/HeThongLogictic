import { Alert, Col, Form, Input, InputNumber, Modal, Row, Switch } from "antd";

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
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Ô sơ đồ gắn vào khu đã có của kho."
          description="Nhãn trùng mã ô kệ (hoặc mã kệ) trong khu thì ô sơ đồ gắn thẳng vào ô kệ/kệ đó. Sức chứa khai ở ô kệ, không khai ở ô sơ đồ."
        />
        <Form.Item label="Khu Vực (tên hoặc mã khu)" required>
          <Input
            placeholder="VD: Khu A, KHO_NHAN"
            value={layoutForm.zoneCode}
            onChange={(e) => setLayoutForm((prev) => ({ ...prev, zoneCode: e.target.value }))}
          />
        </Form.Item>

        <Form.Item label="Nhãn Hiển Thị (Label)" required>
          <Input
            placeholder="VD: mã ô kệ B01, mã kệ S01"
            value={layoutForm.label}
            onChange={(e) => setLayoutForm((prev) => ({ ...prev, label: e.target.value }))}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Tọa độ Hàng (Grid Row)">
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={layoutForm.gridRow}
                onChange={(val) => setLayoutForm((prev) => ({ ...prev, gridRow: val }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Tọa độ Cột (Grid Column)">
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                value={layoutForm.gridColumn}
                onChange={(val) => setLayoutForm((prev) => ({ ...prev, gridColumn: val }))}
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
