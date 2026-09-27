/**
 * DANH MỤC THAM SỐ VẬN HÀNH — bảng tra duy nhất của màn hình.
 *
 * Mỗi dòng ở đây trả lời bốn câu mà người chỉnh số cần biết trước khi gõ:
 *   1. Con số này là gì, đơn vị nào.
 *   2. Đổi nó thì CÁI GÌ chạy khác đi (`affects`).
 *   3. Nếu chưa ai cấu hình thì hệ thống đang chạy bằng bao nhiêu (`fallback`).
 *   4. Nó nằm ở bảng nào (`source`) — thứ này người dùng không thấy, nhưng quyết định
 *      màn hình ghi vào đâu, và ghi nhầm bảng thì số đổi mà hệ thống vẫn chạy như cũ.
 *
 * `fallback` phải khớp với hằng mặc định trong backend. Ba chỗ đang có mặc định:
 *   DeliveryRequest/ConsignmentPaymentService → DEPOSIT_RATE
 *   PurchaseOrderService.DefaultPriceToleranceRate = 5
 *   PurchaseOrderService.DefaultCancelFeeRate = 0
 * Đổi mặc định bên backend thì sửa luôn ở đây, nếu không màn hình sẽ nói dối.
 *
 * KHÔNG đưa vào đây: bảng giá cước theo tuyến (SERVICE_PRICINGS) và cấu hình thùng
 * (PACKAGE_CONFIGURATIONS). Hai thứ đó là danh mục nhiều dòng, có màn riêng; trang này
 * chỉ dành cho tham số MỘT GIÁ TRỊ điều khiển cách tính.
 */

import { SOURCE_FEE, SOURCE_RULE } from "@features/pricing/api/systemParameterService";

/** Cách hiển thị và kiểm giá trị theo đơn vị. */
export const VALUE_KIND = Object.freeze({
  PERCENT: "PERCENT",
  MONEY: "MONEY",
  NUMBER: "NUMBER",
});

