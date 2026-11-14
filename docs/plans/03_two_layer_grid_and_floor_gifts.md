# Kế Hoạch 3: Bàn Cờ 2 Lớp & Quà Tặng Nền Sàn (Floor Gifts: Vàng, Key, Vũ Khí)

← Quay lại: [Kế hoạch 2: Tường Ngăn Cản 1 Chiều](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/02_directional_walls_logic.md) | Tiếp theo: [Kế hoạch 4: Đấu Boss & Trang Bị RPG](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/04_boss_combat_and_rpg_equipment.md)

---

## 1. Mục Tiêu
Triển khai kiến trúc bàn cờ 2 lớp:
1. **Lớp Lưới Chính (Main Grid)**: Chứa các vật thể chuyển động (Tile số, đá, nhân vật, boss, cửa).
2. **Lớp Quà Nền Sàn (Floor Gifts Layer)**: Chứa các món quà (Vàng chẵn, Chìa khóa, Kiếm, Giáp, Găng tay, và **Cuộn Phép Hủy Diệt Số 2 hoặc 4**) rơi ra cố định trên sàn khi merge ô số cao.

### Quy Tắc Cốt Lõi:
- Khi sinh ra, quà nằm cố định trên sàn tại vị trí merge.
- Các ô số có thể trượt đè lên trên món quà mà **không làm biến mất món quà**.
- Khi ô số bị che phủ, nhân vật không thể nhặt. Nhưng ngay khi ô số trượt đi nơi khác và nhân vật **bước vào hoặc sượt ngang qua**, món quà sẽ được thu thập tự động vào túi đồ!

## 2. Công Thức Sinh Vàng Chẵn & Tỉ Lệ Giảm Dần
Khi merge ra giá trị `newTile`:
- `newTile = 16` ➔ Vàng = **10** (Tỉ lệ rớt: 20%)
- `newTile = 32` ➔ Vàng = **30** (Tỉ lệ rớt: 15%)
- `newTile = 64` ➔ Vàng = **60** (Tỉ lệ rớt: 12%)
- `newTile = 128` ➔ Vàng = **120** (Tỉ lệ rớt: 9%)
- `newTile = 256` ➔ Vàng = **250** (Tỉ lệ rớt: 6%)
- `newTile = 512` ➔ Vàng = **500** (Tỉ lệ rớt: 4%)
- `newTile = 1024` ➔ Vàng = **1000** (Tỉ lệ rớt: 3%)
- `newTile = 2048` ➔ Vàng = **2000** (Tỉ lệ rớt: 3%)

Các tỉ lệ này được đọc trực tiếp từ `economyConfig.goldDropRules` trong file `game_config.json`.

## 3. Kiến Trúc State & Thuật Toán Thu Thập (Walkover Collection)

### 3.1. Cấu Trúc Dữ Liệu
```ts
export type FloorGift = 
  | { type: 'gold'; amount: number }
  | { type: 'key' }
  | { type: 'equipment'; item: EquipmentItem }
  | { type: 'scroll'; targetValue: 2 | 4 } // Cuộn phép tiêu hủy toàn bộ tile 2 hoặc 4 trên bàn cờ

// State trong Page component:
const [floorGifts, setFloorGifts] = useState<Record<number, FloorGift>>({})
```

### 3.2. Quá Trình Sinh Quà Sau Mỗi Cú Merge
Trong hàm `move`:
- Mỗi khi có 2 ô gộp lại thành `newTile`:
  - Kiểm tra điều kiện rơi quà (Vàng theo drop rate, hoặc Key / Trang bị theo bảng drop).
  - Nếu thỏa mãn và tại ô tọa độ merge chưa có quà: Ghi nhận vào `nextGifts[mergeIndex] = gift`.

