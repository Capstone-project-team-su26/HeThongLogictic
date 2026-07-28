import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Button,
  Divider,
  Image,
  Input,
  InputNumber,
  Modal,
  Tag,
  Tooltip,
} from "antd";

import {
  CalculatorOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  DollarOutlined,
  FileTextOutlined,
  GiftOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TruckOutlined,
} from "@ant-design/icons";

import {
  createPurchaseRequestQuotationApi,
} from "../../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import AuthNotify from "../../../../utils/Common/AuthNotify";

import "./CreatePurchaseRequestQuotationModal.css";

const { TextArea } = Input;

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const normalizeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const normalizeMoney = (
  value
) => {
  return Math.max(
    0,
    normalizeNumber(value)
  );
};

const roundMoney = (value) =>
  Math.round(
    normalizeMoney(value)
  );

const formatCurrency = (value) => {
  return `${new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }
  ).format(
    roundMoney(value)
  )} ₫`;
};

const formatNumber = (value) => {
  return new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      useGrouping: true,
    }
  ).format(
    normalizeNumber(value)
  );
};

const moneyFormatter = (value) => {
  const number = normalizeMoney(
    String(value ?? "")
      .replace(/[^\d.-]/g, "")
  );

  return new Intl.NumberFormat(
    "vi-VN",
    {
      maximumFractionDigits: 0,
    }
  ).format(number);
};

const moneyParser = (value) => {
  return normalizeMoney(
    String(value ?? "")
      .replace(/[^\d]/g, "")
  );
};

const getItemId = (item) =>
  normalizeText(
    item?.itemId ??
      item?.purchaseRequestItemId
  );

const getRuleId = (rule) =>
  normalizeText(
    rule?.id ??
      rule?.pricingRuleId ??
      rule?.ruleId
  );

const getRuleCode = (rule) =>
  normalizeUpperText(
    rule?.ruleCode
  );

const getCalculationType = (
  rule
) =>
  normalizeUpperText(
    rule?.calculationType
  );

const getRuleScopeLabel = (
  rule
) => {
  const code =
    getRuleCode(rule);

  const map = {
    WOOD_CRATE:
      "Một lần cho toàn đơn",

    SUR_INSURANCE_3PERCENT:
      "Theo tổng tiền sản phẩm",

    SUR_INSPECTION:
      "Theo đơn",

    PACKAGE_CONFIGURATION:
      "Theo cấu hình kiện hàng",
  };

  return (
    map[code] ||
    (getCalculationType(rule) ===
    "PERCENTAGE"
      ? "Theo tổng tiền sản phẩm"
      : "Theo đơn")
  );
};

const clampAmount = (
  value,
  minAmount,
  maxAmount
) => {
  let result =
    normalizeMoney(value);

  const minimum =
    minAmount === null ||
    minAmount === undefined ||
    minAmount === ""
      ? null
      : normalizeMoney(
          minAmount
        );

  const maximum =
    maxAmount === null ||
    maxAmount === undefined ||
    maxAmount === ""
      ? null
      : normalizeMoney(
          maxAmount
        );

  if (minimum !== null) {
    result = Math.max(
      result,
      minimum
    );
  }

  if (maximum !== null) {
    result = Math.min(
      result,
      maximum
    );
  }

  return roundMoney(result);
};

const calculateRuleAmount = (
  rule,
  productSubtotal
) => {
  const calculationType =
    getCalculationType(rule);

  const ruleValue =
    normalizeMoney(
      rule?.value
    );

  const rawAmount =
    calculationType ===
    "PERCENTAGE"
      ? normalizeMoney(
          productSubtotal
        ) *
        (ruleValue / 100)
      : ruleValue;

  return clampAmount(
    rawAmount,
    rule?.minAmount,
    rule?.maxAmount
  );
};

const getRuleValueLabel = (
  rule
) => {
  if (
    getCalculationType(rule) ===
    "PERCENTAGE"
  ) {
    return `${formatNumber(
      rule?.value
    )}%`;
  }

  return formatCurrency(
    rule?.value
  );
};

const buildInitialPrices = (
  items = []
) => {
  return items.reduce(
    (result, item) => {
      const itemId =
        getItemId(item);

      if (itemId) {
        result[itemId] = 0;
      }

      return result;
    },
    {}
  );
};

