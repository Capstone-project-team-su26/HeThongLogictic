/**
 * Dữ liệu mẫu cho DANH MỤC HÀNH CHÍNH VIỆT NAM (tỉnh / quận-huyện / phường-xã).
 *
 * Bản thật lấy danh mục này từ provinces.open-api.vn — một API CÔNG KHAI bên ngoài,
 * nghĩa là bản UI-only mất mạng là ba ô select địa chỉ trống trơn và người xem không
 * thêm được địa chỉ nhận hàng nào. Bộ fixture này thay hẳn nguồn đó.
 *
 * BA MÀN TIÊU THỤ và điều mỗi màn đòi hỏi:
 * - VietnamAddressSelector đọc item.code / item.name (tự map sang value/label).
 * - ConsignmentOrder và ConsignmentBuyOrder render thẳng <option value={item.value}>
 *   {item.label}</option>, và tra tên tỉnh/huyện/xã ngược lại bằng item.value.
 *   Vì thế mỗi bản ghi phải mang ĐỦ CẢ HAI cặp khoá; phần ghép đó do
 *   vietnamAddressService làm khi chuẩn hoá, file này chỉ giữ hạt giống thô.
 *
 * MÃ SỐ KHỚP VỚI deliveryAddresses.js:
 * sổ địa chỉ mẫu đã ghim sẵn các mã 1/79/48/31/92/56/74/75/46/38 cùng quận-huyện và
 * phường-xã tương ứng. Fixture này dùng lại đúng những mã đó với đúng tên đó, để một
 * địa chỉ có sẵn và một địa chỉ vừa thêm qua select không mâu thuẫn nhau khi soi
 * devtools. Mã để dạng CHUỖI SỐ KHÔNG có số 0 đứng đầu ("1" chứ không "01") vì
 * component ép Number() trước khi gửi payload, và deliveryAddresses.js cũng lưu số.
 *
 * Phường/xã: những quận-huyện mà sổ địa chỉ có nhắc tới được liệt kê tay bằng tên
 * thật; phần còn lại sinh theo khuôn ("Quận 7" -> Phường 1..12, "Huyện X" -> một
 * thị trấn + các xã) để mọi lựa chọn trong dropdown đều có cấp dưới, không màn nào
 * rơi vào nhánh "danh sách rỗng".
 */

import { normalizeText } from "@/mocks/mockUtils";

/* =========================================================
   TỈNH / THÀNH PHỐ
========================================================= */

/**
 * 20 tỉnh/thành trải đều Bắc - Trung - Nam.
 *
 * Đủ dài để ô select có thanh cuộn và ô tìm kiếm theo tên có việc để làm, nhưng vẫn
 * gọn để đọc; không cần cả 63 tỉnh mới thấy giao diện hoạt động đúng.
 */
export const provinceSeeds = [
  { code: "1", name: "Thành phố Hà Nội", divisionType: "thành phố trung ương" },
  { code: "27", name: "Tỉnh Bắc Ninh", divisionType: "tỉnh" },
  { code: "31", name: "Thành phố Hải Phòng", divisionType: "thành phố trung ương" },
  { code: "33", name: "Tỉnh Hưng Yên", divisionType: "tỉnh" },
  { code: "36", name: "Tỉnh Nam Định", divisionType: "tỉnh" },
  { code: "38", name: "Tỉnh Thanh Hoá", divisionType: "tỉnh" },
  { code: "40", name: "Tỉnh Nghệ An", divisionType: "tỉnh" },
  { code: "44", name: "Tỉnh Quảng Bình", divisionType: "tỉnh" },
  { code: "46", name: "Tỉnh Thừa Thiên Huế", divisionType: "tỉnh" },
  { code: "48", name: "Thành phố Đà Nẵng", divisionType: "thành phố trung ương" },
  { code: "49", name: "Tỉnh Quảng Nam", divisionType: "tỉnh" },
  { code: "52", name: "Tỉnh Bình Định", divisionType: "tỉnh" },
  { code: "56", name: "Tỉnh Khánh Hoà", divisionType: "tỉnh" },
  { code: "68", name: "Tỉnh Lâm Đồng", divisionType: "tỉnh" },
  { code: "74", name: "Tỉnh Bình Dương", divisionType: "tỉnh" },
  { code: "75", name: "Tỉnh Đồng Nai", divisionType: "tỉnh" },
  { code: "77", name: "Tỉnh Bà Rịa - Vũng Tàu", divisionType: "tỉnh" },
  { code: "79", name: "Thành phố Hồ Chí Minh", divisionType: "thành phố trung ương" },
  { code: "89", name: "Tỉnh An Giang", divisionType: "tỉnh" },
  { code: "92", name: "Thành phố Cần Thơ", divisionType: "thành phố trung ương" },
];

/* =========================================================
   QUẬN / HUYỆN
========================================================= */

