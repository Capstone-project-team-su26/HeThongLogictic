import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import {
  EmailOutlined,
  LockOutlined,
  PublicOutlined,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  ArrowRightOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Button } from "antd";

import { loginApi } from "../../api/Auth/authService";
import AuthNotify from "../../utils/Common/AuthNotify";
import { clearAuthSession } from "../../utils/Common/authSession";
import LoginLoaderPay from "../../utils/LoginLoader/LoginLoaderPay";

import "./login.css";

const ROLE_ROUTES = {
  sale: "/sale",
  sales: "/sale",
  salestaff: "/sale",

  admin: "/admin",
  administrator: "/admin",

  operationsmanager: "/operations-manager",
  operationmanager: "/operations-manager",
};

const normalizeRole = (role) => {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const getLoginData = (response) => {
  return response?.data?.data ?? response?.data ?? response ?? {};
};

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((previous) => ({
        ...previous,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const email = form.email.trim();
    const password = form.password;

    const nextErrors = {
      email: "",
      password: "",
    };

    if (!email) {
      nextErrors.email = "Vui lòng nhập email nội bộ.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Email không đúng định dạng.";
    }

    if (!password.trim()) {
      nextErrors.password = "Vui lòng nhập mật khẩu.";
    } else if (password.length < 6) {
      nextErrors.password = "Mật khẩu phải có ít nhất 6 ký tự.";
    }

    setErrors(nextErrors);

    return !nextErrors.email && !nextErrors.password;
  };

  const saveLoginSession = ({
    token,
    refreshToken,
    expiresAt,
    user,
    normalizedRole,
  }) => {
    sessionStorage.setItem("accessToken", token);
    sessionStorage.setItem("user", JSON.stringify(user));
    sessionStorage.setItem("role", normalizedRole);
    sessionStorage.setItem("isAuth", "true");

    if (refreshToken) {
      sessionStorage.setItem("refreshToken", refreshToken);
    }

    if (expiresAt) {
      sessionStorage.setItem(
        "tokenExpiresAt",
        String(expiresAt)
      );
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    try {
      setLoading(true);
      clearAuthSession();

      const response = await loginApi({
        email: form.email.trim(),
        password: form.password,
      });

      const data = getLoginData(response);

      console.log("LOGIN RESPONSE:", data);

      const token =
        data?.token ||
        data?.accessToken ||
        data?.access_token ||
        data?.jwtToken;

      const refreshToken =
        data?.refreshToken ||
        data?.refresh_token ||
        data?.refresh;

      const user =
        data?.user ||
        data?.userInfo ||
        data?.profile ||
        data?.account ||
        {
          userId: data?.userId || data?.id || "",
          fullName: data?.fullName || data?.name || "",
          email: data?.email || form.email.trim(),
          role: data?.role || data?.roleName || "",
          region: data?.region || "",
        };

      const roleName =
        user?.roleName ||
        user?.role ||
        data?.roleName ||
        data?.role ||
        data?.userRole;

      if (!token) {
        throw new Error(
          "API đăng nhập không trả về access token."
        );
      }

      if (!roleName) {
        throw new Error(
          "API không trả về vai trò người dùng."
        );
      }

      const normalizedRole = normalizeRole(roleName);
      const redirectPath = ROLE_ROUTES[normalizedRole];

      if (!redirectPath) {
        throw new Error(
          `Vai trò "${
            roleName || "không xác định"
          }" không có quyền truy cập hệ thống quản trị.`
        );
      }

      const normalizedUser = {
        ...user,
        role: roleName,
        email: user?.email || form.email.trim(),
      };

      saveLoginSession({
        token,
        refreshToken,
        expiresAt:
          data?.expiresAt ||
          data?.expiredAt ||
          data?.expiration,
        user: normalizedUser,
        normalizedRole,
      });

      AuthNotify.success(
        "Đăng nhập thành công",
        `Chào mừng ${
          normalizedUser?.fullName ||
          normalizedUser?.name ||
          normalizedUser?.email
        }.`
      );

      navigate(redirectPath, {
        replace: true,
      });
    } catch (error) {
      console.error("LOGIN ERROR:", error);

      clearAuthSession();

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.title ||
        error?.message ||
        "Email hoặc mật khẩu không chính xác.";

      AuthNotify.error(
        "Đăng nhập thất bại",
        message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      {loading && <LoginLoaderPay />}

      <section
        className="login-hero"
        aria-label="Hệ thống Vietnam Logistics"
      >
        <img
          className="hero-background"
          src="/images/login-cross-border.webp"
          alt=""
          aria-hidden="true"
        />

        <div className="hero-overlay">
          <header className="hero-top">
            <span className="hero-brand-icon">
              <PublicOutlined />
            </span>

            <div className="hero-brand-text">
              <strong>VIETNAM LOGISTICS</strong>
              <small>
                CROSS-BORDER SUPPLY CHAIN
              </small>
            </div>
          </header>

          <div className="hero-content">
            <span className="hero-eyebrow">
              NỀN TẢNG QUẢN TRỊ TẬP TRUNG
            </span>

            <h1>
              QUẢN LÝ
              <br />
              CHUỖI CUNG ỨNG
              <br />
              <span>XUYÊN BIÊN GIỚI</span>
            </h1>

            <p>
              Quản lý xuyên suốt hoạt động ký gửi,
              mua hộ, kho hàng, kiện hàng và vận
              chuyển quốc tế trên một nền tảng duy
              nhất.
            </p>
          </div>

          <div className="hero-metrics">
            <article className="hero-metric">
              <strong>KÝ GỬI</strong>
              <span>Quản lý kiện hàng</span>
            </article>

            <article className="hero-metric">
              <strong>MUA HỘ</strong>
              <span>Xử lý yêu cầu mua hàng</span>
            </article>

            <article className="hero-metric">
              <strong>XUYÊN BIÊN GIỚI</strong>
              <span>Theo dõi vận chuyển</span>
            </article>
          </div>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card__content">
          <div className="login-heading">
            <span className="login-eyebrow">
              CỔNG QUẢN TRỊ NỘI BỘ
            </span>

            <h2>Đăng nhập hệ thống</h2>

            <div className="login-line" />

            <p className="login-desc">
              Dành cho Sale, Admin và Operations
              Manager của Vietnam Logistics.
            </p>
          </div>

          <form
            className="login-form"
            onSubmit={handleLogin}
            noValidate
          >
            <div className="form-group">
              <label
                className="login-label"
                htmlFor="login-email"
              >
                EMAIL NỘI BỘ
              </label>
              <TextField
  id="login-email"
  name="email"
  type="email"
  fullWidth
  variant="filled"
  placeholder="Nhập email nội bộ"
  value={form.email}
  autoComplete="email"
  autoFocus
  disabled={loading}
  error={Boolean(errors.email)}
  onChange={handleChange}
  slotProps={{
    input: {
      disableUnderline: true,
      startAdornment: (
        <InputAdornment position="start">
          <EmailOutlined />
        </InputAdornment>
      ),
    },
    htmlInput: {
      maxLength: 150,
      "aria-describedby": errors.email
        ? "login-email-error"
        : undefined,
    },
  }}
/>

              {errors.email && (
                <span
                  id="login-email-error"
                  className="error-text"
                  role="alert"
                >
                  {errors.email}
                </span>
              )}
            </div>

            <div className="form-group">
              <label
                className="login-label"
                htmlFor="login-password"
              >
                MẬT KHẨU
              </label>

              <TextField
  id="login-password"
  name="password"
  fullWidth
  variant="filled"
  type={showPassword ? "text" : "password"}
  placeholder="Nhập mật khẩu"
  value={form.password}
  autoComplete="current-password"
  disabled={loading}
  error={Boolean(errors.password)}
  onChange={handleChange}
  slotProps={{
    input: {
      disableUnderline: true,
      startAdornment: (
        <InputAdornment position="start">
          <LockOutlined />
        </InputAdornment>
      ),
      endAdornment: (
        <InputAdornment position="end">
          <IconButton
            type="button"
            edge="end"
            className="login-eye"
            disabled={loading}
            aria-label={
              showPassword
                ? "Ẩn mật khẩu"
                : "Hiện mật khẩu"
            }
            aria-pressed={showPassword}
            onClick={() =>
              setShowPassword(
                (previous) => !previous
              )
            }
          >
            {showPassword ? (
              <VisibilityOff />
            ) : (
              <Visibility />
            )}
          </IconButton>
        </InputAdornment>
      ),
    },
    htmlInput: {
      maxLength: 100,
      "aria-describedby": errors.password
        ? "login-password-error"
        : undefined,
    },
  }}
/>

              {errors.password && (
                <span
                  id="login-password-error"
                  className="error-text"
                  role="alert"
                >
                  {errors.password}
                </span>
              )}
            </div>

            <Button
              block
              size="large"
              htmlType="submit"
              className="login-btn"
              loading={loading}
              disabled={loading}
            >
              <span className="login-btn__content">
                <span>
                  {loading
                    ? "ĐANG XÁC THỰC..."
                    : "ĐĂNG NHẬP QUẢN TRỊ"}
                </span>

                {!loading && (
                  <ArrowRightOutlined className="login-btn__arrow" />
                )}
              </span>
            </Button>
          </form>

          <div className="login-security-note">
            <SafetyCertificateOutlined />

            <span>
              Tài khoản chỉ được cấp cho nhân sự
              có thẩm quyền.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
