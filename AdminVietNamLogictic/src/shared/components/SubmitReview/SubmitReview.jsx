/**
 * KHỐI "XEM LẠI TRƯỚC KHI GỬI" — dùng chung cho mọi hộp xác nhận dẫn tới một thao tác ghi
 * (lập phiếu, duyệt, từ chối, tất toán, gửi báo giá...).
 *
 * Vì sao có khối này: người bấm nút phải thấy ĐỦ thứ mình sắp ghi — khách nào, hàng gì, bao
 * nhiêu kiện, nặng bao nhiêu, tiền bao nhiêu — chứ không phải một dòng "Bạn chắc chứ?". Mỗi
 * màn trước đây tự dựng một bảng kiện riêng, cột lệch nhau, màn thì có cân, màn thì không. Gom
 * về đây để mọi hộp xác nhận đọc giống nhau.
 *
 * LUẬT CỦA `shared/`: component này KHÔNG gọi API, KHÔNG biết nghiệp vụ nào. Màn hình tự nạp
 * dữ liệu thật rồi truyền xuống qua props. Nó chỉ lo ba việc:
 *   1. hiển thị trạng thái đang tải / tải lỗi cho thống nhất (`SubmitReview`);
 *   2. trình bày dữ kiện dạng bảng hai cột (`ReviewFacts`), bảng hàng (`ReviewItemsTable`),
 *      bảng tiền (`ReviewMoney`);
 *   3. cộng tổng các dòng hàng (`summarizeDeclaredItems`) — chỉ CỘNG số backend đã trả, không
 *      tự nhân / quy đổi gì thêm, để con số trên hộp xác nhận không bao giờ "đẹp hơn" số thật.
 *
 * Trường nào dữ liệu không có thì hiện "—", không bao giờ tự điền giá trị đoán.
 *
 * Hàm định dạng, `summarizeDeclaredItems`, cột chuẩn và `REVIEW_MODAL_PROPS` nằm ở
 * `submitReviewFormat.jsx` (Fast Refresh đòi file component chỉ export component).
 */

import { Alert, Descriptions, Spin, Table, Typography } from "antd";

import {
  buildDeclaredItemColumns,
  formatReviewKg,
  formatReviewMoney,
  formatReviewNumber,
  summarizeDeclaredItems,
} from "./submitReviewFormat";
import "./SubmitReview.css";

const { Text } = Typography;

/* =========================
   KHỐI HIỂN THỊ
========================= */

/**
 * Vỏ ngoài của phần xem lại: lo trạng thái tải / lỗi cho mọi hộp xác nhận.
 *
 * - `loading`: hiện spinner thay nội dung. Màn cha tự khoá nút gửi trong lúc này — component
 *   không với tay được tới nút OK của Modal.
 * - `error`: báo rõ nhưng VẪN hiện phần con (thường là dữ kiện sẵn có từ dòng bảng), vì đa số
 *   thao tác không phụ thuộc phần hiển thị; màn nào cần chặn thì tự chặn.
 */
export default function SubmitReview({
  loading = false,
  loadingText = "Đang tải đầy đủ thông tin…",
  error = "",
  errorTitle = "Chưa tải được đầy đủ thông tin",
  errorHint = "",
  children,
}) {
  if (loading) {
    return (
      <div className="submit-review submit-review--loading">
        <Spin />
        <span>{loadingText}</span>
      </div>
    );
  }

  return (
    <div className="submit-review">
      {error ? (
        <Alert
          type="warning"
          showIcon
          className="submit-review__alert"
          message={errorTitle}
          description={errorHint ? `${error} ${errorHint}` : error}
        />
      ) : null}
      {children}
    </div>
  );
}

/** Một khối có tiêu đề nhỏ + dòng tóm tắt bên phải. */
export function ReviewSection({ title, extra, children }) {
  return (
    <section className="submit-review__section">
      {(title || extra) && (
        <div className="submit-review__section-head">
          {title ? <strong>{title}</strong> : <span />}
          {extra ? <span className="submit-review__section-extra">{extra}</span> : null}
        </div>
      )}
      <div className="submit-review__section-body">{children}</div>
    </section>
  );
}