/**
 * Quận/huyện theo mã tỉnh.
 *
 * Hà Nội và Hồ Chí Minh được cho danh sách dài nhất vì hai nơi đó chiếm phần lớn
 * đơn trong bộ dữ liệu mẫu, nên người xem sẽ mở hai tỉnh này nhiều nhất.
 */
export const districtSeedsByProvince = {
  1: [
    { code: "1", name: "Quận Ba Đình", divisionType: "quận" },
    { code: "2", name: "Quận Hoàn Kiếm", divisionType: "quận" },
    { code: "3", name: "Quận Tây Hồ", divisionType: "quận" },
    { code: "4", name: "Quận Long Biên", divisionType: "quận" },
    { code: "5", name: "Quận Cầu Giấy", divisionType: "quận" },
    { code: "6", name: "Quận Đống Đa", divisionType: "quận" },
    { code: "7", name: "Quận Hai Bà Trưng", divisionType: "quận" },
    { code: "8", name: "Quận Hoàng Mai", divisionType: "quận" },
    { code: "9", name: "Quận Thanh Xuân", divisionType: "quận" },
    { code: "19", name: "Quận Nam Từ Liêm", divisionType: "quận" },
    { code: "21", name: "Quận Bắc Từ Liêm", divisionType: "quận" },
    { code: "268", name: "Quận Hà Đông", divisionType: "quận" },
    { code: "17", name: "Huyện Đông Anh", divisionType: "huyện" },
    { code: "18", name: "Huyện Gia Lâm", divisionType: "huyện" },
    { code: "20", name: "Huyện Thanh Trì", divisionType: "huyện" },
  ],
  27: [
    { code: "256", name: "Thành phố Bắc Ninh", divisionType: "thành phố" },
    { code: "261", name: "Thành phố Từ Sơn", divisionType: "thành phố" },
    { code: "258", name: "Huyện Yên Phong", divisionType: "huyện" },
    { code: "259", name: "Huyện Quế Võ", divisionType: "huyện" },
    { code: "260", name: "Huyện Tiên Du", divisionType: "huyện" },
    { code: "262", name: "Huyện Lương Tài", divisionType: "huyện" },
    { code: "263", name: "Huyện Gia Bình", divisionType: "huyện" },
    { code: "264", name: "Huyện Thuận Thành", divisionType: "huyện" },
  ],
  31: [
    { code: "303", name: "Quận Hồng Bàng", divisionType: "quận" },
    { code: "304", name: "Quận Lê Chân", divisionType: "quận" },
    { code: "305", name: "Quận Ngô Quyền", divisionType: "quận" },
    { code: "306", name: "Quận Kiến An", divisionType: "quận" },
    { code: "307", name: "Quận Hải An", divisionType: "quận" },
    { code: "308", name: "Quận Đồ Sơn", divisionType: "quận" },
    { code: "311", name: "Quận Dương Kinh", divisionType: "quận" },
    { code: "312", name: "Huyện Thuỷ Nguyên", divisionType: "huyện" },
    { code: "313", name: "Huyện An Dương", divisionType: "huyện" },
    { code: "314", name: "Huyện An Lão", divisionType: "huyện" },
  ],
  33: [
    { code: "323", name: "Thành phố Hưng Yên", divisionType: "thành phố" },
    { code: "328", name: "Thị xã Mỹ Hào", divisionType: "thị xã" },
    { code: "325", name: "Huyện Văn Lâm", divisionType: "huyện" },
    { code: "326", name: "Huyện Văn Giang", divisionType: "huyện" },
    { code: "327", name: "Huyện Yên Mỹ", divisionType: "huyện" },
    { code: "329", name: "Huyện Ân Thi", divisionType: "huyện" },
    { code: "330", name: "Huyện Khoái Châu", divisionType: "huyện" },
    { code: "331", name: "Huyện Kim Động", divisionType: "huyện" },
  ],
  36: [
    { code: "356", name: "Thành phố Nam Định", divisionType: "thành phố" },
    { code: "359", name: "Huyện Vụ Bản", divisionType: "huyện" },
    { code: "360", name: "Huyện Ý Yên", divisionType: "huyện" },
    { code: "361", name: "Huyện Nam Trực", divisionType: "huyện" },
    { code: "362", name: "Huyện Trực Ninh", divisionType: "huyện" },
    { code: "363", name: "Huyện Xuân Trường", divisionType: "huyện" },
    { code: "364", name: "Huyện Giao Thuỷ", divisionType: "huyện" },
    { code: "365", name: "Huyện Nghĩa Hưng", divisionType: "huyện" },
    { code: "366", name: "Huyện Hải Hậu", divisionType: "huyện" },
  ],
  38: [
    { code: "380", name: "Thành phố Thanh Hoá", divisionType: "thành phố" },
    { code: "382", name: "Thành phố Sầm Sơn", divisionType: "thành phố" },
    { code: "381", name: "Thị xã Bỉm Sơn", divisionType: "thị xã" },
    { code: "393", name: "Huyện Thọ Xuân", divisionType: "huyện" },
    { code: "398", name: "Huyện Hoằng Hoá", divisionType: "huyện" },
    { code: "399", name: "Huyện Hà Trung", divisionType: "huyện" },
    { code: "401", name: "Huyện Triệu Sơn", divisionType: "huyện" },
    { code: "403", name: "Huyện Đông Sơn", divisionType: "huyện" },
  ],
  40: [
    { code: "412", name: "Thành phố Vinh", divisionType: "thành phố" },
    { code: "413", name: "Thị xã Cửa Lò", divisionType: "thị xã" },
    { code: "414", name: "Thị xã Thái Hoà", divisionType: "thị xã" },
    { code: "419", name: "Huyện Nghĩa Đàn", divisionType: "huyện" },
    { code: "422", name: "Huyện Tân Kỳ", divisionType: "huyện" },
    { code: "424", name: "Huyện Đô Lương", divisionType: "huyện" },
    { code: "427", name: "Huyện Diễn Châu", divisionType: "huyện" },
    { code: "428", name: "Huyện Yên Thành", divisionType: "huyện" },
    { code: "429", name: "Huyện Nghi Lộc", divisionType: "huyện" },
  ],
  44: [
    { code: "450", name: "Thành phố Đồng Hới", divisionType: "thành phố" },
    { code: "458", name: "Thị xã Ba Đồn", divisionType: "thị xã" },
    { code: "452", name: "Huyện Minh Hoá", divisionType: "huyện" },
    { code: "453", name: "Huyện Tuyên Hoá", divisionType: "huyện" },
    { code: "454", name: "Huyện Quảng Trạch", divisionType: "huyện" },
    { code: "455", name: "Huyện Bố Trạch", divisionType: "huyện" },
    { code: "456", name: "Huyện Quảng Ninh", divisionType: "huyện" },
    { code: "457", name: "Huyện Lệ Thuỷ", divisionType: "huyện" },
  ],
  46: [
    { code: "474", name: "Thành phố Huế", divisionType: "thành phố" },
    { code: "479", name: "Thị xã Hương Thuỷ", divisionType: "thị xã" },
    { code: "480", name: "Thị xã Hương Trà", divisionType: "thị xã" },
    { code: "476", name: "Huyện Phong Điền", divisionType: "huyện" },
    { code: "477", name: "Huyện Quảng Điền", divisionType: "huyện" },
    { code: "478", name: "Huyện Phú Vang", divisionType: "huyện" },
    { code: "481", name: "Huyện A Lưới", divisionType: "huyện" },
    { code: "482", name: "Huyện Phú Lộc", divisionType: "huyện" },
    { code: "483", name: "Huyện Nam Đông", divisionType: "huyện" },
  ],
  48: [
    { code: "490", name: "Quận Liên Chiểu", divisionType: "quận" },
    { code: "491", name: "Quận Sơn Trà", divisionType: "quận" },
    { code: "492", name: "Quận Hải Châu", divisionType: "quận" },
    { code: "493", name: "Quận Thanh Khê", divisionType: "quận" },
    { code: "494", name: "Quận Ngũ Hành Sơn", divisionType: "quận" },
    { code: "495", name: "Quận Cẩm Lệ", divisionType: "quận" },
    { code: "497", name: "Huyện Hoà Vang", divisionType: "huyện" },
  ],
  49: [
    { code: "502", name: "Thành phố Tam Kỳ", divisionType: "thành phố" },
    { code: "503", name: "Thành phố Hội An", divisionType: "thành phố" },
    { code: "507", name: "Thị xã Điện Bàn", divisionType: "thị xã" },
    { code: "504", name: "Huyện Tây Giang", divisionType: "huyện" },
    { code: "506", name: "Huyện Đại Lộc", divisionType: "huyện" },
    { code: "508", name: "Huyện Duy Xuyên", divisionType: "huyện" },
    { code: "510", name: "Huyện Thăng Bình", divisionType: "huyện" },
    { code: "512", name: "Huyện Núi Thành", divisionType: "huyện" },
  ],
  52: [
    { code: "540", name: "Thành phố Quy Nhơn", divisionType: "thành phố" },
    { code: "543", name: "Thị xã Hoài Nhơn", divisionType: "thị xã" },
    { code: "542", name: "Huyện An Lão", divisionType: "huyện" },
    { code: "544", name: "Huyện Hoài Ân", divisionType: "huyện" },
    { code: "545", name: "Huyện Phù Mỹ", divisionType: "huyện" },
    { code: "546", name: "Huyện Vĩnh Thạnh", divisionType: "huyện" },
    { code: "547", name: "Huyện Tây Sơn", divisionType: "huyện" },
    { code: "548", name: "Huyện Phù Cát", divisionType: "huyện" },
  ],
  56: [
    { code: "568", name: "Thành phố Nha Trang", divisionType: "thành phố" },
    { code: "569", name: "Thành phố Cam Ranh", divisionType: "thành phố" },
    { code: "572", name: "Thị xã Ninh Hoà", divisionType: "thị xã" },
    { code: "570", name: "Huyện Cam Lâm", divisionType: "huyện" },
    { code: "571", name: "Huyện Vạn Ninh", divisionType: "huyện" },
    { code: "573", name: "Huyện Khánh Vĩnh", divisionType: "huyện" },
    { code: "574", name: "Huyện Diên Khánh", divisionType: "huyện" },
    { code: "575", name: "Huyện Khánh Sơn", divisionType: "huyện" },
  ],
  68: [
    { code: "672", name: "Thành phố Đà Lạt", divisionType: "thành phố" },
    { code: "673", name: "Thành phố Bảo Lộc", divisionType: "thành phố" },
    { code: "674", name: "Huyện Đam Rông", divisionType: "huyện" },
    { code: "675", name: "Huyện Lạc Dương", divisionType: "huyện" },
    { code: "676", name: "Huyện Lâm Hà", divisionType: "huyện" },
    { code: "677", name: "Huyện Đơn Dương", divisionType: "huyện" },
    { code: "678", name: "Huyện Đức Trọng", divisionType: "huyện" },
    { code: "679", name: "Huyện Di Linh", divisionType: "huyện" },
  ],
  74: [
    { code: "718", name: "Thành phố Thủ Dầu Một", divisionType: "thành phố" },
    { code: "725", name: "Thành phố Dĩ An", divisionType: "thành phố" },
    { code: "721", name: "Thị xã Bến Cát", divisionType: "thị xã" },
    { code: "723", name: "Thị xã Tân Uyên", divisionType: "thị xã" },
    { code: "719", name: "Huyện Bàu Bàng", divisionType: "huyện" },
    { code: "720", name: "Huyện Dầu Tiếng", divisionType: "huyện" },
    { code: "722", name: "Huyện Phú Giáo", divisionType: "huyện" },
    { code: "724", name: "Huyện Bắc Tân Uyên", divisionType: "huyện" },
  ],
  75: [
    { code: "731", name: "Thành phố Biên Hoà", divisionType: "thành phố" },
    { code: "732", name: "Thành phố Long Khánh", divisionType: "thành phố" },
    { code: "734", name: "Huyện Tân Phú", divisionType: "huyện" },
    { code: "735", name: "Huyện Vĩnh Cửu", divisionType: "huyện" },
    { code: "736", name: "Huyện Định Quán", divisionType: "huyện" },
    { code: "737", name: "Huyện Trảng Bom", divisionType: "huyện" },
    { code: "738", name: "Huyện Thống Nhất", divisionType: "huyện" },
    { code: "739", name: "Huyện Cẩm Mỹ", divisionType: "huyện" },
    { code: "740", name: "Huyện Long Thành", divisionType: "huyện" },
    { code: "741", name: "Huyện Xuân Lộc", divisionType: "huyện" },
    { code: "742", name: "Huyện Nhơn Trạch", divisionType: "huyện" },
  ],
  77: [
    { code: "747", name: "Thành phố Vũng Tàu", divisionType: "thành phố" },
    { code: "748", name: "Thành phố Bà Rịa", divisionType: "thành phố" },
    { code: "754", name: "Thị xã Phú Mỹ", divisionType: "thị xã" },
    { code: "750", name: "Huyện Châu Đức", divisionType: "huyện" },
    { code: "751", name: "Huyện Xuyên Mộc", divisionType: "huyện" },
    { code: "752", name: "Huyện Long Điền", divisionType: "huyện" },
    { code: "753", name: "Huyện Đất Đỏ", divisionType: "huyện" },
  ],
  79: [
    { code: "760", name: "Quận 1", divisionType: "quận" },
    { code: "770", name: "Quận 3", divisionType: "quận" },
    { code: "773", name: "Quận 4", divisionType: "quận" },
    { code: "774", name: "Quận 5", divisionType: "quận" },
    { code: "775", name: "Quận 6", divisionType: "quận" },
    { code: "769", name: "Quận 7", divisionType: "quận" },
    { code: "776", name: "Quận 8", divisionType: "quận" },
    { code: "771", name: "Quận 10", divisionType: "quận" },
    { code: "772", name: "Quận 11", divisionType: "quận" },
    { code: "761", name: "Quận 12", divisionType: "quận" },
    { code: "764", name: "Quận Gò Vấp", divisionType: "quận" },
    { code: "765", name: "Quận Bình Thạnh", divisionType: "quận" },
    { code: "766", name: "Quận Tân Phú", divisionType: "quận" },
    { code: "767", name: "Quận Tân Bình", divisionType: "quận" },
    { code: "768", name: "Quận Phú Nhuận", divisionType: "quận" },
    { code: "777", name: "Quận Bình Tân", divisionType: "quận" },
    { code: "762", name: "Thành phố Thủ Đức", divisionType: "thành phố" },
    { code: "783", name: "Huyện Bình Chánh", divisionType: "huyện" },
    { code: "784", name: "Huyện Nhà Bè", divisionType: "huyện" },
  ],
  89: [
    { code: "883", name: "Thành phố Long Xuyên", divisionType: "thành phố" },
    { code: "884", name: "Thành phố Châu Đốc", divisionType: "thành phố" },
    { code: "887", name: "Thị xã Tân Châu", divisionType: "thị xã" },
    { code: "886", name: "Huyện An Phú", divisionType: "huyện" },
    { code: "888", name: "Huyện Phú Tân", divisionType: "huyện" },
    { code: "889", name: "Huyện Châu Phú", divisionType: "huyện" },
    { code: "890", name: "Huyện Tịnh Biên", divisionType: "huyện" },
    { code: "891", name: "Huyện Thoại Sơn", divisionType: "huyện" },
  ],
  92: [
    { code: "916", name: "Quận Ninh Kiều", divisionType: "quận" },
    { code: "917", name: "Quận Ô Môn", divisionType: "quận" },
    { code: "918", name: "Quận Bình Thuỷ", divisionType: "quận" },
    { code: "919", name: "Quận Cái Răng", divisionType: "quận" },
    { code: "923", name: "Quận Thốt Nốt", divisionType: "quận" },
    { code: "924", name: "Huyện Vĩnh Thạnh", divisionType: "huyện" },
    { code: "925", name: "Huyện Cờ Đỏ", divisionType: "huyện" },
    { code: "926", name: "Huyện Phong Điền", divisionType: "huyện" },
    { code: "927", name: "Huyện Thới Lai", divisionType: "huyện" },
  ],
};

