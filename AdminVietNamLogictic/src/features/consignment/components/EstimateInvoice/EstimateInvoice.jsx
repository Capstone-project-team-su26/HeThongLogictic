/**
 * BẢNG KÊ CHI PHÍ DỰ KIẾN — dạng hoá đơn.
 *
 * Bản sao phải khớp từng chữ với `vcl-customer-ui`: cùng một component in ra tờ hoá đơn mà
 * khách xem ở màn xác nhận trước khi tạo đơn và ở màn báo giá sau khi tạo đơn. Sale đọc
 * con số nào cho khách nghe thì khách mở đơn ra phải thấy đúng con số đó, trình bày y hệt;
 * mỗi bản vẽ một kiểu là sớm muộn ba màn nói ba con số.
 *
 * Mọi con số ở đây do BACKEND tính. Component này chỉ xếp chỗ và đặt tên, tuyệt đối không
 * cộng trừ gì thêm — thêm một phép tính ở đây là mở lại đúng cái cửa đã làm màn xác nhận
 * báo 60.000đ trong khi hệ thống thu 25.000đ.
 *
 * Backend đã bỏ các dòng 0đ và xếp sẵn theo thứ tự đọc của một tờ hoá đơn. Ở đây chỉ gom
 * thành ba nhóm và cộng lại để đối chiếu — tổng nhóm hiện ra để khách tự kiểm được rằng
 * các dòng cộng đúng bằng ô tổng.
 */
/* formatVnd sống trong helpers của màn xác nhận ở app này (web khách để ở shared/utils). */
import { formatVnd } from "@features/consignment/components/ConsignmentOrderConfirm/ConsignmentOrderConfirm.helpers";
import "./EstimateInvoice.css";