### 3.3. Quá Trình Thu Thập Khi Nhân Vật Sượt Qua
- Khi nhân vật di chuyển từ vị trí cũ sang `nextPlayer`:
  - Kiểm tra tại `nextPlayer` có `floorGifts[nextPlayer]` không VÀ ô `board[nextPlayer]` lúc này không bị tile số nào đè lên (chỉ có nhân vật).
  - Nếu có quà:
    - Nếu là Vàng: Cộng dồn vào ví vàng `gold += gift.amount`, hiển thị animation bay số `+X Gold`.
    - Nếu là Key: Tăng `collectedKeys += 1`.
    - Nếu là Trang bị: Cộng chỉ số Power vào người chơi.
    - Nếu là Cuộn Phép (Scroll): Tăng số lượng phép sở hữu trong trận (`inGameSpells[gift.targetValue] += 1`), hiển thị thông báo `📜 Gained Purge [X] Scroll!`.
    - Xóa `floorGifts[nextPlayer]`.

## 4. Thiết Kế UI Rendering 2 Lớp
Trong mỗi cell của bàn cờ:
```tsx
<div className="tile-slot" key={index}>
  {/* Lớp nền sàn: Hiển thị món quà nếu có */}
  {floorGifts[index] && (
    <div className={`floor-gift ${floorGifts[index].type}`}>
      {renderFloorGift(floorGifts[index])}
    </div>
  )}

  {/* Lớp trên: Hiển thị tile số, đá, player, boss */}
  {cell !== null && (
    <div className={`tile ${cellClass}`}>
      {renderTileContent(cell)}
    </div>
  )}
</div>
```

### 4.2. Bẫy Gai Cố Định Trên Sàn (Floor Spike Traps)
- **Vị trí**: Nằm cố định trên lớp nền sàn (`floorTraps: number[]`).
- **Tác động đến Tile số**: Các ô số trượt lướt qua hoặc đè lên ô bẫy gai hoàn toàn bình thường, không bị phá hủy hay cản trở.
- **Tác động đến Nhân Vật (Player)**:
  - Nếu lượt vuốt khiến `nextPlayer` di chuyển vào trúng ô bẫy gai (`floorTraps.includes(nextPlayer)`):
    - Kích hoạt âm thanh bẫy sập và hiệu ứng máu đỏ.
    - Người chơi bị hạ gục ngay lập tức (`setLost(true)` với thông báo: *"You stepped into a deadly Spike Trap!"*).
- **Quy tắc an toàn**: Bẫy gai **không bao giờ** xuất hiện trong các màn Boss để tránh gây ức chế dồn dập.

### 4.3. Ghi Chú Triển Khai: Nhân Vật Trượt Hết Đường
- Nhân vật trượt **hết đường** theo hướng vuốt giống các vật phẩm (dừng ở tường, đá, mép bàn hoặc sau vật khác), không còn đi 1 ô.
- Mọi quà nằm trên các ô nhân vật **trượt qua** đều được nhặt (theo thứ tự trên đường đi).
- **Trượt qua** bẫy gai (không cần dừng trên đó) cũng chết ➔ trên bàn 7×7 giới hạn 2–3 gai/màn (`scripts/rebalance_targets.mjs`), vì mỗi gai đe doạ cả hàng lẫn cột.
- Cửa nằm ngay cuối đường trượt ➔ nhân vật đi thẳng vào cửa (trừ khi Boss còn sống).

## 5. Các Tệp Cần Chỉnh Sửa
- [MODIFY] `app/page.tsx`:
  - Thêm state `floorGifts`, cập nhật Snapshot lịch sử Undo bao gồm cả `floorGifts`.
  - Cập nhật logic spawn quà trong `slideLine` / `move`.
  - Cập nhật logic nhặt quà khi `player` đến ô.
- [MODIFY] `app/globals.css`:
  - CSS cho `.floor-gift`: icon vàng kim tỏa sáng nhẹ chìm dưới nền ô, không làm cản trở tầm nhìn của tile số khi đè lên.

## 6. Checklist Nghiệm Thu
- [ ] Khi merge ra 16, 32, 64 có tỉ lệ rơi ra đồng vàng cố định tại ô đó.
- [ ] Tile số khác trượt đè lên ô có vàng/key, vàng/key vẫn nằm nguyên bên dưới không bị xóa.
- [ ] Khi ô số trượt đi và nhân vật đi vào ô đó, vàng/key lập tức được nhặt.
- [ ] Nút Undo khôi phục chính xác trạng thái của cả quà trên sàn.
