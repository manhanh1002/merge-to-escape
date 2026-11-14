# Kế Hoạch 2: Tường Ngăn Cản 1 Chiều & Cải Tiến Logic Trượt Lưới (Directional Barrier Walls)

← Quay lại: [Kế hoạch 1: Cấu hình tập trung](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/01_game_config_system.md) | Tiếp theo: [Kế hoạch 3: Bàn Cờ 2 Lớp](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/03_two_layer_grid_and_floor_gifts.md)

---

## 1. Mục Tiêu
Thay vì lạm dụng quá nhiều đá làm tắc nghẽn bàn cờ, triển khai cơ chế **Tường Ngăn Cản 1 Chiều (1 đến 3 tường ngẫu nhiên mỗi ván)**:
- Tường dọc: Cản trượt ngang (Trái $\leftrightarrow$ Phải), nhưng cho trượt dọc (Lên $\leftrightarrow$ Xuống).
- Tường ngang: Cản trượt dọc (Lên $\leftrightarrow$ Xuống), nhưng cho trượt ngang (Trái $\leftrightarrow$ Phải).

## 2. Nguyên Lý Thuật Toán Di Chuyển Có Tường Cản

### 2.1. Biểu Diễn Tường
- Tường được gắn tại ô `(row, col)`:
  - `type: 'vertical'`: Vách ngăn nằm giữa cột `col` và cột `col + 1` của hàng `row`. Nếu một tile ở `(row, col)` muốn đi sang phải vào `(row, col + 1)` hoặc ngược lại từ `col + 1` sang trái vào `col`, đường đi bị chặn!
  - `type: 'horizontal'`: Vách ngăn nằm giữa hàng `row` và hàng `row + 1` của cột `col`. Nếu tile ở `(row, col)` muốn đi xuống `(row + 1, col)` hoặc từ `row + 1` lên `row`, đường đi bị chặn!

### 2.2. Cập Nhật Hàm Slide Line
Hiện tại, hàm `move` chia bàn cờ thành các hàng/cột và gọi `slideLine(values)`.
- Khi có vách tường, ta coi bức tường ngăn cách tương đương với một **điểm ngắt đoạn (Segment Barrier)** giống như đá hoặc nhân vật:
  - Trước khi gộp các ô thành 1 line để slide: Kiểm tra giữa 2 ô liên tiếp có bức tường cản trở theo hướng di chuyển không.
  - Nếu có tường cản giữa ô $i$ và $i+1$: Ngắt segment tại đó và gọi `flush()`. Tile ở phía này sẽ dồn lại sát tường mà không được phép băng qua tường sang phía bên kia.

### 2.3. Cập Nhật Di Chuyển Của Nhân Vật (`Player`)
- Khi nhân vật bước từ `(playerRow, playerCol)` sang `(nextRow, nextCol)`:
  - Kiểm tra xem giữa 2 ô liền kề này có bức tường cản trở hướng đi không.
  - Nếu có tường ngăn giữa 2 ô: Hủy di chuyển của nhân vật (nhân vật giữ nguyên vị trí, không xuyên qua tường).

### 2.4. Thuật Toán Dung Hợp Mở Cổng (Resonance Fusion Slide Logic)
- **Kiểm tra công thức**: Nếu level có cấu hình `targetFormula: [A, B]` (ví dụ `[64, 16]`) và Cửa chưa mở (`doorUnlocked === false`):
- **Điều kiện merge trong `slideLine`**:
  ```ts
  const isPortalPair = 
    (val1 === A && val2 === B) || 
    (val1 === B && val2 === A);

  const canMerge = (val1 === val2) || (!doorUnlocked && isPortalPair);
  ```
- **Xử lý kết quả**:
  - Nếu merge 2 số giống nhau: ra số gấp đôi như 2048 truyền thống.
  - Nếu merge cặp `isPortalPair` (A + B): ô kết quả ngay lập tức chuyển thành `'door'` (Cánh Cửa Thoát Hiểm) và bật `doorUnlocked = true`.
