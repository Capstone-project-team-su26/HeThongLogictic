import { useEffect, useMemo, useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import {
  BankOutlined,
  EditOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  normalizeCustomerStatus,
  updateCustomerApi,
} from "../../../../api/SaleAPI/CusSale/CusSaleService";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import CustomerAddressSelector from "../CustomerAdress/CustomerAddressSelector";
import "./EditCustomerSale.css";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
  { value: "PENDING", label: "Chờ kích hoạt" },
  { value: "PENDING_VERIFICATION", label: "Chờ xác minh" },
  { value: "BLOCKED", label: "Đã khóa" },
  { value: "SUSPENDED", label: "Tạm ngưng" },
  { value: "DELETED", label: "Đã xóa" },
];

const getDigits = (value) => String(value ?? "").replace(/\D/g, "");
const getNormalizedEmail = (value) => String(value ?? "").trim().toLowerCase();
const getCustomerId = (customer) => String(customer?.id || customer?.customerId || "");

const createUniquePhoneRule = (customers, excludedCustomerId) => ({
  validator: async (_, value) => {
    const phone = getDigits(value);
    if (!phone || phone.length !== 10) return;

    const duplicated = customers.some(
      (item) =>
        getCustomerId(item) !== excludedCustomerId &&
        getDigits(item?.phone) === phone
    );

    if (duplicated) {
      throw new Error("Số điện thoại này đã tồn tại");
    }
  },
});

const createUniqueEmailRule = (customers, excludedCustomerId) => ({
  validator: async (_, value) => {
    const email = getNormalizedEmail(value);
    if (!email) return;

    const duplicated = customers.some(
      (item) =>
        getCustomerId(item) !== excludedCustomerId &&
        getNormalizedEmail(item?.email) === email
    );

    if (duplicated) {
      throw new Error("Email này đã tồn tại");
    }
  },
});

const getCustomerFormValues = (customer = {}) => {
  const raw = customer?.raw || customer || {};
  return {
    fullName: customer?.fullName || raw?.fullName || "",
    phone: customer?.phone || raw?.phone || "",
    email: customer?.email || raw?.email || "",
    address: customer?.address || raw?.address || "",
    companyName: customer?.companyName || raw?.companyName || "",
    taxId: customer?.taxId || raw?.taxId || "",
    status: normalizeCustomerStatus(customer?.status || raw?.status) || "ACTIVE",
  };
};

export default function EditCustomerSale({
  open,
  customer,
  customers = [],
  onClose,
  onSaved,
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const customerId = customer?.id || customer?.customerId || "";

  const initialValues = useMemo(
    () => getCustomerFormValues(customer),
    [customer]
  );
  const [displayValues, setDisplayValues] = useState(initialValues);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
      form.resetFields();
      form.setFieldsValue(initialValues);
      setDisplayValues(initialValues);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [customerId, form, initialValues, open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const result = await updateCustomerApi(customerId, values);
      AuthNotify.success("Cập nhật thành công", "Thông tin và trạng thái khách hàng đã được lưu.");
      onSaved?.(result);
    } catch (error) {
      if (error?.errorFields) return;
      AuthNotify.error(
        "Không thể cập nhật khách hàng",
        error?.response?.data?.message || error?.response?.data?.error || error?.message || "Vui lòng thử lại."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      width={780}
      centered
      destroyOnHidden
      title={null}
      okText="Lưu thay đổi"
      cancelText="Hủy"
      confirmLoading={saving}
      okButtonProps={{ icon: <SaveOutlined /> }}
      className="edit-customer-sale-modal"
      onOk={handleSubmit}
      onCancel={() => !saving && onClose?.()}
    >
      <div className="edit-customer-sale">
        <header className="edit-customer-sale__hero">
          <div className="edit-customer-sale__icon"><EditOutlined /></div>
          <div>
            <span>CHỈNH SỬA KHÁCH HÀNG</span>
            <h2>{displayValues.fullName || "Hồ sơ khách hàng"}</h2>
            <p>Cập nhật thông tin liên hệ, doanh nghiệp và trạng thái hoạt động.</p>
          </div>
          <div className={`edit-customer-sale__status is-${displayValues.status.toLowerCase()}`}>
            <SafetyCertificateOutlined />
            {STATUS_OPTIONS.find((item) => item.value === displayValues.status)?.label || displayValues.status}
          </div>
        </header>

        <Form form={form} layout="vertical" preserve={false} className="edit-customer-sale__form">
          <div className="edit-customer-sale__grid">
            <Form.Item name="fullName" label="Tên khách hàng" rules={[{ required: true, message: "Vui lòng nhập tên khách hàng" }]}>
              <Input prefix={<TeamOutlined />} />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái hiện tại" rules={[{ required: true }]}>
              <Select suffixIcon={<SafetyCertificateOutlined />} options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              validateTrigger={["onChange", "onBlur"]}
              rules={[
                { required: true, message: "Vui lòng nhập số điện thoại" },
                {
                  pattern: /^0\d{9}$/,
                  message: "Số điện thoại phải bắt đầu bằng số 0 và gồm đúng 10 chữ số",
                },
                createUniquePhoneRule(customers, customerId),
              ]}
            >
              <Input
                prefix={<PhoneOutlined />}
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => {
                  form.setFieldValue("phone", getDigits(event.target.value).slice(0, 10));
                }}
              />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
              validateTrigger={["onChange", "onBlur"]}
              rules={[
                { required: true, message: "Vui lòng nhập email" },
                { type: "email", message: "Email không hợp lệ" },
                createUniqueEmailRule(customers, customerId),
              ]}
            >
              <Input prefix={<MailOutlined />} />
            </Form.Item>
            <Form.Item name="companyName" label="Tên công ty">
              <Input prefix={<BankOutlined />} />
            </Form.Item>
            <Form.Item name="taxId" label="Mã số thuế">
              <Input prefix={<IdcardOutlined />} />
            </Form.Item>
            <Form.Item name="address" label="Địa chỉ" className="is-full">
              <CustomerAddressSelector
                key={displayValues.address}
                initialAddress={displayValues.address}
                onAddressChange={(address) => form.setFieldValue("address", address)}
              />
            </Form.Item>
          </div>
        </Form>
      </div>
    </Modal>
  );
}
