# Kế Hoạch 1: Hệ Thống Cấu Hình Cân Bằng Game Tập Trung (game_config.json)

← Quay lại: [Mục lục kế hoạch](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/README.md) | Tiếp theo: [Kế hoạch 2: Tường Ngăn Cản 1 Chiều](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/02_directional_walls_logic.md)

---

## 1. Mục Tiêu
Tách toàn bộ các thông số quyết định độ khó, tài nguyên và nhịp độ game thành một file cấu hình JSON duy nhất (`lib/game_config.json`).
Giúp Game Designer / Developer có thể tùy biến, cân bằng game (game balancing) bất kỳ lúc nào mà không cần sửa code logic.

## 2. Chi Tiết Cấu Trúc File `lib/game_config.json`

### 2.1. Cấu hình Nền kinh tế & Tỉ lệ rơi đồ (`economyConfig`)
- `goldDropRules`: Bảng quy tắc sinh vàng chẵn khi merge tile $\ge 16$:
  - `minTile: 16` ➔ `gold: 10`, `dropRate: 0.20`
  - `minTile: 32` ➔ `gold: 30`, `dropRate: 0.15`
  - `minTile: 64` ➔ `gold: 60`, `dropRate: 0.12`
  - `minTile: 128` ➔ `gold: 120`, `dropRate: 0.09`
  - `minTile: 256` ➔ `gold: 250`, `dropRate: 0.06`
  - `minTile: 512` ➔ `gold: 500`, `dropRate: 0.04`
  - `minTile: 1024` ➔ `gold: 1000`, `dropRate: 0.03`
  - `minTile: 2048` ➔ `gold: 2000`, `dropRate: 0.03`
- `itemDropRates`: Tỉ lệ rơi vật phẩm trang bị & phép thuật (đã cân bằng theo mô hình toán học):
  - `sword`: `minTile: 8`, `dropRate: 0.12`, `basePower: 15` (rơi sớm từ Vòng 5 để có vũ khí diệt Mid-Boss)
  - `armor`: `minTile: 32`, `dropRate: 0.10`, `basePower: 30`
  - `gauntlet`: `minTile: 64`, `dropRate: 0.08`, `basePower: 50`
  - `purgeScroll4`: `minTile: 128`, `dropRate: 0.08` (Cuộn phép hủy toàn bộ tile 4 trên bàn cờ)
  - `purgeScroll2`: `minTile: 128`, `dropRate: 0.05` (Cuộn phép hủy toàn bộ tile 2 trên bàn cờ)
  - `key`: `minTile: 64`, `dropRate: 0.08`
- `shopPrices`:
  - `hammer`: 150 vàng
- `bossRewards`:
  - `goldRange`: [100, 300] vàng
  - `bonusHammers`: 1
  - `bonusKeys`: 1
- `talentTreeConfig`:
  - `starRewardFormula`: "Math.ceil(levelId / 10) sao khi First-Clear (Tổng 550 ⭐ qua 100 màn)"
  - `costFormula`: "Chi phí nâng lên Level L tốn đúng L điểm Sao ⭐ (Tổng chi phí max 1 nhánh Lv 14 là 105 ⭐)"
  - `statsBonusPerLevel`:
    - `goldRate`: `+0.020` (+2.0% mỗi level)
    - `weaponRate`: `+0.015` (+1.5% mỗi level)
    - `basePower`: `+25` Power khởi đầu mỗi level
    - `keyRate`: `+0.008` (+0.8% mỗi level)
    - `weaponBonusPower`: `+0.050` (+5.0% Power nhận thêm từ mỗi món vũ khí nhặt được)
  - `maxLevel`: 14 (Tổng 5 nhánh tiêu tốn 525 / 550 ⭐, người chơi vượt qua 100 màn có thể max 100% cả 5 cây)

### 2.2. Danh sách 100 Levels (`levels`)
Mỗi level bao gồm các trường:
- `id`: số nguyên 1 - 100.
- `chapter`: 1 - 10 (10 Chapters x 10 Levels).
- `chapterName`: Tên chương (The Catacombs, The Forgotten Mines, The Ancient Labyrinth, The Shifting Vault, The Abyssal Apex).
- `name`: Tên màn ("Level 1", "Level 10 (Boss)", ...).
- `subtitle`: Mô tả cốt truyện ngắn.
- `size`: 4 (Lv 1-20), 5 (Lv 21-40), 6 (Lv 41-70), 7 (Lv 71-100). Quy tắc nằm trong `scripts/rebalance_targets.mjs`; đổi kích thước xong chạy lại `scripts/generate_level_layouts.mjs` để xếp lại vật cản.
- `target`: Điểm mục tiêu tổng (ví dụ: 16, 48, 64, 80, 96, 128, 160...).
- `targetFormula`: Mảng công thức mở cổng:
  - Nếu là màn thuần số mũ 2 thông thường: `[16]`, `[64]`, `[128]` (đạt số này tự hóa Cổng).
  - Nếu là màn dung hợp cộng hưởng (Resonance Fusion): `[64, 16]` (tổng 80), `[64, 32]` (tổng 96), `[128, 32]` (tổng 160)... Khi cả 2 số cùng có mặt trên bàn cờ, chúng phát sáng và cho phép người chơi vuốt gộp trực tiếp `A + B` để sinh ra Cánh Cửa Thoát Hiểm ngay tại vị trí va chạm.
- `initialStones`: Số đá ban đầu tuân thủ nghiêm ngặt:
  - $Lv < 10$: 0-1 cục
  - $Lv < 20$: 1 cục
  - $Lv < 40$: 2 cục
  - $Lv \le 50$: 3 cục
