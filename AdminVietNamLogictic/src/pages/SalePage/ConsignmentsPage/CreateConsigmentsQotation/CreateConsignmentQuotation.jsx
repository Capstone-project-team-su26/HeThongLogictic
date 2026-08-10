import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  InboxOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";

import {
  getConsignmentDetailApi,
  sendQuotationApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/consignmentService";
import {
  getActivePricingRulesApi,
  findPricingRuleByCode,
  calculatePricingRuleAmount,
  PRICING_RULE_CODE,
} from "../../../../api/SaleAPI/ConsignmentAPI/pricingRuleService";
import {
  getOriginWarehousesApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/warehouseService";
import {
  getServicePricingsApi,
  findMatchingServicePricing,
} from "../../../../api/SaleAPI/ConsignmentAPI/servicePricingService";
import {
  getActivePackageConfigurationsApi,
  calculateItemsPackageFee,
  calculateItemPackageFee,
  resolveItemPackageConfiguration,
  getPackageConfigurationDisplayName,
} from "../../../../api/SaleAPI/ConsignmentAPI/packageConfigurationService";

import AuthNotify from "../../../../utils/Common/AuthNotify";
import {
  getBrowserTimeInfo,
  getSyncedNowUtcIso,
} from "../../../../utils/timeUtc";
import ConfirmConsignmentQuotation from "./ConfirmCrearConssigemtQuotaion/ConfirmConsignmentQuotation";
import "./CreateConsignmentQuotation.css";

/* =========================
   TRẠNG THÁI
========================= */

const ORDER_STATUS_CONFIG = {
  PENDING_REVIEW: {
    label: "Chờ duyệt",
    className: "is-warning",
  },
  QUOTATION_SENT: {
    label: "Đã gửi báo giá",
    className: "is-info",
  },
  WAITING_DEPOSIT: {
    label: "Chờ đặt cọc",
    className: "is-warning",
  },
  DEPOSIT_PAID: {
    label: "Đã đặt cọc",
    className: "is-success",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "is-info",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className: "is-success",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "is-danger",
  },
};

const DIM_DECIMAL_PLACES = 4;

/* =========================
   HÀM CHUẨN HÓA
========================= */

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const normalizePositiveNumber = (
  value,
  fallback = 0
) => {
  return Math.max(
    0,
    normalizeNumber(value, fallback)
  );
};

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const normalizeSearchText = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .toUpperCase();

const roundToDecimals = (
  value,
  decimals = DIM_DECIMAL_PLACES
) => {
  const factor = 10 ** decimals;

  return (
    Math.round(
      (
        normalizeNumber(value, 0) +
        Number.EPSILON
      ) *
      factor
    ) / factor
  );
};

const roundMoney = (value) =>
  Math.round(
    normalizePositiveNumber(value)
  );

const getClientUtcPayload = () => {
  const browserTime =
    getBrowserTimeInfo();
  const submittedAtUtc =
    getSyncedNowUtcIso();

  return {
    submittedAtUtc,
    clientSubmittedAtUtc:
      submittedAtUtc,
    clientTimeZone:
      browserTime.timeZone,
    clientUtcOffset:
      browserTime.utcOffsetText,
    clientUtcOffsetMinutes:
      browserTime.utcOffsetMinutes,
  };
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundMoney(value));
};

const formatMeasurement = (
  value,
  maximumFractionDigits = 4
) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
    useGrouping: true,
  }).format(number);
};

const formatDimWeight = (value) => {
  const number =
    normalizePositiveNumber(value);

  return new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits:
        DIM_DECIMAL_PLACES,

      maximumFractionDigits:
        DIM_DECIMAL_PLACES,

      useGrouping: true,
    }
  ).format(
    roundToDecimals(
      number,
      DIM_DECIMAL_PLACES
    )
  );
};

const translateConsignmentType = (
  value
) => {
  const normalizedValue =
    normalizeSearchText(value)
      .replace(/[^A-Z0-9]/g, "");

  const map = {
    EXPRESS: "Hỏa tốc",
    EXPEDITED: "Hỏa tốc",
    HOATOC: "Hỏa tốc",
    STANDARD: "Tiêu chuẩn",
    TIEUCHUAN: "Tiêu chuẩn",
    ECONOMY: "Tiết kiệm",
    TIETKIEM: "Tiết kiệm",
  };

  return (
    map[normalizedValue] ||
    normalizeText(value) ||
    "Chưa xác định"
  );
};

const normalizeServiceTypeCode = (
  value
) => {
  const normalizedValue =
    normalizeSearchText(value)
      .replace(/[^A-Z0-9]/g, "");

  const map = {
    EXPRESS: "EXPRESS",
    EXPEDITED: "EXPRESS",
    HOATOC: "EXPRESS",
    STANDARD: "STANDARD",
    TIEUCHUAN: "STANDARD",
    ECONOMY: "ECONOMY",
    TIETKIEM: "ECONOMY",
  };

  return (
    map[normalizedValue] ||
    normalizedValue
  );
};

const normalizeCountryCode = (
  value
) => {
  const normalizedValue =
    normalizeSearchText(value)
      .replace(/[^A-Z0-9]/g, "");

  const map = {
    CN: "CN",
    CHINA: "CN",
    TRUNGQUOC: "CN",

    JP: "JP",
    JAPAN: "JP",
    NHATBAN: "JP",

    KR: "KR",
    KOREA: "KR",
    SOUTHKOREA: "KR",
    HANQUOC: "KR",

    VN: "VN",
    VIETNAM: "VN",
  };

  return (
    map[normalizedValue] ||
    normalizedValue
  );
};

const getCountryName = (code) => {
  const map = {
    CN: "Trung Quốc",
    JP: "Nhật Bản",
    KR: "Hàn Quốc",
    VN: "Việt Nam",
  };

  return map[code] || code || "Chưa xác định";
};

const parseRouteCountries = (route) => {
  const parts = normalizeText(route)
    .split(/-->|->|→|⇒| đến /i)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    originCountry:
      parts[0] || "",
    destinationCountry:
      parts[parts.length - 1] || "",
  };
};

const getOrderStatus = (status) => {
  return (
    ORDER_STATUS_CONFIG[
    normalizeUpperText(status)
    ] || {
      label:
        normalizeText(status) ||
        "Chưa xác định",
      className: "is-default",
    }
  );
};

const getUnitTypeLabel = (unitType) => {
  const map = {
    KG: "Theo khối lượng tính cước",
    M3: "Theo thể tích",
    PACKAGE: "Theo số kiện",
  };

  return (
    map[normalizeUpperText(unitType)] ||
    "Theo đơn vị của bảng giá"
  );
};

const getUnitSuffix = (unitType) => {
  const map = {
    KG: "kg",
    M3: "m³",
    PACKAGE: "kiện",
  };

  return (
    map[normalizeUpperText(unitType)] ||
    ""
  );
};

/* =========================
   KIỆN HÀNG VÀ DIM
========================= */

const getItemWeightKg = (item) =>
  normalizePositiveNumber(
    item?.weight ??
    item?.actualWeight ??
    item?.totalWeight ??
    item?.weightKg
  );

const getItemLengthCm = (item) =>
  normalizePositiveNumber(
    item?.length ??
    item?.lengthCm
  );