/**
 * Bảng dữ kiện hai cột. `items`: [{ label, value, span?, hidden? }].
 * Giá trị rỗng hiện "—" để người đọc biết trường đó THẬT SỰ trống chứ không phải bị giấu.
 */
export function ReviewFacts({ items = [], column = 2 }) {
  const visible = items.filter((item) => item && !item.hidden);
  if (!visible.length) return null;

  return (
    <Descriptions
      bordered
      size="small"
      column={column}
      className="submit-review__facts"
      items={visible.map((item, index) => ({
        key: item.key || `${item.label}-${index}`,
        label: item.label,
        /* Ô cuối kéo hết hàng: số ô lẻ không để lại lỗ trống (và antd không cảnh báo lệch span). */
        span: item.span ?? (index === visible.length - 1 ? "filled" : undefined),
        children:
          item.value === null || item.value === undefined || item.value === ""
            ? "—"
            : item.value,
      }))}
    />
  );
}

/**
 * Bảng hàng / kiện. Mặc định dùng cột "hàng khách khai"; truyền `columns` để dùng cột riêng.
 * `showTotals` (mặc định bật với cột chuẩn) in dòng cộng tổng ngay trên đầu bảng.
 */
export function ReviewItemsTable({
  title = "Hàng hoá",
  items = [],
  columns,
  rowKey,
  emptyText = "Không có dòng hàng nào.",
  showTotals,
  extra,
  scrollX = 820,
}) {
  const list = Array.isArray(items) ? items : [];
  const useDefault = !columns;
  const totals = useDefault || showTotals ? summarizeDeclaredItems(list) : null;

  const totalsText = totals
    ? [
        `${totals.lineCount} dòng`,
        totals.quantity !== null ? `${formatReviewNumber(totals.quantity, 0)} sản phẩm` : null,
        totals.weight !== null ? formatReviewKg(totals.weight) : null,
        totals.declaredValue !== null ? `khai ${formatReviewMoney(totals.declaredValue)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <ReviewSection title={title} extra={extra ?? totalsText}>
      <Table
        size="small"
        pagination={false}
        rowKey={
          rowKey ||
          ((item, index) =>
            item?.id || item?.orderItemId || item?.parcelId || item?.packageCode || index)
        }
        dataSource={list}
        columns={columns || buildDeclaredItemColumns()}
        scroll={{ x: scrollX }}
        locale={{ emptyText }}
      />
    </ReviewSection>
  );
}

/* Số (hoặc chuỗi toàn số) → định dạng VNĐ; chữ / node thì hiện nguyên. */
const isMoneyValue = (value) =>
  typeof value === "number" ||
  (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));

/**
 * Bảng tiền. `lines`: [{ label, value, strong?, tone?: "success"|"danger"|"warning", hint? }].
 * `value` là số → định dạng VNĐ; là chữ / node → hiện nguyên (để màn tự ghép chữ khi cần).
 */
export function ReviewMoney({ title = "Tiền", lines = [], extra }) {
  const visible = lines.filter((line) => line && !line.hidden);
  if (!visible.length) return null;

  return (
    <ReviewSection title={title} extra={extra}>
      <div className="submit-review__money">
        {visible.map((line, index) => (
          <div
            key={line.key || `${line.label}-${index}`}
            className={`submit-review__money-row${line.strong ? " is-strong" : ""}`}
          >
            <span>
              {line.label}
              {line.hint ? <small>{line.hint}</small> : null}
            </span>
            <Text strong={line.strong} type={line.tone}>
              {isMoneyValue(line.value) ? formatReviewMoney(line.value) : line.value ?? "—"}
            </Text>
          </div>
        ))}
      </div>
    </ReviewSection>
  );
}