/* =========================================================
   PHƯỜNG / XÃ LIỆT KÊ TAY
========================================================= */

/**
 * Phường/xã tên thật cho những quận-huyện mà deliveryAddresses.js đã ghim.
 *
 * Mã phường ở đây trùng đúng mã trong sổ địa chỉ mẫu (178 Yên Hoà, 27178 Phường 14,
 * 20200 Bình Hiên...), nhờ vậy hai bộ fixture kể cùng một câu chuyện.
 */
const explicitWardSeeds = {
  /* Hà Nội - Quận Cầu Giấy */
  5: [
    { code: "175", name: "Phường Nghĩa Đô" },
    { code: "176", name: "Phường Nghĩa Tân" },
    { code: "177", name: "Phường Mai Dịch" },
    { code: "178", name: "Phường Yên Hoà" },
    { code: "179", name: "Phường Dịch Vọng" },
    { code: "180", name: "Phường Dịch Vọng Hậu" },
    { code: "181", name: "Phường Trung Hoà" },
    { code: "182", name: "Phường Quan Hoa" },
  ],
  /* Hà Nội - Quận Hai Bà Trưng */
  7: [
    { code: "289", name: "Phường Nguyễn Du" },
    { code: "292", name: "Phường Bạch Mai" },
    { code: "295", name: "Phường Bách Khoa" },
    { code: "298", name: "Phường Đồng Tâm" },
    { code: "301", name: "Phường Vĩnh Tuy" },
    { code: "304", name: "Phường Thanh Nhàn" },
    { code: "307", name: "Phường Cầu Dền" },
    { code: "310", name: "Phường Bạch Đằng" },
    { code: "313", name: "Phường Phố Huế" },
  ],
  /* Hà Nội - Quận Thanh Xuân */
  9: [
    { code: "265", name: "Phường Thượng Đình" },
    { code: "268", name: "Phường Khương Trung" },
    { code: "271", name: "Phường Nhân Chính" },
    { code: "274", name: "Phường Khương Mai" },
    { code: "277", name: "Phường Thanh Xuân Trung" },
    { code: "280", name: "Phường Phương Liệt" },
    { code: "283", name: "Phường Hạ Đình" },
    { code: "286", name: "Phường Khương Đình" },
  ],
  /* Hải Phòng - Quận Ngô Quyền */
  305: [
    { code: "11608", name: "Phường Máy Chai" },
    { code: "11611", name: "Phường Vạn Mỹ" },
    { code: "11614", name: "Phường Máy Tơ" },
    { code: "11617", name: "Phường Cầu Tre" },
    { code: "11620", name: "Phường Lạc Viên" },
    { code: "11623", name: "Phường Gia Viên" },
    { code: "11626", name: "Phường Đông Khê" },
    { code: "11629", name: "Phường Cầu Đất" },
    { code: "11632", name: "Phường Lê Lợi" },
    { code: "11635", name: "Phường Đằng Giang" },
  ],
  /* Thanh Hoá - Thành phố Thanh Hoá */
  380: [
    { code: "14023", name: "Phường Hàm Rồng" },
    { code: "14026", name: "Phường Đông Thọ" },
    { code: "14029", name: "Phường Nam Ngạn" },
    { code: "14032", name: "Phường Trường Thi" },
    { code: "14035", name: "Phường Đông Vệ" },
    { code: "14038", name: "Phường Phú Sơn" },
    { code: "14041", name: "Phường Lam Sơn" },
    { code: "14044", name: "Phường Ba Đình" },
    { code: "14047", name: "Phường Ngọc Trạo" },
    { code: "14050", name: "Phường Điện Biên" },
    { code: "14053", name: "Phường Đông Sơn" },
    { code: "14056", name: "Phường Tân Sơn" },
  ],
  /* Thừa Thiên Huế - Thành phố Huế */
  474: [
    { code: "19777", name: "Phường Phú Thuận" },
    { code: "19780", name: "Phường Phú Bình" },
    { code: "19783", name: "Phường Tây Lộc" },
    { code: "19786", name: "Phường Thuận Lộc" },
    { code: "19789", name: "Phường Phú Hiệp" },
    { code: "19792", name: "Phường Phú Hậu" },
    { code: "19795", name: "Phường Phú Nhuận" },
    { code: "19798", name: "Phường Thuận Hoà" },
    { code: "19801", name: "Phường Thuận Thành" },
    { code: "19804", name: "Phường Vĩnh Ninh" },
    { code: "19807", name: "Phường Phú Hội" },
    { code: "19810", name: "Phường Phú Cát" },
  ],
  /* Đà Nẵng - Quận Hải Châu */
  492: [
    { code: "20194", name: "Phường Thanh Bình" },
    { code: "20197", name: "Phường Thuận Phước" },
    { code: "20200", name: "Phường Bình Hiên" },
    { code: "20203", name: "Phường Hải Châu I" },
    { code: "20206", name: "Phường Hải Châu II" },
    { code: "20209", name: "Phường Phước Ninh" },
    { code: "20212", name: "Phường Nam Dương" },
    { code: "20215", name: "Phường Bình Thuận" },
    { code: "20218", name: "Phường Hoà Cường Bắc" },
    { code: "20221", name: "Phường Hoà Cường Nam" },
  ],
  /* Đà Nẵng - Quận Thanh Khê */
  493: [
    { code: "20254", name: "Phường Tam Thuận" },
    { code: "20257", name: "Phường Thanh Khê Đông" },
    { code: "20260", name: "Phường Thanh Khê Tây" },
    { code: "20263", name: "Phường Chính Gián" },
    { code: "20266", name: "Phường Vĩnh Trung" },
    { code: "20269", name: "Phường Thạc Gián" },
    { code: "20272", name: "Phường An Khê" },
    { code: "20275", name: "Phường Hoà Khê" },
    { code: "20278", name: "Phường Xuân Hà" },
    { code: "20281", name: "Phường Tân Chính" },
  ],
  /* Khánh Hoà - Thành phố Nha Trang */
  568: [
    { code: "22366", name: "Phường Vĩnh Hoà" },
    { code: "22369", name: "Phường Vĩnh Hải" },
    { code: "22372", name: "Phường Vĩnh Phước" },
    { code: "22375", name: "Phường Ngọc Hiệp" },
    { code: "22378", name: "Phường Lộc Thọ" },
    { code: "22381", name: "Phường Vĩnh Thọ" },
    { code: "22384", name: "Phường Xương Huân" },
    { code: "22387", name: "Phường Vạn Thắng" },
    { code: "22390", name: "Phường Vạn Thạnh" },
    { code: "22393", name: "Phường Phương Sài" },
    { code: "22396", name: "Phường Phước Hoà" },
    { code: "22399", name: "Phường Tân Lập" },
  ],
  /* Bình Dương - Thành phố Dĩ An */
  725: [
    { code: "25816", name: "Phường An Bình" },
    { code: "25819", name: "Phường Tân Đông Hiệp" },
    { code: "25822", name: "Phường Dĩ An" },
    { code: "25825", name: "Phường Tân Bình" },
    { code: "25828", name: "Phường Đông Hoà" },
    { code: "25831", name: "Phường Bình An" },
    { code: "25834", name: "Phường Bình Thắng" },
  ],
  /* Đồng Nai - Thành phố Biên Hoà */
  731: [
    { code: "25990", name: "Phường Trảng Dài" },
    { code: "25993", name: "Phường Tân Phong" },
    { code: "25996", name: "Phường Tân Biên" },
    { code: "25999", name: "Phường Hố Nai" },
    { code: "26002", name: "Phường Tân Hoà" },
    { code: "26005", name: "Phường Tân Tiến" },
    { code: "26008", name: "Phường Tân Hiệp" },
    { code: "26011", name: "Phường Bửu Long" },
    { code: "26014", name: "Phường Tân Mai" },
    { code: "26017", name: "Phường Thống Nhất" },
    { code: "26020", name: "Phường Trung Dũng" },
    { code: "26023", name: "Phường Quang Vinh" },
    { code: "26026", name: "Phường Quyết Thắng" },
  ],
  /* Hồ Chí Minh - Quận Tân Phú */
  766: [
    { code: "26869", name: "Phường Tây Thạnh" },
    { code: "26872", name: "Phường Sơn Kỳ" },
    { code: "26875", name: "Phường Tân Quý" },
    { code: "26878", name: "Phường Tân Thành" },
    { code: "26881", name: "Phường Phú Thọ Hoà" },
    { code: "26884", name: "Phường Phú Thạnh" },
    { code: "26887", name: "Phường Phú Trung" },
    { code: "26890", name: "Phường Hoà Thạnh" },
    { code: "26893", name: "Phường Hiệp Tân" },
    { code: "26896", name: "Phường Tân Thới Hoà" },
    { code: "26899", name: "Phường Tân Sơn Nhì" },
  ],
  /* Hồ Chí Minh - Quận 7 */
  769: [
    { code: "27334", name: "Phường Tân Thuận Đông" },
    { code: "27337", name: "Phường Tân Phú" },
    { code: "27340", name: "Phường Tân Kiểng" },
    { code: "27343", name: "Phường Tân Hưng" },
    { code: "27346", name: "Phường Bình Thuận" },
    { code: "27349", name: "Phường Tân Quy" },
    { code: "27352", name: "Phường Phú Thuận" },
    { code: "27355", name: "Phường Tân Thuận Tây" },
    { code: "27358", name: "Phường Tân Phong" },
    { code: "27361", name: "Phường Phú Mỹ" },
  ],
  /* Hồ Chí Minh - Quận 3 (mã 27043 phải là "Phường 12" cho khớp sổ địa chỉ,
     nên thứ tự khai báo được xếp lại để nhãn trong dropdown vẫn tăng dần) */
  770: [
    { code: "27031", name: "Phường 1" },
    { code: "27034", name: "Phường 2" },
    { code: "27037", name: "Phường 3" },
    { code: "27040", name: "Phường 4" },
    { code: "27046", name: "Phường 5" },
    { code: "27049", name: "Phường 6" },
    { code: "27052", name: "Phường 7" },
    { code: "27055", name: "Phường 8" },
    { code: "27058", name: "Phường 9" },
    { code: "27061", name: "Phường 10" },
    { code: "27064", name: "Phường 11" },
    { code: "27043", name: "Phường 12" },
    { code: "27067", name: "Phường 13" },
    { code: "27070", name: "Phường 14" },
  ],
  /* Hồ Chí Minh - Quận 10 */
  771: [
    { code: "27151", name: "Phường 1" },
    { code: "27154", name: "Phường 2" },
    { code: "27157", name: "Phường 4" },
    { code: "27160", name: "Phường 6" },
    { code: "27163", name: "Phường 7" },
    { code: "27166", name: "Phường 8" },
    { code: "27169", name: "Phường 9" },
    { code: "27172", name: "Phường 10" },
    { code: "27175", name: "Phường 12" },
    { code: "27178", name: "Phường 14" },
    { code: "27181", name: "Phường 15" },
  ],
  /* Cần Thơ - Quận Ninh Kiều */
  916: [
    { code: "31117", name: "Phường An Hoà" },
    { code: "31120", name: "Phường Thới Bình" },
    { code: "31123", name: "Phường An Nghiệp" },
    { code: "31126", name: "Phường Cái Khế" },
    { code: "31129", name: "Phường An Cư" },
    { code: "31135", name: "Phường Tân An" },
    { code: "31138", name: "Phường An Phú" },
    { code: "31141", name: "Phường Xuân Khánh" },
    { code: "31144", name: "Phường Hưng Lợi" },
    { code: "31147", name: "Phường An Khánh" },
    { code: "31150", name: "Phường An Bình" },
  ],
};

