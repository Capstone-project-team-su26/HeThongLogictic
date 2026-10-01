/**
 * GIỚI HẠN TẠO ĐƠN (Admin) — mục trên trang "Tham số vận hành".
 *
 * Trước đây form tạo đơn ký gửi / mua hộ (web khách + màn Sale tạo hộ) chặn cứng 5 kg / đơn,
 * 10.000.000 đ / đơn, 3 kg / kiện… Nay Admin đặt các con số đó ở đây; backend lưu ở bảng
 * SYSTEM_SETTINGS (nhóm ORDER_LIMITS), kiểm lại khi tạo / xem trước đơn, và ghi nhật ký
 * mỗi lần đổi (ai, lúc nào, cũ → mới).
 *
 * Lưu một lần cho mọi ô đã sửa (một PUT) vì backend kiểm chéo cả bộ: tổng cân nặng của đơn
 * không được nhỏ hơn cân nặng tối đa mỗi kiện, tương tự với giá trị khai báo.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, Spin, Tag, Typography } from "antd";
import { HistoryOutlined, ReloadOutlined } from "@ant-design/icons";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import {
  getOrderLimitHistoryApi,
  getOrderLimitSettingsApi,
  getOrderLimitsApiError,
  updateOrderLimitSettingsApi,
} from "@shared/api/orderLimitsApi";
import { formatVietnamDateTime } from "@shared/utils/timeUtc";

import {
  draftFromItem,
  draftValue,
  formatOrderLimit,
  validateOrderLimitDraft,
} from "./OrderLimitsSection.helpers";
import "./OrderLimitsSection.css";

const { Text } = Typography;

const SCOPE_TITLES = {
  CONSIGNMENT: "Đơn ký gửi (web khách + Sale tạo hộ khách)",
  PURCHASE: "Yêu cầu mua hộ (web khách + Sale tạo hộ khách)",
};

export default function OrderLimitsSection() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ updatedAt: null, updatedByName: null });
  const [drafts, setDrafts] = useState({});
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* Lần đầu isLoading đã là true; bấm "Tải lại" thì bật lại trước khi gọi. */
  const load = useCallback(
    (signal) =>
      getOrderLimitSettingsApi({ signal })
        .then((result) => {
          if (signal?.aborted) return;
          setItems(result.items);
          setMeta({ updatedAt: result.updatedAt, updatedByName: result.updatedByName });
          setDrafts({});
          setLoadError("");
        })
        .catch((error) => {
          if (signal?.aborted) return;
          setItems([]);
          setLoadError(getOrderLimitsApiError(error, "Không tải được giới hạn tạo đơn."));
        })
        .finally(() => {
          if (!signal?.aborted) setIsLoading(false);
        }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await getOrderLimitHistoryApi(20));
    } catch (error) {
      AuthNotify.error("Không tải được nhật ký", getOrderLimitsApiError(error));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) loadHistory();
  };

  const draftOf = (item) => drafts[item.key] ?? draftFromItem(item);

  const updateDraft = (item, patch) =>
    setDrafts((previous) => ({ ...previous, [item.key]: { ...draftOf(item), ...patch } }));

  const rows = useMemo(
    () =>
      items.map((item) => {
        const draft = drafts[item.key] ?? draftFromItem(item);
        const error = validateOrderLimitDraft(item, draft);
        const next = error ? undefined : draftValue(draft);
        const changed = !error && drafts[item.key] !== undefined && next !== item.value;
        return { item, draft, error, next, changed };
      }),
    [items, drafts],
  );

  const changedRows = rows.filter((row) => row.changed);
  const hasErrors = rows.some((row) => row.error);

  const groups = useMemo(
    () =>
      ["CONSIGNMENT", "PURCHASE"]
        .map((scope) => ({ scope, rows: rows.filter((row) => row.item.scope === scope) }))
        .filter((group) => group.rows.length > 0),
    [rows],
  );

  const save = async () => {
    setIsSaving(true);
    setSaveError("");

    try {
      const values = Object.fromEntries(changedRows.map((row) => [row.item.key, row.next]));
      const result = await updateOrderLimitSettingsApi(values, note);

      setItems(result.items);
      setMeta({ updatedAt: result.updatedAt, updatedByName: result.updatedByName });
      setDrafts({});
      setNote("");
      setConfirmOpen(false);

      AuthNotify.success(
        "Đã cập nhật giới hạn đơn hàng",
        `${changedRows.length} giới hạn đã đổi. Áp dụng ngay cho các đơn tạo từ bây giờ.`,
      );

      if (historyOpen) loadHistory();
    } catch (error) {
      setSaveError(getOrderLimitsApiError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="system-parameters__group order-limits" id="gioi-han-tao-don">
      <div className="order-limits__head">
        <div className="system-parameters__group-head">
          <h4>Giới hạn tạo đơn ký gửi / mua hộ</h4>
          <Text type="secondary">
            Trần cân nặng, giá trị khai báo, kích thước, số kiện và số lượng mà khách / Sale được
            khai khi tạo đơn. Để “Không giới hạn” thì hệ thống không chặn con số đó.
          </Text>
          <Text type="secondary" className="order-limits__audit">
            {meta.updatedAt
              ? `Sửa lần cuối: ${meta.updatedByName || "—"} lúc ${formatVietnamDateTime(meta.updatedAt)}`
              : "Chưa ai sửa — đang dùng giá trị khởi tạo của hệ thống."}
          </Text>
        </div>

        <div className="order-limits__head-actions">
          <Button icon={<HistoryOutlined />} onClick={toggleHistory} disabled={isLoading}>
            {historyOpen ? "Ẩn nhật ký" : "Nhật ký thay đổi"}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setIsLoading(true);
              load();
            }}
            disabled={isLoading || isSaving}
          >
            Tải lại
          </Button>
        </div>
      </div>

      {loadError && (
        <Alert type="error" showIcon message="Không tải được giới hạn tạo đơn" description={loadError} />
      )}

      {historyOpen && (
        <div className="order-limits__history">
          {historyLoading ? (
            <Spin size="small" />
          ) : history.length === 0 ? (
            <Text type="secondary">Chưa có thay đổi nào.</Text>
          ) : (
            <ul>
              {history.map((row) => (
                <li key={row.id}>
                  <span className="order-limits__history-time">{formatVietnamDateTime(row.changedAt)}</span>
                  <b>{row.changedByName || "—"}</b> đổi <b>{row.label}</b>:{" "}
                  {formatOrderLimit(row.oldValue, row.unit)} → {formatOrderLimit(row.newValue, row.unit)}
                  {row.note && <span className="order-limits__history-note"> — {row.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="system-parameters__loading">
          <Spin />
          <Text type="secondary">Đang đọc giới hạn tạo đơn…</Text>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.scope} className="order-limits__scope">
            <div className="order-limits__scope-title">{SCOPE_TITLES[group.scope] || group.scope}</div>

            <div className="system-parameters__list">
              {group.rows.map(({ item, draft, error, changed }) => (
                <article key={item.key} className="param">
                  <div className="param__main">
                    <div className="param__title">
                      <strong>{item.label}</strong>
                      {item.value === null && <Tag color="blue">Không giới hạn</Tag>}
                      {changed && <Tag color="gold">Chưa lưu</Tag>}
                      <code className="param__code">{item.key}</code>
                    </div>

                    <p className="param__affects">{item.description}</p>

                    <p className="param__current">
                      Đang áp dụng: <b>{formatOrderLimit(item.value, item.unit)}</b>
                      <span className="param__muted">
                        {" "}
                        (mặc định {formatOrderLimit(item.defaultValue, item.unit)})
                      </span>
                    </p>

                    {item.updatedAt && (
                      <p className="param__muted order-limits__row-audit">
                        Sửa bởi {item.updatedByName || "—"} lúc {formatVietnamDateTime(item.updatedAt)}
                      </p>
                    )}
                  </div>

                  <div className="param__edit">
                    <label className="param__field">
                      <span>Giá trị mới ({item.unit})</span>
                      <Input
                        value={draft.unlimited ? "" : draft.text}
                        status={error ? "error" : ""}
                        disabled={isSaving || draft.unlimited}
                        inputMode="decimal"
                        placeholder={draft.unlimited ? "Không giới hạn" : "Nhập số"}
                        suffix={item.unit}
                        onChange={(event) => updateDraft(item, { text: event.target.value })}
                      />
                      <span className="param__hint">
                        Khoảng hợp lệ: {formatOrderLimit(item.minValue, item.unit)} –{" "}
                        {formatOrderLimit(item.maxValue, item.unit)}
                        {item.isInteger ? ", số nguyên" : ""}.
                      </span>
                      {error && <span className="param__error">{error}</span>}
                    </label>

                    {item.allowUnlimited && (
                      <Checkbox
                        checked={draft.unlimited}
                        disabled={isSaving}
                        onChange={(event) =>
                          updateDraft(item, {
                            unlimited: event.target.checked,
                            text:
                              !event.target.checked && draft.text === ""
                                ? String(item.defaultValue ?? "").replace(".", ",")
                                : draft.text,
                          })
                        }
                      >
                        Không giới hạn
                      </Checkbox>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}

      {!isLoading && !loadError && items.length > 0 && (
        <div className="order-limits__savebar">
          <Input
            className="order-limits__note"
            value={note}
            maxLength={500}
            disabled={isSaving}
            placeholder="Lý do thay đổi (tuỳ chọn, ghi vào nhật ký)"
            onChange={(event) => setNote(event.target.value)}
          />
          <Button disabled={isSaving || Object.keys(drafts).length === 0} onClick={() => setDrafts({})}>
            Hoàn tác
          </Button>
          <Button
            type="primary"
            disabled={hasErrors || changedRows.length === 0}
            onClick={() => {
              setSaveError("");
              setConfirmOpen(true);
            }}
          >
            Lưu thay đổi{changedRows.length ? ` (${changedRows.length})` : ""}
          </Button>
        </div>
      )}

      <Modal
        open={confirmOpen}
        title="Xác nhận đổi giới hạn tạo đơn"
        okText="Lưu"
        cancelText="Huỷ"
        confirmLoading={isSaving}
        cancelButtonProps={{ disabled: isSaving }}
        maskClosable={!isSaving}
        closable={!isSaving}
        onOk={save}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>Áp dụng ngay cho mọi đơn ký gửi / mua hộ tạo từ bây giờ (web khách và Sale tạo hộ):</p>
        <ul className="order-limits__confirm-list">
          {changedRows.map(({ item, next }) => (
            <li key={item.key}>
              <b>{item.label}</b>: {formatOrderLimit(item.value, item.unit)} →{" "}
              <b>{formatOrderLimit(next, item.unit)}</b>
            </li>
          ))}
        </ul>
        <p className="param__muted">Đơn đã tạo trước đó không bị ảnh hưởng.</p>
        {saveError && <Alert type="error" showIcon message={saveError} />}
      </Modal>
    </section>
  );
}