const getItemWidthCm = (item) =>
  normalizePositiveNumber(
    item?.width ??
    item?.widthCm
  );

const getItemHeightCm = (item) =>
  normalizePositiveNumber(
    item?.height ??
    item?.heightCm
  );

const getItemDeclaredValue = (item) =>
  normalizePositiveNumber(
    item?.declaredValue
  );

const calculateItemVolumeCm3 = (
  item
) => {
  const length = getItemLengthCm(item);
  const width = getItemWidthCm(item);
  const height = getItemHeightCm(item);

  if (
    length <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return 0;
  }

  return length * width * height;
};

const calculateItemDimKg = (
  item,
  divisor
) => {
  const returnedDim =
    Number(item?.volumetricWeight);

  if (
    Number.isFinite(returnedDim) &&
    returnedDim >= 0
  ) {
    return returnedDim;
  }

  const validDivisor =
    normalizePositiveNumber(divisor);

  if (validDivisor <= 0) {
    return 0;
  }

  return (
    calculateItemVolumeCm3(item) /
    validDivisor
  );
};

/* =========================
   CHỌN KHO THEO TUYẾN
========================= */

const WAREHOUSE_COUNTRY_KEYWORDS = {
  CN: [
    "CN",
    "CHINA",
    "TRUNG QUOC",
    "QUANG CHAU",
    "GUANGZHOU",
    "SHENZHEN",
  ],
  JP: [
    "JP",
    "JAPAN",
    "NHAT BAN",
    "TOKYO",
    "OSAKA",
  ],
  KR: [
    "KR",
    "KOREA",
    "HAN QUOC",
    "SEOUL",
    "BUSAN",
  ],
  VN: [
    "VN",
    "VIET NAM",
    "VIETNAM",
    "HCM",
    "HA NOI",
  ],
};

const warehouseMatchesCountry = (
  warehouse,
  countryCode
) => {
  if (!countryCode) {
    return false;
  }

  const code =
    normalizeSearchText(
      warehouse?.code
    );

  if (
    code === countryCode ||
    code.startsWith(`${countryCode}-`) ||
    code.startsWith(countryCode)
  ) {
    return true;
  }

  const searchableText =
    normalizeSearchText(
      [
        warehouse?.name,
        warehouse?.code,
        warehouse?.address,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const keywords =
    WAREHOUSE_COUNTRY_KEYWORDS[
    countryCode
    ] || [];

  return keywords.some((keyword) =>
    searchableText.includes(
      normalizeSearchText(keyword)
    )
  );
};

/* =========================
   PHỤ PHÍ KHÁCH ĐÃ CHỌN
========================= */

const getSelectedRuleIds = (detail) => {
  return new Set(
    Array.isArray(detail?.pricingRuleIds)
      ? detail.pricingRuleIds
        .map(normalizeText)
        .filter(Boolean)
      : []
  );
};

const isRuleSelectedByCustomer = (
  rule,
  detail
) => {
  const ruleId =
    normalizeText(rule?.id);

  const ruleCode =
    normalizeUpperText(
      rule?.ruleCode
    );

  const selectedIds =
    getSelectedRuleIds(detail);

  if (
    ruleId &&
    selectedIds.has(ruleId)
  ) {
    return true;
  }

  const note =
    normalizeUpperText(
      detail?.note
    );

  if (
    ruleCode &&
    note.includes(ruleCode)
  ) {
    return true;
  }

  if (
    ruleCode ===
    PRICING_RULE_CODE
      .SUR_INSPECTION &&
    detail?.requiresInspection === true
  ) {
    return true;
  }

  return false;
};

const isRuleEligible = (
  rule,
  {
    declaredValue = 0,
    requiresInspection = false,
  } = {}
) => {
  const conditionType =
    normalizeUpperText(
      rule?.conditionType
    );

  if (
    conditionType ===
    "REQUIRES_INSPECTION"
  ) {
    return Boolean(
      requiresInspection
    );
  }

  if (
    conditionType ===
    "MIN_DECLARED_VALUE"
  ) {
    return (
      normalizePositiveNumber(
        declaredValue
      ) >=
      normalizePositiveNumber(
        rule?.conditionValue
      )
    );
  }

  return true;
};

/* =========================
   HIỂN THỊ TẢI DỮ LIỆU
========================= */

function PageLoading() {
  return (
    <main className="quotation-create-page">
      <div className="quotation-create-loading">
        <Skeleton.Button
          active
          size="small"
        />

        <Skeleton
          active
          paragraph={{ rows: 8 }}
        />
      </div>
    </main>
  );
}


/* =========================
   KẾT QUẢ TÍNH BÁO GIÁ
========================= */

const getFiniteMoney = (
  ...values
) => {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return Math.round(
        Math.max(0, number)
      );
    }
  }

  return 0;
};


/* =========================
   COMPONENT
========================= */