/* =========================================================
   PHƯỜNG / XÃ SINH THEO KHUÔN
========================================================= */

/* Tên phường phố phường thị; dùng cho quận và cho phần "phường" của thành phố/thị xã. */
const URBAN_WARD_NAMES = [
  "Trung Tâm",
  "Quang Trung",
  "Lê Lợi",
  "Trần Phú",
  "Nguyễn Trãi",
  "Hoà Bình",
  "Bình Minh",
  "Đông Hải",
  "Tây Sơn",
  "Nam Thành",
  "Bắc Sơn",
  "Phú Thịnh",
];

/* Tên xã nông thôn; dùng cho huyện và cho phần "xã" của thành phố/thị xã. */
const RURAL_WARD_NAMES = [
  "An Bình",
  "Tân Lập",
  "Hoà Thắng",
  "Phú Cường",
  "Đại Đồng",
  "Nghĩa Hưng",
  "Vĩnh Thành",
  "Thanh Mỹ",
  "Xuân Hoà",
  "Hồng Phong",
  "Quảng Phú",
  "Đức Thắng",
];

/**
 * Bộ đếm cấp phát mã cho phường/xã sinh tự động.
 *
 * Bắt đầu từ 900001 để KHÔNG BAO GIỜ đụng dải mã liệt kê tay (đều dưới 40000).
 * Trùng mã giữa hai huyện khác nhau thì tra cứu vẫn đúng vì luôn tra trong phạm vi
 * một quận-huyện, nhưng mã trùng làm devtools khó đọc nên vẫn tránh hẳn.
 */
