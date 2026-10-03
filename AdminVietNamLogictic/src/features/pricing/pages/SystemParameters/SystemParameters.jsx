/**
 * THAM SỐ VẬN HÀNH (Admin) — chỉnh các con số điều khiển cách hệ thống tính tiền.
 *
 * KHÁC GÌ TRANG "QUY TẮC TÍNH GIÁ" Ở DANH MỤC
 * Trang danh mục là bảng CRUD thô: liệt kê mọi dòng, mọi cột, ai đọc cũng phải tự biết
 * `PURCHASE_PRICE_TOLERANCE_RATE` nghĩa là gì. Trang này ngược lại: chỉ những con số
 * THỰC SỰ đổi hành vi hệ thống, mỗi con số kèm một câu "đổi nó thì cái gì chạy khác đi",
 * và ghi vào ĐÚNG bảng mà backend đọc.
 *
 * BA TRẠNG THÁI PHẢI PHÂN BIỆT RÕ, vì nhìn con số thôi thì giống hệt nhau:
 *   • Đã cấu hình  — có dòng trong DB, hệ thống chạy theo số này.
 *   • Chưa cấu hình — chưa có dòng nào; hệ thống chạy bằng mặc định trong mã nguồn.
 *     Lần lưu đầu tiên sẽ TẠO dòng.
 *   • Đang tắt     — có dòng nhưng bị tắt; hệ thống quay về mặc định. Đây là cái bẫy
 *     hay gặp nhất: số hiện trên màn hình đúng mà hệ thống không dùng.
 *
 * Màn hình không tự bật lại dòng đang tắt khi người dùng chỉ sửa số: bật hay tắt là một
 * quyết định riêng, có công tắc riêng.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Input,
  Select,
  Spin,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CalculatorOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  ControlOutlined,
  DollarCircleOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  WarningFilled,
  WarningOutlined,
} from "@ant-design/icons";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import OrderLimitsSection from "@features/pricing/components/OrderLimitsSection/OrderLimitsSection";
import {
  findParameterRecord,
  getSystemParameterApiError,
  getSystemParametersApi,
  saveSystemParameterApi,
} from "@features/pricing/api/systemParameterService";

import {
  SYSTEM_PARAMETER_GROUPS,
  VALUE_KIND,
} from "./SystemParameters.constants";
import {
  buildParameterRow,
  formatParameterValue,
  hasParameterChanged,
  validateConditionValue,
  validateParameterValue,
} from "./SystemParameters.helpers";
import "./SystemParameters.css";

const { Text, Title } = Typography;

const GROUP_META = {
  money: {
    icon: <DollarCircleOutlined style={{ color: "#2563eb" }} />,
    tagColor: "blue",
  },
  weight: {
    icon: <CalculatorOutlined style={{ color: "#059669" }} />,
    tagColor: "cyan",
  },
  surcharge: {
    icon: <InboxOutlined style={{ color: "#d97706" }} />,
    tagColor: "orange",
  },
  purchase: {
    icon: <ShoppingOutlined style={{ color: "#7c3aed" }} />,
    tagColor: "purple",
  },
};

export default function SystemParameters() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  /* Bản nháp theo mã tham số: { value, conditionValue, error, conditionError }. */
  const [drafts, setDrafts] = useState({});
  const [savingCode, setSavingCode] = useState("");

  /* Filters */
  const [selectedTab, setSelectedTab] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const load = useCallback(async (signal) => {
    try {
      const result = await getSystemParametersApi({ signal });
      if (signal?.aborted) return;

      setRecords(result);
      /* Bỏ nháp cũ: số trên màn hình phải là số vừa đọc từ server. */
      setDrafts({});
      setLoadError("");
    } catch (error) {
      if (signal?.aborted) return;

      setRecords([]);
      setLoadError(
        getSystemParameterApiError(error, "Không tải được tham số vận hành."),
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleReload = () => {
    setIsLoading(true);
    setLoadError("");
    load();
  };

  /* Ghép định nghĩa với bản ghi thật một lần cho cả trang. */
  const groups = useMemo(
    () =>
      SYSTEM_PARAMETER_GROUPS.map((group) => ({
        ...group,
        rows: group.items.map((definition) =>
          buildParameterRow(
            definition,
            findParameterRecord(records, definition),
          ),
        ),
      })),
    [records],
  );

  /* Thống kê KPI tham số */
  const stats = useMemo(() => {
    let total = 0;
    let configured = 0;
    let fallback = 0;
    let inactive = 0;

    groups.forEach((group) => {
      group.rows.forEach((row) => {
        total++;
        if (row.inactive) {
          inactive++;
        } else if (row.configured) {
          configured++;
        } else {
          fallback++;
        }
      });
    });

    return { total, configured, fallback, inactive };
  }, [groups]);

  const notConfiguredCount = stats.fallback;

  const draftOf = (row) =>
    drafts[row.definition.code] ?? {
      value: String(row.effectiveValue ?? ""),
      conditionValue: String(row.conditionValue ?? ""),
      error: "",
      conditionError: "",
    };

  const updateDraft = (row, patch) => {
    const current = draftOf(row);
    const next = { ...current, ...patch };

    /* Kiểm ngay lúc gõ — đừng để người dùng bấm Lưu mới biết gõ sai. */
    if (patch.value !== undefined) {
      next.error = validateParameterValue(patch.value, row.definition);
    }
    if (patch.conditionValue !== undefined) {
      next.conditionError = validateConditionValue(patch.conditionValue);
    }

    setDrafts((previous) => ({ ...previous, [row.definition.code]: next }));
  };

  const resetDraft = (row) => {
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[row.definition.code];
      return next;
    });
  };

  const save = async (row, { isActive } = {}) => {
    const draft = draftOf(row);
    const error = validateParameterValue(draft.value, row.definition);
    const conditionError = row.definition.condition
      ? validateConditionValue(draft.conditionValue)
      : "";

    if (error || conditionError) {
      updateDraft(row, { error, conditionError });
      return;
    }

    setSavingCode(row.definition.code);

    try {
      await saveSystemParameterApi({
        definition: row.definition,
        record: row.record,
        value: draft.value,
        conditionValue: row.definition.condition
          ? draft.conditionValue
          : undefined,
        isActive:
          isActive === undefined
            ? row.record
              ? row.record.isActive
              : true
            : isActive,
      });

      AuthNotify.success(
        "Đã lưu tham số",
        `${row.definition.label}: ${formatParameterValue(draft.value, row.definition)}. Áp cho các đơn phát sinh sau đây.`,
      );

      await load(undefined, false);
    } catch (saveError) {
      AuthNotify.error(
        "Không lưu được",
        getSystemParameterApiError(saveError),
      );
    } finally {
      setSavingCode("");
    }
  };

  const toggleActive = async (row, checked) => {
    if (!row.record?.id) return;
    await save(row, { isActive: checked });
  };

  /* Lọc theo từ khóa tìm kiếm */
  const rowMatchesSearch = (row, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const { definition, effectiveValue } = row;
    const label = String(definition.label || "").toLowerCase();
    const code = String(definition.code || "").toLowerCase();
    const affects = String(definition.affects || "").toLowerCase();
    const careful = String(definition.careful || "").toLowerCase();
    const val = String(effectiveValue ?? "").toLowerCase();
    return (
      label.includes(q) ||
      code.includes(q) ||
      affects.includes(q) ||
      careful.includes(q) ||
      val.includes(q)
    );
  };

  /* Lọc theo trạng thái cấu hình */
  const rowMatchesStatus = (row, status) => {
    if (status === "ALL") return true;
    if (status === "INACTIVE") return Boolean(row.inactive);
    if (status === "CONFIGURED") return Boolean(row.configured && !row.inactive);
    if (status === "FALLBACK") return !row.configured;
    return true;
  };

  /* Nhóm sau khi lọc */
  const filteredGroups = useMemo(() => {
    return groups
      .filter((group) => {
        if (selectedTab === "limits") return false;
        if (selectedTab !== "ALL" && group.key !== selectedTab) return false;
        return true;
      })
      .map((group) => ({
        ...group,
        filteredRows: group.rows.filter(
          (row) =>
            rowMatchesSearch(row, searchText.trim()) &&
            rowMatchesStatus(row, statusFilter),
        ),
      }))
      .filter((group) => group.filteredRows.length > 0 || !searchText);
  }, [groups, selectedTab, searchText, statusFilter]);

  /* Danh sách tabs */
  const tabItems = useMemo(() => {
    const list = [
      {
        key: "ALL",
        label: `Tất cả (${stats.total})`,
      },
    ];

    groups.forEach((group) => {
      const meta = GROUP_META[group.key];
      list.push({
        key: group.key,
        label: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {meta?.icon}
            {group.title} ({group.rows.length})
          </span>
        ),
      });
    });

    list.push({
      key: "limits",
      label: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <SafetyCertificateOutlined style={{ color: "#0284c7" }} />
          Giới hạn tạo đơn
        </span>
      ),
    });

    return list;
  }, [groups, stats.total]);

  const showOrderLimits = selectedTab === "ALL" || selectedTab === "limits";

  return (
    <div className="system-parameters">
      {/* Hero Banner */}
      <header className="system-parameters-hero">
        <div className="system-parameters-hero__content">
          <div className="system-parameters-hero__info">
            <div className="system-parameters-hero__eyebrow">
              <ControlOutlined />
              CẤU HÌNH & THAM SỐ TOÀN HỆ THỐNG
            </div>
            <Title level={2} className="system-parameters-hero__title">
              Tham số vận hành hệ thống
            </Title>
            <p className="system-parameters-hero__desc">
              Điều khiển công thức tính cước, tỷ lệ cọc, ngưỡng dung sai mua hộ, thuế VAT,
              phụ phí đóng gói và các giới hạn tạo đơn trên toàn nền tảng logistics.
            </p>
          </div>

          <div className="system-parameters-hero__actions">
            <Button
              className="system-parameters-hero__reload-btn"
              icon={<ReloadOutlined spin={isLoading} />}
              onClick={handleReload}
              disabled={isLoading}
            >
              Tải lại cấu hình
            </Button>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="system-parameters-kpi-grid">
        <div className="system-parameters-kpi-card system-parameters-kpi-card--total">
          <div className="system-parameters-kpi-card__icon-box">
            <SettingOutlined />
          </div>
          <div className="system-parameters-kpi-card__meta">
            <span className="system-parameters-kpi-card__label">Tổng tham số</span>
            <span className="system-parameters-kpi-card__value">{stats.total}</span>
            <span className="system-parameters-kpi-card__sub">Bao gồm 4 nhóm phí & quy tắc</span>
          </div>
        </div>

        <div className="system-parameters-kpi-card system-parameters-kpi-card--active">
          <div className="system-parameters-kpi-card__icon-box">
            <CheckCircleFilled />
          </div>
          <div className="system-parameters-kpi-card__meta">
            <span className="system-parameters-kpi-card__label">Đang áp dụng</span>
            <span className="system-parameters-kpi-card__value">{stats.configured}</span>
            <span className="system-parameters-kpi-card__sub">Đã lưu DB và đang tính tiền</span>
          </div>
        </div>

        <div className="system-parameters-kpi-card system-parameters-kpi-card--fallback">
          <div className="system-parameters-kpi-card__icon-box">
            <ClockCircleFilled />
          </div>
          <div className="system-parameters-kpi-card__meta">
            <span className="system-parameters-kpi-card__label">Dùng mặc định</span>
            <span className="system-parameters-kpi-card__value">{stats.fallback}</span>
            <span className="system-parameters-kpi-card__sub">Theo hằng số mã nguồn</span>
          </div>
        </div>

        <div className="system-parameters-kpi-card system-parameters-kpi-card--inactive">
          <div className="system-parameters-kpi-card__icon-box">
            <WarningFilled />
          </div>
          <div className="system-parameters-kpi-card__meta">
            <span className="system-parameters-kpi-card__label">Đang tạm tắt</span>
            <span className="system-parameters-kpi-card__value">{stats.inactive}</span>
            <span className="system-parameters-kpi-card__sub">Hệ thống bỏ qua khi tính toán</span>
          </div>
        </div>
      </section>

      {/* Banners hướng dẫn & cảnh báo */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        className="system-parameters__note"
        message="Nguyên tắc áp dụng tham số hệ thống"
        description="Mọi thay đổi tham số chỉ áp dụng cho các đơn hàng, báo giá và khoản phụ phí phát sinh SAU thời điểm lưu. Báo giá đã gửi, khoản cọc đã phát hành và khoản hoàn đã chốt được bảo lưu con số cũ."
      />

      {loadError && (
        <Alert
          type="error"
          showIcon
          className="system-parameters__note system-parameters__note--error"
          message="Không tải được tham số"
          description={loadError}
        />
      )}

      {!loadError && notConfiguredCount > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          className="system-parameters__note system-parameters__note--warning"
          message={`${notConfiguredCount} tham số chưa được lưu vào cơ sở dữ liệu`}
          description="Các tham số này đang tạm thời chạy bằng giá trị mặc định của mã nguồn. Bạn có thể bấm 'Ghi vào cấu hình' để ghi đè vào DB, giúp hệ thống hoạt động ổn định và có thể tùy chỉnh sau này mà không cần lập trình viên."
        />
      )}

      {/* Navigation & Search Filter Bar */}
      <section className="system-parameters-filter-bar">
        <div className="system-parameters-filter-bar__top">
          <Input
            className="system-parameters-filter-bar__search"
            placeholder="Tìm kiếm tham số (VD: cọc, VAT, 5000, bảo hiểm, DEPOSIT_RATE...)"
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <div className="system-parameters-filter-bar__controls">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 200 }}
              options={[
                { value: "ALL", label: "Tất cả trạng thái" },
                { value: "CONFIGURED", label: "Đã cấu hình (Lưu DB)" },
                { value: "FALLBACK", label: "Đang dùng mặc định" },
                { value: "INACTIVE", label: "Đang tạm tắt" },
              ]}
            />
          </div>
        </div>

        <Tabs
          className="system-parameters-filter-bar__tabs"
          activeKey={selectedTab}
          onChange={setSelectedTab}
          items={tabItems}
        />
      </section>

      {/* Nội dung danh sách tham số */}
      {isLoading ? (
        <div className="system-parameters__loading">
          <Spin size="large" />
          <Text type="secondary" style={{ fontSize: 14 }}>
            Đang tải dữ liệu cấu hình hệ thống…
          </Text>
        </div>
      ) : (
        <>
          {filteredGroups.length === 0 && selectedTab !== "limits" && (
            <div style={{ background: "#ffffff", padding: "40px 20px", borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <Empty
                description="Không tìm thấy tham số nào phù hợp với bộ lọc tìm kiếm hiện tại."
              />
            </div>
          )}

          {filteredGroups.map((group) => {
            const meta = GROUP_META[group.key];

            return (
              <section key={group.key} className="system-parameters__group">
                <div className="system-parameters__group-head">
                  <div>
                    <div className="system-parameters__group-head-title">
                      {meta?.icon}
                      <h4>{group.title}</h4>
                      <Badge
                        count={group.filteredRows.length}
                        style={{ backgroundColor: "#0284c7" }}
                      />
                    </div>
                    <Text type="secondary">{group.hint}</Text>
                  </div>
                </div>

                <div className="system-parameters__list">
                  {group.filteredRows.map((row) => {
                    const { definition } = row;
                    const draft = draftOf(row);
                    const busy = savingCode === definition.code;
                    const changed = hasParameterChanged(row, draft);

                    return (
                      <article
                        key={definition.code}
                        className={`param ${changed ? "param--changed" : ""}`}
                      >
                        {/* Cột trái: Thông tin tham số & Giải thích */}
                        <div className="param__main">
                          <div className="param__title">
                            <strong>{definition.label}</strong>

                            {!row.configured && (
                              <Tooltip title="Chưa có dòng nào trong DB — hệ thống đang chạy bằng giá trị mặc định của mã nguồn.">
                                <Tag color="gold" icon={<ClockCircleFilled />}>
                                  Dùng mặc định
                                </Tag>
                              </Tooltip>
                            )}

                            {row.configured && !row.inactive && (
                              <Tag color="success" icon={<CheckCircleFilled />}>
                                Đã cấu hình
                              </Tag>
                            )}

                            {row.inactive && (
                              <Tooltip title="Dòng cấu hình đang tắt nên hệ thống bỏ qua nó và quay về giá trị mặc định.">
                                <Tag color="error" icon={<WarningFilled />}>
                                  Đang tắt
                                </Tag>
                              </Tooltip>
                            )}

                            <code className="param__code">{definition.code}</code>
                          </div>

                          <p className="param__affects">{definition.affects}</p>

                          {definition.careful && (
                            <div className="param__careful">
                              <WarningOutlined />
                              <span>{definition.careful}</span>
                            </div>
                          )}

                          <div className="param__current">
                            <ThunderboltOutlined style={{ color: "#0284c7" }} />
                            <span>Đang áp dụng:</span>
                            <b>{formatParameterValue(row.effectiveValue, definition)}</b>
                            {!row.configured && (
                              <span className="param__muted">(mặc định mã nguồn)</span>
                            )}
                          </div>
                        </div>

                        {/* Cột phải: Nhập giá trị & Thao tác */}
                        <div className="param__edit">
                          <label className="param__field">
                            <span>Giá trị mới</span>
                            <Input
                              value={draft.value}
                              status={draft.error ? "error" : ""}
                              disabled={busy}
                              inputMode="decimal"
                              placeholder="Nhập giá trị..."
                              suffix={
                                definition.kind === VALUE_KIND.PERCENT
                                  ? "%"
                                  : definition.kind === VALUE_KIND.MONEY
                                    ? "đ"
                                    : ""
                              }
                              onChange={(event) =>
                                updateDraft(row, { value: event.target.value })
                              }
                            />
                            {draft.error && (
                              <span className="param__error">{draft.error}</span>
                            )}
                          </label>

                          {definition.condition && (
                            <label className="param__field">
                              <span>{definition.condition.label}</span>
                              <Input
                                value={draft.conditionValue}
                                status={draft.conditionError ? "error" : ""}
                                disabled={busy}
                                inputMode="decimal"
                                placeholder="Để trống = không ràng buộc"
                                suffix={definition.condition.unit}
                                onChange={(event) =>
                                  updateDraft(row, {
                                    conditionValue: event.target.value,
                                  })
                                }
                              />
                              <span className="param__hint">
                                {definition.condition.hint}
                              </span>
                              {draft.conditionError && (
                                <span className="param__error">
                                  {draft.conditionError}
                                </span>
                              )}
                            </label>
                          )}

                          <div className="param__actions">
                            <Button
                              type="primary"
                              size="middle"
                              className="param__save-btn"
                              loading={busy}
                              disabled={Boolean(draft.error) || !changed}
                              onClick={() => save(row)}
                            >
                              {row.configured ? "Lưu thay đổi" : "Ghi vào cấu hình"}
                            </Button>

                            {changed && (
                              <Button
                                size="middle"
                                icon={<UndoOutlined />}
                                disabled={busy}
                                onClick={() => resetDraft(row)}
                              >
                                Hoàn tác
                              </Button>
                            )}

                            {row.configured && (
                              <span className="param__switch">
                                <Switch
                                  size="small"
                                  checked={row.record.isActive}
                                  disabled={busy}
                                  onChange={(checked) => toggleActive(row, checked)}
                                />
                                <span>Áp dụng</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Giới hạn tạo đơn ký gửi / mua hộ */}
          {showOrderLimits && <OrderLimitsSection />}
        </>
      )}
    </div>
  );
}
