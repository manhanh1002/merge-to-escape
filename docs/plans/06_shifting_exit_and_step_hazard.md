# Kế Hoạch 6: Thử Thách Cửa Chạy & Mọc Đá Khi Vượt Bước (Shifting Exit & Step Hazard)

← Quay lại: [Kế hoạch 5: Nền Kinh Tế & Shop](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/05_economy_shop_and_boosters.md) | Tiếp theo: [Kế hoạch 7: Hoàn Thiện HUD & Selector](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/07_ui_hud_chapter_selector_and_polish.md)

---

## 1. Mục Tiêu
Triển khai 2 cơ chế tạo áp lực sinh tồn theo số bước đi (turn-based tension) ở các Chapter cấp cao:
1. **Cửa Thoát Hiểm Di Chuyển (Shifting Exit)** từ Level 31+: Mỗi lượt vuốt, cánh cửa sẽ nhảy sang ô lân cận để né người chơi.
2. **Mọc Đá Khi Vượt Ngưỡng Bước (Step Limit Hazard)**: Đi quá số bước quy định sẽ bị cảnh báo sập hầm và mọc thêm đá cản đường.

## 2. Chi Tiết Kỹ Thuật

### 2.1. Cửa Thoát Hiểm Di Chuyển (Shifting Exit)
- **Kích hoạt**: Bắt đầu từ Level 31 đến 50 khi cửa thoát hiểm đã mở khóa (`doorUnlocked === true`).
- **Hành vi mỗi lượt di chuyển**:
  - Khi người chơi thực hiện 1 move:
    - Tìm các ô trống lân cận (4 hướng Up, Down, Left, Right) xung quanh vị trí cửa hiện tại.
    - Nếu có ô trống hợp lệ (không có tường ngăn, không có người chơi, không có đá hay boss): Cửa có 70% tỉ lệ di chuyển sang một trong các ô trống đó!
    - Tạo cảm giác cánh cửa ma thuật đang trôi dạt trong mật thất, buộc người chơi phải dồn ép góc thông minh để tóm được cửa.

### 2.2. Mọc Thêm Đá Khi Vượt Ngưỡng Bước (Step Limit Hazard)
- Mỗi level cấu hình `stepLimit` (ví dụ: 40 bước an toàn).
- Sau khi `moves > level.stepLimit`:
  - Trạng thái cảnh báo nguy hiểm kích hoạt: Thông báo *"Dungeon Collapsing! Move faster!"*.
  - Cứ sau mỗi **8 bước** tiếp theo (`(moves - stepLimit) % 8 === 0`):
    - Tìm các ô trống ngẫu nhiên trên bàn cờ.
    - Biến 1 ô trống thành khối đá (`'stone'`).
    - Hiệu ứng rung màn hình và âm báo sập đá.
    - **Lưu ý cân bằng**: Tổng số đá mọc thêm không vượt quá ngưỡng tối đa cho phép của từng Chapter (tối đa 3 đá).

## 3. Các Tệp Cần Chỉnh Sửa
- [MODIFY] `app/page.tsx`:
  - Logic tính toán bước đi vượt ngưỡng `stepLimit` và spawn đá mới trong `move`.
  - Hàm `shiftExitDoor(currentExitIndex, board, size, walls)` gọi sau mỗi lượt vuốt nếu `level.shiftingExit` bật.
- [MODIFY] `app/globals.css`:
  - Animation dịch chuyển mượt mà của cánh cửa thoát hiểm.

## 4. Checklist Nghiệm Thu
- [ ] Sau khi vượt quá `stepLimit`, sau 8 bước mọc thêm 1 khối đá cản trở tại ô trống.
- [ ] Ở Level 31+, khi cửa mở, mỗi lượt vuốt cửa có dịch chuyển sang ô lân cận hợp lệ.
- [ ] Không có trường hợp cửa nhảy đè lên nhân vật hoặc nhảy xuyên qua tường cản.