- **Hiệu ứng cộng hưởng (`.tile-resonant`)**:
  - Khi bàn cờ đang chứa cả ô `A` và ít nhất một ô `B`: Toàn bộ các ô này sẽ được thêm class CSS `.tile-resonant` với hiệu ứng viền hào quang ma thuật nhấp nháy, báo hiệu cho người chơi biết đã sẵn sàng dung hợp mở cửa.

### 2.5. Cơ Chế Va Chạm & Phá Hủy "Đá Khắc Số" (Numbered Stone)
- **Bản chất**: Ô đá có giá trị số cụ thể. **Quy tắc tính giá trị**: Luôn bằng **1/2 giá trị tile cao nhất** trong công thức của vòng chơi đó (Ví dụ: vòng có Target 160 gồm `[128, 32]` thì đá khắc số chỉ có giá trị là 64; Target 80 gồm `[64, 16]` thì đá khắc số có giá trị là 32). Nhờ đó, người chơi có thể tận dụng các ô số trung gian trên đường merge lên đỉnh để đập vỡ đá mà không phải cày lại từ đầu.
- **Va chạm khi trượt**:
  - Khi một ô số trượt đâm vào ô đá khắc số:
    - Nếu giá trị ô số **bằng đúng** giá trị của khối đá (`incomingTile === stone.value`):
      - Cả ô số và khối đá cùng phát nổ triệt tiêu nhau!
      - Giải phóng ô đó thành ô trống (`null`).
      - Tạo hiệu ứng rung lắc và âm thanh vỡ đá giòn tan.
    - Nếu giá trị ô số **khác** giá trị khối đá: Khối đá hoạt động như một vật cản cứng thông thường (tile dừng lại trước nó).
- **Quy ước Tường bổ sung**: Khi một màn trong range tối đa $X$ đá không có đá nào ($0$ đá), màn đó có thể được bổ sung tối đa $3 \times X$ bức tường cản 1 chiều để tạo mê cung đa dạng. Phân bổ chi tiết do config từng level quy định.

## 3. Thiết Kế Giao Diện Tường Trên Bàn Cờ (CSS/SVG)
- Thêm các phần tử render tường nằm đè lên viền giữa các ô:
  - `.wall-vertical`: Thanh kim loại hoặc tia năng lượng ánh sáng dài theo chiều cao của ô, đặt tại mép phải của ô `(row, col)`.
  - `.wall-horizontal`: Thanh kim loại hoặc tia năng lượng dài theo chiều ngang của ô, đặt tại mép dưới của ô `(row, col)`.

## 4. Các Tệp Cần Chỉnh Sửa
- [MODIFY] `app/page.tsx`:
  - Hàm kiểm tra va chạm tường `isWallBetween(fromIdx, toIdx, direction, walls)`.
  - Tích hợp kiểm tra tường vào vòng lặp gom segment của hàm `move`.
  - Kiểm tra tường khi cập nhật vị trí `nextPlayer`.
  - Render các thẻ `div.wall-item` hiển thị trực quan trên bàn cờ.
- [MODIFY] `app/globals.css`:
  - Stylesheet cho `.wall-vertical`, `.wall-horizontal` với hiệu ứng viền ánh sáng rực rỡ (neon energy gate).

## 5. Checklist Nghiệm Thu
- [ ] Khi vuốt ngang, tile gặp tường dọc sẽ dừng lại ngay trước tường mà không xuyên qua.
- [ ] Cùng hàng/cột đó khi vuốt dọc, tile vẫn trượt trơn tru lên xuống bình thường.
- [ ] Nhân vật không thể bước xuyên qua tường cản.
- [ ] Bàn cờ hiển thị tường rõ ràng, đẹp mắt, không làm lệch tỉ lệ các ô số.
