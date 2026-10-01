/**
 * Hộp "Gán kho" cho một tài khoản vai trò kho (màn Quản lý người dùng của Admin).
 *
 * - Nạp kho phụ trách hiện tại qua GET /api/users/{id}/warehouses (người gán, lúc gán, ghi chú)
 *   và danh mục kho qua GET /api/warehouses.
 * - Chọn nhiều kho bằng checkbox. Chỉ liệt kê kho ĐANG HOẠT ĐỘNG; tài khoản có vùng thì chỉ kho
 *   cùng vùng; tài khoản trống vùng thì hiện mọi kho nhưng đã chọn một kho thì chỉ chọn thêm
 *   được kho cùng vùng (server sẽ đặt vùng tài khoản = vùng của kho).
 * - Bỏ chọn hết = bỏ gán: tài khoản quay về giới hạn theo vùng như trước khi có tính năng này.
 * - PUT THAY TOÀN BỘ danh sách, nên chưa nạp được danh sách hiện tại thì KHÔNG cho lưu.
 * - Trước khi lưu luôn qua hộp xem lại (SubmitReview) ghi đủ trước → sau.
 *
 * Component được mount lại mỗi lần mở (nơi gọi gắn `key={user.id}`), nên state tự sạch.
 */

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";

import SubmitReview, {
  ReviewFacts,
  ReviewSection,
} from "@shared/components/SubmitReview/SubmitReview";
import useSubmitReviewData from "@shared/components/SubmitReview/useSubmitReviewData";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import { formatVietnamDateTime } from "@shared/utils/timeUtc";
import {
  assignUserWarehousesApi,
  getAdminUserApiError,
  getAssignableWarehousesApi,
  getUserWarehousesApi,
  isWarehouseRole,
  toRegionKey,
} from "@features/admin/api/adminUserService";
import "./UserWarehouseAssignModal.css";
import { getRoleLabel, getWarehouseTypeLabel } from "@shared/utils/statusLabel";

const { Text } = Typography;

const formatDate = (value) => formatVietnamDateTime(value, { fallback: "—" });

const compareText = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), "vi", { sensitivity: "base" });

const toSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

/* Ném lại lỗi dạng Error thường mang câu tiếng Việt, để useSubmitReviewData hiện đúng câu đó
   (kể cả 403 body rỗng). */
const withReadableError = (promise, fallback) =>
  promise.catch((error) => {
    throw new Error(getAdminUserApiError(error, fallback));
  });

const warehouseLabel = (warehouse) =>
  warehouse?.name || warehouse?.code || warehouse?.id || "Kho không rõ tên";

const sameSet = (left, right) =>
  left.length === right.length && left.every((id) => right.includes(id));

function WarehouseList({ items, emptyText }) {
  if (!items.length) return <Text type="secondary">{emptyText}</Text>;
  return (
    <Space size={[4, 6]} wrap>
      {items.map((item) => (
        <Tag key={item.id} color={item.tone}>
          {warehouseLabel(item)}
          {item.region ? ` · ${item.region}` : ""}
          {item.suffix ? ` (${item.suffix})` : ""}
        </Tag>
      ))}
    </Space>
  );
}

