import {
  Button,
  Modal,
} from "antd";
import {
  CheckCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";

import "./ConfirmConsignmentQuotation.css";

export default function ConfirmConsignmentQuotation({
  open,
  loading,
  submitted = false,
  data,
  onCancel,
  onConfirm,
  formatCurrency,
  formatMeasurement,
  getUnitSuffix,
}) {
  if (!data) {
    return null;
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width={760}
      centered
      destroyOnHidden
      mask={{ closable: !loading && !submitted }}
      closable={!loading}
      footer={null}
      className="quotation-confirm-modal"
      title={null}
    >
      <div className="quotation-confirm">
        <div className="quotation-confirm__hero">
          <div className="quotation-confirm__hero-icon">
            <SafetyCertificateOutlined />
          </div>

          <div>
            <span>
              XÁC NHẬN BÁO GIÁ CHÍNH THỨC
            </span>

            <h2>
              Kiểm tra thông tin trước khi gửi
            </h2>

            <p>
              Báo giá sẽ được gửi đến khách hàng ngay
              sau khi bạn xác nhận.
            </p>
          </div>
        </div>

        <div className="quotation-confirm__overview">
          <div>
            <span>Mã đơn ký gửi</span>
            <strong>
              {data.consignmentCode}
            </strong>
          </div>

          <div>
            <span>Khách hàng</span>
            <strong>
              {data.customerName}
            </strong>
            <small>
              {data.customerPhone}
            </small>
          </div>

          <div>
            <span>Dịch vụ</span>
            <strong>
              {data.serviceName}
            </strong>
          </div>

          <div>
            <span>Tuyến vận chuyển</span>
            <strong>
              {data.route}
            </strong>
          </div>
        </div>

        <section className="quotation-confirm__section">
          <div className="quotation-confirm__section-title">
            <EnvironmentOutlined />

            <div>
              <strong>
                Kho và bảng giá áp dụng
              </strong>
              <span>
                Kho được chọn trong danh sách phù hợp với
                tuyến hàng; bảng giá được giữ nguyên theo
                dịch vụ khách hàng đã chọn.
              </span>
            </div>
          </div>

          <div className="quotation-confirm__locked-grid">
            <div>
              <span>Kho gửi hàng</span>
              <strong>
                {data.warehouseName}
              </strong>
              <small>
                {data.warehouseAddress}
              </small>
            </div>

            <div>
              <span>Bảng giá vận chuyển</span>
              <strong>
                {data.pricingName}
              </strong>
              <small>
                {formatCurrency(data.unitPrice)} /{" "}
                {getUnitSuffix(data.unitType)}
              </small>
            </div>
          </div>
        </section>

        {Array.isArray(data.packageRows) &&
          data.packageRows.length > 0 && (
            <section className="quotation-confirm__section">
              <div className="quotation-confirm__section-title">
                <CheckCircleOutlined />

                <div>
                  <strong>
                    Cấu hình đóng gói
                  </strong>
                  <span>
                    Cấu hình khách hàng đã chọn cho từng
                    kiện hàng.
                  </span>
                </div>
              </div>

              <div className="quotation-confirm__fee-list">
                {data.packageRows.map((row) => (
                  <div key={row.id}>
                    <div>
                      <strong>{row.name}</strong>
                      <span>
                        {row.configurationName}
                      </span>
                    </div>

                    <strong>
                      {formatCurrency(row.fee)}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          )}

        {Array.isArray(data.optionalFees) &&
          data.optionalFees.length > 0 && (
            <section className="quotation-confirm__section">
              <div className="quotation-confirm__section-title">
                <CheckCircleOutlined />

                <div>
                  <strong>
                    Phụ phí khách hàng đã chọn
                  </strong>
                  <span>
                    Chỉ các phụ phí có trong đơn hàng mới
                    được tính.
                  </span>
                </div>
              </div>

              <div className="quotation-confirm__fee-list">
                {data.optionalFees.map((fee) => (
                  <div key={fee.id || fee.code}>
                    <div>
                      <strong>{fee.label}</strong>
                      {fee.description && (
                        <span>
                          {fee.description}
                        </span>
                      )}
                    </div>

                    <strong>
                      {formatCurrency(fee.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          )}

        <section className="quotation-confirm__section quotation-confirm__calculation">
          <div className="quotation-confirm__section-title">
            <DollarOutlined />

            <div>
              <strong>
                Chi tiết chi phí
              </strong>
              <span>
                Các số tiền được làm tròn theo đồng Việt
                Nam.
              </span>
            </div>
          </div>

          <div className="quotation-confirm__calculation-grid">
            <div>
              <span>Số lượng tính giá</span>
              <strong>
                {formatMeasurement(
                  data.billingQuantity,
                  6
                )}{" "}
                {getUnitSuffix(data.unitType)}
              </strong>
            </div>

            <div>
              <span>Giá trị khai báo</span>
              <strong>
                {formatCurrency(
                  data.declaredValue
                )}
              </strong>
            </div>
          </div>

          <div className="quotation-confirm__lines">
            <div>
              <span>
                Phí vận chuyển quốc tế
              </span>
              <strong>
                {formatCurrency(
                  data.freightCharge
                )}
              </strong>
            </div>

            {data.domesticShippingFee > 0 && (
              <div className="is-domestic-fee">
                <span>
                  Phí vận chuyển nội địa
                </span>
                <strong>
                  {formatCurrency(
                    data.domesticShippingFee
                  )}
                </strong>
              </div>
            )}

            {data.packageConfigurationFee > 0 && (
              <div>
                <span>
                  Phí cấu hình thùng theo kiện
                </span>
                <strong>
                  {formatCurrency(
                    data.packageConfigurationFee
                  )}
                </strong>
              </div>
            )}

            {data.woodCrateFee > 0 && (
              <div>
                <span>
                  Phí đóng thùng gỗ theo đơn
                </span>
                <strong>
                  {formatCurrency(
                    data.woodCrateFee
                  )}
                </strong>
              </div>
            )}

            {data.packagingFeeTotal > 0 && (
              <div className="is-packaging-total">
                <span>
                  Tổng phí đóng gói
                </span>
                <strong>
                  {formatCurrency(
                    data.packagingFeeTotal
                  )}
                </strong>
              </div>
            )}

            {Array.isArray(data.optionalFees) &&
              data.optionalFees.map((fee) => (
                <div key={fee.id || fee.code}>
                  <span>
                    {fee.label || "Phụ phí"}
                  </span>
                  <strong>
                    {formatCurrency(fee.amount)}
                  </strong>
                </div>
              ))}

            {data.discountAmount > 0 && (
              <div className="is-discount">
                <span>
                  Chiết khấu (
                  {data.discountPercent}%)
                </span>
                <strong>
                  -
                  {formatCurrency(
                    data.discountAmount
                  )}
                </strong>
              </div>
            )}

            {data.taxAndDuty > 0 && (
              <div className="is-tax-and-duty">
                <span>
                  Thuế và phí nhập khẩu
                </span>
                <strong>
                  {formatCurrency(
                    data.taxAndDuty
                  )}
                </strong>
              </div>
            )}
          </div>

          <div className="quotation-confirm__total">
            <span>
              Tổng chi phí dự kiến
            </span>
            <strong>
              {formatCurrency(
                data.totalEstimatedCost
              )}
            </strong>
          </div>
        </section>

        {data.salesNote && (
          <section className="quotation-confirm__note">
            <UserOutlined />

            <div>
              <span>
                Ghi chú gửi khách hàng
              </span>
              <p>{data.salesNote}</p>
            </div>
          </section>
        )}

        <div
          className={`quotation-confirm__notice ${submitted
              ? "is-submitted"
              : ""
            }`}
        >
          <CheckCircleOutlined />

          <span>
            {submitted
              ? "Báo giá chính thức đã được gửi thành công. Bạn không thể xác nhận hoặc gửi lại báo giá này."
              : "Sau khi gửi, khách hàng sẽ nhận được báo giá chính thức để xem và xác nhận."}
          </span>
        </div>

        <div className="quotation-confirm__actions">
          <Button
            size="large"
            onClick={onCancel}
            disabled={loading || submitted}
          >
            {submitted
              ? "Báo giá đã được gửi"
              : "Quay lại kiểm tra"}
          </Button>

          <Button
            type="primary"
            size="large"
            icon={
              submitted ? (
                <CheckCircleOutlined />
              ) : (
                <SendOutlined />
              )
            }
            loading={loading}
            disabled={
              loading || submitted
            }
            onClick={() => {
              if (
                loading ||
                submitted
              ) {
                return;
              }

              onConfirm?.();
            }}
            className={`quotation-confirm__submit-button ${submitted
                ? "is-submitted"
                : ""
              }`}
          >
            {submitted
              ? "Đã gửi báo giá"
              : "Xác nhận và gửi báo giá"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
