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
  Button,
  Empty,
  Input,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  InfoCircleOutlined,
  ReloadOutlined,
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

export default function SystemParameters() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  /* Bản nháp theo mã tham số: { value, conditionValue, error, conditionError }. */
  const [drafts, setDrafts] = useState({});
  const [savingCode, setSavingCode] = useState("");

  const load = useCallback(async (signal) => {
    setIsLoading(true);
    setLoadError("");

    try {
      const result = await getSystemParametersApi({ signal });
      if (signal?.aborted) return;

      setRecords(result);
      /* Bỏ nháp cũ: số trên màn hình phải là số vừa đọc từ server. */
      setDrafts({});
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

  const notConfiguredCount = useMemo(
    () =>
      groups.reduce(
        (total, group) =>
          total + group.rows.filter((row) => !row.configured).length,
        0,
      ),
    [groups],
  );

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

      await load();
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

  return (
    <div className="system-parameters">
      <header className="system-parameters__head">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Tham số vận hành
          </Title>
          <Text type="secondary">
            Những con số điều khiển cách hệ thống tính tiền. Sửa ở đây là áp cho
            toàn hệ thống, không phải cho một khách.
          </Text>
        </div>

        <Button icon={<ReloadOutlined />} onClick={() => load()} disabled={isLoading}>
          Tải lại
        </Button>
      </header>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        className="system-parameters__note"
        message="Đổi tham số chỉ áp cho việc phát sinh SAU khi lưu"
        description="Báo giá đã gửi, khoản cọc đã phát hành và khoản hoàn đã chốt vẫn giữ nguyên con số cũ. Muốn đổi những cái đó thì phải lập lại từng cái."
      />

      {loadError && (
        <Alert
          type="error"
          showIcon
          className="system-parameters__note"
          message="Không tải được tham số"
          description={loadError}
        />
      )}

      {!loadError && notConfiguredCount > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          className="system-parameters__note"
          message={`${notConfiguredCount} tham số chưa được cấu hình`}
          description="Chúng đang chạy bằng giá trị mặc định trong mã nguồn. Bấm Lưu một lần để ghi hẳn vào cấu hình — sau này đổi không cần lập trình viên."
        />
      )}

      {isLoading ? (
        <div className="system-parameters__loading">
          <Spin />
          <Text type="secondary">Đang đọc cấu hình…</Text>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="system-parameters__group">
            <div className="system-parameters__group-head">
              <h4>{group.title}</h4>
              <Text type="secondary">{group.hint}</Text>
            </div>

            <div className="system-parameters__list">
              {group.rows.length === 0 && <Empty description="Không có tham số" />}

              {group.rows.map((row) => {
                const { definition } = row;
                const draft = draftOf(row);
                const busy = savingCode === definition.code;
                const changed = hasParameterChanged(row, draft);

                return (
                  <article key={definition.code} className="param">
                    <div className="param__main">
                      <div className="param__title">
                        <strong>{definition.label}</strong>

                        {!row.configured && (
                          <Tooltip title="Chưa có dòng nào trong cấu hình — hệ thống đang chạy bằng giá trị mặc định của mã nguồn.">
                            <Tag color="gold">Đang dùng mặc định</Tag>
                          </Tooltip>
                        )}

                        {row.inactive && (
                          <Tooltip title="Dòng cấu hình đang tắt nên hệ thống bỏ qua nó và quay về giá trị mặc định.">
                            <Tag color="red">Đang tắt</Tag>
                          </Tooltip>
                        )}

                        <code className="param__code">{definition.code}</code>
                      </div>

                      <p className="param__affects">{definition.affects}</p>

                      {definition.careful && (
                        <p className="param__careful">
                          <WarningOutlined /> {definition.careful}
                        </p>
                      )}

                      <p className="param__current">
                        Đang áp dụng:{" "}
                        <b>{formatParameterValue(row.effectiveValue, definition)}</b>
                        {!row.configured && (
                          <span className="param__muted">
                            {" "}
                            (mặc định của hệ thống)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="param__edit">
                      <label className="param__field">
                        <span>Giá trị mới</span>
                        <Input
                          value={draft.value}
                          status={draft.error ? "error" : ""}
                          disabled={busy}
                          inputMode="decimal"
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
                          size="small"
                          loading={busy}
                          disabled={Boolean(draft.error) || !changed}
                          onClick={() => save(row)}
                        >
                          {row.configured ? "Lưu" : "Ghi vào cấu hình"}
                        </Button>

                        {changed && (
                          <Button
                            size="small"
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
                            <span>Đang áp dụng</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Giới hạn tạo đơn ký gửi / mua hộ — bảng riêng (SYSTEM_SETTINGS), tải / lưu độc lập. */}
      <OrderLimitsSection />
    </div>
  );
}
