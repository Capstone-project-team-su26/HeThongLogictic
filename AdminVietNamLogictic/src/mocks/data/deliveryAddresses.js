/**
 * Dữ liệu mẫu cho SỔ ĐỊA CHỈ NHẬN HÀNG (delivery addresses).
 *
 * Hai màn đặt đơn dùng chung bộ này: ConsignmentOrder (ký gửi) và
 * ConsignmentBuyOrder (mua hộ). Cả hai đều chuẩn hoá lại bản ghi bằng
 * normalizeDeliveryAddress của riêng chúng, và phép chuẩn hoá đó chỉ nhận
 * bản ghi khi đọc được CHUỖI ĐỊA CHỈ ĐẦY ĐỦ — bản ghi thiếu `address`
 * bị filter(Boolean) loại thẳng, danh sách rỗng và người xem tưởng lỗi API.
 * Vì vậy mọi bản ghi ở đây đều có đủ `address` + `fullAddress`.
 *
 * Ba khoá lái giao diện thấy được:
 * - address / fullAddress -> chuỗi hiện trên từng thẻ địa chỉ, và cũng là
 *   GIÁ TRỊ ĐƯỢC SO SÁNH để biết thẻ nào đang được chọn (form.selectedDeliveryAddress
 *   so bằng chuỗi, không so bằng id), nên chuỗi phải duy nhất tuyệt đối.
 * - deliveryAddressId -> thành `apiId`, là thứ nút Xoá gửi lên; bản ghi không có
 *   id thì nút Xoá báo "Địa chỉ này không có ID hợp lệ".
 * - isDefault -> đúng MỘT bản ghi được true, vì màn đặt đơn lấy
 *   list.find(item => item.isDefault) để tự chọn sẵn địa chỉ khi mở form.
 *
 * provinceCode/districtCode/wardCode để dạng SỐ đúng như payload FE gửi lên khi
 * thêm địa chỉ mới (component ép Number() trước khi gọi API), nhờ vậy bản ghi có
 * sẵn và bản ghi mới tạo trông giống nhau khi đọc trong devtools.
 */

import { isoDaysAgo } from "@/mocks/mockUtils";

/* Id phải hợp khuôn UUID vì backend thật chặn id sai khuôn, và FE ghép thẳng
   apiId vào URL /api/delivery-addresses/{id} khi xoá. */
const addressUuid = (index) => {
  const tail = String(index).padStart(4, "0");

  return [
    `7d4a${tail}`,
    "5e61",
    "4f82",
    "9a03",
    `c6${tail}00000000`.slice(0, 12),
  ].join("-");
};

/**
 * Ghép địa chỉ theo đúng thứ tự FE tự ghép khi tạo mới:
 * "số nhà, phường/xã, quận/huyện, tỉnh/thành".
 *
 * Bắt buộc dùng chung một công thức cho cả bản ghi có sẵn và bản ghi mới tạo,
 * nếu không địa chỉ vừa thêm sẽ không khớp chuỗi nào trong danh sách và màn hình
 * mất luôn trạng thái "đang chọn" ngay sau khi lưu.
 */
