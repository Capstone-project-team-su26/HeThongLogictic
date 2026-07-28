import { useEffect, useMemo, useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import {
  BankOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import {
  createCustomerApi,
  updateCustomerApi,
} from "../../../../api/SaleAPI/CusSale/CusSaleService";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import CustomerAddressSelector from "../CustomerAdress/CustomerAddressSelector";
import "./CreateCustomerSale.css";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
  { value: "PENDING", label: "Chờ kích hoạt" },
  { value: "BLOCKED", label: "Đã khóa" },
  { value: "SUSPENDED", label: "Tạm ngưng" },
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

const getInitialValues = (customer) => {
  const raw = customer?.raw || customer || {};
  return {
    fullName: customer?.fullName || raw?.fullName || "",
    phone: customer?.phone || raw?.phone || "",
    email: customer?.email || raw?.email || "",
    address: customer?.address || raw?.address || "",
    companyName: customer?.companyName || raw?.companyName || "",
    taxId: customer?.taxId || raw?.taxId || "",
    status: customer?.status || raw?.status || "ACTIVE",
  };
};

export default function CreateCustomerSale({
  open,
  customer = null,
  customers = [],
  onClose,
  onSaved,
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(customer?.id || customer?.customerId);
  const customerId = getCustomerId(customer);
  const initialValues = useMemo(
    () => getInitialValues(customer),
    [customer]
  );

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(initialValues);
  }, [form, initialValues, open]);

  const handleCancel = () => {
    if (saving) return;
    form.resetFields();
    onClose?.();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const savedCustomer = isEditing
        ? await updateCustomerApi(
            customer.id || customer.customerId,
            values
          )
        : await createCustomerApi({
            ...values,
            status: "ACTIVE",
          });

      AuthNotify.success(
        isEditing ? "Cập nhật thành công" : "Tạo khách hàng thành công",
        isEditing
          ? "Thông tin khách hàng đã được lưu."
          : "Khách hàng mới đã được thêm vào hệ thống."
      );

      form.resetFields();
      onSaved?.(
        savedCustomer && typeof savedCustomer === "object"
          ? savedCustomer
          : {
              ...values,
              status: isEditing ? values.status : "ACTIVE",
            }
      );
    } catch (error) {
      if (error?.errorFields) return;
      AuthNotify.error(
        "Không thể lưu khách hàng",
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Vui lòng kiểm tra thông tin và thử lại."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      width={760}
      centered
      destroyOnHidden
      title={null}
      okText={isEditing ? "Lưu thay đổi" : "Tạo khách hàng"}
      cancelText="Hủy"
      confirmLoading={saving}
      className="create-customer-sale-modal"
      onOk={handleSubmit}
      onCancel={handleCancel}
    >
      <div className="create-customer-sale">
        <header className="create-customer-sale__hero">
          <div className="create-customer-sale__hero-icon">
            {isEditing ? <TeamOutlined /> : <UserAddOutlined />}
          </div>
          <div>
            <span>QUẢN LÝ KHÁCH HÀNG</span>
            <h2>{isEditing ? "Cập nhật hồ sơ" : "Thêm khách hàng mới"}</h2>
            <p>
              {isEditing
                ? "Điều chỉnh thông tin liên hệ và trạng thái khách hàng."
                : "Tạo hồ sơ khách hàng để đội ngũ kinh doanh dễ dàng theo dõi."}
            </p>
          </div>
        </header>

        <Form
          form={form}
          layout="vertical"
          preserve={false}
          className="create-customer-sale__form"
        >
          <section className="create-customer-sale__section">
            <div className="create-customer-sale__section-title">
              <UserAddOutlined />
              <div><strong>Thông tin liên hệ</strong><span>Các trường có dấu * là bắt buộc</span></div>
            </div>
            <div className="create-customer-sale__grid">
              <Form.Item name="fullName" label="Tên khách hàng" rules={[{ required: true, message: "Vui lòng nhập tên khách hàng" }]}>
                <Input prefix={<TeamOutlined />} placeholder="Nguyễn Văn A" />
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
                  placeholder="0901234567"
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
                <Input prefix={<MailOutlined />} placeholder="customer@company.vn" />
              </Form.Item>
              {isEditing ? (
                <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
                  <Select
                    suffixIcon={<SafetyCertificateOutlined />}
                    options={STATUS_OPTIONS}
                  />
                </Form.Item>
              ) : (
                <>
                  <Form.Item name="status" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item label="Trạng thái mặc định">
                    <div className="create-customer-sale__fixed-status" role="status">
                      <span className="create-customer-sale__status-icon">
                        <SafetyCertificateOutlined />
                      </span>
                      <span className="create-customer-sale__status-copy">
                        <strong>Đang hoạt động</strong>
                        <small>Tự động áp dụng khi tạo khách hàng</small>
                      </span>
                    </div>
                  </Form.Item>
                </>
              )}
              <Form.Item name="address" label="Địa chỉ" className="is-full">
                <CustomerAddressSelector
                  initialAddress={initialValues.address}
                  onAddressChange={(address) => {
                    form.setFieldValue("address", address);
                  }}
                />
              </Form.Item>
            </div>
          </section>

          <section className="create-customer-sale__section is-company">
            <div className="create-customer-sale__section-title">
              <BankOutlined />
              <div><strong>Thông tin doanh nghiệp</strong><span>Có thể bổ sung sau nếu là khách hàng cá nhân</span></div>
            </div>
            <div className="create-customer-sale__grid">
              <Form.Item name="companyName" label="Tên công ty">
                <Input prefix={<BankOutlined />} placeholder="Công ty TNHH..." />
              </Form.Item>
              <Form.Item name="taxId" label="Mã số thuế">
                <Input prefix={<IdcardOutlined />} placeholder="Nhập mã số thuế" />
              </Form.Item>
            </div>
          </section>

          <div className="create-customer-sale__note">
            <EnvironmentOutlined />
            Dữ liệu sẽ được đồng bộ vào danh sách khách hàng ngay sau khi lưu.
          </div>
        </Form>
      </div>
    </Modal>
  );
}