/* Ba nhóm, đúng thứ tự khách cần hiểu: đi quốc tế → mình chọn thêm gì → nhà nước thu gì. */
const SECTIONS = [
  {
    key: "shipping",
    title: "Vận chuyển",
    hint: "Cước chính của đơn và chặng giao trong nước",
    types: ["MAIN_SERVICE", "DOMESTIC_FEE", "SERVICE_FEE"],
  },
  {
    key: "service",
    title: "Dịch vụ và phụ phí",
    hint: "Những gì bạn chọn thêm cho từng kiện",
    types: ["SURCHARGE", "PACKING_FEE"],
  },
  {
    key: "tax",
    title: "Thuế",
    hint: "Thuế nhập khẩu theo loại hàng và VAT dịch vụ",
    types: ["TAX"],
  },
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatRate = (value) => {
  const number = toNumber(value);
  return Number.isInteger(number) ? String(number) : String(number).replace(".", ",");
};

/** Cách tính, viết cho người không đọc mã: "8%", "120.000đ/kg", "Cố định". */
const describeCalculation = (line) => {
  const type = String(line?.calculationType ?? "").toUpperCase();
  const value = toNumber(line?.value);

  if (type === "PERCENTAGE") return `${formatRate(value)}%`;
  if (type === "PER_KG") return `${formatVnd(value)}/kg`;
  if (type === "PER_CBM") return `${formatVnd(value)}/m³`;
  if (type === "PER_PRODUCT") return `${formatVnd(value)}/sản phẩm`;
  if (type === "PER_VOLUME") return `${formatVnd(value)}/1.000cm³`;
  if (type === "FIXED") return "Cố định";

  return "";
};

const sumOf = (lines) => lines.reduce((total, line) => total + toNumber(line.amount), 0);

export default function EstimateInvoice({ estimate }) {
  if (!estimate) return null;

  const lines = Array.isArray(estimate.invoiceLines) ? estimate.invoiceLines : [];

  /*
   * Không có bảng kê (backend đời cũ) thì đừng dựng khung hoá đơn rỗng — trả null để chỗ
   * gọi hiện bản tóm tắt bốn ô như trước.
   */
  if (lines.length === 0) return null;

  const sections = SECTIONS.map((section) => {
    const sectionLines = lines.filter((line) =>
      section.types.includes(String(line.feeType ?? "").toUpperCase()),
    );

    /* Dịch vụ theo kiện: gom theo kiện vì khách nhớ theo kiện, không nhớ theo tên phí. */
    const groups = [];
    for (const line of sectionLines) {
      const label = line.itemName ? `Kiện · ${line.itemName}` : "";
      const existing = groups.find((group) => group.label === label);

      if (existing) existing.lines.push(line);
      else groups.push({ label, lines: [line] });
    }

    return { ...section, lines: sectionLines, groups, total: sumOf(sectionLines) };
  }).filter((section) => section.lines.length > 0);

  const grandTotal = toNumber(estimate.totalEstimatedCost);

  /*
   * Phép cộng trong ô tổng: "20.000đ + 25.000đ + 3.200đ = 48.200đ" — chỉ ghép lại đúng
   * những con số đang in ở các dòng "Cộng …" để khách thấy tổng đến từ đâu, không tính
   * thêm con số nào mới. Nếu cộng các nhóm KHÔNG ra đúng tổng backend trả (lệch quá 1đ,
   * ví dụ backend có dòng phí thuộc loại chưa được xếp vào nhóm nào) thì KHÔNG in phép
   * cộng: bày ra một phép tính sai trên tờ báo giá còn tệ hơn không bày gì.
   */
  const sectionsSum = sections.reduce((total, section) => total + section.total, 0);
  const showFormula = sections.length > 1 && Math.abs(sectionsSum - grandTotal) <= 1;

  /*
   * Bốn ô tổng theo nhóm — DÙNG ĐÚNG bộ nhãn, đúng thứ tự và đúng màu với màn chi tiết
   * đơn sau khi tạo. Sale đọc cho khách nghe con số nào thì khách mở đơn ra phải thấy
   * đúng con số đó, trình bày y hệt.
   */
  const summaryCards = [
    {
      key: "freight",
      label: "Cước vận chuyển quốc tế",
      value: toNumber(estimate.estimatedFreightCharge),
      hint: "Cước vận chuyển chính của đơn hàng",
    },
    {
      key: "domestic",
      label: "Phí vận chuyển nội địa",
      value: toNumber(estimate.domesticShippingFee),
      hint: "Chi phí giao nhận trong nước",
    },
    {
      key: "service",
      label: "Phí dịch vụ và phụ phí",
      value: toNumber(estimate.serviceFee),
      hint: "Tổng các dịch vụ bổ sung",
    },
    {
      key: "tax",
      label: "Thuế và phí nhập khẩu",
      value: toNumber(estimate.taxAndDuty),
      hint: "Bao gồm VAT và thuế nhập khẩu",
    },
  ];

  return (
    <div className="estimate-invoice">
      <div className="estimate-invoice__summary">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className={`estimate-invoice__summary-card is-${card.key}`}
          >
            <span>{card.label}</span>
            <strong>{formatVnd(card.value)}</strong>
            <small>{card.hint}</small>
          </div>
        ))}
      </div>

      <div className="estimate-invoice__weight">
        <div>
          <span>Cân tính cước</span>
          <strong>{toNumber(estimate.chargeableWeight).toLocaleString("vi-VN")} kg</strong>
        </div>
        <small>
          Cân thực {toNumber(estimate.totalWeight).toLocaleString("vi-VN")} kg · quy đổi{" "}
          {toNumber(estimate.volumetricWeight).toLocaleString("vi-VN")} kg — cước tính theo
          số lớn hơn
        </small>
      </div>

      {sections.map((section) => (
        <section key={section.key} className="estimate-invoice__section">
          <header>
            <h4>{section.title}</h4>
            <p>{section.hint}</p>
          </header>

          {section.groups.map((group) => (
            <div key={group.label || "chung"} className="estimate-invoice__group">
              {group.label && (
                <span className="estimate-invoice__group-label">{group.label}</span>
              )}

              {group.lines.map((line) => (
                <div key={line.id ?? `${line.feeName}-${line.amount}`} className="estimate-invoice__line">
                  <span className="estimate-invoice__line-name">
                    {line.feeName}
                    {line.note && (
                      <small className="estimate-invoice__line-note">{line.note}</small>
                    )}
                  </span>

                  <span className="estimate-invoice__line-rate">
                    {describeCalculation(line)}
                  </span>

                  <strong className="estimate-invoice__line-amount">
                    {formatVnd(line.amount)}
                  </strong>
                </div>
              ))}
            </div>
          ))}

          <div className={`estimate-invoice__subtotal is-${section.key}`}>
            <span>Cộng {section.title.toLowerCase()}</span>
            <strong>{formatVnd(section.total)}</strong>
          </div>
        </section>
      ))}

      <div className="estimate-invoice__total">
        <div>
          <span>Tổng cộng dự kiến</span>
          <strong>{formatVnd(grandTotal)}</strong>
        </div>
        {showFormula && (
          <p className="estimate-invoice__formula">
            {sections.map((section, index) => (
              <span key={section.key} className="estimate-invoice__formula-term">
                {index > 0 && <span className="estimate-invoice__formula-op">+</span>}
                <b className={`is-${section.key}`} title={`Cộng ${section.title.toLowerCase()}`}>
                  {formatVnd(section.total)}
                </b>
              </span>
            ))}
            <span className="estimate-invoice__formula-term">
              <span className="estimate-invoice__formula-op">=</span>
              <b className="is-total">{formatVnd(grandTotal)}</b>
            </span>
          </p>
        )}
        <small>
          Đây là báo giá <b>tạm tính</b>. Cước cuối cùng tính lại theo cân đo thật tại kho
          Việt Nam; phần chênh (nếu có) sẽ hiện ở bước tất toán.
        </small>
      </div>
    </div>
  );
}