export const SYSTEM_PARAMETER_GROUPS = Object.freeze([
  {
    key: "money",
    title: "Thu tiền và hoàn tiền",
    hint: "Quyết định khách trả bao nhiêu và khi nào, công ty trả lại bao nhiêu.",
    items: [
      {
        code: "DEPOSIT_RATE",
        source: SOURCE_FEE,
        label: "Tỷ lệ cọc đơn ký gửi",
        kind: VALUE_KIND.PERCENT,
        unit: "%",
        calculationType: "PERCENTAGE",
        fallback: 30,
        max: 100,
        affects:
          "Khách chấp nhận báo giá ký gửi thì phải cọc bao nhiêu phần trăm tổng báo giá. Phần còn lại thu khi tất toán.",
        careful:
          "Đổi số này KHÔNG tính lại các đơn đã phát hành khoản cọc; chỉ áp cho đơn chấp nhận báo giá sau đó.",
      },
      {
        code: "PURCHASE_PRICE_TOLERANCE_RATE",
        source: SOURCE_FEE,
        label: "Ngưỡng lệch giá mua hộ",
        kind: VALUE_KIND.PERCENT,
        unit: "%",
        calculationType: "PERCENTAGE",
        fallback: 5,
        max: 100,
        affects:
          "Giá mua thực vượt giá đã báo quá mức này thì đơn dừng lại chờ khách xem và trả phần chênh. Trong ngưỡng thì đi thẳng tới bước Admin duyệt.",
        careful:
          "Để 0 nghĩa là chênh một đồng cũng phải hỏi khách — đơn sẽ kẹt rất nhiều.",
      },
      {
        code: "PURCHASE_CANCEL_FEE_RATE",
        source: SOURCE_FEE,
        label: "Phí huỷ đơn mua NCC",
        kind: VALUE_KIND.PERCENT,
        unit: "%",
        calculationType: "PERCENTAGE",
        fallback: 0,
        max: 100,
        affects:
          "Trừ vào tiền hoàn khi Admin huỷ đơn mua ĐÃ đặt nhà cung cấp. Tính trên tiền hàng đã báo.",
        careful:
          "Để 0 là hoàn đủ cho khách. Đổi số này chỉ áp cho lần huỷ sau đó, không tính lại khoản hoàn đã chốt.",
      },
    ],
  },
  {
    key: "weight",
    title: "Cân đo và thuế",
    hint: "Quyết định cước tính trên bao nhiêu ký và cộng thêm bao nhiêu thuế.",
    items: [
      {
        code: "VOLUMETRIC_DIVISOR",
        source: SOURCE_RULE,
        label: "Hệ số quy đổi thể tích",
        kind: VALUE_KIND.NUMBER,
        unit: "",
        fallback: 5000,
        min: 1,
        affects:
          "Cân quy đổi = Dài × Rộng × Cao ÷ hệ số (cm). Cước tính theo cân lớn hơn giữa cân thực và cân quy đổi.",
        careful:
          "Hệ số NHỎ hơn = cân quy đổi LỚN hơn = khách trả nhiều hơn. Đổi số này là mọi báo giá lập sau đó và mọi lần tất toán đều tính lại.",
      },
      {
        code: "VAT",
        source: SOURCE_RULE,
        label: "Thuế VAT",
        kind: VALUE_KIND.PERCENT,
        unit: "%",
        fallback: 8,
        max: 100,
        affects:
          "Cộng vào phần phí dịch vụ và cước trên báo giá, hoá đơn tất toán và phần trả trước của mua hộ.",
      },
      {
        code: "IMPORT_TAX",
        source: SOURCE_RULE,
        label: "Thuế nhập khẩu mặc định",
        kind: VALUE_KIND.PERCENT,
        unit: "%",
        fallback: 0,
        max: 100,
        affects:
          "Dùng khi loại hàng chưa khai thuế suất riêng. Loại hàng đã có thuế suất trong danh mục thì lấy theo loại hàng, không lấy số này.",
      },
    ],
  },
  {
    key: "surcharge",
    title: "Phụ phí theo kiện",
    hint: "Khách tick chọn lúc đặt đơn; hệ thống tự tính, Sale chỉ sửa số tiền cho từng khách.",
    items: [
      {
        code: "SUR_INSURANCE_3PERCENT",
        source: SOURCE_RULE,
        label: "Bảo hiểm hàng hoá",
        kind: VALUE_KIND.PERCENT,
        unit: "%",
        fallback: 3,
        max: 100,
        affects: "Tính trên giá trị khai báo của từng kiện.",
        condition: {
          type: "MIN_DECLARED_VALUE",
          label: "Chỉ áp cho kiện khai giá từ",
          unit: "đ",
          hint: "Kiện khai dưới mức này thì không mua được bảo hiểm. Để trống là bỏ ràng buộc.",
        },
      },
      {
        code: "SUR_INSPECTION",
        source: SOURCE_RULE,
        label: "Phí kiểm hàng",
        kind: VALUE_KIND.MONEY,
        unit: "đ",
        fallback: 20000,
        affects: "Thu một lần cho mỗi kiện khách yêu cầu kiểm.",
      },
      {
        /*
         * CẨN THẬN: production có dòng CARTON_REPACK ở CẢ HAI bảng. Backend chỉ đọc bản
         * trong PRICING_RULES (PricingRuleService), bản trong ADDITIONAL_SERVICE_FEES là
         * rác còn sót lại và không ai đọc. Sửa nhầm bản kia thì không có gì đổi.
         */
        code: "CARTON_REPACK",
        source: SOURCE_RULE,
        label: "Phí đóng lại kiện carton",
        kind: VALUE_KIND.MONEY,
        unit: "đ",
        fallback: 25500,
        affects: "Thu cho kiện khách yêu cầu đóng lại thùng.",
      },
      {
        code: "WOOD_CRATE",
        source: SOURCE_RULE,
        label: "Phí đóng thùng gỗ",
        kind: VALUE_KIND.MONEY,
        unit: "đ",
        fallback: 0,
        affects:
          "Áp cho kiện chọn đóng thùng gỗ. Kích thước và phí từng loại thùng nằm ở Danh mục › Cấu hình đóng gói.",
      },
      {
        code: "DOMESTIC_FEE",
        source: SOURCE_RULE,
        label: "Phí nội địa",
        kind: VALUE_KIND.MONEY,
        unit: "đ",
        fallback: 0,
        affects:
          "Chặng giao trong nước sau khi hàng về kho VN. Không phải dịch vụ khách tick chọn.",
      },
    ],
  },
  {
    key: "purchase",
    title: "Phí dịch vụ mua hộ",
    hint: "Công mua thay khách. Sale chọn áp bản cố định hay bản phần trăm lúc báo giá.",
    items: [
      {
        code: "PURCHASE_FEE_PERCENT",
        source: SOURCE_RULE,
        label: "Phí mua hộ theo phần trăm",
        kind: VALUE_KIND.PERCENT,
        unit: "%",
        fallback: 0,
        max: 100,
        affects: "Tính trên tiền hàng của yêu cầu mua hộ.",
      },
      {
        code: "PURCHASE_FEE_FIXED",
        source: SOURCE_RULE,
        label: "Phí mua hộ cố định",
        kind: VALUE_KIND.MONEY,
        unit: "đ",
        fallback: 0,
        affects: "Số tiền cố định cho một yêu cầu mua hộ.",
      },
    ],
  },
]);

/** Phẳng hoá để tra nhanh theo mã. */
export const ALL_SYSTEM_PARAMETERS = Object.freeze(
  SYSTEM_PARAMETER_GROUPS.flatMap((group) => group.items),
);
