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
    // antd đọc tiêu đề ở `message`. Truyền `title` thì nó coi như không có nội dung và bỏ qua
    // luôn cả thông báo — nghĩa là mọi lỗi trong app đều im lặng, người dùng bấm nút không
    // thấy gì xảy ra.
    message: title,
    description,
    style: {
      borderRadius: 14,
    },
  });
};

const AuthNotify = {
  success(title = "Thành công", desc = "") {
    open("success", title, desc);
  },
  error(title = "Lỗi", desc = "") {
    open("error", title, desc);
  },
  warning(title = "Cảnh báo", desc = "") {
    open("warning", title, desc);
  },
  info(title = "Thông báo", desc = "") {
    open("info", title, desc);
  },
};

export default AuthNotify;