export const buildFullAddress = ({
  detailAddress,
  wardName,
  districtName,
  provinceName,
}) =>
  [detailAddress, wardName, districtName, provinceName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");

const createDeliveryAddress = ({
  index,
  receiverName,
  receiverPhone,
  detailAddress,
  wardCode,
  wardName,
  districtCode,
  districtName,
  provinceCode,
  provinceName,
  isDefault = false,
  createdDaysAgo = 30,
  updatedDaysAgo = 3,
  note = "",
}) => {
  const fullAddress = buildFullAddress({
    detailAddress,
    wardName,
    districtName,
    provinceName,
  });

  const id = addressUuid(index);

  return {
    /* Ba khoá id cùng trỏ một giá trị: normalizeDeliveryAddress đọc theo thứ tự
       deliveryAddressId -> addressId -> id, giữ cả ba thì đổi thứ tự đọc ở FE
       cũng không làm mất apiId. */
    deliveryAddressId: id,
    addressId: id,
    id,

    /* Ba khoá địa chỉ cùng một chuỗi: ConsignmentOrder ưu tiên fullAddress,
       ConsignmentBuyOrder ưu tiên address, còn receiverAddress là tên khoá cũ
       vẫn nằm trong chuỗi fallback của cả hai. */
    address: fullAddress,
    fullAddress,
    receiverAddress: fullAddress,

    receiverName,
    receiverPhone,

    detailAddress,
    wardCode,
    wardName,
    districtCode,
    districtName,
    provinceCode,
    provinceName,

    isDefault,
    note,

    createdAt: isoDaysAgo(createdDaysAgo),
    updatedAt: isoDaysAgo(updatedDaysAgo),
  };
};

/* =========================================================
   SỔ ĐỊA CHỈ

   18 bản ghi, trải trên 9 tỉnh/thành để khung danh sách có thanh cuộn thật
   (khung địa chỉ trong form chỉ cao ~4 thẻ) và để người xem thấy được cả
   trường hợp địa chỉ nhà riêng, chung cư, kho xưởng lẫn cửa hàng.
========================================================= */

export const deliveryAddresses = [
  createDeliveryAddress({
    index: 1,
    receiverName: "Vương Thị Kiều Trinh",
    receiverPhone: "0921112233",
    detailAddress: "Số 21 Nguyễn Khang",
    wardCode: 178,
    wardName: "Phường Yên Hoà",
    districtCode: 5,
    districtName: "Quận Cầu Giấy",
    provinceCode: 1,
    provinceName: "Thành phố Hà Nội",
    /* Bản ghi mặc định duy nhất — form đặt đơn tự chọn sẵn thẻ này. */
    isDefault: true,
    createdDaysAgo: 210,
    updatedDaysAgo: 4,
    note: "Giao trong giờ hành chính, gọi trước 15 phút.",
  }),
  createDeliveryAddress({
    index: 2,
    receiverName: "Vương Thị Kiều Trinh",
    receiverPhone: "0921112233",
    detailAddress: "Kho C2, Số 118 Trung Kính",
    wardCode: 181,
    wardName: "Phường Trung Hoà",
    districtCode: 5,
    districtName: "Quận Cầu Giấy",
    provinceCode: 1,
    provinceName: "Thành phố Hà Nội",
    createdDaysAgo: 198,
    updatedDaysAgo: 12,
    note: "Kho nhận hàng ký gửi, có xe nâng.",
  }),
  createDeliveryAddress({
    index: 3,
    receiverName: "Nguyễn Thị Thuỳ Dương",
    receiverPhone: "0356778899",
    detailAddress: "Số 18 Nguyễn Thị Định",
    wardCode: 184,
    wardName: "Phường Trung Hoà",
    districtCode: 5,
    districtName: "Quận Cầu Giấy",
    provinceCode: 1,
    provinceName: "Thành phố Hà Nội",
    createdDaysAgo: 165,
    updatedDaysAgo: 21,
  }),
  createDeliveryAddress({
    index: 4,
    receiverName: "Đỗ Hoàng Nam",
    receiverPhone: "0913445566",
    detailAddress: "Tầng 3, Toà Sunrise A, Số 27 Lê Văn Lương",
    wardCode: 271,
    wardName: "Phường Nhân Chính",
    districtCode: 9,
    districtName: "Quận Thanh Xuân",
    provinceCode: 1,
    provinceName: "Thành phố Hà Nội",
    createdDaysAgo: 143,
    updatedDaysAgo: 9,
    note: "Bảo vệ toà nhà nhận hộ nếu chủ nhà vắng.",
  }),
  createDeliveryAddress({
    index: 5,
    receiverName: "Trịnh Văn Hậu",
    receiverPhone: "0967889900",
    detailAddress: "Số 402 Bạch Mai",
    wardCode: 292,
    wardName: "Phường Bạch Mai",
    districtCode: 7,
    districtName: "Quận Hai Bà Trưng",
    provinceCode: 1,
    provinceName: "Thành phố Hà Nội",
    createdDaysAgo: 121,
    updatedDaysAgo: 30,
  }),
  createDeliveryAddress({
    index: 6,
    receiverName: "Hồ Ngọc Mai",
    receiverPhone: "0923334455",
    detailAddress: "Số 140 Lý Thường Kiệt",
    wardCode: 27178,
    wardName: "Phường 14",
    districtCode: 771,
    districtName: "Quận 10",
    provinceCode: 79,
    provinceName: "Thành phố Hồ Chí Minh",
    createdDaysAgo: 156,
    updatedDaysAgo: 6,
  }),
  createDeliveryAddress({
    index: 7,
    receiverName: "Lâm Tuấn Kiệt",
    receiverPhone: "0924445566",
    detailAddress: "Số 302 Cách Mạng Tháng Tám",
    wardCode: 27043,
    wardName: "Phường 12",
    districtCode: 770,
    districtName: "Quận 3",
    provinceCode: 79,
    provinceName: "Thành phố Hồ Chí Minh",
    createdDaysAgo: 132,
    updatedDaysAgo: 2,
    note: "Cửa hàng, nhận hàng từ 09:00 đến 20:00.",
  }),
  createDeliveryAddress({
    index: 8,
    receiverName: "Lâm Tuấn Kiệt",
    receiverPhone: "0924445566",
    detailAddress: "Xưởng B4, Số 9 Đường số 7, KCN Tân Bình",
    wardCode: 26869,
    wardName: "Phường Tây Thạnh",
    districtCode: 766,
    districtName: "Quận Tân Phú",
    provinceCode: 79,
    provinceName: "Thành phố Hồ Chí Minh",
    createdDaysAgo: 118,
    updatedDaysAgo: 17,
    note: "Xưởng gia công, chỉ nhận hàng buổi sáng.",
  }),
  createDeliveryAddress({
    index: 9,
    receiverName: "Huỳnh Gia Bảo",
    receiverPhone: "0908223344",
    detailAddress: "Số 55 Nguyễn Thị Thập",
    wardCode: 27337,
    wardName: "Phường Tân Phú",
    districtCode: 769,
    districtName: "Quận 7",
    provinceCode: 79,
    provinceName: "Thành phố Hồ Chí Minh",
    createdDaysAgo: 96,
    updatedDaysAgo: 11,
  }),
  createDeliveryAddress({
    index: 10,
    receiverName: "Đoàn Chí Thành",
    receiverPhone: "0922223344",
    detailAddress: "Số 76 Hoàng Diệu",
    wardCode: 20200,
    wardName: "Phường Bình Hiên",
    districtCode: 492,
    districtName: "Quận Hải Châu",
    provinceCode: 48,
    provinceName: "Thành phố Đà Nẵng",
    createdDaysAgo: 175,
    updatedDaysAgo: 8,
  }),
  createDeliveryAddress({
    index: 11,
    receiverName: "Bùi Quang Vinh",
    receiverPhone: "0905112233",
    detailAddress: "Số 230 Điện Biên Phủ",
    wardCode: 20263,
    wardName: "Phường Chính Gián",
    districtCode: 493,
    districtName: "Quận Thanh Khê",
    provinceCode: 48,
    provinceName: "Thành phố Đà Nẵng",
    createdDaysAgo: 88,
    updatedDaysAgo: 25,
  }),
  createDeliveryAddress({
    index: 12,
    receiverName: "Phạm Thị Hải Yến",
    receiverPhone: "0812334455",
    detailAddress: "Số 9 Lê Thánh Tông",
    wardCode: 11614,
    wardName: "Phường Máy Tơ",
    districtCode: 305,
    districtName: "Quận Ngô Quyền",
    provinceCode: 31,
    provinceName: "Thành phố Hải Phòng",
    createdDaysAgo: 74,
    updatedDaysAgo: 5,
  }),
  createDeliveryAddress({
    index: 13,
    receiverName: "Trần Đăng Khoa",
    receiverPhone: "0788990011",
    detailAddress: "Số 55 Trần Phú",
    wardCode: 31126,
    wardName: "Phường Cái Khế",
    districtCode: 916,
    districtName: "Quận Ninh Kiều",
    provinceCode: 92,
    provinceName: "Thành phố Cần Thơ",
    createdDaysAgo: 137,
    updatedDaysAgo: 19,
  }),
  createDeliveryAddress({
    index: 14,
    receiverName: "Ngô Thanh Tuyền",
    receiverPhone: "0935667788",
    detailAddress: "Số 12 Hùng Vương",
    wardCode: 22378,
    wardName: "Phường Lộc Thọ",
    districtCode: 568,
    districtName: "Thành phố Nha Trang",
    provinceCode: 56,
    provinceName: "Tỉnh Khánh Hoà",
    createdDaysAgo: 63,
    updatedDaysAgo: 13,
    note: "Khách sạn, để ở quầy lễ tân.",
  }),
  createDeliveryAddress({
    index: 15,
    receiverName: "Lý Bảo Châu",
    receiverPhone: "0949556677",
    detailAddress: "Số 88 Nguyễn An Ninh",
    wardCode: 25822,
    wardName: "Phường Dĩ An",
    districtCode: 725,
    districtName: "Thành phố Dĩ An",
    provinceCode: 74,
    provinceName: "Tỉnh Bình Dương",
    createdDaysAgo: 57,
    updatedDaysAgo: 7,
    note: "Nhận hàng tại nhà xe của công ty.",
  }),
  createDeliveryAddress({
    index: 16,
    receiverName: "Cao Minh Nhật",
    receiverPhone: "0977334455",
    detailAddress: "Số 145 Phạm Văn Thuận",
    wardCode: 26005,
    wardName: "Phường Tân Tiến",
    districtCode: 731,
    districtName: "Thành phố Biên Hoà",
    provinceCode: 75,
    provinceName: "Tỉnh Đồng Nai",
    createdDaysAgo: 45,
    updatedDaysAgo: 15,
  }),
  createDeliveryAddress({
    index: 17,
    receiverName: "Dương Khánh Linh",
    receiverPhone: "0916778899",
    detailAddress: "Số 3 Hà Nội, Kiệt 42",
    wardCode: 19795,
    wardName: "Phường Phú Nhuận",
    districtCode: 474,
    districtName: "Thành phố Huế",
    provinceCode: 46,
    provinceName: "Tỉnh Thừa Thiên Huế",
    createdDaysAgo: 38,
    updatedDaysAgo: 10,
  }),
  createDeliveryAddress({
    index: 18,
    receiverName: "Tạ Quốc Cường",
    receiverPhone: "0987112244",
    detailAddress: "Kho Logistic số 2, Đường Trần Nhân Tông",
    wardCode: 14035,
    wardName: "Phường Đông Vệ",
    districtCode: 380,
    districtName: "Thành phố Thanh Hoá",
    provinceCode: 38,
    provinceName: "Tỉnh Thanh Hoá",
    createdDaysAgo: 26,
    updatedDaysAgo: 1,
    note: "Kho trung chuyển, nhận hàng cả ngày.",
  }),
];

/* Tra cứu theo id để hàm xoá của service tìm đúng bản ghi cần bỏ; nhận cả ba
   tên khoá id vì FE có thể gửi lên giá trị lấy từ khoá nào cũng được. */
export const findDeliveryAddressById = (addressId) => {
  const needle = String(addressId ?? "").trim();
  if (!needle) return null;

  return (
    deliveryAddresses.find(
      (item) =>
        String(item.deliveryAddressId) === needle ||
        String(item.addressId) === needle ||
        String(item.id) === needle,
    ) || null
  );
};

/* Tra cứu theo chuỗi địa chỉ (không phân biệt hoa thường, bỏ khoảng trắng đầu
   cuối) — dùng cho nhánh chống trùng của hàm tạo mới, khớp đúng cách FE tự
   kiểm trùng trước khi gọi API. */
export const findDeliveryAddressByText = (addressText) => {
  const needle = String(addressText ?? "")
    .trim()
    .toLowerCase();

  if (!needle) return null;

  return (
    deliveryAddresses.find(
      (item) =>
        String(item.address ?? "")
          .trim()
          .toLowerCase() === needle,
    ) || null
  );
};

export default deliveryAddresses;
