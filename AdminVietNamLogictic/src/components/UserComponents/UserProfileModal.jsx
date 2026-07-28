import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Button, Col, Form, Input, Modal, Row, Spin, Tag } from "antd";
import {
  CalendarOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  getUserProfileApi,
  updateUserProfileApi,
} from "../../api/Auth/authService";
import AuthNotify from "../../utils/Common/AuthNotify";
import VietnamAddressSelector from "../AddressComponents/VietnamAddressSelector";
import "./UserProfileModal.css";

const normalizeText = (value) => String(value ?? "").trim();

const pickValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && normalizeText(value)) {
      return value;
    }
  }
  return "";
};

const unwrapProfileData = (response) => {
  const data = response?.data?.data ?? response?.data ?? response ?? {};
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};

  const nested = data?.profile || data?.user || data?.userInfo || data?.account;
  return nested && typeof nested === "object"
    ? { ...data, ...nested }
    : data;
};

const normalizeProfile = (value = {}) => {
  const data = unwrapProfileData(value);
  const isActive =
    typeof data?.isActive === "boolean"
      ? data.isActive
      : undefined;

  return {
    ...data,
    id: normalizeText(
      pickValue(data?.id, data?.userId, data?.accountId, data?.profileId)
    ),
    fullName: normalizeText(
      pickValue(data?.fullName, data?.name, data?.displayName, data?.userName)
    ),
    email: normalizeText(
      pickValue(data?.email, data?.emailAddress, data?.userEmail)
    ),
    phone: normalizeText(
      pickValue(data?.phone, data?.phoneNumber, data?.mobile)
    ),
    role: normalizeText(
      pickValue(data?.roleName, data?.role, data?.userRole)
    ),
    region: normalizeText(pickValue(data?.region, data?.area)),
    country: normalizeText(pickValue(data?.country, data?.nation)),
    address: normalizeText(
      pickValue(data?.address, data?.fullAddress, data?.location)
    ),
    status: normalizeText(
      pickValue(data?.status, data?.accountStatus)
    ),
    isActive,
    createdAt: pickValue(data?.createdAt, data?.createdDate, data?.createdOn),
    updatedAt: pickValue(data?.updatedAt, data?.updatedDate, data?.modifiedAt),
  };
};

const mergeProfileData = (currentProfile = {}, nextProfile = {}) => {
  const meaningfulEntries = Object.entries(nextProfile).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    return typeof value !== "string" || normalizeText(value) !== "";
  });

  return normalizeProfile({
    ...currentProfile,
    ...Object.fromEntries(meaningfulEntries),
  });
};

const getStoredUser = () => {
  try {
    return normalizeProfile(JSON.parse(sessionStorage.getItem("user") || "{}"));
  } catch {
    return {};
  }
};

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.title ||
  error?.message ||
  fallbackMessage;

