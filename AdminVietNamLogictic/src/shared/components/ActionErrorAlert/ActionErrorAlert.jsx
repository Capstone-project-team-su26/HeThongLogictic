import { Alert } from "antd";

/**
 * Câu lỗi của thao tác ghi, hiện NGAY TRONG hộp / ngăn đang mở (thường đặt ở chân hộp, sát nút OK,
 * qua `footer={(origin) => <><ActionErrorAlert … />{origin}</>}`). Hộp không đóng khi lỗi nên người
 * dùng thấy lý do và giữ nguyên những gì đã nhập; không có lỗi thì không vẽ gì.
 */
export default function ActionErrorAlert({ error, title = "Chưa thực hiện được", style }) {
  if (!error) return null;

  return (
    <div aria-live="polite">
      <Alert
        type="error"
        showIcon
        message={title}
        description={error}
        style={{ textAlign: "left", marginBottom: 12, ...style }}
      />
    </div>
  );
}