- `stoneCoords`: Mảng toạ độ `[row, col]` đá cố định.
- **Hệ thống Điểm Chướng Ngại Vật (Enemy Points - EP) & Quy Đổi**:
  - `Tường 1 chiều (Wall)`: **1 EP**
  - `Đá khắc số (Numbered Stone)`: **2 EP** (giá trị = 1/2 tile cao nhất của vòng)
  - `Đá thường (Stone)`: **3 EP** (luôn tuân thủ giới hạn tối đa số đá theo từng range)
  - `Bẫy gai sàn (Spike Trap)`: **5 EP** (chết ngay khi chạm, không xuất hiện ở vòng Boss)
  - `Thú săn mồi (Wandering Beast)`: **6 EP** (di chuyển 1 ô mỗi lượt, cần Power để diệt)
  - *Lưu ý*: **Boss tính theo Máu (HP)**, không tính vào số lượng hay điểm EP! Mỗi màn Boss luôn có duy nhất 1 Boss trấn giữ, kèm ngân sách EP chướng ngại vật phụ trợ riêng.

### Bảng Phân Bổ Max Enemy Points (EP) & Boss HP Cho 10 Chương (100 Vòng):
| Chương (Vòng) | Board | EP Vòng 1-4 (Đầu-Giữa) | **Mid-Boss (Vòng 5)** | EP Vòng 6-9 (Tăng tốc - Đỉnh) | **Final Boss (Vòng 10)** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Chương 1 (1-10)** | 4x4 | 0 ➔ 2 EP | **Boss HP: 20** (+ 1 EP vật cản) | 2 ➔ 4 EP (Max 4) | **Boss HP: 40** (+ 2 EP vật cản) |
| **Chương 2 (11-20)** | 5x5 | 2 ➔ 4 EP | **Boss HP: 70** (+ 2 EP vật cản) | 4 ➔ 6 EP (Max 6) | **Boss HP: 100** (+ 3 EP vật cản) |
| **Chương 3 (21-30)** | 5x5 | 4 ➔ 6 EP | **Boss HP: 140** (+ 3 EP vật cản) | 6 ➔ 8 EP (Max 8) | **Boss HP: 190** (+ 4 EP vật cản) |
| **Chương 4 (31-40)** | 6x6 | 5 ➔ 8 EP | **Boss HP: 250** (+ 4 EP vật cản) | 8 ➔ 10 EP (Max 10) | **Boss HP: 320** (+ 5 EP vật cản) |
| **Chương 5 (41-50)** | 6x6 | 7 ➔ 10 EP | **Boss HP: 400** (+ 5 EP vật cản) | 10 ➔ 12 EP (Max 12) | **Boss HP: 480** (+ 6 EP vật cản) |
| **Chương 6 (51-60)** | 6x6 | 9 ➔ 11 EP | **Boss HP: 560** (+ 6 EP vật cản) | 11 ➔ 14 EP (Max 14) | **Boss HP: 640** (+ 7 EP vật cản) |
| **Chương 7 (61-70)** | 6x6 | 11 ➔ 13 EP | **Boss HP: 720** (+ 7 EP vật cản) | 13 ➔ 16 EP (Max 16) | **Boss HP: 790** (+ 8 EP vật cản) |
| **Chương 8 (71-80)** | 6x6 | 12 ➔ 15 EP | **Boss HP: 850** (+ 8 EP vật cản) | 15 ➔ 18 EP (Max 18) | **Boss HP: 900** (+ 9 EP vật cản) |
| **Chương 9 (81-90)** | 6x6 | 14 ➔ 17 EP | **Boss HP: 940** (+ 9 EP vật cản) | 17 ➔ 20 EP (Max 20) | **Boss HP: 970** (+ 10 EP vật cản) |
| **Chương 10 (91-100)**| 6x6 | 16 ➔ 19 EP | **Boss HP: 990** (+ 10 EP vật cản) | 19 ➔ 22 EP (Max 22) | **Boss HP: 1000** (+ 12 EP vật cản) |

- `hasBoss`: `true` tại các vòng chia hết cho 5 (5, 10, 15, 20, ..., 100).
- `bossHp`: Lấy chính xác theo bảng Boss HP ở trên.
- `requiredKeys`: Số chìa khóa cần để mở cửa (0 ở Lv 1-9; 1 ở vòng Boss; 1-3 ở các Chapter sau).
- `stepLimit`: Giới hạn bước an toàn trước khi mọc đá cảnh báo.
- `shiftingExit`: Cờ bật cơ chế cửa dịch chuyển (true từ Chapter 4 / Lv 31 trở đi).

## 3. Các Tệp Cần Tạo / Chỉnh Sửa
- [NEW] `lib/game_config.json`: File JSON chứa toàn bộ 100 level và tham số cân bằng.
- [NEW] `lib/types.ts`: Định nghĩa TypeScript Interface tương ứng cho Level, Wall, Equipment, FloorGift, EconomyConfig.
- [MODIFY] `app/page.tsx`: Import config thay vì khai báo mảng hardcode trực tiếp.

## 4. Checklist Nghiệm Thu
- [ ] File `lib/game_config.json` hợp lệ, parse JSON không có lỗi cú pháp.
- [ ] Đầy đủ 100 level trải dài trên 10 Chapter. Target tối đa 512 (dung hợp tối đa 512 + 128) — bản cũ lên tới 8192 cần 1000–4000 nước/màn và gần như không thể thắng từ Lv 72 (đo bằng `npm run sim`); độ khó chương sau đến từ ngân sách vật cản. Công thức nằm trong `scripts/rebalance_targets.mjs`.
- [ ] Số lượng đá của mọi level không bao giờ vượt quá 3.
- [ ] TypeScript compile thành công không bị thiếu trường dữ liệu (`npm run build`).
