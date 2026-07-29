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
    ArrowLeftOutlined,
    CheckCircleFilled,
    DownloadOutlined,
    FilePdfOutlined,
    PrinterOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    UserOutlined,
  } from "@ant-design/icons";
  import {
    Button,
    Empty,
    Skeleton,
    Tag,
    Tooltip,
  } from "antd";
  import html2canvas from "html2canvas";
  import { jsPDF } from "jspdf";
  
  import {
    getConsignmentDetailApi,
  } from "../../../../../api/SaleAPI/ConsignmentAPI/consignmentService";
  import {
    getProductTypesApi,
  } from "../../../../../api/SaleAPI/ConsignmentAPI/consignmentMasterService";
  import {
    getActiveWarehousesApi,
  } from "../../../../../api/SaleAPI/ConsignmentAPI/warehouseService";
  import {
    getServicePricingsApi,
  } from "../../../../../api/SaleAPI/ConsignmentAPI/servicePricingService";
  import {
    getActivePricingRulesApi,
  } from "../../../../../api/SaleAPI/ConsignmentAPI/pricingRuleService";
  import {
    getActivePackageConfigurationsApi,
  } from "../../../../../api/SaleAPI/ConsignmentAPI/packageConfigurationService";
  import {
    getOrderPaymentHistoryApi,
  } from "../../../../../api/SaleAPI/Historyapi/orderPaymentService";
  import {
    getUserProfileApi,
  } from "../../../../../api/Auth/authService";
  import AuthNotify from "../../../../../utils/Common/AuthNotify";
  import logoImage from "../../../../../assets/anhlogocap2.jpeg";
  
  import "./WarehouseReceiptCreate.css";
  
  /* =========================================================
     COMPANY
  ========================================================= */
  
  const COMPANY_NAME =
    import.meta.env.VITE_COMPANY_NAME?.trim() ||
    "CÔNG TY TNHH VIETNAM LOGISTICS";
  
  const COMPANY_TAX_CODE =
    import.meta.env.VITE_COMPANY_TAX_CODE?.trim() ||
    "—";
  
  const COMPANY_PHONE =
    import.meta.env.VITE_COMPANY_PHONE?.trim() ||
    "—";
  
  /* =========================================================
     HELPERS
  ========================================================= */
  
  const normalizeText = (value) =>
    String(value ?? "").replace(/\s+/g, " ").trim();
  
  const normalizeUpperText = (value) =>
    normalizeText(value).toUpperCase();
  
  const normalizePayload = (value) =>
    value?.data?.data ??
    value?.data ??
    value ??
    null;
  
  const normalizeArray = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.content)) return value.content;
    if (Array.isArray(value?.results)) return value.results;
    return [];
  };
  
  const formatCurrency = (value) => {
    const amount = Number(value);
  
    if (!Number.isFinite(amount)) {
      return "0 ₫";
    }
  
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    }).format(Math.round(amount))} ₫`;
  };
  
  const formatNumber = (
    value,
    {
      maximumFractionDigits = 2,
      suffix = "",
      fallback = "—",
    } = {}
  ) => {
    const number = Number(value);
  
    if (!Number.isFinite(number)) {
      return fallback;
    }
  
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits,
    }).format(number)}${suffix}`;
  };
  
  const formatDateTime = (value) => {
    if (!value) return "—";
  
    const date = new Date(value);
  
    if (Number.isNaN(date.getTime())) {
      return normalizeText(value) || "—";
    }
  
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };
  
  const formatDate = (value) => {
    if (!value) return "—";
  
    const date = new Date(value);
  
    if (Number.isNaN(date.getTime())) {
      return normalizeText(value) || "—";
    }
  
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };
  
  const sanitizeFileName = (value) =>
    normalizeText(value)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "phieu-nhap-kho";
  
  const PAYMENT_METHOD_MAP = {
    SEPAY: "Chuyển khoản SePay",
    BANK_TRANSFER: "Chuyển khoản ngân hàng",
    CASH: "Tiền mặt",
    VNPAY: "VNPay",
    MOMO: "MoMo",
  };
  
  const PAYMENT_STATUS_MAP = {
    SUCCESS: "Thanh toán thành công",
    PAID: "Đã thanh toán",
    COMPLETED: "Hoàn thành",
    PENDING: "Chờ thanh toán",
    PROCESSING: "Đang xử lý",
    FAILED: "Thanh toán thất bại",
    CANCELLED: "Đã hủy",
  };
  
  const ORDER_STATUS_MAP = {
    DEPOSIT_PAID: "Đã thanh toán đặt cọc",
    WAITING_DEPOSIT: "Chờ đặt cọc",
    PENDING_REVIEW: "Chờ duyệt",
    QUOTATION_SENT: "Đã gửi báo giá",
    PROCESSING: "Đang xử lý",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
  };
  
  const CONSIGNMENT_TYPE_MAP = {
    STANDARD: "Tiêu chuẩn",
    EXPRESS: "Hỏa tốc",
    ECONOMY: "Tiết kiệm",
  };
  
  const QUOTATION_STATUS_MAP = {
    PENDING: "Chờ xác nhận",
    SENT: "Đã gửi",
    ACCEPTED: "Đã chấp nhận",
    REJECTED: "Đã từ chối",
    EXPIRED: "Đã hết hạn",
  };
  
  const INSTALLMENT_TYPE_MAP = {
    DEPOSIT: "Thanh toán đặt cọc",
    REMAINING: "Thanh toán phần còn lại",
    FULL_PAYMENT: "Thanh toán toàn bộ",
    FINAL_PAYMENT: "Thanh toán phần còn lại",
  };
  
  const getMapLabel = (
    map,
    value,
    fallback = "—"
  ) => {
    const code = normalizeUpperText(value);
  
    return (
      map[code] ||
      normalizeText(value) ||
      fallback
    );
  };
  
  const getPaymentMethodLabel = (value) =>
    getMapLabel(
      PAYMENT_METHOD_MAP,
      value,
      "Chưa xác định"
    );
  
  const getPaymentStatusLabel = (value) =>
    getMapLabel(
      PAYMENT_STATUS_MAP,
      value,
      "Chưa xác định"
    );
  
  const getOrderStatusLabel = (value) =>
    getMapLabel(
      ORDER_STATUS_MAP,
      value,
      "Chưa xác định"
    );
  
  const getConsignmentTypeLabel = (value) =>
    getMapLabel(
      CONSIGNMENT_TYPE_MAP,
      value,
      "Chưa xác định"
    );
  
  const getQuotationStatusLabel = (value) =>
    getMapLabel(
      QUOTATION_STATUS_MAP,
      value,
      "Chưa xác định"
    );
  
  const getInstallmentTypeLabel = (value) =>
    getMapLabel(
      INSTALLMENT_TYPE_MAP,
      value,
      "Khoản thanh toán"
    );
  
  const isSuccessfulPayment = (payment) =>
    ["SUCCESS", "PAID", "COMPLETED"].includes(
      normalizeUpperText(payment?.status)
    );
  
  const getPayments = (history) => {
    const payload = normalizePayload(history);
  
    if (Array.isArray(payload)) {
      return payload;
    }
  
    return normalizeArray(
      payload?.payments ||
        payload?.paymentHistory ||
        payload?.transactions ||
        payload?.items
    );
  };
  
  const getPaymentTimestamp = (payment) => {
    const value =
      payment?.paidAt ||
      payment?.completedAt ||
      payment?.updatedAt ||
      payment?.createdAt;
  
    const timestamp = new Date(value || 0).getTime();
  
    return Number.isFinite(timestamp)
      ? timestamp
      : 0;
  };
  
  const getSessionUser = () => {
    try {
      const rawUser =
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");
  
      const user = rawUser
        ? JSON.parse(rawUser)
        : {};
  
      return {
        ...user,
        fullName:
          user?.fullName ||
          user?.name ||
          user?.userName ||
          sessionStorage.getItem("fullName") ||
          localStorage.getItem("fullName") ||
          "",
        role:
          user?.roleName ||
          user?.role ||
          sessionStorage.getItem("role") ||
          localStorage.getItem("role") ||
          "",
      };
    } catch {
      return {
        fullName:
          sessionStorage.getItem("fullName") ||
          localStorage.getItem("fullName") ||
          "",
        role:
          sessionStorage.getItem("role") ||
          localStorage.getItem("role") ||
          "",
      };
    }
  };
  
  const createReceiptCode = ({
    transactionCode,
    consignmentCode,
    orderId,
  }) => {
    const source =
      normalizeText(transactionCode) ||
      normalizeText(consignmentCode) ||
      normalizeText(orderId) ||
      String(Date.now());
  
    return `NK-${source
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-18)
      .toUpperCase()}`;
  };
  
  const getImageUrls = (item) => {
    const urls = [
      ...(Array.isArray(item?.referenceUrls)
        ? item.referenceUrls
        : []),
      item?.referenceUrl,
      item?.imageUrl,
      item?.image,
    ]
      .map(normalizeText)
      .filter(Boolean);

    return Array.from(new Set(urls));
  };

  const waitForReceiptImages = async (element) => {
    const images = Array.from(
      element?.querySelectorAll("img") || []
    );

    await Promise.all(
      images.map((image) => {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          const finish = () => resolve();

          image.addEventListener(
            "load",
            finish,
            { once: true }
          );

          image.addEventListener(
            "error",
            finish,
            { once: true }
          );

          window.setTimeout(
            finish,
            5000
          );
        });
      })
    );
  };

  const getErrorMessage = (
    error,
    fallbackMessage
  ) =>
    error?.response?.data?.message ||
    error?.response?.data?.title ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage;
  
  /* =========================================================
     COMPONENT
  ========================================================= */
  
  export default function WarehouseReceiptCreate() {
    const navigate = useNavigate();
    const location = useLocation();
    const { orderId } = useParams();
  
    const receiptRef = useRef(null);
  
    const stateOrderDetail =
      location?.state?.orderDetail ||
      location?.state?.consignment ||
      null;
  
    const statePaymentHistory =
      location?.state?.paymentHistory ||
      location?.state?.history ||
      null;
  
    const statePayment =
      location?.state?.payment || null;
  
    const [orderDetail, setOrderDetail] =
      useState(stateOrderDetail);
  
    const [
      paymentHistory,
      setPaymentHistory,
    ] = useState(statePaymentHistory);
  
    const [saleProfile, setSaleProfile] =
      useState(() => getSessionUser());
  
    const [productTypes, setProductTypes] =
      useState([]);
  
    const [warehouses, setWarehouses] =
      useState([]);
  
    const [
      servicePricings,
      setServicePricings,
    ] = useState([]);
  
    const [pricingRules, setPricingRules] =
      useState([]);
  
    const [
      packageConfigurations,
      setPackageConfigurations,
    ] = useState([]);
  
    const [loading, setLoading] =
      useState(true);
  
    const [downloading, setDownloading] =
      useState(false);
  
    const [error, setError] =
      useState("");
  
    const loadReceiptData =
      useCallback(async () => {
        if (!orderId) {
          setError(
            "Không tìm thấy orderId của đơn ký gửi."
          );
          setLoading(false);
          return;
        }
  
        try {
          setLoading(true);
          setError("");
  
          const results =
            await Promise.allSettled([
              getConsignmentDetailApi(orderId),
              getOrderPaymentHistoryApi(orderId),
              getUserProfileApi(),
              getProductTypesApi(),
              getActiveWarehousesApi(),
              getServicePricingsApi(),
              getActivePricingRulesApi(),
              getActivePackageConfigurationsApi(),
            ]);
  
          const [
            orderResult,
            paymentResult,
            profileResult,
            productTypeResult,
            warehouseResult,
            servicePricingResult,
            pricingRuleResult,
            packageConfigurationResult,
          ] = results;
  
          if (
            orderResult.status === "fulfilled"
          ) {
            setOrderDetail(
              normalizePayload(
                orderResult.value
              ) || null
            );
          } else if (!stateOrderDetail) {
            throw orderResult.reason;
          }
  
          if (
            paymentResult.status ===
            "fulfilled"
          ) {
            setPaymentHistory(
              normalizePayload(
                paymentResult.value
              ) || null
            );
          } else if (!statePaymentHistory) {
            console.warn(
              "Không tải được lịch sử thanh toán:",
              paymentResult.reason
            );
          }
  
          if (
            profileResult.status === "fulfilled"
          ) {
            const profile =
              normalizePayload(
                profileResult.value
              ) || {};
  
            setSaleProfile({
              ...getSessionUser(),
              ...profile,
            });
          } else {
            setSaleProfile(getSessionUser());
  
            console.warn(
              "Không tải được hồ sơ Sale:",
              profileResult.reason
            );
          }
  
          setProductTypes(
            productTypeResult.status ===
              "fulfilled"
              ? normalizeArray(
                  productTypeResult.value
                )
              : []
          );
  
          setWarehouses(
            warehouseResult.status ===
              "fulfilled"
              ? normalizeArray(
                  warehouseResult.value
                )
              : []
          );
  
          setServicePricings(
            servicePricingResult.status ===
              "fulfilled"
              ? normalizeArray(
                  servicePricingResult.value
                )
              : []
          );
  
          setPricingRules(
            pricingRuleResult.status ===
              "fulfilled"
              ? normalizeArray(
                  pricingRuleResult.value
                )
              : []
          );
  
          setPackageConfigurations(
            packageConfigurationResult.status ===
              "fulfilled"
              ? normalizeArray(
                  packageConfigurationResult.value
                )
              : []
          );
        } catch (requestError) {
          const message = getErrorMessage(
            requestError,
            "Không thể tải dữ liệu phiếu nhập kho."
          );
  
          setError(message);
  
          AuthNotify.error(
            "Tải phiếu thất bại",
            message
          );
        } finally {
          setLoading(false);
        }
      }, [
        orderId,
        stateOrderDetail,
        statePaymentHistory,
      ]);
  
    useEffect(() => {
      loadReceiptData();
    }, [loadReceiptData]);
  
    const payments = useMemo(
      () => getPayments(paymentHistory),
      [paymentHistory]
    );
  
    const selectedPayment = useMemo(() => {
      if (statePayment) {
        const matchedPayment =
          payments.find(
            (item) =>
              normalizeText(item?.paymentId) ===
                normalizeText(
                  statePayment?.paymentId
                ) ||
              normalizeText(
                item?.transactionCode
              ) ===
                normalizeText(
                  statePayment?.transactionCode
                )
          );
  
        return {
          ...(matchedPayment || {}),
          ...statePayment,
        };
      }
  
      return (
        [...payments]
          .filter(isSuccessfulPayment)
          .sort(
            (a, b) =>
              getPaymentTimestamp(b) -
              getPaymentTimestamp(a)
          )[0] ||
        [...payments].sort(
          (a, b) =>
            getPaymentTimestamp(b) -
            getPaymentTimestamp(a)
        )[0] ||
        null
      );
    }, [payments, statePayment]);
  
    const customer =
      orderDetail?.customer ||
      paymentHistory?.customer ||
      {};
  
    const quotation =
      orderDetail?.quotation ||
      paymentHistory?.quotation ||
      {};
  
    const productTypeMap = useMemo(() => {
      return new Map(
        productTypes.map((item) => [
          normalizeText(
            item?.id ??
              item?.value ??
              item?.code
          ),
          normalizeText(
            item?.name ??
              item?.label ??
              item?.displayName
          ),
        ])
      );
    }, [productTypes]);
  
    const packageConfigurationMap =
      useMemo(() => {
        return new Map(
          packageConfigurations.map(
            (item) => [
              normalizeText(item?.id),
              item,
            ]
          )
        );
      }, [packageConfigurations]);
  
    const pricingRuleMap = useMemo(() => {
      return new Map(
        pricingRules.map((rule) => [
          normalizeText(rule?.id),
          rule,
        ])
      );
    }, [pricingRules]);
  
    const items = useMemo(() => {
      const rawItems = Array.isArray(
        orderDetail?.items
      )
        ? orderDetail.items
        : [];
  
      return rawItems.map((item) => {
        const packageConfiguration =
          item?.packageConfiguration ||
          packageConfigurationMap.get(
            normalizeText(
              item?.packageConfigurationId
            )
          ) ||
          null;
  
        return {
          ...item,
          productTypeDisplayName:
            productTypeMap.get(
              normalizeText(item?.productType)
            ) ||
            normalizeText(
              item?.productTypeName
            ) ||
            normalizeText(item?.productType) ||
            "—",
          packageConfiguration,
        };
      });
    }, [
      orderDetail?.items,
      packageConfigurationMap,
      productTypeMap,
    ]);
  
    const selectedPricingRules =
      useMemo(() => {
        const ids = Array.isArray(
          orderDetail?.pricingRuleIds
        )
          ? orderDetail.pricingRuleIds
          : [];
  
        return ids.map((id) => {
          return (
            pricingRuleMap.get(
              normalizeText(id)
            ) || {
              id,
              ruleName: "Quy tắc dịch vụ",
              ruleCode: id,
            }
          );
        });
      }, [
        orderDetail?.pricingRuleIds,
        pricingRuleMap,
      ]);
  
    const resolvedWarehouse = useMemo(() => {
      const warehouseId =
        orderDetail?.warehouseId ||
        orderDetail?.destinationWarehouseId ||
        quotation?.warehouseId ||
        quotation?.destinationWarehouseId;
  
      const exactWarehouse =
        warehouses.find(
          (warehouse) =>
            normalizeText(warehouse?.id) ===
            normalizeText(warehouseId)
        );
  
      if (exactWarehouse) {
        return exactWarehouse;
      }
  
      const destinationWarehouses =
        warehouses.filter(
          (warehouse) =>
            normalizeUpperText(
              warehouse?.warehouseType
            ) === "DESTINATION"
        );
  
      return destinationWarehouses.length ===
        1
        ? destinationWarehouses[0]
        : null;
    }, [
      orderDetail?.destinationWarehouseId,
      orderDetail?.warehouseId,
      quotation?.destinationWarehouseId,
      quotation?.warehouseId,
      warehouses,
    ]);
  
    const resolvedServicePricing =
      useMemo(() => {
        const servicePricingId =
          quotation?.servicePricingId ||
          orderDetail?.servicePricingId;
  
        return (
          servicePricings.find(
            (pricing) =>
              normalizeText(pricing?.id) ===
              normalizeText(servicePricingId)
          ) || null
        );
      }, [
        orderDetail?.servicePricingId,
        quotation?.servicePricingId,
        servicePricings,
      ]);
  
    const saleName =
      normalizeText(
        saleProfile?.fullName ||
          saleProfile?.name ||
          saleProfile?.userName
      ) || "Chưa xác định nhân viên Sale";
  
    const saleRole =
      normalizeText(
        saleProfile?.roleName ||
          saleProfile?.role ||
          getSessionUser()?.role
      ) || "Sale";
  
    const saleId =
      normalizeText(
        saleProfile?.employeeCode ||
          saleProfile?.userCode ||
          saleProfile?.userId ||
          saleProfile?.id
      ) || "—";
  
    const transactionCode =
      normalizeText(
        selectedPayment?.transactionCode ||
          selectedPayment?.orderCode ||
          selectedPayment?.paymentId
      ) || "—";
  
    const paymentTime =
      selectedPayment?.paidAt ||
      selectedPayment?.completedAt ||
      orderDetail?.paymentConfirmedAt ||
      selectedPayment?.updatedAt ||
      selectedPayment?.createdAt ||
      orderDetail?.statusUpdatedAt;
  
    const paymentAmount =
      Number(selectedPayment?.amount) ||
      Number(paymentHistory?.totalPaid) ||
      0;
  
    const totalPaid =
      Number(paymentHistory?.totalPaid) ||
      paymentAmount;
  
    const totalBillAmount =
      Number(paymentHistory?.totalBillAmount) ||
      Number(
        quotation?.totalEstimatedCost
      ) ||
      0;
  
    const remainingAmount = Math.max(
      0,
      Number(paymentHistory?.remaining) ||
        totalBillAmount - totalPaid
    );
  
    /*
     * Mỗi phần tử trong items là một kiện hàng.
     * quantity chỉ là số sản phẩm nằm bên trong kiện,
     * không được dùng để nhân số kiện, trọng lượng,
     * DIM, thể tích hoặc giá trị khai báo của kiện.
     */
    const totalPackageCount = items.length;

    const totalProductQuantity = useMemo(
      () =>
        items.reduce(
          (total, item) =>
            total +
            (Number(item?.quantity) || 0),
          0
        ),
      [items]
    );

    const totalDeclaredValue = useMemo(
      () =>
        items.reduce(
          (total, item) =>
            total +
            (Number(item?.declaredValue) ||
              0),
          0
        ),
      [items]
    );

    const fallbackTotalWeight = useMemo(
      () =>
        items.reduce(
          (total, item) =>
            total +
            (Number(item?.weight) || 0),
          0
        ),
      [items]
    );

    const fallbackTotalDim = useMemo(
      () =>
        items.reduce(
          (total, item) =>
            total +
            (Number(
              item?.volumetricWeight
            ) || 0),
          0
        ),
      [items]
    );

    const totalWeight =
      Number(orderDetail?.totalWeight) ||
      fallbackTotalWeight;

    const totalVolume =
      Number(orderDetail?.totalVolume) ||
      items.reduce(
        (total, item) =>
          total +
          (Number(item?.length) || 0) *
            (Number(item?.width) || 0) *
            (Number(item?.height) || 0),
        0
      );

    const receiptCode = useMemo(
      () =>
        createReceiptCode({
          transactionCode,
          consignmentCode:
            orderDetail?.consignmentCode,
          orderId,
        }),
      [
        orderDetail?.consignmentCode,
        orderId,
        transactionCode,
      ]
    );
  
    const handlePrint = () => {
      window.print();
    };
  
    const handleDownloadPdf = async () => {
      const element = receiptRef.current;
  
      if (!element || downloading) {
        return;
      }
  
      try {
        setDownloading(true);
  
        if (document?.fonts?.ready) {
          await document.fonts.ready;
        }

        await waitForReceiptImages(
          element
        );

        const canvas = await html2canvas(
          element,
          {
            scale: Math.max(
              3,
              Number(
                window.devicePixelRatio
              ) || 1
            ),
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: "#ffffff",
            windowWidth:
              element.scrollWidth,
            width: element.scrollWidth,
            height: element.scrollHeight,
            scrollX: 0,
            scrollY: -window.scrollY,
            imageTimeout: 15000,
            removeContainer: true,
            onclone: (
              clonedDocument
            ) => {
              const clonedReceipt =
                clonedDocument.getElementById(
                  "warehouse-receipt-document"
                );

              clonedReceipt?.classList.add(
                "warehouse-receipt-document--exporting"
              );
            },
          }
        );

        const context =
          canvas.getContext("2d");

        if (context) {
          context.imageSmoothingEnabled =
            true;
          context.imageSmoothingQuality =
            "high";
        }

        const imageData =
          canvas.toDataURL("image/png");

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
        });
  
        const pageWidth = 210;
        const pageHeight = 297;
        const imageWidth = pageWidth;
        const imageHeight =
          (canvas.height * imageWidth) /
          canvas.width;
  
        let heightLeft = imageHeight;
        let position = 0;
  
        pdf.addImage(
          imageData,
          "PNG",
          0,
          position,
          imageWidth,
          imageHeight,
          undefined,
          "SLOW"
        );
  
        heightLeft -= pageHeight;
  
        while (heightLeft > 0) {
          position =
            heightLeft - imageHeight;
  
          pdf.addPage();
  
          pdf.addImage(
            imageData,
            "PNG",
            0,
            position,
            imageWidth,
            imageHeight,
            undefined,
            "SLOW"
          );
  
          heightLeft -= pageHeight;
        }
  
        const fileName =
          `${sanitizeFileName(
            receiptCode
          )}-${sanitizeFileName(
            orderDetail?.consignmentCode ||
              orderId
          )}.pdf`;
  
        pdf.save(fileName);
  
        AuthNotify.success(
          "Đã tải phiếu",
          `Phiếu nhập kho ${receiptCode} đã được tải về.`
        );
      } catch (downloadError) {
        console.error(
          "DOWNLOAD RECEIPT PDF ERROR:",
          downloadError
        );
  
        AuthNotify.error(
          "Không thể tải PDF",
          getErrorMessage(
            downloadError,
            "Vui lòng thử lại."
          )
        );
      } finally {
        setDownloading(false);
      }
    };
  
    if (loading) {
      return (
        <main className="warehouse-receipt-page">
          <div className="warehouse-receipt-loading">
            <Skeleton
              active
              paragraph={{ rows: 18 }}
            />
          </div>
        </main>
      );
    }
  
    if (error || !orderDetail) {
      return (
        <main className="warehouse-receipt-page">
          <div className="warehouse-receipt-empty">
            <Empty
              description={
                error ||
                "Không tìm thấy dữ liệu đơn ký gửi."
              }
            />
  
            <div className="warehouse-receipt-empty__actions">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
              >
                Quay lại
              </Button>
  
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={loadReceiptData}
              >
                Tải lại
              </Button>
            </div>
          </div>
        </main>
      );
    }
  
    return (
      <main className="warehouse-receipt-page">
        <header className="warehouse-receipt-toolbar">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          >
            Quay lại
          </Button>
  
          <div className="warehouse-receipt-toolbar__title">
            <span>CHỨNG TỪ NHẬP KHO</span>
  
            <strong>
              {orderDetail?.consignmentCode ||
                orderId}
            </strong>
  
            <small>
              Người lập: {saleName}
            </small>
          </div>
  
          <div className="warehouse-receipt-toolbar__actions">
            <Tooltip title="Mở cửa sổ in của trình duyệt">
              <Button
                icon={<PrinterOutlined />}
                onClick={handlePrint}
              >
                In phiếu
              </Button>
            </Tooltip>
  
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              loading={downloading}
              onClick={handleDownloadPdf}
            >
              Tải phiếu PDF
            </Button>
          </div>
        </header>
  
        <section className="warehouse-receipt-preview">
          <article
            ref={receiptRef}
            id="warehouse-receipt-document"
            className="warehouse-receipt-document"
          >
            <header className="warehouse-receipt-document__header">
              <div className="warehouse-receipt-document__company">
                <div className="warehouse-receipt-document__brand">
                  <img
                    src={logoImage}
                    alt="Vietnam Logistics"
                  />
                </div>
  
                <div>
                  <strong>{COMPANY_NAME}</strong>
  
                  <span>
                    {resolvedWarehouse?.address ||
                      "Địa chỉ kho chưa được xác định"}
                  </span>
  
                  <span>
                    MST: {COMPANY_TAX_CODE}
                  </span>
  
                  <span>
                    Điện thoại: {COMPANY_PHONE}
                  </span>
                </div>
              </div>
  
              <div className="warehouse-receipt-document__heading">
                <h1>PHIẾU NHẬP KHO</h1>
                <h2>(HÀNG KÝ GỬI)</h2>
  
                <span>
                  Số phiếu:{" "}
                  <b>{receiptCode}</b>
                </span>
  
                <span>
                  Ngày lập:{" "}
                  <b>
                    {formatDate(new Date())}
                  </b>
                </span>
  
                <Tag className="warehouse-receipt-document__paid-tag">
                  <CheckCircleFilled />
                  ĐÃ XÁC NHẬN THANH TOÁN
                </Tag>
              </div>
            </header>
  
            <section className="warehouse-receipt-document__section">
              <h3>I. THÔNG TIN KHÁCH HÀNG</h3>
  
              <div className="warehouse-receipt-document__rows">
                <div>
                  <span>Khách hàng:</span>
                  <strong>
                    {customer?.fullName || "—"}
                  </strong>
                </div>
  
                <div>
                  <span>Mã khách hàng:</span>
                  <strong>
                    {customer?.customerCode ||
                      customer?.customerId ||
                      "—"}
                  </strong>
                </div>
  
                <div>
                  <span>Số điện thoại:</span>
                  <strong>
                    {customer?.phone || "—"}
                  </strong>
                </div>
  
                <div>
                  <span>Email:</span>
                  <strong>
                    {customer?.email || "—"}
                  </strong>
                </div>
  
                <div>
                  <span>Người nhận:</span>
                  <strong>
                    {orderDetail?.receiverName ||
                      "—"}
                    {" · "}
                    {orderDetail?.receiverPhone ||
                      "—"}
                  </strong>
                </div>
  
                <div>
                  <span>Địa chỉ nhận hàng:</span>
                  <strong>
                    {orderDetail?.receiverAddress ||
                      "—"}
                  </strong>
                </div>
              </div>
            </section>
  
            <section className="warehouse-receipt-document__section">
              <h3>II. THÔNG TIN ĐƠN KÝ GỬI</h3>
  
              <div className="warehouse-receipt-document__summary-grid">
                <div>
                  <span>Mã ký gửi</span>
                  <strong>
                    {orderDetail?.consignmentCode ||
                      "—"}
                  </strong>
                </div>
  
                <div>
                  <span>Order ID</span>
                  <strong>
                    {orderDetail?.orderId ||
                      orderId ||
                      "—"}
                  </strong>
                </div>
  
                <div>
                  <span>Ngày tạo đơn</span>
                  <strong>
                    {formatDateTime(
                      orderDetail?.createdAt
                    )}
                  </strong>
                </div>
  
                <div>
                  <span>Xác nhận thanh toán</span>
                  <strong>
                    {formatDateTime(
                      orderDetail?.paymentConfirmedAt ||
                        paymentTime
                    )}
                  </strong>
                </div>
  
                <div>
                  <span>Loại vận chuyển</span>
                  <strong>
                    {getConsignmentTypeLabel(
                      orderDetail?.consignmentType
                    )}
                  </strong>
                </div>
  
                <div>
                  <span>Tuyến hàng</span>
                  <strong>
                    {orderDetail?.route || "—"}
                  </strong>
                </div>
  
                <div>
                  <span>Trạng thái đơn</span>
                  <strong>
                    {getOrderStatusLabel(
                      orderDetail?.status
                    )}
                  </strong>
                </div>
  
                <div>
                  <span>Yêu cầu kiểm hàng</span>
                  <strong>
                    {orderDetail?.requiresInspection
                      ? "Có"
                      : "Không"}
                  </strong>
                </div>
  
                <div>
                  <span>Tổng trọng lượng</span>
                  <strong>
                    {formatNumber(totalWeight, {
                      suffix: " kg",
                    })}
                  </strong>
                </div>
  
                <div>
                  <span>Tổng thể tích</span>
                  <strong>
                    {formatNumber(totalVolume, {
                      suffix: " cm³",
                    })}
                  </strong>
                </div>
  
                <div>
                  <span>Tổng số kiện hàng</span>
                  <strong>
                    {formatNumber(
                      totalPackageCount,
                      {
                        maximumFractionDigits:
                          0,
                        suffix: " kiện",
                      }
                    )}
                  </strong>
                </div>
  
                <div>
                  <span>Kho nhập</span>
                  <strong>
                    {resolvedWarehouse?.name ||
                      "Chưa xác định"}
                  </strong>
                </div>
              </div>
  
              {orderDetail?.note && (
                <div className="warehouse-receipt-document__note-box">
                  <span>Ghi chú dịch vụ:</span>
                  <strong>
                    {orderDetail.note}
                  </strong>
                </div>
              )}
            </section>
  
            <section className="warehouse-receipt-document__section">
              <div className="warehouse-receipt-section-heading">
                <h3>
                  III. DANH SÁCH KIỆN HÀNG NHẬP KHO
                </h3>

                <Tag className="warehouse-receipt-package-count">
                  {totalPackageCount} kiện
                </Tag>
              </div>

              {items.length ? (
                <div className="warehouse-receipt-package-list">
                  {items.map(
                    (item, index) => {
                      const imageUrls =
                        getImageUrls(item);

                      const packageConfig =
                        item
                          ?.packageConfiguration;

                      const packageFee =
                        Number(
                          packageConfig
                            ?.estimatedFee
                        ) ||
                        Number(
                          packageConfig
                            ?.packageFee
                        ) ||
                        0;

                      return (
                        <article
                          key={
                            item?.id ||
                            index
                          }
                          className="warehouse-receipt-package-card"
                        >
                          <header className="warehouse-receipt-package-card__header">
                            <div className="warehouse-receipt-package-card__number">
                              KIỆN{" "}
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </div>

                            <div className="warehouse-receipt-package-card__title">
                              <strong>
                                {item?.productName ||
                                  "Chưa có tên sản phẩm"}
                              </strong>

                              <span>
                                Mã kiện:{" "}
                                {item?.packageCode ||
                                  item?.id ||
                                  "—"}
                              </span>
                            </div>

                            <Tag className="warehouse-receipt-package-card__type">
                              {
                                item
                                  ?.productTypeDisplayName
                              }
                            </Tag>
                          </header>

                          <div className="warehouse-receipt-package-card__body">
                            <div className="warehouse-receipt-package-images">
                              <span className="warehouse-receipt-package-images__label">
                                Hình ảnh kiện hàng
                              </span>

                              {imageUrls.length ? (
                                <div className="warehouse-receipt-package-images__grid">
                                  {imageUrls.map(
                                    (
                                      imageUrl,
                                      imageIndex
                                    ) => (
                                      <figure
                                        key={`${imageUrl}-${imageIndex}`}
                                        className="warehouse-receipt-package-image"
                                      >
                                        <img
                                          src={
                                            imageUrl
                                          }
                                          crossOrigin="anonymous"
                                          alt={`${
                                            item?.productName ||
                                            "Kiện hàng"
                                          } - ảnh ${
                                            imageIndex +
                                            1
                                          }`}
                                          loading="eager"
                                        />

                                        <figcaption>
                                          Ảnh{" "}
                                          {imageIndex +
                                            1}
                                        </figcaption>
                                      </figure>
                                    )
                                  )}
                                </div>
                              ) : (
                                <div className="warehouse-receipt-package-images__empty">
                                  Không có hình ảnh
                                </div>
                              )}
                            </div>

                            <div className="warehouse-receipt-package-details">
                              <div>
                                <span>
                                  Số sản phẩm trong kiện
                                </span>
                                <strong>
                                  {formatNumber(
                                    item?.quantity,
                                    {
                                      maximumFractionDigits:
                                        0,
                                      suffix:
                                        " sản phẩm",
                                      fallback:
                                        "0 sản phẩm",
                                    }
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Trọng lượng kiện
                                </span>
                                <strong>
                                  {formatNumber(
                                    item?.weight,
                                    {
                                      suffix:
                                        " kg",
                                    }
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Kích thước kiện
                                </span>
                                <strong>
                                  {formatNumber(
                                    item?.length
                                  )}
                                  {" × "}
                                  {formatNumber(
                                    item?.width
                                  )}
                                  {" × "}
                                  {formatNumber(
                                    item?.height
                                  )}
                                  {" cm"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  DIM của kiện
                                </span>
                                <strong>
                                  {formatNumber(
                                    item?.volumetricWeight,
                                    {
                                      suffix:
                                        " kg",
                                      maximumFractionDigits:
                                        4,
                                    }
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Giá trị khai báo của kiện
                                </span>
                                <strong>
                                  {formatCurrency(
                                    item?.declaredValue
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Mã vận đơn nội địa
                                </span>
                                <strong>
                                  {item?.domesticTrackingCode ||
                                    "Chưa có"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Cấu hình đóng gói
                                </span>
                                <strong>
                                  {packageConfig
                                    ?.displayName ||
                                    packageConfig
                                      ?.configName ||
                                    packageConfig
                                      ?.configCode ||
                                    "Chưa xác định"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Phí đóng gói kiện
                                </span>
                                <strong>
                                  {formatCurrency(
                                    packageFee
                                  )}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    }
                  )}

                  <div className="warehouse-receipt-package-summary">
                    <div>
                      <span>
                        Tổng số kiện
                      </span>
                      <strong>
                        {totalPackageCount} kiện
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tổng sản phẩm khai báo
                      </span>
                      <strong>
                        {totalProductQuantity} sản phẩm
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tổng trọng lượng kiện
                      </span>
                      <strong>
                        {formatNumber(
                          totalWeight,
                          {
                            suffix: " kg",
                          }
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tổng DIM theo kiện
                      </span>
                      <strong>
                        {formatNumber(
                          fallbackTotalDim,
                          {
                            suffix: " kg",
                            maximumFractionDigits:
                              4,
                          }
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tổng giá trị khai báo theo kiện
                      </span>
                      <strong>
                        {formatCurrency(
                          totalDeclaredValue
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="warehouse-receipt-package-empty">
                  Chưa có dữ liệu kiện hàng.
                </div>
              )}
            </section>

            <section className="warehouse-receipt-document__section">
              <h3>
                IV. THÔNG TIN BÁO GIÁ VÀ THANH TOÁN
              </h3>
  
              <div className="warehouse-receipt-finance-grid">
                <div className="warehouse-receipt-finance-card">
                  <h4>Chi tiết báo giá</h4>
  
                  <dl>
                    <div>
                      <dt>Mã báo giá</dt>
                      <dd>
                        {quotation?.quotationId ||
                          "—"}
                      </dd>
                    </div>
  
                    <div>
                      <dt>Loại báo giá</dt>
                      <dd>
                        {normalizeUpperText(
                          quotation?.quoteType
                        ) === "OFFICIAL"
                          ? "Báo giá chính thức"
                          : quotation?.quoteType ||
                            "—"}
                      </dd>
                    </div>
  
                    <div>
                      <dt>Trạng thái</dt>
                      <dd>
                        {getQuotationStatusLabel(
                          quotation?.status
                        )}
                      </dd>
                    </div>
  
                    <div>
                      <dt>Cước vận chuyển</dt>
                      <dd>
                        {formatCurrency(
                          quotation?.estimatedFreightCharge
                        )}
                      </dd>
                    </div>
  
                    <div>
                      <dt>Phí vận chuyển nội địa</dt>
                      <dd>
                        {formatCurrency(
                          quotation?.domesticShippingFee
                        )}
                      </dd>
                    </div>
  
                    <div>
                      <dt>Phí dịch vụ</dt>
                      <dd>
                        {formatCurrency(
                          quotation?.serviceFee
                        )}
                      </dd>
                    </div>
  
                    <div>
                      <dt>Thuế và nghĩa vụ</dt>
                      <dd>
                        {formatCurrency(
                          quotation?.taxAndDuty
                        )}
                      </dd>
                    </div>
  
                    <div className="is-total">
                      <dt>Tổng báo giá</dt>
                      <dd>
                        {formatCurrency(
                          quotation?.totalEstimatedCost
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
  
                <div className="warehouse-receipt-payment-confirm">
                  <CheckCircleFilled />
  
                  <div>
                    <strong>
                      Hệ thống xác nhận khách hàng đã
                      thanh toán thành công.
                    </strong>
  
                    <dl>
                      <div>
                        <dt>Mã giao dịch</dt>
                        <dd>
                          {transactionCode}
                        </dd>
                      </div>
  
                      <div>
                        <dt>Loại thanh toán</dt>
                        <dd>
                          {getInstallmentTypeLabel(
                            selectedPayment?.installmentType
                          )}
                        </dd>
                      </div>
  
                      <div>
                        <dt>Trạng thái</dt>
                        <dd>
                          {getPaymentStatusLabel(
                            selectedPayment?.status ||
                              "SUCCESS"
                          )}
                        </dd>
                      </div>
  
                      <div>
                        <dt>Phương thức</dt>
                        <dd>
                          {getPaymentMethodLabel(
                            selectedPayment?.paymentMethod
                          )}
                        </dd>
                      </div>
  
                      <div>
                        <dt>Thời gian</dt>
                        <dd>
                          {formatDateTime(
                            paymentTime
                          )}
                        </dd>
                      </div>
  
                      <div>
                        <dt>Khoản giao dịch</dt>
                        <dd>
                          {formatCurrency(
                            paymentAmount
                          )}
                        </dd>
                      </div>
  
                      <div>
                        <dt>Tổng đã thanh toán</dt>
                        <dd>
                          {formatCurrency(
                            totalPaid
                          )}
                        </dd>
                      </div>
  
                      <div>
                        <dt>Còn phải thanh toán</dt>
                        <dd>
                          {formatCurrency(
                            remainingAmount
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </section>
  
            <section className="warehouse-receipt-document__section">
              <h3>
                V. KHO NHẬP VÀ DỊCH VỤ ÁP DỤNG
              </h3>
  
              <div className="warehouse-receipt-operation-grid">
                <div>
                  <span>Kho nhập hàng</span>
                  <strong>
                    {resolvedWarehouse?.name ||
                      "Chưa xác định"}
                  </strong>
                  <small>
                    {resolvedWarehouse?.code ||
                      "Không có mã kho"}
                  </small>
                  <p>
                    {resolvedWarehouse?.address ||
                      "Chưa có địa chỉ kho trong dữ liệu đơn."}
                  </p>
                </div>
  
                <div>
                  <span>Bảng giá vận chuyển</span>
                  <strong>
                    {resolvedServicePricing
                      ?.serviceTypeDisplayName ||
                      getConsignmentTypeLabel(
                        orderDetail?.consignmentType
                      )}
                  </strong>
                  <small>
                    {resolvedServicePricing
                      ?.routeDisplayName ||
                      orderDetail?.route ||
                      "—"}
                  </small>
                  <p>
                    {resolvedServicePricing
                      ?.formattedPrice ||
                      "Chi phí theo báo giá chính thức của đơn."}
                  </p>
                </div>
              </div>
  
              <div className="warehouse-receipt-rules">
                <span>
                  Dịch vụ / quy tắc áp dụng:
                </span>
  
                <div>
                  {selectedPricingRules.length ? (
                    selectedPricingRules.map(
                      (rule) => (
                        <Tag
                          key={
                            rule?.id ||
                            rule?.ruleCode
                          }
                        >
                          {rule?.ruleName ||
                            rule?.ruleCode ||
                            rule?.id}
                        </Tag>
                      )
                    )
                  ) : (
                    <Tag>
                      Không có dịch vụ bổ sung
                    </Tag>
                  )}
                </div>
              </div>
            </section>
  
            <p className="warehouse-receipt-document__description">
              Phiếu này được lập từ dữ liệu đơn ký gửi,
              báo giá và giao dịch thanh toán đã được hệ
              thống Vietnam Logistics ghi nhận. Thông tin
              người lập phiếu được lấy từ tài khoản Sale
              đang đăng nhập.
            </p>
  
            <footer className="warehouse-receipt-document__signatures">
              <div className="warehouse-receipt-signature">
                <strong>
                  NGƯỜI LẬP PHIẾU
                </strong>
  
                <span>{saleRole} </span>
  
                <div className="warehouse-receipt-signature__script">
                  {saleName}
                </div>
  
                {/* <b>{saleName}</b> */}
  
                <small>
                  
                </small>
              </div>
  
              <div className="warehouse-receipt-stamp">
                <div className="warehouse-receipt-stamp__outer">
                  <span>
                    {COMPANY_NAME}
                  </span>
  
                  <SafetyCertificateOutlined />
  
                  <strong>
                    ĐÃ XÁC NHẬN
                  </strong>
  
                  <small>
                    VIETNAM LOGISTICS
                  </small>
                </div>
              </div>
  
              <div className="warehouse-receipt-signature">
                <strong>
                  XÁC NHẬN KHO
                </strong>
  
                <span>(Thủ kho)</span>
  
                <div className="warehouse-receipt-signature__blank">
                  Ký và ghi rõ họ tên
                </div>
  
                <b>
                  {resolvedWarehouse?.name ||
                    "Kho nhập hàng"}
                </b>
  
                <small>
                  {resolvedWarehouse?.code ||
                    "Chưa có mã kho"}
                </small>
              </div>
            </footer>
  
            <div className="warehouse-receipt-document__footer">
              <small>
                Phiếu số {receiptCode}
              </small>
  
              <small>
                Order ID:{" "}
                {orderDetail?.orderId ||
                  orderId}
              </small>
  
              <small>
                Chứng từ điện tử nội bộ
              </small>
            </div>
          </article>
        </section>
      </main>
    );
  }