let generatedWardCode = 900000;

const nextGeneratedWardCode = () => {
  generatedWardCode += 1;

  return String(generatedWardCode);
};

/** Quận đánh số ("Quận 7") thì phường cũng đánh số, đúng cách Sài Gòn gọi tên. */
const isNumberedDistrict = (districtName) =>
  /^Quận\s+\d+$/.test(String(districtName ?? "").trim());

const buildWardsForDistrict = (districtSeed) => {
  const name = String(districtSeed?.name ?? "").trim();

  if (isNumberedDistrict(name)) {
    return Array.from({ length: 12 }, (_unused, index) => ({
      code: nextGeneratedWardCode(),
      name: `Phường ${index + 1}`,
    }));
  }

  if (name.startsWith("Quận")) {
    return URBAN_WARD_NAMES.map((wardName) => ({
      code: nextGeneratedWardCode(),
      name: `Phường ${wardName}`,
    }));
  }

  if (name.startsWith("Huyện")) {
    /* Mỗi huyện có đúng một thị trấn làm trung tâm hành chính, phần còn lại là xã. */
    return [
      {
        code: nextGeneratedWardCode(),
        name: `Thị trấn ${RURAL_WARD_NAMES[0]}`,
      },
      ...RURAL_WARD_NAMES.slice(1).map((wardName) => ({
        code: nextGeneratedWardCode(),
        name: `Xã ${wardName}`,
      })),
    ];
  }

  /* Thành phố trực thuộc tỉnh và thị xã có cả phường (nội thị) lẫn xã (ngoại thị). */
  return [
    ...URBAN_WARD_NAMES.slice(0, 7).map((wardName) => ({
      code: nextGeneratedWardCode(),
      name: `Phường ${wardName}`,
    })),
    ...RURAL_WARD_NAMES.slice(0, 5).map((wardName) => ({
      code: nextGeneratedWardCode(),
      name: `Xã ${wardName}`,
    })),
  ];
};