const getAvatarText = (fullName) => {
  const words = normalizeText(fullName).split(/\s+/).filter(Boolean);
  if (!words.length) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words.at(-1)[0]}`.toUpperCase();
};

const ROLE_LABELS = {
  admin: "Quản trị viên",
  administrator: "Quản trị viên",
  sale: "Nhân viên kinh doanh",
  salesstaff: "Nhân viên kinh doanh",
  operationsmanager: "Quản lý vận hành",
};

const getRoleLabel = (role) => {
  const normalizedRole = normalizeText(role)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ROLE_LABELS[normalizedRole] || normalizeText(role) || "Người dùng";
};

const getStatusInfo = (profile = {}) => {
  if (profile?.isActive === true) {
    return { label: "Đang hoạt động", color: "success" };
  }
  if (profile?.isActive === false) {
    return { label: "Ngừng hoạt động", color: "error" };
  }

  const status = normalizeText(profile?.status)
    .replace(/[\s_-]+/g, "")
    .toUpperCase();
  const statuses = {
    ACTIVE: { label: "Đang hoạt động", color: "success" },
    INACTIVE: { label: "Ngừng hoạt động", color: "error" },
    BLOCKED: { label: "Đã khóa", color: "error" },
    SUSPENDED: { label: "Tạm ngưng", color: "warning" },
    PENDING: { label: "Chờ kích hoạt", color: "processing" },
    PENDINGVERIFICATION: { label: "Chờ xác minh", color: "processing" },
  };
  return statuses[status] || {
    label: normalizeText(profile?.status) || "Chưa cập nhật",
    color: "default",
  };
};

const formatDateTime = (value) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const updateSessionUser = (updatedProfile, payload) => {
  const storedUser = getStoredUser();
  const nextUser = normalizeProfile({
    ...storedUser,
    ...updatedProfile,
    fullName: updatedProfile?.fullName || payload?.fullName || storedUser?.fullName,
    phone: updatedProfile?.phone ?? payload?.phone ?? storedUser?.phone,
    country: updatedProfile?.country ?? payload?.country ?? storedUser?.country,
    address: updatedProfile?.address ?? payload?.address ?? storedUser?.address,
  });
  sessionStorage.setItem("user", JSON.stringify(nextUser));
  return nextUser;
};

function ProfileInfoItem({ icon, label, value, wide = false, mono = false }) {
  return (
    <div className={`profile-info-item${wide ? " is-wide" : ""}`}>
      <span className="profile-info-item__icon">{icon}</span>
      <span className="profile-info-item__content">
        <small>{label}</small>
        <strong className={mono ? "is-mono" : ""} title={normalizeText(value)}>
          {normalizeText(value) || "Chưa cập nhật"}
        </strong>
      </span>
    </div>
  );
}

export default function UserProfileModal({ open, onClose, onUpdated }) {
  const [form] = Form.useForm();
  const [profile, setProfile] = useState(() => getStoredUser());
  const [fetching, setFetching] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fullName = profile?.fullName || profile?.email || "Người dùng";
  const roleName = getRoleLabel(
    profile?.role || sessionStorage.getItem("role")
  );
  const statusInfo = useMemo(() => getStatusInfo(profile), [profile]);
  const avatarText = useMemo(() => getAvatarText(fullName), [fullName]);

  const setProfileFormValues = useCallback(
    (data = {}) => {
      form.setFieldsValue({
        fullName: data?.fullName || "",
        phone: data?.phone || "",
        country: data?.country || "",
        address: data?.address || "",
      });
    },
    [form]
  );

  const fetchProfile = useCallback(async () => {
    const cachedProfile = getStoredUser();
    setProfile(cachedProfile);
    setProfileFormValues(cachedProfile);

    try {
      setFetching(true);
      const response = await getUserProfileApi();
      const apiProfile = normalizeProfile(response);
      const mergedProfile = mergeProfileData(cachedProfile, apiProfile);
      setProfile(mergedProfile);
      setProfileFormValues(mergedProfile);
      updateSessionUser(mergedProfile, mergedProfile);
    } catch (error) {
      AuthNotify.error(
        "Không tải được thông tin mới nhất",
        getErrorMessage(error, "Đang hiển thị thông tin đã lưu từ phiên đăng nhập.")
      );
    } finally {
      setFetching(false);
    }
  }, [setProfileFormValues]);

  useEffect(() => {
    if (!open) return undefined;

    const timeoutId = window.setTimeout(fetchProfile, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchProfile, open]);

  const handleCancel = () => {
    if (updating) return;
    form.resetFields();
    onClose?.();
  };

  const handleUpdate = async () => {
    if (updating) return;

    try {
      const values = await form.validateFields();
      setUpdating(true);
      const payload = {
        fullName: normalizeText(values?.fullName),
        phone: normalizeText(values?.phone),
        country: normalizeText(values?.country),
        address: normalizeText(values?.address),
      };

      const response = await updateUserProfileApi(payload);
      let updatedProfile = normalizeProfile(response);

      if (!updatedProfile?.fullName && !updatedProfile?.email) {
        updatedProfile = normalizeProfile(await getUserProfileApi());
      }

      const mergedProfile = normalizeProfile({
        ...mergeProfileData(profile, updatedProfile),
        ...payload,
      });
      setProfile(mergedProfile);
      setProfileFormValues(mergedProfile);
      updateSessionUser(mergedProfile, payload);
      onUpdated?.(mergedProfile);
      AuthNotify.success(
        "Cập nhật thành công",
        "Thông tin cá nhân đã được cập nhật."
      );
    } catch (error) {
      if (error?.errorFields) return;
      AuthNotify.error(
        "Cập nhật thất bại",
        getErrorMessage(error, "Không thể cập nhật thông tin cá nhân.")
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      centered
      width={820}
      destroyOnHidden
      closable={!updating}
      keyboard={!updating}
      mask={{ closable: false }}
      className="user-profile-modal"
    >
      <div className="profile-modal__content">
        <header className="profile-header">
          <Avatar size={76} className="profile-avatar">
            {avatarText}
          </Avatar>
          <div className="profile-header__content">
            <span className="profile-header__eyebrow">HỒ SƠ NGƯỜI DÙNG</span>
            <h2>{fullName}</h2>
            <p>{profile?.email || "Chưa cập nhật email"}</p>
          </div>
          <div className="profile-header__badges">
            <Tag icon={<TeamOutlined />} color="blue">{roleName}</Tag>
            <Tag icon={<SafetyCertificateOutlined />} color={statusInfo.color}>
              {statusInfo.label}
            </Tag>
          </div>
        </header>

        {fetching && (
          <div className="profile-refreshing">
            <Spin size="small" />
            <span>Đang đồng bộ thông tin mới nhất từ hệ thống...</span>
          </div>
        )}

            <section className="profile-section">
              <div className="profile-section__heading">
                <IdcardOutlined />
                <div>
                  <h3>Thông tin tài khoản</h3>
                  <p>Dữ liệu được lấy trực tiếp từ hồ sơ người dùng.</p>
                </div>
              </div>
              <div className="profile-info-grid">
                <ProfileInfoItem icon={<MailOutlined />} label="Email" value={profile?.email} />
                <ProfileInfoItem icon={<PhoneOutlined />} label="Số điện thoại" value={profile?.phone} />
                <ProfileInfoItem icon={<TeamOutlined />} label="Vai trò" value={roleName} />
                <ProfileInfoItem icon={<SafetyCertificateOutlined />} label="Trạng thái" value={statusInfo.label} />
                <ProfileInfoItem icon={<EnvironmentOutlined />} label="Khu vực" value={profile?.region} />
                <ProfileInfoItem icon={<GlobalOutlined />} label="Quốc gia" value={profile?.country} />
                <ProfileInfoItem icon={<IdcardOutlined />} label="Mã người dùng" value={profile?.id} mono />
                <ProfileInfoItem icon={<CalendarOutlined />} label="Ngày tạo" value={formatDateTime(profile?.createdAt)} />
                <ProfileInfoItem icon={<CalendarOutlined />} label="Cập nhật gần nhất" value={formatDateTime(profile?.updatedAt)} />
                <ProfileInfoItem icon={<EnvironmentOutlined />} label="Địa chỉ" value={profile?.address} wide />
              </div>
            </section>

            <section className="profile-section profile-section--form">
              <div className="profile-section__heading">
                <UserOutlined />
                <div>
                  <h3>Cập nhật thông tin cá nhân</h3>
                  <p>Email, vai trò và trạng thái do hệ thống quản lý.</p>
                </div>
              </div>

              <Form
                form={form}
                layout="vertical"
                className="profile-form"
                requiredMark={false}
                autoComplete="off"
                preserve={false}
              >
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="fullName"
                      label="Họ và tên"
                      rules={[
                        { required: true, whitespace: true, message: "Vui lòng nhập họ và tên." },
                        { min: 2, message: "Họ và tên phải có ít nhất 2 ký tự." },
                        { max: 100, message: "Họ và tên không được vượt quá 100 ký tự." },
                      ]}
                    >
                      <Input prefix={<UserOutlined />} size="large" maxLength={100} disabled={updating} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="phone"
                      label="Số điện thoại"
                      rules={[
                        {
                          pattern: /^0\d{9}$/,
                          message: "Số điện thoại phải bắt đầu bằng 0 và gồm đúng 10 chữ số.",
                        },
                      ]}
                    >
                      <Input
                        prefix={<PhoneOutlined />}
                        size="large"
                        maxLength={10}
                        inputMode="numeric"
                        disabled={updating}
                        onChange={(event) => {
                          form.setFieldValue(
                            "phone",
                            event.target.value.replace(/\D/g, "").slice(0, 10)
                          );
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="country" label="Quốc gia" rules={[{ max: 100 }]}>
                      <Input prefix={<GlobalOutlined />} size="large" maxLength={100} disabled={updating} />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="address" hidden rules={[{ max: 255 }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item label="Địa chỉ Việt Nam">
                      <VietnamAddressSelector
                        key={profile?.address || "empty-address"}
                        initialAddress={profile?.address || ""}
                        disabled={updating}
                        onAddressChange={(address) => {
                          form.setFieldsValue({
                            address,
                            country: address
                              ? form.getFieldValue("country") || "Việt Nam"
                              : form.getFieldValue("country"),
                          });
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <div className="profile-form__actions">
                  <Button size="large" onClick={handleCancel} disabled={updating}>
                    Đóng
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<SaveOutlined />}
                    loading={updating}
                    onClick={handleUpdate}
                    className="profile-save-btn"
                  >
                    Lưu thay đổi
                  </Button>
                </div>
              </Form>
            </section>
      </div>
    </Modal>
  );
}
