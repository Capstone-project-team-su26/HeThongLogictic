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
  Select,
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
  SwapOutlined,
  TruckOutlined,
} from "@ant-design/icons";

import {
  createPurchaseRequestQuotationApi,
} from "../../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import {
  getActivePricingRulesApi,
  PRICING_RULE_CODE,
} from "../../../../api/SaleAPI/ConsignmentAPI/pricingRuleService";
import {
  getExchangeRatesApi,
  convertCurrencyApi,
  CURRENCY_NAMES,
} from "../../../../api/SaleAPI/ExchangeRateAPI/exchangeRateService";
import {
  getServicePricingsApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/servicePricingService";
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

const getMinRequiredOrderAmount = (rule) => {
  const condVal = normalizeNumber(rule?.conditionValue, 0);
  if (condVal > 0) {
    return condVal;
  }
  const minAmt = normalizeNumber(rule?.minAmount, 0);
  if (minAmt > 0) {
    return minAmt;
  }
  return 0;
};

const getRuleScopeLabel = (
  rule,
  packageCount = 1
) => {
  const code =
    getRuleCode(rule);
  const minRequired = getMinRequiredOrderAmount(rule);

  const map = {
    WOOD_CRATE:
      packageCount > 1
        ? `Tính theo sản phẩm (${packageCount} sản phẩm)`
        : "Theo 1 sản phẩm",

    DOMESTIC_FEE:
      "Vận chuyển nội địa",

    SUR_INSURANCE_3PERCENT:
      minRequired > 0
        ? `Theo tổng tiền sản phẩm (Đơn ≥ ${formatCurrency(minRequired)})`
        : "Theo tổng tiền sản phẩm",

    IMPORT_TAX:
      "Theo tổng tiền sản phẩm",

    VAT:
      "Theo tổng chi phí đơn hàng",

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

const calculateRuleAmountWithContext = (
  rule,
  { productSubtotal = 0, purchaseFee = 0, shippingFee = 0, packageCount = 1 } = {}
) => {
  if (!rule) return 0;
  const ruleCode = getRuleCode(rule);
  const calculationType = getCalculationType(rule);
  const conditionType = normalizeUpperText(rule?.conditionType);
  const ruleValue = normalizeMoney(rule?.value);

  if (ruleCode === PRICING_RULE_CODE.VOLUMETRIC_DIVISOR) {
    return 0;
  }

  let percentageBase = productSubtotal;

  if (ruleCode === PRICING_RULE_CODE.VAT) {
    if (conditionType === "FREIGHT_PLUS_SERVICE") {
      percentageBase = normalizeMoney(shippingFee) + normalizeMoney(purchaseFee);
    } else {
      percentageBase =
        normalizeMoney(productSubtotal) +
        normalizeMoney(purchaseFee) +
        normalizeMoney(shippingFee);
    }
  }

  let rawAmount =
    calculationType === "PERCENTAGE"
      ? percentageBase * (ruleValue / 100)
      : ruleValue;

  if (ruleCode === PRICING_RULE_CODE.WOOD_CRATE) {
    const totalPkgs = Math.max(1, packageCount);
    rawAmount = rawAmount * totalPkgs;
  }

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

  const [activeRules, setActiveRules] = useState([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (Array.isArray(pricingRules) && pricingRules.length > 0) {
      setActiveRules(pricingRules);
    } else {
      getActivePricingRulesApi()
        .then((data) => {
          if (Array.isArray(data)) {
            setActiveRules(data);
          }
        })
        .catch(() => { });
    }
  }, [open, pricingRules]);

  const effectiveRules = useMemo(() => {
    return Array.isArray(activeRules) && activeRules.length > 0
      ? activeRules
      : Array.isArray(pricingRules)
        ? pricingRules
        : [];
  }, [activeRules, pricingRules]);

  const [itemPrices, setItemPrices] = useState({});
  const [purchaseFee, setPurchaseFee] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const routeCurrencyInfo = useMemo(() => {
    const route = String(purchaseRequest?.route || "").toUpperCase();
    if (route.includes("KOREA") || route.includes("HAN") || route.includes("HÀN")) {
      return { code: "KRW", flag: "🇰🇷", name: "Won Hàn Quốc", label: "🇰🇷 KRW (Won Hàn)" };
    }
    if (route.includes("JAPAN") || route.includes("NHAT") || route.includes("NHẬT")) {
      return { code: "JPY", flag: "🇯🇵", name: "Yên Nhật", label: "🇯🇵 JPY (Yên Nhật)" };
    }
    if (route.includes("CHINA") || route.includes("TRUNG")) {
      return { code: "CNY", flag: "🇨🇳", name: "Nhân dân tệ", label: "🇨🇳 CNY (Nhân dân tệ)" };
    }
    if (route.includes("USA") || route.includes("MY") || route.includes("MỸ") || route.includes("US")) {
      return { code: "USD", flag: "🇺🇸", name: "Đô la Mỹ", label: "🇺🇸 USD (Đô la Mỹ)" };
    }
    return { code: "CNY", flag: "🇨🇳", name: "Nhân dân tệ", label: "🇨🇳 CNY (Nhân dân tệ)" };
  }, [purchaseRequest?.route]);

  const defaultCurrency = routeCurrencyInfo.code;

  const [exchangeRates, setExchangeRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [foreignInputs, setForeignInputs] = useState({});

  const [servicePricings, setServicePricings] = useState([]);
  const [loadingPricings, setLoadingPricings] = useState(false);
  const [selectedPricingId, setSelectedPricingId] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoadingRates(true);
    getExchangeRatesApi({ activeOnly: true })
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setExchangeRates(list);
        }
      })
      .catch((err) => {
        console.error("GET EXCHANGE RATES ERROR:", err);
      })
      .finally(() => {
        setLoadingRates(false);
      });

    setLoadingPricings(true);
    getServicePricingsApi()
      .then((list) => {
        if (Array.isArray(list)) {
          setServicePricings(list);
        }
      })
      .catch((err) => {
        console.error("GET SERVICE PRICINGS ERROR:", err);
      })
      .finally(() => {
        setLoadingPricings(false);
      });
  }, [open]);

  const autoMatchedServicePricing = useMemo(() => {
    if (!Array.isArray(servicePricings) || servicePricings.length === 0) return null;

    const routeText = String(purchaseRequest?.route || "").toUpperCase();
    const shippingOptionText = String(purchaseRequest?.shippingOption || "").toUpperCase();

    let targetOrigin = "";
    if (routeText.includes("KOREA") || routeText.includes("HAN") || routeText.includes("HÀN")) {
      targetOrigin = "KOREA";
    } else if (routeText.includes("JAPAN") || routeText.includes("NHAT") || routeText.includes("NHẬT")) {
      targetOrigin = "JAPAN";
    } else if (routeText.includes("CHINA") || routeText.includes("TRUNG")) {
      targetOrigin = "CHINA";
    } else if (routeText.includes("USA") || routeText.includes("MY") || routeText.includes("MỸ") || routeText.includes("US")) {
      targetOrigin = "USA";
    }

    const byRoute = servicePricings.filter((sp) => {
      const origin = String(sp.originCountry || sp.originCountryDisplayName || "").toUpperCase();
      if (targetOrigin === "CHINA") return origin.includes("CHINA") || origin.includes("CN") || origin.includes("TRUNG");
      if (targetOrigin === "KOREA") return origin.includes("KOREA") || origin.includes("KR") || origin.includes("HÀN");
      if (targetOrigin === "JAPAN") return origin.includes("JAPAN") || origin.includes("JP") || origin.includes("NHẬT");
      if (targetOrigin === "USA") return origin.includes("USA") || origin.includes("US") || origin.includes("MỸ");
      return true;
    });

    if (byRoute.length === 0) return null;

    if (shippingOptionText) {
      const byOption = byRoute.find((sp) => {
        const serviceType = String(sp.serviceType || sp.serviceTypeDisplayName || "").toUpperCase();
        return serviceType.includes(shippingOptionText) || shippingOptionText.includes(serviceType);
      });
      if (byOption) return byOption;
    }

    return byRoute[0];
  }, [servicePricings, purchaseRequest?.route, purchaseRequest?.shippingOption]);

  const matchedPurchaseFeeRule = useMemo(() => {
    if (!Array.isArray(effectiveRules) || effectiveRules.length === 0) return null;
    return effectiveRules.find((rule) => {
      const type = String(rule?.ruleType || "").toUpperCase();
      const code = String(rule?.ruleCode || "").toUpperCase();
      return type === "PURCHASE_FEE" || code === "PURCHASE_FEE_FIXED" || code.includes("PURCHASE_FEE");
    });
  }, [effectiveRules]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setItemPrices(
      buildInitialPrices(
        items
      )
    );

    const defaultPurchaseFee = Number(matchedPurchaseFeeRule?.value) || 50000;
    setPurchaseFee(defaultPurchaseFee);
    setShippingFee(0);
    setNote("");
    setFormError("");
    setSubmitting(false);
    setForeignInputs({});
  }, [
    items,
    open,
    purchaseRequest?.purchaseRequestId,
    matchedPurchaseFeeRule,
  ]);

  // Auto-fill shipping fee from exact matched route + shippingOption
  useEffect(() => {
    if (!open) return;
    if (autoMatchedServicePricing) {
      const basePrice = Number(autoMatchedServicePricing.price) || 0;
      const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
      const calculatedFee = basePrice > 0 ? basePrice * (totalQty > 0 ? totalQty : 1) : basePrice;
      setShippingFee(calculatedFee > 0 ? calculatedFee : basePrice);
    }
  }, [autoMatchedServicePricing, open, items]);

  const handleConvertForeignPrice = async (itemId, currency, amount) => {
    if (!itemId) return;

    const selectedCurr = currency || foreignInputs[itemId]?.currency || defaultCurrency;
    const numAmount = Number(amount);

    if (amount === null || amount === undefined || amount === "" || !Number.isFinite(numAmount) || numAmount <= 0) {
      handlePriceChange(itemId, 0);
      setForeignInputs((prev) => ({
        ...prev,
        [itemId]: {
          currency: selectedCurr,
          amount: null,
          convertedVnd: 0,
          rate: 0,
        },
      }));
      return;
    }

    try {
      const convertRes = await convertCurrencyApi(selectedCurr, numAmount);
      const vndVal = Math.round(Number(convertRes?.amountVnd) || 0);

      handlePriceChange(itemId, vndVal);
      setForeignInputs((prev) => ({
        ...prev,
        [itemId]: {
          currency: selectedCurr,
          amount: numAmount,
          convertedVnd: vndVal,
          rate: Number(convertRes?.exchangeRate) || 0,
        },
      }));
    } catch (err) {
      const rateObj = exchangeRates.find((r) => r.currencyCode === selectedCurr);
      const rate = Number(rateObj?.rateToVnd) || 0;
      if (rate > 0) {
        const calculatedVnd = Math.round(numAmount * rate);
        handlePriceChange(itemId, calculatedVnd);
        setForeignInputs((prev) => ({
          ...prev,
          [itemId]: {
            currency: selectedCurr,
            amount: numAmount,
            convertedVnd: calculatedVnd,
            rate,
          },
        }));
      } else {
        handlePriceChange(itemId, 0);
        AuthNotify.error("Quy đổi thất bại", err?.message || "Không thể lấy tỷ giá quy đổi.");
      }
    }
  };

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

  const selectedRuleIds = useMemo(() => {
    return new Set(
      Array.isArray(purchaseRequest?.pricingRuleIds)
        ? purchaseRequest.pricingRuleIds.map(normalizeText).filter(Boolean)
        : []
    );
  }, [purchaseRequest?.pricingRuleIds]);

  const packageCount = useMemo(() => {
    if (Array.isArray(items) && items.length > 0) {
      return items.length;
    }
    return 1;
  }, [items]);

  const additionalFeeBreakdown = useMemo(() => {
    const list = [];
    const processedRuleIds = new Set();

    effectiveRules.forEach((rule) => {
      const ruleId = getRuleId(rule);
      const ruleCode = getRuleCode(rule);
      if (!ruleId || processedRuleIds.has(ruleId)) return;
      if (ruleCode === PRICING_RULE_CODE.VOLUMETRIC_DIVISOR) {
        return;
      }

      const isImportTax = ruleCode === PRICING_RULE_CODE.IMPORT_TAX;
      const isVat = ruleCode === PRICING_RULE_CODE.VAT;
      const isInsurance =
        ruleCode === PRICING_RULE_CODE.SUR_INSURANCE_3PERCENT ||
        ruleCode.includes("INSURANCE");
      const isWoodCrate = ruleCode === PRICING_RULE_CODE.WOOD_CRATE;
      const isInspection = ruleCode === PRICING_RULE_CODE.SUR_INSPECTION;
      const isDomesticFee =
        ruleCode === PRICING_RULE_CODE.DOMESTIC_FEE ||
        ruleCode === "DOMESTIC_FEE";

      let isRequested = selectedRuleIds.has(ruleId);
      if (isImportTax || isVat || isDomesticFee) {
        isRequested = true;
      } else if (isInsurance && purchaseRequest?.requiresInsurance) {
        isRequested = true;
      } else if (isWoodCrate && purchaseRequest?.requiresWoodenCrate) {
        isRequested = true;
      } else if (isInspection && purchaseRequest?.requiresInspection) {
        isRequested = true;
      }

      if (!isRequested) return;

      processedRuleIds.add(ruleId);

      let amount = 0;
      let isSkipped = false;
      let skipReason = "";

      if (isInsurance) {
        const minOrderAmount = getMinRequiredOrderAmount(rule);
        if (minOrderAmount > 0 && productSubtotal < minOrderAmount) {
          isSkipped = true;
          skipReason = `Đơn hàng chưa đạt mức tối thiểu ${formatCurrency(minOrderAmount)} - Không áp dụng bảo hiểm`;
          amount = 0;
        } else {
          amount = calculateRuleAmountWithContext(rule, {
            productSubtotal,
            purchaseFee,
            shippingFee,
            packageCount,
          });
        }
      } else {
        amount = calculateRuleAmountWithContext(rule, {
          productSubtotal,
          purchaseFee,
          shippingFee,
          packageCount,
        });
      }

      list.push({
        rule,
        pricingRuleId: ruleId,
        ruleCode,
        ruleName: rule?.ruleName || "Phụ phí dịch vụ",
        amount,
        isSkipped,
        skipReason,
        isTaxOrVat: isImportTax || isVat,
        isInsurance,
        isDomesticFee,
      });
    });

    return list;
  }, [
    effectiveRules,
    purchaseRequest?.pricingRuleIds,
    purchaseRequest?.requiresInsurance,
    purchaseRequest?.requiresWoodenCrate,
    purchaseRequest?.requiresInspection,
    selectedRuleIds,
    productSubtotal,
    purchaseFee,
    shippingFee,
    packageCount,
  ]);

  const additionalFeeTotal = useMemo(
    () =>
      additionalFeeBreakdown.reduce(
        (total, current) => total + (current.isSkipped ? 0 : current.amount),
        0
      ),
    [additionalFeeBreakdown]
  );

  const quotationTotal = useMemo(
    () =>
      roundMoney(
        productSubtotal +
        normalizeMoney(purchaseFee) +
        normalizeMoney(shippingFee) +
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
      return `Vui lòng nhập đơn giá lớn hơn 0 cho sản phẩm "${invalidPriceItem
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
          additionalFeeBreakdown
            .filter((current) => !current.isSkipped && current.amount > 0)
            .map((current) => {
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
            }),
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
            Quy tắc dịch vụ & thuế
          </span>
          <strong>
            {additionalFeeBreakdown.filter((item) => !item.isSkipped).length}
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

                const currentForeign = foreignInputs[current.itemId] || {};

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
                    </div>

                    <div className="purchase-quotation-item__price">
                      <div className="pricing-card-box">
                        <div className="pricing-field-group">
                          <div className="pricing-field-header">
                            <label className="pricing-field-label">
                              Giá ngoại tệ ({routeCurrencyInfo.code}) <b className="required-star">*</b>
                            </label>
                            <span className="currency-pill-badge">
                              {routeCurrencyInfo.flag} {routeCurrencyInfo.code} • {routeCurrencyInfo.name}
                            </span>
                          </div>

                          <InputNumber
                            value={currentForeign.amount ?? null}
                            placeholder={`Nhập số tiền (${routeCurrencyInfo.code})`}
                            min={0}
                            precision={0}
                            controls={false}
                            addonAfter={routeCurrencyInfo.code}
                            formatter={(val) => (val ? `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "")}
                            parser={(val) => (val ? val.replace(/[^0-9]/g, "") : "")}
                            onKeyDown={(e) => {
                              if (
                                !/[0-9]/.test(e.key) &&
                                !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) &&
                                !e.ctrlKey &&
                                !e.metaKey
                              ) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(amount) => {
                              handleConvertForeignPrice(current.itemId, routeCurrencyInfo.code, amount);
                            }}
                            className="premium-price-input"
                          />
                        </div>

                        <div className="pricing-field-group">
                          <div className="pricing-field-header">
                            <label className="pricing-field-label">
                              Đơn giá quy đổi (VNĐ)
                            </label>
                            {currentForeign.convertedVnd > 0 && currentForeign.amount > 0 && (
                              <span className="rate-info-chip">
                                💡 1 {currentForeign.currency} = {formatNumber(currentForeign.rate)} ₫
                              </span>
                            )}
                          </div>

                          <InputNumber
                            value={current.unitPrice || null}
                            placeholder="Tự động quy đổi từ giá ngoại tệ"
                            min={0}
                            disabled
                            controls={false}
                            formatter={moneyFormatter}
                            addonAfter="₫"
                            className="premium-price-input is-vnd"
                          />
                        </div>

                        <div className="pricing-card-footer">
                          <span className="line-item-qty">
                            Số lượng: <strong>{formatNumber(current.quantity)}</strong> sản phẩm
                          </span>

                          <span className="line-item-total">
                            Thành tiền: <strong>{formatCurrency(current.lineTotal || 0)}</strong>
                          </span>
                        </div>
                      </div>
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
                {matchedPurchaseFeeRule
                  ? `💡 ${matchedPurchaseFeeRule.ruleName || 'Phí dịch vụ mua hộ cố định (50.000 VNĐ)'}.`
                  : "Phí dịch vụ mua hộ cố định (50.000 VNĐ) mỗi đơn hàng."}
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
                  DỊCH VỤ & THUẾ
                </span>

                <h3>
                  Phụ phí & Quy tắc thuế theo hệ thống
                </h3>
              </div>
            </div>

            <Tag className="purchase-quotation-section__tag is-service">
              {additionalFeeBreakdown.filter((item) => !item.isSkipped).length} quy tắc áp dụng
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
                  Khách hàng không chọn dịch vụ có quy tắc tính phí.
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
                  const rule = current.rule;
                  const isInsurance = current.isInsurance;
                  const isSkipped = current.isSkipped;
                  const isTaxOrVat = current.isTaxOrVat;

                  return (
                    <article
                      key={
                        current.pricingRuleId || index
                      }
                      className={`purchase-quotation-service-card ${isSkipped
                        ? "is-disabled"
                        : isTaxOrVat
                          ? "is-tax-vat"
                          : isInsurance
                            ? "is-insurance-card"
                            : ""
                        }`}
                    >
                      <div className="purchase-quotation-service-card__icon">
                        {isInsurance ? (
                          <SafetyCertificateOutlined />
                        ) : current.isDomesticFee ? (
                          <TruckOutlined />
                        ) : isTaxOrVat ? (
                          <DollarOutlined />
                        ) : (
                          <GiftOutlined />
                        )}
                      </div>

                      <div className="purchase-quotation-service-card__content">
                        <span>
                          {rule?.ruleCode || "PRICING_RULE"}
                        </span>

                        <h4>
                          {rule?.ruleName || "Phụ phí dịch vụ"}
                        </h4>

                        <p>
                          {isSkipped
                            ? current.skipReason
                            : rule?.description ||
                            "Phụ phí được lấy từ cấu hình hệ thống."}
                        </p>

                        <div>
                          <Tag>
                            {getCalculationType(rule) === "PERCENTAGE"
                              ? "Phần trăm"
                              : "Cố định"}
                          </Tag>

                          <Tag>
                            {getRuleScopeLabel(rule, packageCount)}
                          </Tag>

                          {isSkipped && (
                            <Tag color="warning">
                              Chưa đạt tối thiểu (&lt; {formatCurrency(getMinRequiredOrderAmount(rule))})
                            </Tag>
                          )}
                        </div>
                      </div>

                      <div className="purchase-quotation-service-card__amount">
                        <span>
                          Mức cấu hình
                        </span>

                        <strong>
                          {getRuleValueLabel(rule)}
                        </strong>

                        <Divider />

                        <span>
                          Thành tiền
                        </span>

                        <b style={{ color: isSkipped ? "#8c8c8c" : undefined }}>
                          {isSkipped
                            ? "0 ₫ (Bỏ qua)"
                            : formatCurrency(current.amount)}
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
              Thuế nhập khẩu và VAT được tự động tính theo quy tắc hệ thống và đơn giá đã nhập.
              Bảo hiểm hàng hóa chỉ áp dụng khi tổng tiền sản phẩm đạt mức tối thiểu theo cấu hình quy tắc.
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

          {(() => {
            const activeFees = additionalFeeBreakdown.filter((item) => !item.isSkipped);
            if (activeFees.length === 0) return null;
            const activeFeesTotal = activeFees.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            const tooltipContent = (
              <div style={{ padding: "4px 2px" }}>
                <div style={{ fontWeight: 800, marginBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "4px" }}>
                  Chi tiết {activeFees.length} khoản phụ phí & thuế:
                </div>
                {activeFees.map((fee) => (
                  <div key={fee.pricingRuleId} style={{ display: "flex", justifyContent: "space-between", gap: "16px", fontSize: "12px", lineHeight: "1.6" }}>
                    <span>• {fee.ruleName}</span>
                    <strong>{formatCurrency(fee.amount)}</strong>
                  </div>
                ))}
              </div>
            );

            return (
              <div>
                <Tooltip title={tooltipContent} placement="top">
                  <span style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    Phụ phí & thuế ({activeFees.length} khoản) <InfoCircleOutlined style={{ fontSize: "12px", color: "#60a5fa" }} />
                  </span>
                </Tooltip>

                <strong>
                  {formatCurrency(activeFeesTotal)}
                </strong>
              </div>
            );
          })()}

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