/** divisionType suy ra từ tiền tố tên, đúng cách API thật gắn nhãn. */
const detectWardDivisionType = (wardName) => {
  const name = String(wardName ?? "").trim();

  if (name.startsWith("Thị trấn")) return "thị trấn";
  if (name.startsWith("Xã")) return "xã";

  return "phường";
};

/**
 * Dựng sẵn toàn bộ bảng phường/xã một lần khi module được nạp.
 *
 * Sinh tại chỗ mỗi lần gọi sẽ cho ra mã khác nhau giữa hai lần mở dropdown, và địa
 * chỉ vừa chọn sẽ không tra lại được tên khi lưu.
 */
export const wardSeedsByDistrict = (() => {
  const table = {};

  Object.values(districtSeedsByProvince).forEach((districtSeeds) => {
    districtSeeds.forEach((districtSeed) => {
      const explicit = explicitWardSeeds[districtSeed.code];

      const seeds = explicit || buildWardsForDistrict(districtSeed);

      table[districtSeed.code] = seeds.map((wardSeed) => ({
        code: String(wardSeed.code),
        name: wardSeed.name,

        divisionType:
          wardSeed.divisionType ||
          detectWardDivisionType(wardSeed.name),
      }));
    });
  });

  return table;
})();

/* =========================================================
   TRUY VẤN
========================================================= */

/** codename kiểu API thật: bỏ dấu, hạ chữ, nối bằng dấu gạch dưới. */
export const toCodename = (name) =>
  normalizeText(name)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const listProvinceSeeds = () => provinceSeeds;

export const listDistrictSeeds = (provinceCode) => {
  const key = String(provinceCode ?? "").trim();

  return districtSeedsByProvince[key] || [];
};

export const listWardSeeds = (districtCode) => {
  const key = String(districtCode ?? "").trim();

  return wardSeedsByDistrict[key] || [];
};

const addresses = {
  provinceSeeds,
  districtSeedsByProvince,
  wardSeedsByDistrict,
  toCodename,
  listProvinceSeeds,
  listDistrictSeeds,
  listWardSeeds,
};

export default addresses;
