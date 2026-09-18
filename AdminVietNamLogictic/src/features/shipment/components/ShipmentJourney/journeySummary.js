/**
 * Số liệu rút gọn của hành trình lô hàng.
 *
 * Tách khỏi component để mỗi màn khỏi tự đếm lại — và để file component chỉ export component,
 * đúng yêu cầu của fast refresh.
 */

/**
 * @param {Array} groups danh sách lô trả về từ API chi tiết đơn
 * @returns {{ groups: Array, parcelCount: number, lotCount: number, discrepancyCount: number }}
 */
export const summarizeJourney = (groups) => {
  const safeGroups = Array.isArray(groups) ? groups : [];

  const parcels = safeGroups.flatMap((group) =>
    Array.isArray(group?.parcels) ? group.parcels : [],
  );

  return {
    groups: safeGroups,
    parcelCount: parcels.length,
    lotCount: safeGroups.filter((group) => group?.shipmentId).length,
    discrepancyCount: parcels.filter(
      (parcel) => parcel?.inspection?.hasDiscrepancy,
    ).length,
  };
};

/** Nhãn ngắn cho phần tiêu đề: "2 kiện · 1 lô" hoặc "2 kiện · chưa xếp lô". */
export const describeJourneyScale = (summary) =>
  `${summary.parcelCount} kiện · ${
    summary.lotCount > 0 ? `${summary.lotCount} lô` : "chưa xếp lô"
  }`;