export default function CreatePurchaseRequestQuotationModal({
  open,
  onClose,
  onSuccess,
  purchaseRequest,
  pricingRules = [],
}) {
  const items = useMemo(
    () =>
      Array.isArray(
        purchaseRequest?.items
      )
        ? purchaseRequest.items
        : [],
    [purchaseRequest?.items]
  );

  const selectedRules =
    useMemo(
      () =>
        (
          Array.isArray(
            pricingRules
          )
            ? pricingRules
            : []
        ).filter(
          (rule) =>
            Boolean(
              getRuleId(rule)
            )
        ),
      [pricingRules]
    );

  const [itemPrices, setItemPrices] =
    useState({});

  const [purchaseFee, setPurchaseFee] =
    useState(0);

  const [shippingFee, setShippingFee] =
    useState(0);

  const [note, setNote] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [formError, setFormError] =
    useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setItemPrices(
      buildInitialPrices(
        items
      )
    );

    setPurchaseFee(0);
    setShippingFee(0);
    setNote("");
    setFormError("");
    setSubmitting(false);
  }, [
    items,
    open,
    purchaseRequest
      ?.purchaseRequestId,
  ]);

  const itemBreakdown =
    useMemo(
      () =>
        items.map((item) => {
          const itemId =
            getItemId(item);

          const unitPrice =
            normalizeMoney(
              itemPrices?.[
                itemId
              ]
            );

          const quantity =
            Math.max(
              0,
              normalizeNumber(
                item?.quantity
              )
            );

          return {
            item,
            itemId,
            unitPrice,
            quantity,
            lineTotal:
              roundMoney(
                unitPrice *
                  quantity
              ),
          };
        }),
      [
        itemPrices,
        items,
      ]
    );

  const productSubtotal =
    useMemo(
      () =>
        itemBreakdown.reduce(
          (
            total,
            current
          ) =>
            total +
            current.lineTotal,
          0
        ),
      [itemBreakdown]
    );

  const additionalFeeBreakdown =
    useMemo(
      () =>
        selectedRules.map(
          (rule) => ({
            rule,
            pricingRuleId:
              getRuleId(rule),

            amount:
              calculateRuleAmount(
                rule,
                productSubtotal
              ),
          })
        ),
      [
        productSubtotal,
        selectedRules,
      ]
    );

  const additionalFeeTotal =
    useMemo(
      () =>
        additionalFeeBreakdown.reduce(
          (
            total,
            current
          ) =>
            total +
            current.amount,
          0
        ),
      [
        additionalFeeBreakdown,
      ]
    );

  const quotationTotal =
    useMemo(
      () =>
        roundMoney(
          productSubtotal +
            normalizeMoney(
              purchaseFee
            ) +
            normalizeMoney(
              shippingFee
            ) +
            additionalFeeTotal
        ),
      [
        additionalFeeTotal,
        productSubtotal,
        purchaseFee,
        shippingFee,
      ]
    );

  const handlePriceChange = (
    itemId,
    value
  ) => {
    setItemPrices(
      (current) => ({
        ...current,

        [itemId]:
          normalizeMoney(
            value
          ),
      })
    );

    setFormError("");
  };

  const validateForm = () => {
    if (
      !normalizeText(
        purchaseRequest
          ?.purchaseRequestId
      )
    ) {
      return "Không tìm thấy mã yêu cầu mua hộ.";
    }

    if (items.length === 0) {
      return "Yêu cầu mua hộ chưa có sản phẩm.";
    }

    const missingItem =
      itemBreakdown.find(
        (current) =>
          !current.itemId
      );

    if (missingItem) {
      return "Có sản phẩm chưa có itemId.";
    }

    const invalidPriceItem =
      itemBreakdown.find(
        (current) =>
          current.unitPrice <= 0
      );

    if (invalidPriceItem) {
      return `Vui lòng nhập đơn giá lớn hơn 0 cho sản phẩm "${
        invalidPriceItem
          ?.item
          ?.productName ||
        "chưa xác định"
      }".`;
    }

    return "";
  };

  const handleSubmit =
    async () => {
      const validationMessage =
        validateForm();

      if (validationMessage) {
        setFormError(
          validationMessage
        );

        AuthNotify.warning(
          "Thông tin chưa đầy đủ",
          validationMessage
        );

        return;
      }

      const payload = {
        purchaseFee:
          roundMoney(
            purchaseFee
          ),

        shippingFee:
          roundMoney(
            shippingFee
          ),

        note:
          normalizeText(note),

        items:
          itemBreakdown.map(
            (current) => ({
              purchaseRequestItemId:
                current.itemId,

              unitPrice:
                roundMoney(
                  current.unitPrice
                ),
            })
          ),

        additionalFees:
          additionalFeeBreakdown.map(
            (current) => {
              const rule =
                current.rule;

              return {
                pricingRuleId:
                  current
                    .pricingRuleId,

                feeName:
                  normalizeText(
                    rule?.ruleName
                  ),

                feeType:
                  normalizeText(
                    rule?.ruleType
                  ),

                calculationType:
                  getCalculationType(
                    rule
                  ),

                value:
                  normalizeMoney(
                    rule?.value
                  ),

                amount:
                  current.amount,

                note:
                  normalizeText(
                    rule?.description
                  ),
              };
            }
          ),
      };

      try {
        setSubmitting(true);
        setFormError("");

        const result =
          await createPurchaseRequestQuotationApi(
            purchaseRequest
              ?.purchaseRequestId,
            payload
          );

        AuthNotify.success(
          "Tạo báo giá thành công",
          "Báo giá mua hộ đã được gửi lên hệ thống."
        );

        onSuccess?.(
          result,
          payload
        );
      } catch (error) {
        const message =
          error?.message ||
          "Không thể tạo báo giá mua hộ.";

        setFormError(message);

        AuthNotify.error(
          "Tạo báo giá thất bại",
          message
        );
      } finally {
        setSubmitting(false);
      }
    };

  const handleClose = () => {
    if (submitting) {
      return;
    }

    onClose?.();
  };

  return (
    <Modal
      open={open}
      centered
      width={1080}
      footer={null}
      closable={false}
      mask={{ closable: !submitting }}
      keyboard={!submitting}
      destroyOnHidden
      onCancel={handleClose}
      className="purchase-quotation-modal"
      rootClassName="purchase-quotation-modal-root"
    >
      <div className="purchase-quotation-modal__header">
        <div className="purchase-quotation-modal__heading">
          <div className="purchase-quotation-modal__heading-icon">
            <CalculatorOutlined />
          </div>

          <div>
            <span>
              TẠO BÁO GIÁ MUA HỘ
            </span>

            <h2>
              {purchaseRequest
                ?.purchaseCode ||
                "Yêu cầu mua hộ"}
            </h2>

            <p>
              Nhập đơn giá sản phẩm, phí mua hộ,
              phí vận chuyển và kiểm tra dịch vụ
              trước khi xác nhận.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="purchase-quotation-modal__close"
          onClick={handleClose}
          disabled={submitting}
          aria-label="Đóng cửa sổ tạo báo giá"
        >
          <CloseOutlined />
        </button>
      </div>

      <div className="purchase-quotation-modal__meta">
        <div>
          <ShoppingCartOutlined />
          <span>
            Số mặt hàng
          </span>
          <strong>
            {items.length}
          </strong>
        </div>

        <div>
          <ShoppingOutlined />
          <span>
            Tổng số lượng
          </span>
          <strong>
            {formatNumber(
              purchaseRequest
                ?.totalQuantity
            )}
          </strong>
        </div>

        <div>
          <GiftOutlined />
          <span>
            Dịch vụ tính phí
          </span>
          <strong>
            {selectedRules.length}
          </strong>
        </div>
      </div>

      <div className="purchase-quotation-modal__body">
        {formError && (
          <Alert
            type="error"
            showIcon
            message="Không thể tạo báo giá"
            description={
              formError
            }
            className="purchase-quotation-modal__alert"
          />
        )}

        <section className="purchase-quotation-section">
          <div className="purchase-quotation-section__heading">
            <div>
              <ShoppingCartOutlined />

              <div>
                <span>
                  CHI PHÍ SẢN PHẨM
                </span>

                <h3>
                  Nhập đơn giá từng sản phẩm
                </h3>
              </div>
            </div>

            <Tag className="purchase-quotation-section__tag">
              Thành tiền:{" "}
              {formatCurrency(
                productSubtotal
              )}
            </Tag>
          </div>

          <div className="purchase-quotation-item-list">
            {itemBreakdown.map(
              (
                current,
                index
              ) => {
                const item =
                  current.item;

                const firstImage =
                  Array.isArray(
                    item?.imageUrls
                  )
                    ? item
                        .imageUrls[0]
                    : "";

                return (
                  <article
                    key={
                      current.itemId ||
                      index
                    }
                    className="purchase-quotation-item"
                  >
                    <div className="purchase-quotation-item__index">
                      {index + 1}
                    </div>

                    <div className="purchase-quotation-item__image">
                      {firstImage ? (
                        <Image
                          src={
                            firstImage
                          }
                          alt={
                            item
                              ?.productName ||
                            "Sản phẩm"
                          }
                          preview
                        />
                      ) : (
                        <ShoppingOutlined />
                      )}
                    </div>

                    <div className="purchase-quotation-item__content">
                      <span>
                        SẢN PHẨM
                      </span>

                      <h4>
                        {item
                          ?.productName ||
                          "Sản phẩm"}
                      </h4>

                      <div>
                        <Tag>
                          Số lượng:{" "}
                          {formatNumber(
                            current.quantity
                          )}
                        </Tag>

                        {item
                          ?.attributes && (
                          <Tag>
                            {
                              item.attributes
                            }
                          </Tag>
                        )}
                      </div>
                    </div>

                    <div className="purchase-quotation-item__price">
                      <label>
                        Đơn giá
                        <b>*</b>
                      </label>

                      <InputNumber
                        value={
                          current.unitPrice
                        }
                        min={0}
                        step={1000}
                        precision={0}
                        controls={false}
                        formatter={
                          moneyFormatter
                        }
                        parser={
                          moneyParser
                        }
                        onChange={(
                          value
                        ) =>
                          handlePriceChange(
                            current.itemId,
                            value
                          )
                        }
                        addonAfter="₫"
                        placeholder="Nhập đơn giá"
                      />

                      <small>
                        Thành tiền:{" "}
                        <strong>
                          {formatCurrency(
                            current.lineTotal
                          )}
                        </strong>
                      </small>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>

        <section className="purchase-quotation-section">
          <div className="purchase-quotation-section__heading">
            <div>
              <DollarOutlined />

              <div>
                <span>
                  CHI PHÍ CHUNG
                </span>

                <h3>
                  Phí mua hộ và vận chuyển
                </h3>
              </div>
            </div>
          </div>

          <div className="purchase-quotation-base-fee-grid">
            <div className="purchase-quotation-field">
              <label>
                <DollarOutlined />
                Phí mua hộ
              </label>

              <InputNumber
                value={
                  purchaseFee
                }
                min={0}
                step={1000}
                precision={0}
                controls={false}
                formatter={
                  moneyFormatter
                }
                parser={
                  moneyParser
                }
                onChange={(value) =>
                  setPurchaseFee(
                    normalizeMoney(
                      value
                    )
                  )
                }
                addonAfter="₫"
                placeholder="Nhập phí mua hộ"
              />

              <small>
                Phí dịch vụ hỗ trợ mua hàng.
              </small>
            </div>

            <div className="purchase-quotation-field">
              <label>
                <TruckOutlined />
                Phí vận chuyển
              </label>

              <InputNumber
                value={
                  shippingFee
                }
                min={0}
                step={1000}
                precision={0}
                controls={false}
                formatter={
                  moneyFormatter
                }
                parser={
                  moneyParser
                }
                onChange={(value) =>
                  setShippingFee(
                    normalizeMoney(
                      value
                    )
                  )
                }
                addonAfter="₫"
                placeholder="Nhập phí vận chuyển"
              />

              <small>
                Chi phí vận chuyển của yêu cầu.
              </small>
            </div>
          </div>
        </section>

        <section className="purchase-quotation-section">
          <div className="purchase-quotation-section__heading">
            <div>
              <GiftOutlined />

              <div>
                <span>
                  DỊCH VỤ ĐÃ CHỌN
                </span>

                <h3>
                  Phụ phí theo cấu hình hệ thống
                </h3>
              </div>
            </div>

            <Tag className="purchase-quotation-section__tag is-service">
              {selectedRules.length} dịch vụ
            </Tag>
          </div>

          {additionalFeeBreakdown.length ===
          0 ? (
            <div className="purchase-quotation-service-empty">
              <InfoCircleOutlined />

              <div>
                <strong>
                  Không có phụ phí dịch vụ
                </strong>

                <span>
                  Khách hàng không chọn dịch vụ
                  có quy tắc tính phí.
                </span>
              </div>
            </div>
          ) : (
            <div className="purchase-quotation-service-list">
              {additionalFeeBreakdown.map(
                (
                  current,
                  index
                ) => {
                  const rule =
                    current.rule;

                  const isInsurance =
                    getRuleCode(
                      rule
                    ).includes(
                      "INSURANCE"
                    );

                  return (
                    <article
                      key={
                        current
                          .pricingRuleId ||
                        index
                      }
                      className="purchase-quotation-service-card"
                    >
                      <div className="purchase-quotation-service-card__icon">
                        {isInsurance ? (
                          <SafetyCertificateOutlined />
                        ) : (
                          <GiftOutlined />
                        )}
                      </div>

                      <div className="purchase-quotation-service-card__content">
                        <span>
                          {rule
                            ?.ruleCode ||
                            "PRICING_RULE"}
                        </span>

                        <h4>
                          {rule
                            ?.ruleName ||
                            "Phụ phí dịch vụ"}
                        </h4>

                        <p>
                          {rule
                            ?.description ||
                            "Phụ phí được lấy từ cấu hình hệ thống."}
                        </p>

                        <div>
                          <Tag>
                            {getCalculationType(
                              rule
                            ) ===
                            "PERCENTAGE"
                              ? "Phần trăm"
                              : "Cố định"}
                          </Tag>

                          <Tag>
                            {getRuleScopeLabel(
                              rule
                            )}
                          </Tag>
                        </div>
                      </div>

                      <div className="purchase-quotation-service-card__amount">
                        <span>
                          Mức cấu hình
                        </span>

                        <strong>
                          {getRuleValueLabel(
                            rule
                          )}
                        </strong>

                        <Divider />

                        <span>
                          Thành tiền
                        </span>

                        <b>
                          {formatCurrency(
                            current.amount
                          )}
                        </b>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}

          <div className="purchase-quotation-service-note">
            <InfoCircleOutlined />

            <span>
              Phụ phí phần trăm được tính trên
              tổng tiền sản phẩm và tự áp dụng
              mức tối thiểu hoặc tối đa từ cấu hình.
              Phí đóng thùng gỗ chỉ tính một lần
              cho toàn đơn.
            </span>
          </div>
        </section>

        <section className="purchase-quotation-section">
          <div className="purchase-quotation-section__heading">
            <div>
              <FileTextOutlined />

              <div>
                <span>
                  GHI CHÚ BÁO GIÁ
                </span>

                <h3>
                  Nội dung gửi kèm báo giá
                </h3>
              </div>
            </div>
          </div>

          <TextArea
            value={note}
            onChange={(event) =>
              setNote(
                event.target.value
              )
            }
            maxLength={1000}
            showCount
            autoSize={{
              minRows: 3,
              maxRows: 6,
            }}
            placeholder="Nhập ghi chú cho khách hàng..."
            className="purchase-quotation-note-input"
          />
        </section>
      </div>

      <div className="purchase-quotation-modal__footer">
        <div className="purchase-quotation-summary">
          <div>
            <span>
              Tiền sản phẩm
            </span>

            <strong>
              {formatCurrency(
                productSubtotal
              )}
            </strong>
          </div>

          <div>
            <span>
              Phí mua hộ
            </span>

            <strong>
              {formatCurrency(
                purchaseFee
              )}
            </strong>
          </div>

          <div>
            <span>
              Phí vận chuyển
            </span>

            <strong>
              {formatCurrency(
                shippingFee
              )}
            </strong>
          </div>

          <div>
            <span>
              Phụ phí dịch vụ
            </span>

            <strong>
              {formatCurrency(
                additionalFeeTotal
              )}
            </strong>
          </div>

          <div className="purchase-quotation-summary__total">
            <span>
              Tổng báo giá
            </span>

            <strong>
              {formatCurrency(
                quotationTotal
              )}
            </strong>
          </div>
        </div>

        <div className="purchase-quotation-modal__actions">
          <Button
            size="large"
            onClick={handleClose}
            disabled={submitting}
          >
            Hủy bỏ
          </Button>

          <Tooltip
            title={
              quotationTotal <= 0
                ? "Vui lòng nhập đơn giá sản phẩm"
                : ""
            }
          >
            <Button
              type="primary"
              size="large"
              icon={
                submitting ? (
                  <CalculatorOutlined />
                ) : (
                  <SaveOutlined />
                )
              }
              loading={submitting}
              disabled={
                submitting ||
                quotationTotal <= 0
              }
              onClick={
                handleSubmit
              }
              className="purchase-quotation-submit-button"
            >
              Xác nhận tạo báo giá
            </Button>
          </Tooltip>
        </div>
      </div>
    </Modal>
  );
}