export default function UserWarehouseAssignModal({ user, onClose, onSaved }) {
  const userId = user?.id ? String(user.id) : "";

  const detailState = useSubmitReviewData(userId, () =>
    withReadableError(getUserWarehousesApi(userId), "Không tải được kho phụ trách hiện tại."),
  );
  const catalogState = useSubmitReviewData(userId ? `catalog-${userId}` : "", () =>
    withReadableError(getAssignableWarehousesApi(), "Không tải được danh mục kho."),
  );

  const [selection, setSelection] = useState(null);
  const [note, setNote] = useState("");
  const [keyword, setKeyword] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const detail = detailState.data;
  const detailReady = Boolean(detail) && !detailState.loading && !detailState.error;

  const currentWarehouses = useMemo(
    () => detail?.warehouses ?? user?.assignedWarehouses ?? [],
    [detail, user],
  );
  const currentIds = useMemo(
    () => currentWarehouses.map((warehouse) => warehouse.warehouseId),
    [currentWarehouses],
  );
  const selectedIds = selection ?? currentIds;

  const currentRegion = String(detail?.region ?? user?.region ?? "").trim();
  const currentRegionKey = toRegionKey(currentRegion);
  const roleLabel = getRoleLabel(detail?.role || user?.role);
  const canAssign = detail ? detail.isWarehouseRole : isWarehouseRole(user?.role);

  /* Thông tin kho theo id: ưu tiên danh mục, thiếu thì lấy từ bản ghi gán hiện tại. */
  const warehouseById = useMemo(() => {
    const map = new Map();
    currentWarehouses.forEach((item) =>
      map.set(item.warehouseId, {
        id: item.warehouseId,
        name: item.warehouseName,
        code: item.warehouseCode,
        region: item.region,
        isActive: item.isActive,
        warehouseType: "",
      }),
    );
    (catalogState.data || []).forEach((warehouse) => map.set(warehouse.id, warehouse));
    return map;
  }, [catalogState.data, currentWarehouses]);

  const describe = (id) =>
    warehouseById.get(id) || { id, name: "", code: id, region: "", isActive: true };

  /* Vùng khoá lựa chọn: vùng của tài khoản, hoặc (tài khoản trống vùng) vùng của kho chọn đầu tiên. */
  const firstSelected = selectedIds.length ? describe(selectedIds[0]) : null;
  const lockedRegionKey = currentRegionKey || toRegionKey(firstSelected?.region);
  const regionAfterSave =
    selectedIds.length === 0 ? currentRegion : currentRegion || String(firstSelected?.region || "").trim();
  const regionWillChange = toRegionKey(regionAfterSave) !== currentRegionKey;

  const options = useMemo(() => {
    const catalog = catalogState.data || [];
    const visible = catalog.filter(
      (warehouse) =>
        warehouse.isActive &&
        (!currentRegionKey || toRegionKey(warehouse.region) === currentRegionKey),
    );
    const visibleIds = new Set(visible.map((warehouse) => warehouse.id));
    /* Kho đang gán nhưng không còn trong danh sách chọn (ngừng hoạt động / khác vùng) vẫn hiện
       để Admin thấy và bỏ chọn được. */
    const extras = currentIds
      .filter((id) => !visibleIds.has(id))
      .map((id) => warehouseById.get(id))
      .filter(Boolean);

    const search = toSearchText(keyword);
    return [...visible, ...extras]
      .filter(
        (warehouse) =>
          !search ||
          [warehouse.name, warehouse.code, warehouse.region].some((value) =>
            toSearchText(value).includes(search),
          ),
      )
      .sort(
        (a, b) => compareText(a.region, b.region) || compareText(warehouseLabel(a), warehouseLabel(b)),
      );
  }, [catalogState.data, currentIds, currentRegionKey, keyword, warehouseById]);

  const selectedInactive = selectedIds.map(describe).filter((warehouse) => !warehouse.isActive);
  const unchanged = sameSet(selectedIds, currentIds) && !note.trim();
  const saveBlockedReason = !detailReady
    ? "Chưa tải được danh sách kho hiện tại — không thể lưu vì thao tác này thay toàn bộ danh sách."
    : !canAssign
      ? "Tài khoản này không phải vai trò kho nên không gán kho được."
      : "";

  const isDisabled = (warehouse, checked) => {
    if (!detailReady || !canAssign || saving) return true;
    if (checked) return false;
    if (!warehouse.isActive) return true;
    return Boolean(lockedRegionKey) && toRegionKey(warehouse.region) !== lockedRegionKey;
  };

  const toggle = (id, checked) =>
    setSelection((previous) => {
      const base = previous ?? currentIds;
      const rest = base.filter((item) => item !== id);
      return checked ? [...rest, id] : rest;
    });

  const beforeItems = currentIds.map((id) => ({ ...describe(id), tone: "default" }));
  const afterItems = selectedIds.map((id) => ({
    ...describe(id),
    tone: currentIds.includes(id) ? "blue" : "green",
    suffix: currentIds.includes(id) ? "giữ" : "thêm mới",
  }));
  const removedItems = currentIds
    .filter((id) => !selectedIds.includes(id))
    .map((id) => ({ ...describe(id), tone: "red", suffix: "bỏ gán" }));

  const unassignConsequence = currentRegion
    ? `Tài khoản quay về giới hạn theo vùng ${currentRegion}: thao tác được mọi kho đang hoạt động thuộc vùng này.`
    : "Tài khoản chưa có vùng nên sau khi bỏ gán sẽ không bị giới hạn theo kho cụ thể nào; nên đặt vùng cho tài khoản.";

  const submit = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const result = await assignUserWarehousesApi(userId, { warehouseIds: selectedIds, note });
      const regionNote = result.data.regionChanged
        ? ` Vùng tài khoản: ${result.data.previousRegion || "trống"} → ${result.data.region || "trống"}.`
        : "";
      AuthNotify.success(
        "Đã lưu kho phụ trách",
        `${result.message || "Đã cập nhật kho phụ trách."}${regionNote}`,
      );
      setReviewOpen(false);
      onSaved?.(result);
    } catch (error) {
      const message = getAdminUserApiError(error, "Không lưu được kho phụ trách.");
      setSaveError(message);
      AuthNotify.error("Lưu kho phụ trách thất bại", message);
    } finally {
      setSaving(false);
    }
  };

  const currentColumns = [
    {
      title: "Kho",
      key: "warehouse",
      render: (_, row) => (
        <div className="uwa-cell">
          <strong>{row.warehouseName || row.warehouseCode || "—"}</strong>
          <span>{[row.warehouseCode, row.region].filter(Boolean).join(" · ")}</span>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      width: 120,
      render: (value) => (value === false ? <Tag>Ngừng hoạt động</Tag> : <Tag color="green">Hoạt động</Tag>),
    },
    { title: "Lúc gán", dataIndex: "assignedAt", width: 150, render: formatDate },
    { title: "Người gán", dataIndex: "assignedByName", width: 150, render: (value) => value || "—" },
    { title: "Ghi chú", dataIndex: "note", render: (value) => value || "—" },
  ];

  const loadingMain = detailState.loading || catalogState.loading;

  return (
    <>
      <Modal
        open
        width={820}
        title={`Gán kho: ${user?.fullName || user?.email || "Tài khoản"}`}
        mask={{ closable: !saving }}
        destroyOnHidden
        onCancel={() => !saving && onClose?.()}
        className="admin-editor-modal"
        footer={[
          <Button key="cancel" onClick={onClose} disabled={saving}>
            Hủy
          </Button>,
          <Button
            key="review"
            type="primary"
            disabled={Boolean(saveBlockedReason) || unchanged || loadingMain}
            onClick={() => {
              setSaveError("");
              setReviewOpen(true);
            }}
          >
            Xem lại &amp; lưu
          </Button>,
        ]}
      >
        <div className="uwa-body">
          <ReviewFacts
            items={[
              { label: "Tài khoản", value: [user?.fullName, user?.email].filter(Boolean).join(" · ") },
              { label: "Vai trò", value: roleLabel },
              { label: "Vùng hiện tại", value: currentRegion || "Chưa có vùng" },
            ]}
          />

          {detailState.error ? (
            <Alert type="error" showIcon message="Không tải được kho phụ trách hiện tại" description={detailState.error} />
          ) : null}
          {saveBlockedReason && !detailState.loading && !detailState.error ? (
            <Alert type="warning" showIcon message={saveBlockedReason} />
          ) : null}

          <ReviewSection
            title="Đang phụ trách"
            extra={detailReady ? `${currentWarehouses.length} kho` : null}
          >
            {detailState.loading ? (
              <div className="uwa-loading">
                <Spin size="small" /> <span>Đang tải kho phụ trách…</span>
              </div>
            ) : (
              <Table
                size="small"
                rowKey="warehouseId"
                pagination={false}
                dataSource={currentWarehouses}
                columns={currentColumns}
                scroll={{ x: 700 }}
                locale={{
                  emptyText: currentRegion
                    ? `Chưa gán kho nào — đang theo vùng ${currentRegion}.`
                    : "Chưa gán kho nào, tài khoản chưa có vùng.",
                }}
              />
            )}
          </ReviewSection>

          <ReviewSection
            title="Chọn kho phụ trách"
            extra={`Đã chọn ${selectedIds.length} kho`}
          >
            <div className="uwa-picker">
              <Text type="secondary" className="uwa-hint">
                {currentRegionKey
                  ? `Chỉ hiện kho đang hoạt động thuộc vùng ${currentRegion}. Muốn gán kho vùng khác, sửa vùng của tài khoản trước bằng nút "Phân quyền".`
                  : "Tài khoản chưa có vùng: hiện mọi kho đang hoạt động, nhưng đã chọn một kho thì chỉ chọn thêm được kho cùng vùng."}
              </Text>

              {!currentRegionKey && selectedIds.length > 0 ? (
                <Alert
                  type="info"
                  showIcon
                  message={`Tài khoản chưa có vùng — lưu sẽ đặt vùng = ${firstSelected?.region || "(kho chưa khai vùng)"}`}
                />
              ) : null}

              {catalogState.error ? (
                <Alert type="error" showIcon message="Không tải được danh mục kho" description={catalogState.error} />
              ) : null}

              <Input
                allowClear
                size="small"
                prefix={<SearchOutlined />}
                placeholder="Tìm theo tên, mã kho, vùng…"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />

              {catalogState.loading ? (
                <div className="uwa-loading">
                  <Spin size="small" /> <span>Đang tải danh mục kho…</span>
                </div>
              ) : options.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    currentRegionKey
                      ? `Không có kho đang hoạt động nào thuộc vùng ${currentRegion}.`
                      : "Không có kho đang hoạt động nào."
                  }
                />
              ) : (
                <div className="uwa-list">
                  {options.map((warehouse) => {
                    const checked = selectedIds.includes(warehouse.id);
                    const disabled = isDisabled(warehouse, checked);
                    return (
                      <Checkbox
                        key={warehouse.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => toggle(warehouse.id, event.target.checked)}
                        className={`uwa-option${checked ? " is-checked" : ""}`}
                      >
                        <span className="uwa-option__main">
                          <strong>{warehouseLabel(warehouse)}</strong>
                          <span>
                            {[
                              warehouse.code,
                              warehouse.region || "chưa khai vùng",
                              warehouse.warehouseType ? getWarehouseTypeLabel(warehouse.warehouseType) : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="uwa-option__tags">
                          {currentIds.includes(warehouse.id) ? <Tag color="blue">Đang gán</Tag> : null}
                          {!warehouse.isActive ? <Tag>Ngừng hoạt động</Tag> : null}
                          {!checked &&
                          warehouse.isActive &&
                          lockedRegionKey &&
                          toRegionKey(warehouse.region) !== lockedRegionKey ? (
                            <Tag>Khác vùng</Tag>
                          ) : null}
                        </span>
                      </Checkbox>
                    );
                  })}
                </div>
              )}

              {selectedInactive.length ? (
                <Alert
                  type="warning"
                  showIcon
                  message={`Đang chọn kho ngừng hoạt động: ${selectedInactive.map(warehouseLabel).join(", ")}. Máy chủ chỉ nhận kho đang hoạt động — bỏ chọn trước khi lưu.`}
                />
              ) : null}

              {detailReady && selectedIds.length === 0 && currentIds.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Bỏ chọn hết = bỏ gán toàn bộ kho"
                  description={unassignConsequence}
                />
              ) : null}
            </div>
          </ReviewSection>

          <label className="admin-form-field">
            <span>Ghi chú (tuỳ chọn)</span>
            <Input.TextArea
              rows={2}
              maxLength={500}
              showCount
              value={note}
              disabled={!canAssign}
              placeholder="Ví dụ: Phân công trực kho Quảng Châu từ tháng 10."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={reviewOpen}
        width={760}
        centered
        title="Xác nhận gán kho"
        okText={selectedIds.length ? "Lưu kho phụ trách" : "Bỏ gán toàn bộ"}
        okButtonProps={{ danger: selectedIds.length === 0, loading: saving }}
        cancelText="Quay lại"
        cancelButtonProps={{ disabled: saving }}
        mask={{ closable: !saving }}
        onOk={submit}
        onCancel={() => !saving && setReviewOpen(false)}
        styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowY: "auto" } }}
      >
        <SubmitReview error={saveError} errorTitle="Máy chủ từ chối lưu">
          <ReviewFacts
            items={[
              { label: "Tài khoản", value: [user?.fullName, user?.email].filter(Boolean).join(" · ") },
              { label: "Vai trò", value: roleLabel },
              { label: "Vùng hiện tại", value: currentRegion || "Chưa có vùng" },
              {
                label: "Vùng sau khi lưu",
                value: (
                  <Space size={6}>
                    <span>{regionAfterSave || "Chưa có vùng"}</span>
                    {regionWillChange ? <Tag color="orange">Sẽ đổi vùng</Tag> : null}
                  </Space>
                ),
              },
              { label: "Ghi chú", value: note.trim() || null, span: "filled" },
            ]}
          />

          <ReviewSection title="Kho phụ trách — trước" extra={`${beforeItems.length} kho`}>
            <WarehouseList
              items={beforeItems}
              emptyText={currentRegion ? `Chưa gán — theo vùng ${currentRegion}` : "Chưa gán, chưa có vùng"}
            />
          </ReviewSection>

          <ReviewSection title="Kho phụ trách — sau khi lưu" extra={`${afterItems.length} kho`}>
            <WarehouseList items={afterItems} emptyText="Không còn kho nào (bỏ gán toàn bộ)" />
          </ReviewSection>

          {removedItems.length ? (
            <ReviewSection title="Bỏ gán" extra={`${removedItems.length} kho`}>
              <WarehouseList items={removedItems} emptyText="—" />
            </ReviewSection>
          ) : null}

          {selectedIds.length === 0 ? (
            <Alert type="warning" showIcon message="Bỏ gán toàn bộ kho" description={unassignConsequence} />
          ) : null}
          {!currentRegionKey && selectedIds.length > 0 ? (
            <Alert
              type="info"
              showIcon
              message={`Tài khoản chưa có vùng — lưu sẽ đặt vùng = ${firstSelected?.region || "(kho chưa khai vùng)"}`}
            />
          ) : null}
          {selectedInactive.length ? (
            <Alert
              type="warning"
              showIcon
              message={`Có kho ngừng hoạt động trong danh sách: ${selectedInactive.map(warehouseLabel).join(", ")} — máy chủ sẽ từ chối.`}
            />
          ) : null}
        </SubmitReview>
      </Modal>
    </>
  );
}
