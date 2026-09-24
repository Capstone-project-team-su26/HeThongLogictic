/**
 * Hàm thuần của Sidebar — tách khỏi component để kiểm thử được bằng máy và để file
 * component chỉ còn phần dựng giao diện.
 */

/*
 * Admin có 9 mục cha và 23 mục con nằm trong 6 nhóm gập. Muốn mở "Bảng giá tiền tệ" thì
 * phải nhớ nó nằm trong nhóm nào rồi bấm mở nhóm đó — ô tìm nhanh cắt hẳn bước nhớ ấy.
 *
 * Bỏ dấu trước khi so khớp: gõ "gia tien te" vẫn ra "Bảng giá tiền tệ", vì không ai gõ dấu
 * khi đang tìm vội.
 */
export const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

const matchesQuery = (label, query) =>
  normalizeSearchText(label).includes(query);

/** Lọc menu theo từ khoá: giữ nhóm nếu tên nhóm khớp, hoặc còn mục con khớp. */
export const filterMenus = (menus, query) => {
  if (!query) {
    return menus;
  }

  return menus.reduce((kept, item) => {
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    if (!hasChildren) {
      return matchesQuery(item.label, query) ? [...kept, item] : kept;
    }

    /* Tên nhóm khớp thì giữ nguyên cả nhóm, khỏi bắt người dùng đoán tiếp. */
    if (matchesQuery(item.label, query)) {
      return [...kept, item];
    }

    const children = item.children.filter((child) =>
      matchesQuery(child.label, query),
    );

    return children.length ? [...kept, { ...item, children }] : kept;
  }, []);
};
