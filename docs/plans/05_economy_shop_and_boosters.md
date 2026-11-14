# Kế Hoạch 5: Nền Kinh Tế Vàng, Kho Đồ & Cửa Hàng Vật Phẩm (Shop & Boosters)

← Quay lại: [Kế hoạch 4: Đấu Boss & Trang Bị](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/04_boss_combat_and_rpg_equipment.md) | Tiếp theo: [Kế hoạch 6: Cửa Chạy & Mọc Đá Khi Vượt Bước](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/06_shifting_exit_and_step_hazard.md)

---

## 1. Mục Tiêu
Xây dựng vòng lặp kinh tế (Meta-Loop) giúp người chơi giữ chân lâu dài:
- Nhận Vàng từ mỗi cú merge và khi diệt Boss.
- Vàng và kho đồ được lưu vĩnh viễn trong `localStorage`.
- Cửa hàng (Shop Modal) cho phép mua sắm:
  - 🔨 **Búa Phá Đá (`Dungeon Hammer`)**: Phá hủy ngay 1 khối đá cản đường.
- Thanh công cụ Booster dưới bàn cờ để kích hoạt vật phẩm nhanh.

## 2. Quản Lý Dữ Liệu Kinh Tế (Player Economy Storage)

### 2.1. Cấu Trúc Lưu Trữ `localStorage`
Key lưu trữ: `mte_player_economy`
```ts
export type PlayerEconomy = {
  gold: number
  hammers: number
}
```
- Khởi tạo mặc định: `{ gold: 0, hammers: 1 }` (tặng người chơi 1 búa làm quà tân thủ).
- Tự động đồng bộ vào `localStorage` mỗi khi thay đổi.

### 2.2. Bảng Giá Cửa Hàng (Lấy Từ `game_config.json`)
- Búa phá đá: 150 Vàng.

## 3. Cơ Chế Kích Hoạt Booster Trong Trận

### 3.1. Búa Phá Đá (Dungeon Hammer 🔨)
- Người chơi nhấn vào nút Búa trên thanh Booster:
  - Trạng thái bàn cờ chuyển sang `hammerMode = true`.
  - Con trỏ hoặc các khối đá nhấp nháy hiệu ứng mục tiêu.
  - Người chơi nhấp vào 1 ô đá bất kỳ (`board[targetIndex] === 'stone'`):
    - Khối đá vỡ vụn biến mất (`board[targetIndex] = null`).
    - Giảm số lượng búa sở hữu (`hammers -= 1`).
### 3.2. Cuộn Phép Hủy Diệt Số 2 & Số 4 (Purge Scrolls 📜)
- **Nguồn gốc**: Nhặt được từ nền sàn khi người chơi merge từ 128 trở lên (tỉ lệ ra 4 nhiều hơn 2 một chút).
- **Cơ chế sử dụng**: Người chơi có thể dùng bất kỳ lúc nào trong màn chơi đó.
  - Nhấn nút `[📜 Diệt 2 (x{spells.purge2})]`:
    - Quét toàn bộ bàn cờ: Bất kỳ ô nào đang chứa giá trị số `2` sẽ bị hủy diệt hoàn toàn, biến thành ô trống (`null`).
    - Trừ 1 cuộn phép diệt 2: `spells.purge2 -= 1`.
  - Nhấn nút `[📜 Diệt 4 (x{spells.purge4})]`:
    - Quét toàn bộ bàn cờ: Bất kỳ ô nào đang chứa giá trị số `4` sẽ bị hủy diệt hoàn toàn, biến thành ô trống (`null`).
    - Trừ 1 cuộn phép diệt 4: `spells.purge4 -= 1`.
- **Hiệu ứng hình ảnh**: Sóng xung kích / tia sét ma thuật quét qua bàn cờ, làm vỡ tan các ô số rác, giải phóng không gian thở khẩn cấp khi bàn cờ bị nghẽn!

## 4. Thiết Kế UI Cửa Hàng (Store Modal) & Thanh Booster
- **Nút Shop trên Topbar**: Biểu tượng giỏ hàng hoặc túi vàng `ShoppingBag` kèm số vàng hiện có.
- **Store Modal**:
  - Giao diện tối màu cổ kính, khung viền vàng kim.
  - Thẻ item Búa: Icon Búa, mô tả, nút "Mua (150🪙)".
  - Nút Mua tự động disable nếu người chơi không đủ vàng.
- **Thanh In-Game Booster Bar**:
  - Đặt dưới bàn cờ, cạnh nút Undo và Restart.
  - Gồm 3 nút công cụ giải cứu:
    - Nút Búa: `[🔨 Búa (x{hammers})]` (dùng phá đá).
    - Nút Phép 2: `[📜 Diệt [2] (x{spells.purge2})]` (tự động disable nếu số lượng = 0).
    - Nút Phép 4: `[📜 Diệt [4] (x{spells.purge4})]` (tự động disable nếu số lượng = 0).

## 5. Các Tệp Cần Chỉnh Sửa
- [NEW] `components/StoreModal.tsx` (hoặc tích hợp trực tiếp component trong `app/page.tsx`).
- [MODIFY] `app/page.tsx`:
  - Thêm state `economy` (`gold`, `hammers`), `inGameSpells` (`purge2`, `purge4`), `isStoreOpen`, `isHammerActive`.
  - Logic đập đá và logic hủy diệt toàn bộ ô số 2 / số 4.
- [MODIFY] `app/globals.css`:
  - CSS cho Store Modal, Booster bar, hiệu ứng búa nhấp nháy chọn đá, hiệu ứng phép quét số.

## 6. Checklist Nghiệm Thu
- [ ] Vàng tích lũy khi merge hoặc diệt Boss được lưu vào `localStorage` (F5 lại trang không mất).
- [ ] Vào Shop mua Búa bị trừ đúng 150 vàng, số lượng búa tăng lên.
- [ ] Bấm Búa chọn đập vỡ 1 khối đá thành công, giải phóng đường đi.
- [ ] Khi nhặt được Cuộn Phép trên sàn, số lượng phép tương ứng tăng lên trên thanh Booster.
- [ ] Nhấn nút Diệt [2] (hoặc Diệt [4]) hủy diệt sạch sẽ mọi ô số 2 (hoặc 4) trên bàn cờ, giải phóng không gian thở ngay lập tức.
