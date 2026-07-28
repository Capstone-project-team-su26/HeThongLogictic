import { notification } from "antd";
import "./auth-notify.css";

const DURATION = 2; // giây

const baseConfig = {
  placement: "topRight",
  duration: DURATION,
  className: "auth-notify",
};

const open = (type, title, description) => {
  notification[type]({
    ...baseConfig,
    title,
    description,
    style: {
      borderRadius: 14,
    },
  });
};

const AuthNotify = {
  success(title = "Đăng nhập thành công", desc = "") {
    open("success", title, desc);
  },
  error(title = "Lỗi", desc = "") {
    open("error", title, desc);
  },
  warning(title = "Cảnh báo", desc = "") {
    open("warning", title, desc);
  },
};

export default AuthNotify;