export default function CreateConsignmentQuotation() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const orderId =
    params?.orderId ||
    location?.state?.consignment
      ?.orderId ||
    location?.state?.orderId ||
    "";

  const [form] = Form.useForm();

  const [detail, setDetail] =
    useState(null);

  const [
    pricingRules,
    setPricingRules,
  ] = useState([]);

  const [
    warehouses,
    setWarehouses,
  ] = useState([]);

  const [
    servicePricings,
    setServicePricings,
  ] = useState([]);

  const [
    packageConfigurations,
    setPackageConfigurations,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [
    quotationSubmitted,
    setQuotationSubmitted,
  ] = useState(false);

  const quotationSubmitLockRef =
    useRef(false);

  const [error, setError] =
    useState("");

  const [
    warningMessage,
    setWarningMessage,
  ] = useState("");

  const [
    confirmationOpen,
    setConfirmationOpen,
  ] = useState(false);

  const [
    confirmationData,
    setConfirmationData,
  ] = useState(null);

  const [
    pendingPayload,
    setPendingPayload,
  ] = useState(null);

  const [
    selectedWarehouseId,
    setSelectedWarehouseId,
  ] = useState("");

  const loadPageData =
    useCallback(async () => {
      if (!orderId) {
        setError(
          "Không tìm thấy mã đơn ký gửi."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setWarningMessage("");

        const [
          detailResult,
          ruleResult,
          warehouseResult,
          pricingResult,
          packageResult,
        ] = await Promise.allSettled([
          getConsignmentDetailApi(
            orderId
          ),
          getActivePricingRulesApi(),
          getOriginWarehousesApi(),
          getServicePricingsApi(),
          getActivePackageConfigurationsApi(),
        ]);

        if (
          detailResult.status ===
          "rejected"
        ) {
          throw detailResult.reason;
        }

        setDetail(
          detailResult.value || null
        );

        setPricingRules(
          ruleResult.status ===
            "fulfilled" &&
            Array.isArray(
              ruleResult.value
            )
            ? ruleResult.value
            : []
        );

        setWarehouses(
          warehouseResult.status ===
            "fulfilled" &&
            Array.isArray(
              warehouseResult.value
            )
            ? warehouseResult.value
            : []
        );

        setServicePricings(
          pricingResult.status ===
            "fulfilled" &&
            Array.isArray(
              pricingResult.value
            )
            ? pricingResult.value
            : []
        );

        setPackageConfigurations(
          packageResult.status ===
            "fulfilled" &&
            Array.isArray(
              packageResult.value
            )
            ? packageResult.value
            : []
        );

        const warnings = [];

        if (
          ruleResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được cấu hình phí và thuế."
          );
        }

        if (
          warehouseResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được danh sách kho gửi hàng."
          );
        }

        if (
          pricingResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được bảng giá vận chuyển."
          );
        }

        if (
          packageResult.status ===
          "rejected"
        ) {
          warnings.push(
            "Không tải được cấu hình đóng gói."
          );
        }

        setWarningMessage(
          warnings.join(" ")
        );
      } catch (requestError) {
        const message =
          requestError?.response?.data
            ?.message ||
          requestError?.response?.data
            ?.error ||
          requestError?.message ||
          "Không thể tải thông tin lập báo giá.";

        setError(message);

        AuthNotify.error(
          "Tải dữ liệu thất bại",
          message
        );
      } finally {
        setLoading(false);
      }
    }, [orderId]);

  useEffect(() => {
    quotationSubmitLockRef.current =
      false;

    const resetTimer = window.setTimeout(
      () => {
        setQuotationSubmitted(false);
        loadPageData();
      },
      0
    );

    return () =>
      window.clearTimeout(resetTimer);
  }, [loadPageData, orderId]);

  const items = useMemo(() => {
    return Array.isArray(
      detail?.items
    )
      ? detail.items
      : [];
  }, [detail]);

  const orderStatus =
    useMemo(
      () =>
        getOrderStatus(
          detail?.status
        ),
      [detail?.status]
    );

  const routeCountries =
    useMemo(
      () =>
        parseRouteCountries(
          detail?.route
        ),
      [detail?.route]
    );

  const routeCountryCodes =
    useMemo(
      () => ({
        originCountry:
          normalizeCountryCode(
            routeCountries
              .originCountry
          ),
        destinationCountry:
          normalizeCountryCode(
            routeCountries
              .destinationCountry
          ),
      }),
      [routeCountries]
    );

  const matchedWarehouses =
    useMemo(() => {
      const matches =
        warehouses.filter(
          (warehouse) =>
            warehouseMatchesCountry(
              warehouse,
              routeCountryCodes
                .originCountry
            )
        );

      return matches.sort(
        (a, b) =>
          normalizeText(
            a?.name
          ).localeCompare(
            normalizeText(b?.name),
            "vi"
          )
      );
    }, [
      warehouses,
      routeCountryCodes
        .originCountry,
    ]);

  const warehouseOptions =
    useMemo(() => {
      return matchedWarehouses.map(
        (warehouse) => ({
          value: normalizeText(
            warehouse?.id
          ),
          label:
            normalizeText(
              warehouse?.name
            ) || "Kho gửi hàng",
          searchText:
            normalizeSearchText(
              [
                warehouse?.name,
                warehouse?.code,
                warehouse?.address,
              ]
                .filter(Boolean)
                .join(" ")
            ),
        })
      );
    }, [matchedWarehouses]);

  useEffect(() => {
    const warehouseTimer =
      window.setTimeout(() => {
        if (
          matchedWarehouses.length === 0
        ) {
          setSelectedWarehouseId("");
          return;
        }

        const quotationWarehouseId =
          normalizeText(
            detail?.quotation?.warehouseId
          );

        setSelectedWarehouseId(
          (currentWarehouseId) => {
            const currentStillValid =
              matchedWarehouses.some(
                (warehouse) =>
                  normalizeText(
                    warehouse?.id
                  ) ===
                  normalizeText(
                    currentWarehouseId
                  )
              );

            if (currentStillValid) {
              return currentWarehouseId;
            }

            const quotationWarehouseExists =
              matchedWarehouses.some(
                (warehouse) =>
                  normalizeText(
                    warehouse?.id
                  ) ===
                  quotationWarehouseId
              );

            if (
              quotationWarehouseExists
            ) {
              return quotationWarehouseId;
            }

            return normalizeText(
              matchedWarehouses[0]?.id
            );
          }
        );
      }, 0);

    return () =>
      window.clearTimeout(
        warehouseTimer
      );
  }, [
    detail?.quotation?.warehouseId,
    matchedWarehouses,
  ]);

  const selectedWarehouse =
    useMemo(() => {
      return (
        matchedWarehouses.find(
          (warehouse) =>
            normalizeText(
              warehouse?.id
            ) ===
            normalizeText(
              selectedWarehouseId
            )
        ) || null
      );
    }, [
      matchedWarehouses,
      selectedWarehouseId,
    ]);

  const selectedServicePricing =
    useMemo(() => {
      const serviceType =
        normalizeServiceTypeCode(
          detail?.consignmentType
        );

      const quotationPricingId =
        normalizeText(
          detail?.quotation
            ?.servicePricingId
        );

      const existingPricing =
        servicePricings.find(
          (pricing) =>
            normalizeText(
              pricing?.id
            ) ===
            quotationPricingId &&
            normalizeUpperText(
              pricing?.serviceType
            ) === serviceType &&
            normalizeCountryCode(
              pricing?.originCountry
            ) ===
            routeCountryCodes
              .originCountry &&
            normalizeCountryCode(
              pricing
                ?.destinationCountry
            ) ===
            routeCountryCodes
              .destinationCountry
        );

      if (existingPricing) {
        return existingPricing;
      }

      return findMatchingServicePricing(
        servicePricings,
        {
          serviceType,
          originCountry:
            routeCountryCodes
              .originCountry,
          destinationCountry:
            routeCountryCodes
              .destinationCountry,
        }
      );
    }, [
      detail?.consignmentType,
      detail?.quotation
        ?.servicePricingId,
      routeCountryCodes,
      servicePricings,
    ]);

  const dimRule =
    useMemo(
      () =>
        findPricingRuleByCode(
          pricingRules,
          PRICING_RULE_CODE
            .VOLUMETRIC_DIVISOR
        ),
      [pricingRules]
    );

  const dimDivisor =
    normalizePositiveNumber(
      dimRule?.value
    );

  const packageCount =
    items.length;

  const totalWeightKg =
    useMemo(() => {
      const returnedWeight =
        normalizePositiveNumber(
          detail?.totalWeight
        );

      if (returnedWeight > 0) {
        return returnedWeight;
      }

      return items.reduce(
        (total, item) =>
          total +
          getItemWeightKg(item),
        0
      );
    }, [
      detail?.totalWeight,
      items,
    ]);

  const totalVolumeCm3 =
    useMemo(() => {
      const returnedVolume =
        normalizePositiveNumber(
          detail?.totalVolume
        );

      if (returnedVolume > 0) {
        return returnedVolume;
      }

      return items.reduce(
        (total, item) =>
          total +
          calculateItemVolumeCm3(
            item
          ),
        0
      );
    }, [
      detail?.totalVolume,
      items,
    ]);

  const totalVolumeM3 =
    totalVolumeCm3 /
    1_000_000;

  const totalDimKg =
    useMemo(() => {
      return roundToDecimals(
        items.reduce(
          (total, item) =>
            total +
            calculateItemDimKg(
              item,
              dimDivisor
            ),
          0
        ),
        DIM_DECIMAL_PLACES
      );
    }, [
      items,
      dimDivisor,
    ]);

  const chargeableWeightKg =
    roundToDecimals(
      Math.max(
        totalWeightKg,
        totalDimKg
      ),
      DIM_DECIMAL_PLACES
    );

  const declaredValue =
    useMemo(() => {
      const itemTotal =
        items.reduce(
          (total, item) =>
            total +
            getItemDeclaredValue(
              item
            ),
          0
        );

      return itemTotal > 0
        ? itemTotal
        : normalizePositiveNumber(
          detail?.quotation
            ?.declaredValue
        );
    }, [
      items,
      detail?.quotation
        ?.declaredValue,
    ]);

  const packageConfigurationFee =
    useMemo(() => {
      return calculateItemsPackageFee(
        items,
        packageConfigurations
      );
    }, [
      items,
      packageConfigurations,
    ]);

  const selectedPackageRows =
    useMemo(() => {
      return items
        .map((item) => {
          const configuration =
            resolveItemPackageConfiguration(
              item,
              packageConfigurations
            );

          if (!configuration) {
            return null;
          }

          return {
            id:
              item?.id ||
              item?.packageConfigurationId,
            name:
              normalizeText(
                item?.productName
              ) || "Kiện hàng",
            configurationName:
              getPackageConfigurationDisplayName(
                configuration
              ),
            fee: calculateItemPackageFee(
              item,
              packageConfigurations
            ),
          };
        })
        .filter(Boolean);
    }, [
      items,
      packageConfigurations,
    ]);

  /*
   * Phí vận chuyển nội địa là khoản phí của đơn ký gửi,
   * được lấy trực tiếp từ cấu hình phí đang áp dụng.
   * Khoản này luôn được tính riêng và không phụ thuộc
   * vào danh sách phụ phí khách hàng lựa chọn.
   */
  const domesticFeeRule =
    useMemo(() => {
      return findPricingRuleByCode(
        pricingRules,
        PRICING_RULE_CODE.DOMESTIC_FEE
      );
    }, [pricingRules]);

  const selectedOptionalFeeRows =
    useMemo(() => {
      return pricingRules
        .filter((rule) => {
          const code =
            normalizeUpperText(
              rule?.ruleCode
            );

          if (
            !code ||
            rule?.isRequired ===
            true ||
            code ===
            PRICING_RULE_CODE
              .VOLUMETRIC_DIVISOR ||
            code ===
            PRICING_RULE_CODE
              .DOMESTIC_FEE
          ) {
            return false;
          }

          return (
            isRuleSelectedByCustomer(
              rule,
              detail
            ) &&
            isRuleEligible(
              rule,
              {
                declaredValue,
                requiresInspection:
                  detail
                    ?.requiresInspection,
              }
            )
          );
        })
        .map((rule) => {
          const ruleCode =
            normalizeUpperText(
              rule?.ruleCode
            );

          /*
           * Phí đóng thùng gỗ áp dụng theo toàn đơn.
           * Không truyền tổng số kiện vào công thức vì
           * sẽ làm mức phí bị nhân nhiều lần.
           *
           * Các phụ phí theo kiện khác vẫn dùng đúng
           * packageCount thực tế của đơn.
           */
          const calculationPackageCount =
            ruleCode ===
              PRICING_RULE_CODE
                .WOOD_CRATE
              ? 1
              : packageCount;

          const amount =
            calculatePricingRuleAmount(
              rule,
              {
                declaredValue,

                packageCount:
                  calculationPackageCount,

                requiresInspection:
                  detail
                    ?.requiresInspection,
              }
            );

          return {
            id: rule.id,
            code:
              normalizeUpperText(
                rule.ruleCode
              ),
            label:
              normalizeText(
                rule.ruleName
              ) || "Phụ phí",
            description:
              normalizeText(
                rule.description
              ),
            amount:
              roundMoney(amount),
          };
        })
        .filter(
          (row) => row.amount > 0
        );
    }, [
      pricingRules,
      detail,
      declaredValue,
      packageCount,
    ]);

  const domesticShippingFee =
    useMemo(() => {
      if (!domesticFeeRule) {
        return 0;
      }

      return roundMoney(
        calculatePricingRuleAmount(
          domesticFeeRule,
          {
            declaredValue,
            packageCount,
            requiresInspection:
              detail?.requiresInspection,
          }
        )
      );
    }, [
      domesticFeeRule,
      declaredValue,
      packageCount,
      detail?.requiresInspection,
    ]);

  /*
   * Phí đóng thùng gỗ là phụ phí theo toàn đơn.
   * Phí cấu hình thùng được tính riêng theo từng kiện.
   */
  const woodCrateFeeRow =
    useMemo(() => {
      return (
        selectedOptionalFeeRows.find(
          (row) =>
            row.code ===
            PRICING_RULE_CODE.WOOD_CRATE
        ) || null
      );
    }, [selectedOptionalFeeRows]);

  /*
   * Giá trị duy nhất dùng chung cho:
   * - Tổng hợp báo giá phía sale.
   * - Popup xác nhận gửi báo giá.
   * - Payload gửi về API.
   * - Báo giá phía khách hàng.
   */
  const woodCrateFee =
    roundMoney(
      woodCrateFeeRow?.amount
    );

  const otherSurchargeRows =
    useMemo(() => {
      return selectedOptionalFeeRows.filter(
        (row) =>
          row.code !==
          PRICING_RULE_CODE.DOMESTIC_FEE &&
          row.code !==
          PRICING_RULE_CODE.WOOD_CRATE
      );
    }, [selectedOptionalFeeRows]);

  const otherSurchargeTotal =
    useMemo(() => {
      return otherSurchargeRows.reduce(
        (total, row) =>
          total + row.amount,
        0
      );
    }, [otherSurchargeRows]);

  const additionalFeeRows =
    selectedOptionalFeeRows;

  const packagingFeeTotal =
    roundMoney(
      packageConfigurationFee +
      woodCrateFee
    );

  const watchedDiscountPercent =
    Form.useWatch(
      "discountPercent",
      form
    ) ?? 0;

  const watchedSalesNote =
    Form.useWatch(
      "salesNote",
      form
    ) || "";

  useEffect(() => {
    if (!detail?.orderId) {
      return;
    }

    form.setFieldsValue({
      discountPercent:
        normalizePositiveNumber(
          detail?.quotation
            ?.discountPercent
        ),
      salesNote:
        normalizeText(
          detail?.quotation
            ?.salesNote
        ),
    });
  }, [
    detail,
    form,
  ]);

  const unitType =
    normalizeUpperText(
      selectedServicePricing
        ?.unitType
    ) || "KG";

  const billingQuantity =
    unitType === "M3"
      ? totalVolumeM3
      : unitType === "PACKAGE"
        ? packageCount
        : chargeableWeightKg;

  const unitPrice =
    normalizePositiveNumber(
      selectedServicePricing?.price
    );

  const freightCharge =
    roundMoney(
      unitPrice *
      normalizePositiveNumber(
        billingQuantity
      )
    );

  /*
   * Phí dịch vụ chính thức và số tiền hiển thị dự kiến
   * dùng chung đúng một công thức:
   *
   * phí cấu hình thùng theo từng kiện
   * + phí đóng thùng gỗ một lần cho toàn đơn
   * + các phụ phí khác khách đã chọn.
   */
  const serviceFee =
    roundMoney(
      packagingFeeTotal +
      otherSurchargeTotal
    );

  /*
   * Thuế và phí nhập khẩu không tự chia nhỏ ở phía giao diện.
   * Khi đơn đã có báo giá, ưu tiên số tiền được trả về theo mã đơn.
   * Khi xác nhận, hệ thống sẽ tính lại và trả về số chính xác.
   */
  const returnedTaxAndDuty =
    detail?.quotation?.taxAndDuty !== undefined &&
      detail?.quotation?.taxAndDuty !== null
      ? getFiniteMoney(
        detail.quotation.taxAndDuty
      )
      : null;

  const taxAndDuty =
    returnedTaxAndDuty ?? 0;

  const subtotal =
    roundMoney(
      freightCharge +
      domesticShippingFee +
      serviceFee
    );

  const discountPercent =
    Math.min(
      100,
      normalizePositiveNumber(
        watchedDiscountPercent
      )
    );

  const discountAmount =
    roundMoney(
      subtotal *
      (discountPercent / 100)
    );

  const totalEstimatedCost =
    roundMoney(
      subtotal -
      discountAmount +
      taxAndDuty
    );

  const currentOrderStatus =
    normalizeUpperText(
      detail?.status
    );

  const terminalStatus =
    [
      "COMPLETED",
      "CANCELLED",
    ].includes(currentOrderStatus);

  const hasSentQuotation =
    useMemo(() => {
      const quotation =
        detail?.quotation || {};

      const quoteType =
        normalizeUpperText(
          quotation?.quoteType
        );

      const quotationStatus =
        normalizeUpperText(
          quotation?.status
        );

      const orderStatusAlreadyQuoted =
        [
          "QUOTATION_SENT",
          "WAITING_DEPOSIT",
          "DEPOSIT_PAID",
          "PROCESSING",
          "COMPLETED",
        ].includes(currentOrderStatus);

      const officialQuotationExists =
        quoteType === "OFFICIAL" &&
        Boolean(
          quotation?.quotationId ||
          quotation?.id ||
          quotationStatus
        );

      return Boolean(
        quotationSubmitted ||
        location?.state?.quotationSent ||
        orderStatusAlreadyQuoted ||
        officialQuotationExists
      );
    }, [
      currentOrderStatus,
      detail?.quotation,
      location?.state?.quotationSent,
      quotationSubmitted,
    ]);

  const canCreateQuotation =
    Boolean(orderId) &&
    packageCount > 0 &&
    totalWeightKg > 0 &&
    Boolean(selectedWarehouse?.id) &&
    Boolean(
      selectedServicePricing?.id
    ) &&
    !terminalStatus &&
    !hasSentQuotation;

  const validationMessages =
    useMemo(() => {
      const messages = [];

      if (packageCount <= 0) {
        messages.push(
          "Đơn hàng chưa có kiện hàng."
        );
      }

      if (totalWeightKg <= 0) {
        messages.push(
          "Đơn hàng chưa có trọng lượng hợp lệ."
        );
      }

      if (
        !selectedWarehouse?.id
      ) {
        messages.push(
          `Không tìm thấy kho gửi hàng phù hợp với tuyến từ ${getCountryName(
            routeCountryCodes
              .originCountry
          )} về Việt Nam.`
        );
      }

      if (
        !selectedServicePricing?.id
      ) {
        messages.push(
          "Không tìm thấy bảng giá phù hợp với tuyến và loại dịch vụ khách hàng đã chọn."
        );
      }

      if (terminalStatus) {
        messages.push(
          "Đơn hàng đã hoàn thành hoặc đã hủy nên không thể lập báo giá."
        );
      }

      if (
        hasSentQuotation &&
        !terminalStatus
      ) {
        messages.push(
          "Đơn hàng đã gửi báo giá chính thức nên không thể xác nhận lại."
        );
      }

      return messages;
    }, [
      packageCount,
      totalWeightKg,
      selectedWarehouse,
      selectedServicePricing,
      terminalStatus,
      hasSentQuotation,
      routeCountryCodes
        .originCountry,
    ]);

  const requiredPricingRuleIds =
    useMemo(() => {
      return pricingRules
        .filter((rule) => {
          const code =
            normalizeUpperText(
              rule?.ruleCode
            );

          return (
            rule?.isRequired === true &&
            code !==
            PRICING_RULE_CODE
              .VOLUMETRIC_DIVISOR
          );
        })
        .map((rule) =>
          normalizeText(rule?.id)
        )
        .filter(Boolean);
    }, [pricingRules]);

  const buildQuotationPayload =
    useCallback(() => {
      if (!canCreateQuotation) {
        throw new Error(
          validationMessages[0] ||
          "Chưa đủ điều kiện lập báo giá."
        );
      }

      const additionalFees =
        additionalFeeRows.map(
          (row) => {
            const code =
              normalizeUpperText(
                row?.code
              );

            return {
              feeId: row.id,
              code,
              label: row.label,

              /*
               * WOOD_CRATE đã được chuẩn hóa thành
               * phí một lần cho toàn đơn ở trên.
               */
              amount:
                code ===
                  PRICING_RULE_CODE
                    .WOOD_CRATE
                  ? woodCrateFee
                  : roundMoney(
                    row.amount
                  ),

              enabled: true,
            };
          }
        );

      /*
       * Chụp thời gian đúng lúc người dùng mở bước xác nhận.
       * Payload này được giữ nguyên cho đến khi gửi thành công,
       * tránh tạo nhiều mốc thời gian khác nhau khi nhấn xác nhận.
       */
      const clientUtcPayload =
        getClientUtcPayload();

      return {
        ...clientUtcPayload,

        warehouseId:
          selectedWarehouse.id,

        servicePricingId:
          selectedServicePricing.id,

        serviceType:
          normalizeServiceTypeCode(
            detail?.consignmentType
          ),

        weightKg:
          roundToDecimals(
            totalWeightKg,
            4
          ),

        volumeM3:
          roundToDecimals(
            totalVolumeM3,
            6
          ),

        packageCount,
        declaredValue:
          roundMoney(declaredValue),

        salesNote:
          normalizeText(
            watchedSalesNote
          ),

        pricingRuleIds: Array.from(
          new Set(
            [
              domesticFeeRule?.id,
              ...requiredPricingRuleIds,
              ...selectedOptionalFeeRows.map(
                (row) => row.id
              ),
            ].filter(Boolean)
          )
        ),

        quotation: {
          quoteType: "OFFICIAL",

          servicePricingId:
            selectedServicePricing.id,

          serviceType:
            normalizeServiceTypeCode(
              detail?.consignmentType
            ),

          originCountry:
            routeCountryCodes
              .originCountry,

          destinationCountry:
            routeCountryCodes
              .destinationCountry,

          unitType,
          unitPrice:
            roundMoney(unitPrice),

          currency: "VND",

          totalWeight:
            roundToDecimals(
              totalWeightKg,
              4
            ),

          totalVolume:
            roundToDecimals(
              totalVolumeCm3,
              4
            ),

          volumetricWeight:
            roundToDecimals(
              totalDimKg,
              4
            ),

          chargeableWeight:
            roundToDecimals(
              chargeableWeightKg,
              4
            ),

          mainServiceAmount:
            freightCharge,

          domesticShippingFee:
            domesticShippingFee,

          packageConfigurationFee:
            packageConfigurationFee,

          /*
           * Phí đóng thùng gỗ chỉ tính một lần
           * cho toàn đơn. Trường này giúp màn
           * hình khách và sale dùng cùng số tiền.
           */
          woodCrateFee,

          additionalFees,

          discountPercent,
          subtotal,
          discount:
            discountAmount,

          estimatedFreightCharge:
            freightCharge,

          serviceFee,
          taxAndDuty,

          total:
            totalEstimatedCost,

          totalEstimatedCost,

          salesNote:
            normalizeText(
              watchedSalesNote
            ),
        },
      };
    }, [
      canCreateQuotation,
      validationMessages,
      selectedWarehouse,
      selectedServicePricing,
      detail?.consignmentType,
      totalWeightKg,
      totalVolumeM3,
      totalVolumeCm3,
      packageCount,
      declaredValue,
      watchedSalesNote,
      domesticFeeRule,
      requiredPricingRuleIds,
      selectedOptionalFeeRows,
      additionalFeeRows,
      routeCountryCodes,
      unitType,
      unitPrice,
      totalDimKg,
      chargeableWeightKg,
      freightCharge,
      domesticShippingFee,
      packageConfigurationFee,
      woodCrateFee,
      discountPercent,
      subtotal,
      discountAmount,
      serviceFee,
      taxAndDuty,
      totalEstimatedCost,
    ]);

  const buildConfirmationData =
    useCallback((calculation = null) => {
      const exactTaxAndDuty =
        getFiniteMoney(
          calculation?.taxAndDuty,
          taxAndDuty
        );

      const exactTotalEstimatedCost =
        getFiniteMoney(
          calculation?.totalEstimatedCost,
          calculation?.total,
          totalEstimatedCost
        );

      return {
        consignmentCode:
          detail?.consignmentCode ||
          "Đơn ký gửi",

        customerName:
          detail?.customer?.fullName ||
          "Khách hàng",

        customerPhone:
          detail?.customer?.phone ||
          "—",

        route:
          detail?.route || "—",

        serviceName:
          translateConsignmentType(
            detail?.consignmentType
          ),

        warehouseName:
          selectedWarehouse?.name ||
          "—",

        warehouseAddress:
          selectedWarehouse?.address ||
          "—",

        pricingName:
          `${translateConsignmentType(
            selectedServicePricing
              ?.serviceType
          )} • ${getCountryName(
            routeCountryCodes
              .originCountry
          )} → ${getCountryName(
            routeCountryCodes
              .destinationCountry
          )}`,

        unitPrice,
        unitType,
        billingQuantity,

        freightCharge,
        domesticShippingFee,
        packageConfigurationFee,
        woodCrateFee,
        packagingFeeTotal,

        optionalFees:
          otherSurchargeRows,

        discountPercent,
        discountAmount,

        taxAndDuty:
          exactTaxAndDuty,

        declaredValue,
        totalEstimatedCost:
          exactTotalEstimatedCost,

        salesNote:
          normalizeText(
            watchedSalesNote
          ),

        packageRows:
          selectedPackageRows,
      };
    }, [
      detail,
      selectedWarehouse,
      selectedServicePricing,
      routeCountryCodes,
      unitPrice,
      unitType,
      billingQuantity,
      freightCharge,
      domesticShippingFee,
      packageConfigurationFee,
      woodCrateFee,
      packagingFeeTotal,
      otherSurchargeRows,
      discountPercent,
      discountAmount,
      taxAndDuty,
      declaredValue,
      totalEstimatedCost,
      watchedSalesNote,
      selectedPackageRows,
    ]);

  const handleOpenConfirmation =
    async () => {
      if (
        sending ||
        hasSentQuotation ||
        quotationSubmitLockRef.current
      ) {
        if (hasSentQuotation) {
          AuthNotify.warning(
            "Báo giá đã được gửi",
            "Không thể xác nhận hoặc gửi lại báo giá cho đơn hàng này."
          );
        }

        return;
      }

      try {
        await form.validateFields();

        const payload =
          buildQuotationPayload();

        setPendingPayload(payload);

        setConfirmationData(
          buildConfirmationData(
            payload.quotation
          )
        );

        setConfirmationOpen(true);
      } catch (formError) {
        if (formError?.errorFields) {
          return;
        }

        AuthNotify.error(
          "Chưa thể mở xác nhận báo giá",
          formError?.response?.data?.message ||
          formError?.response?.data?.error ||
          formError?.message ||
          "Vui lòng kiểm tra lại thông tin."
        );
      }
    };

  const handleConfirmQuotation =
    async () => {
      if (
        sending ||
        quotationSubmitted ||
        hasSentQuotation ||
        quotationSubmitLockRef.current ||
        !pendingPayload
      ) {
        return;
      }

      quotationSubmitLockRef.current =
        true;

      try {
        setSending(true);

        await sendQuotationApi(
          orderId,
          pendingPayload
        );

        setQuotationSubmitted(true);
        setPendingPayload(null);

        AuthNotify.success(
          "Gửi báo giá thành công",
          "Báo giá chính thức đã được gửi đến khách hàng."
        );

        setConfirmationOpen(false);

        navigate(
          `/sale/consignments/${orderId}`,
          {
            replace: true,
            state: {
              orderId,
              quotationSent: true,
              refreshQuotation: true,
            },
          }
        );
      } catch (sendError) {
        quotationSubmitLockRef.current =
          false;

        const message =
          sendError?.response?.data
            ?.message ||
          sendError?.response?.data
            ?.error ||
          sendError?.message ||
          "Không thể gửi báo giá. Vui lòng thử lại.";

        AuthNotify.error(
          "Gửi báo giá thất bại",
          message
        );
      } finally {
        setSending(false);
      }
    };

  if (loading) {
    return <PageLoading />;
  }

  if (error || !detail) {
    return (
      <main className="quotation-create-page">
        <section className="quotation-create-error">
          <InboxOutlined />

          <h2>
            Không thể mở màn hình lập báo giá
          </h2>

          <p>
            {error ||
              "Không tìm thấy thông tin đơn ký gửi."}
          </p>

          <div>
            <Button
              icon={
                <ArrowLeftOutlined />
              }
              onClick={() =>
                navigate(-1)
              }
            >
              Quay lại
            </Button>

            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadPageData}
            >
              Tải lại
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="quotation-create-page">
      <div className="quotation-create-shell">
        <div className="quotation-create-topbar">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() =>
              navigate(-1)
            }
            className="quotation-create-back"
          >
            Quay lại chi tiết đơn
          </Button>

          <Tag
            className={`quotation-order-status ${orderStatus.className}`}
          >
            {orderStatus.label}
          </Tag>
        </div>

        {warningMessage && (
          <Alert
            type="warning"
            showIcon
            message="Một số dữ liệu chưa tải được"
            description={
              warningMessage
            }
            action={
              <Button
                size="small"
                onClick={loadPageData}
              >
                Tải lại
              </Button>
            }
            className="quotation-create-warning"
          />
        )}

        <section className="quotation-create-hero">
          <div className="quotation-create-hero__content">
            <span>
              BÁO GIÁ CHÍNH THỨC
            </span>

            <h1>
              {detail
                ?.consignmentCode ||
                "Đơn ký gửi"}
            </h1>

            <p>
              Các thông tin về tuyến vận chuyển,
              kho xử lý và bảng giá được hệ thống
              tự xác định theo lựa chọn của khách
              hàng.
            </p>
          </div>

          <div className="quotation-create-hero__summary">
            <div>
              <span>Số kiện</span>
              <strong>
                {packageCount} kiện
              </strong>
            </div>

            <div>
              <span>
                Trọng lượng thực
              </span>
              <strong>
                {formatMeasurement(
                  totalWeightKg,
                  4
                )}{" "}
                kg
              </strong>
            </div>

            <div>
              <span>
                Khối lượng tính cước
              </span>
              <strong>
                {formatMeasurement(
                  chargeableWeightKg,
                  4
                )}{" "}
                kg
              </strong>
            </div>

            <div>
              <span>
                Giá trị khai báo
              </span>
              <strong>
                {formatCurrency(
                  declaredValue
                )}
              </strong>
            </div>
          </div>
        </section>

        {validationMessages.length >
          0 && (
            <Alert
              type="warning"
              showIcon
              message="Chưa đủ điều kiện gửi báo giá"
              description={
                <ul className="quotation-validation-list">
                  {validationMessages.map(
                    (message) => (
                      <li key={message}>
                        {message}
                      </li>
                    )
                  )}
                </ul>
              }
              className="quotation-create-validation"
            />
          )}

        <div className="quotation-create-layout">
          <section className="quotation-create-main">
            <article className="quotation-section-card">
              <div className="quotation-section-heading">
                <div className="quotation-section-heading__icon">
                  <EnvironmentOutlined />
                </div>

                <div>
                  <span>01</span>
                  <h2>
                    Tuyến và kho xử lý
                  </h2>
                  <p>
                    Chỉ hiển thị các kho phù hợp với
                    quốc gia gửi. Bạn có thể chọn kho
                    xử lý khi có nhiều kho.
                  </p>
                </div>
              </div>

              <div className="quotation-locked-grid">
                <div className="quotation-locked-card">
                  <span>Tuyến vận chuyển</span>
                  <strong>
                    {getCountryName(
                      routeCountryCodes
                        .originCountry
                    )}{" "}
                    →{" "}
                    {getCountryName(
                      routeCountryCodes
                        .destinationCountry
                    )}
                  </strong>
                  <small>
                    {detail?.route || "—"}
                  </small>
                </div>

                <div className="quotation-locked-card quotation-warehouse-card">
                  <span>Kho gửi hàng</span>

                  {matchedWarehouses.length > 0 ? (
                    <>
                      <Select
                        value={
                          selectedWarehouseId ||
                          undefined
                        }
                        onChange={
                          setSelectedWarehouseId
                        }
                        options={warehouseOptions}
                        optionFilterProp="searchText"
                        filterOption={(input, option) =>
                          normalizeSearchText(
                            option?.searchText
                          ).includes(
                            normalizeSearchText(input)
                          )
                        }
                        showSearch
                        className="quotation-warehouse-select"
                        popupClassName="quotation-warehouse-select-popup"
                        placeholder="Chọn kho gửi hàng"
                        notFoundContent="Không có kho phù hợp"
                      />

                      {selectedWarehouse && (
                        <div className="quotation-warehouse-selected">
                          <strong>
                            {selectedWarehouse.name}
                          </strong>
                          <small>
                            {selectedWarehouse.address ||
                              "Chưa cập nhật địa chỉ"}
                          </small>
                          <Tag>
                            {matchedWarehouses.length > 1
                              ? `${matchedWarehouses.length} kho phù hợp`
                              : "Kho phù hợp với tuyến"}
                          </Tag>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>
                        Chưa tìm thấy kho phù hợp
                      </strong>
                      <small>
                        Vui lòng kiểm tra lại tuyến
                        hàng và danh sách kho.
                      </small>
                    </>
                  )}
                </div>
              </div>
            </article>

            <article className="quotation-section-card">
              <div className="quotation-section-heading">
                <div className="quotation-section-heading__icon">
                  <DollarOutlined />
                </div>

                <div>
                  <span>02</span>
                  <h2>
                    Bảng giá vận chuyển
                  </h2>
                  <p>
                    Bảng giá được khóa theo loại
                    dịch vụ khách hàng đã chọn.
                  </p>
                </div>
              </div>

              {selectedServicePricing ? (
                <div className="quotation-pricing-card">
                  <div className="quotation-pricing-card__main">
                    <Tag>
                      {translateConsignmentType(
                        selectedServicePricing
                          .serviceType
                      )}
                    </Tag>

                    <strong>
                      {getCountryName(
                        normalizeCountryCode(
                          selectedServicePricing
                            .originCountry
                        )
                      )}{" "}
                      →{" "}
                      {getCountryName(
                        normalizeCountryCode(
                          selectedServicePricing
                            .destinationCountry
                        )
                      )}
                    </strong>

                    <span>
                      {
                        getUnitTypeLabel(
                          selectedServicePricing
                            .unitType
                        )
                      }
                    </span>
                  </div>

                  <div className="quotation-pricing-card__price">
                    <span>Đơn giá</span>
                    <strong>
                      {formatCurrency(
                        unitPrice
                      )}
                    </strong>
                    <small>
                      /{" "}
                      {getUnitSuffix(
                        unitType
                      )}
                    </small>
                  </div>

                  <div className="quotation-pricing-card__lock">
                    <SafetyCertificateOutlined />
                    Không thể thay đổi
                  </div>
                </div>
              ) : (
                <Empty
                  image={
                    Empty
                      .PRESENTED_IMAGE_SIMPLE
                  }
                  description="Không tìm thấy bảng giá phù hợp với tuyến và dịch vụ của đơn hàng."
                />
              )}
            </article>

            {selectedPackageRows.length >
              0 && (
                <article className="quotation-section-card">
                  <div className="quotation-section-heading">
                    <div className="quotation-section-heading__icon">
                      <ShoppingOutlined />
                    </div>

                    <div>
                      <span>03</span>
                      <h2>
                        Cấu hình đóng gói
                      </h2>
                      <p>
                        Chỉ hiển thị cấu hình khách
                        hàng đã chọn cho từng kiện.
                      </p>
                    </div>
                  </div>

                  <div className="quotation-package-list">
                    {selectedPackageRows.map(
                      (row) => (
                        <div
                          key={row.id}
                          className="quotation-package-row"
                        >
                          <div>
                            <strong>
                              {row.name}
                            </strong>
                            <span>
                              {
                                row.configurationName
                              }
                            </span>
                          </div>

                          <strong>
                            {formatCurrency(
                              row.fee
                            )}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </article>
              )}

            {additionalFeeRows.length >
              0 && (
                <article className="quotation-section-card">
                  <div className="quotation-section-heading">
                    <div className="quotation-section-heading__icon">
                      <CheckCircleOutlined />
                    </div>

                    <div>
                      <span>04</span>
                      <h2>
                        Phụ phí khách hàng đã chọn
                      </h2>
                      <p>
                        Không hiển thị những phụ phí
                        khách hàng không lựa chọn.
                      </p>
                    </div>
                  </div>

                  <div className="quotation-selected-fees">
                    {additionalFeeRows.map(
                      (fee) => (
                        <div
                          key={
                            fee.id ||
                            fee.code
                          }
                          className="quotation-selected-fee"
                        >
                          <CheckCircleOutlined />

                          <div>
                            <strong>
                              {fee.label}
                            </strong>

                            {fee.description && (
                              <span>
                                {
                                  fee.description
                                }
                              </span>
                            )}
                          </div>

                          <strong>
                            {formatCurrency(
                              fee.amount
                            )}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </article>
              )}

            <article className="quotation-section-card">
              <div className="quotation-section-heading">
                <div className="quotation-section-heading__icon">
                  <FileTextOutlined />
                </div>

                <div>
                  <span>05</span>
                  <h2>
                    Thông tin bổ sung
                  </h2>
                  <p>
                    Nhập ghi chú dành cho khách hàng.
                  </p>
                </div>
              </div>

              <Form
                form={form}
                layout="vertical"
                requiredMark={false}
                autoComplete="off"
                className="quotation-create-form"
              >
                <div className="quotation-create-form__grid">
                  <div className="quotation-readonly-value">
                    <span>
                      Giá trị khai báo
                    </span>
                    <strong>
                      {formatCurrency(
                        declaredValue
                      )}
                    </strong>
                    <small>
                      Giá trị do khách hàng khai báo
                      trong đơn.
                    </small>
                  </div>

                  <Form.Item
                    name="salesNote"
                    label="Ghi chú gửi khách hàng"
                    className="quotation-create-form__full"
                  >
                    <Input.TextArea
                      rows={4}
                      maxLength={500}
                      showCount
                      placeholder="Nhập nội dung cần thông báo thêm cho khách hàng"
                      disabled={sending}
                    />
                  </Form.Item>
                </div>
              </Form>
            </article>
          </section>

          <aside className="quotation-create-summary">
            <div className="quotation-summary-header">
              <span>
                TỔNG HỢP BÁO GIÁ
              </span>

              <strong>
                {formatCurrency(
                  totalEstimatedCost
                )}
              </strong>

              <small>
                Báo giá chính thức sẽ được gửi sau
                khi xác nhận.
              </small>
            </div>

            <div className="quotation-summary-metrics">
              <div>
                <span>
                  Trọng lượng thực
                </span>
                <strong>
                  {formatMeasurement(
                    totalWeightKg,
                    4
                  )}{" "}
                  kg
                </strong>
              </div>

              <div className="is-highlight">
                <span>
                  Khối lượng tính cước
                </span>
                <strong>
                  {formatMeasurement(
                    chargeableWeightKg,
                    4
                  )}{" "}
                  kg
                </strong>
              </div>
            </div>

            <div className="quotation-summary-lines">
              <div>
                <span>
                  Phí vận chuyển quốc tế
                </span>
                <strong>
                  {formatCurrency(
                    freightCharge
                  )}
                </strong>
              </div>

              {domesticShippingFee >
                0 && (
                  <div className="is-domestic-fee">
                    <span>
                      Phí vận chuyển nội địa
                    </span>
                    <strong>
                      {formatCurrency(
                        domesticShippingFee
                      )}
                    </strong>
                  </div>
                )}

              {packageConfigurationFee >
                0 && (
                  <div>
                    <span>
                      Phí cấu hình thùng theo kiện
                    </span>
                    <strong>
                      {formatCurrency(
                        packageConfigurationFee
                      )}
                    </strong>
                  </div>
                )}

              {woodCrateFee > 0 && (
                <div>
                  <span>
                    Phí đóng thùng gỗ (1 lần/đơn)
                  </span>
                  <strong>
                    {formatCurrency(
                      woodCrateFee
                    )}
                  </strong>
                </div>
              )}

              {packagingFeeTotal > 0 && (
                <div className="is-packaging-total">
                  <span>
                    Tổng phí đóng gói
                  </span>
                  <strong>
                    {formatCurrency(
                      packagingFeeTotal
                    )}
                  </strong>
                </div>
              )}

              {otherSurchargeTotal > 0 && (
                <div>
                  <span>
                    Phụ phí khác khách đã chọn
                  </span>
                  <strong>
                    {formatCurrency(
                      otherSurchargeTotal
                    )}
                  </strong>
                </div>
              )}

              <div>
                <span>Thành tiền trước thuế</span>
                <strong>
                  {formatCurrency(
                    subtotal
                  )}
                </strong>
              </div>

              {discountAmount > 0 && (
                <div className="is-discount">
                  <span>
                    Chiết khấu (
                    {discountPercent}%)
                  </span>
                  <strong>
                    -
                    {formatCurrency(
                      discountAmount
                    )}
                  </strong>
                </div>
              )}

              {taxAndDuty > 0 ? (
                <div className="is-tax-and-duty">
                  <span>
                    Thuế và phí nhập khẩu
                  </span>
                  <strong>
                    {formatCurrency(
                      taxAndDuty
                    )}
                  </strong>
                </div>
              ) : (
                <div className="is-tax-pending">
                  <span>
                    Thuế và phí nhập khẩu
                  </span>
                  <strong>
                    Được hệ thống xác định khi gửi báo giá
                  </strong>
                </div>
              )}
            </div>

            <div className="quotation-summary-total">
              <span>
                Tổng chi phí dự kiến
              </span>
              <strong>
                {formatCurrency(
                  totalEstimatedCost
                )}
              </strong>
            </div>

            <Button
              type="primary"
              size="large"
              icon={
                hasSentQuotation ? (
                  <CheckCircleOutlined />
                ) : (
                  <SendOutlined />
                )
              }
              loading={sending}
              disabled={
                sending ||
                !canCreateQuotation ||
                hasSentQuotation
              }
              onClick={
                handleOpenConfirmation
              }
              block
              className={`quotation-confirm-button ${hasSentQuotation
                  ? "is-submitted"
                  : ""
                }`}
            >
              {hasSentQuotation
                ? "Đã gửi báo giá"
                : "Xem lại và gửi báo giá"}
            </Button>

            <div className="quotation-summary-note">
              <SafetyCertificateOutlined />

              <span>
                Hệ số quy đổi thể tích:{" "}
                {dimDivisor > 0
                  ? formatMeasurement(
                    dimDivisor,
                    0
                  )
                  : "Chưa có cấu hình"}
                .
              </span>
            </div>
          </aside>
        </div>
      </div>

      <ConfirmConsignmentQuotation
        open={confirmationOpen}
        loading={sending}
        submitted={
          quotationSubmitted ||
          hasSentQuotation
        }
        data={confirmationData}
        onCancel={() => {
          if (!sending) {
            setConfirmationOpen(
              false
            );
          }
        }}
        onConfirm={
          handleConfirmQuotation
        }
        formatCurrency={
          formatCurrency
        }
        formatMeasurement={
          formatMeasurement
        }
        getUnitSuffix={
          getUnitSuffix
        }
      />
    </main>
  );
}
