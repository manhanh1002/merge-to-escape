# Kế Hoạch 8: Tiến Trình Roguelite - Điểm Kỹ Năng EXP & Nâng Cấp Thuộc Tính (EXP & Talent Tree)

← Quay lại: [Kế hoạch 7: Hoàn Thiện HUD & Selector](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/07_ui_hud_chapter_selector_and_polish.md) | [Về Mục lục kế hoạch](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/README.md)

---

## 1. Mục Tiêu
Bổ sung vòng lặp tiến trình vĩnh viễn (Meta-Progression Loop) chuẩn phong cách **Roguelite**:
- **Thưởng Sao (EXP) Tăng Dần Theo Mốc 10 Vòng (Escalating Star Rewards)**:
  - Để giúp người chơi mạnh lên tương xứng với độ khó ở các vòng sau:
    - **Màn 1 – 10 (Chapter 1)**: Mỗi vòng pass lần đầu nhận **+1 ⭐ (EXP)**.
    - **Màn 11 – 20 (Chapter 2)**: Mỗi vòng pass lần đầu nhận **+2 ⭐ (EXP)**.
    - **Màn 21 – 30 (Chapter 3)**: Mỗi vòng pass lần đầu nhận **+3 ⭐ (EXP)**.
    - **Màn 31 – 40 (Chapter 4)**: Mỗi vòng pass lần đầu nhận **+4 ⭐ (EXP)**.
    - **Màn 41 – 50 (Chapter 5)**: Mỗi vòng pass lần đầu nhận **+5 ⭐ (EXP)**.
    - **Màn 51 – 60 (Chapter 6)**: Mỗi vòng pass lần đầu nhận **+6 ⭐ (EXP)**.
    - **Màn 61 – 70 (Chapter 7)**: Mỗi vòng pass lần đầu nhận **+7 ⭐ (EXP)**.
    - **Màn 71 – 80 (Chapter 8)**: Mỗi vòng pass lần đầu nhận **+8 ⭐ (EXP)**.
    - **Màn 81 – 90 (Chapter 9)**: Mỗi vòng pass lần đầu nhận **+9 ⭐ (EXP)**.
    - **Màn 91 – 100 (Chapter 10)**: Mỗi vòng pass lần đầu nhận **+10 ⭐ (EXP)**.
  - Công thức: `rewardStars = Math.ceil(levelId / 10)` (Tổng cộng 550 ⭐ qua 100 màn).
- **Quy tắc chơi lại (Replay Rule)**: Khi chơi lại các màn đã từng vượt qua, người chơi **vẫn tích lũy được tiền Vàng** rơi ra trong trận (dùng để mua Búa trong Shop), nhưng **KHÔNG ĐƯỢC NHẬN THÊM SAO/EXP**.
- Người chơi sử dụng điểm Sao tích lũy để nâng cấp **4 nhánh thuộc tính cốt lõi** của nhân vật (mở rộng lên tới **15 cấp độ**), giúp nhân vật đủ sức vượt qua các thử thách quái thú và boss nghìn máu về sau!

---

## 2. Quy Tắc 5 Nhánh Thuộc Tính & Công Thức Chi Phí Sao

### 2.1. Năm Thanh Chỉ Số Nâng Cấp (The 5 Stat Tracks)
1. 🪙 **Tỉ Lệ Rớt Vàng (`goldRate`)**:
   - Tăng thêm tỉ lệ rơi vàng mỗi khi merge tile $\ge 16$.
   - Mỗi cấp độ: `+2.0%` tỉ lệ rớt vàng so với cơ bản (Max Lv 14 = +28%).
2. ⚔️ **Tỉ Lệ Sinh Trang Bị (`weaponRate`)**:
   - Tăng tỉ lệ sinh Kiếm, Giáp, Găng Tay từ các cú merge.
   - Mỗi cấp độ: `+1.5%` tỉ lệ rớt trang bị toàn diện (Max Lv 14 = +21%).
3. 💥 **Sức Mạnh Khởi Điểm (`basePower`)**:
   - Nhân vật bắt đầu ván đấu với một lượng Power có sẵn.
   - Mỗi cấp độ: `+25 Base Power` (Max Lv 14 = **350 Base Power**!). Giúp chém gục thú săn mồi và quái nhỏ ngay từ đầu ván đấu.
4. 🔑 **Tỉ Lệ Rớt Chìa Khóa Ô Thường (`keyRate`)**:
   - Tăng tỉ lệ ngẫu nhiên rơi ra chìa khóa khi merge các ô số thông thường.
   - Mỗi cấp độ: `+0.8%` tỉ lệ rơi chìa khóa (Max Lv 14 = +11.2%).
5. 🛡️ **Cường Hóa Sức Mạnh Vũ Khí (`weaponBonusPower`)**:
   - Gia tăng thêm lượng Power nhận được mỗi khi nhân vật bước qua nhặt 1 món trang bị (Kiếm, Giáp, Găng tay) trong ván đấu.
   - Mỗi cấp độ: `+5.0%` Power nhận thêm từ trang bị (Max Lv 14 = **+70% Power** khi nhặt vũ khí).

### 2.2. Công Thức Tiêu Hao Sao & Cân Bằng Cấp Độ (Progressive Upgrade Cost)
Chi phí Sao để nâng lên **Level $L$** của bất kỳ thanh chỉ số nào luôn bằng đúng **$L$ Sao**:
- Nâng từ **Lv 0 ➔ Lv 1**: Tiêu tốn **1 ⭐**
- Nâng từ **Lv 1 ➔ Lv 2**: Tiêu tốn **2 ⭐**
- Nâng từ **Lv 2 ➔ Lv 3**: Tiêu tốn **3 ⭐**
- ...
- Nâng từ **Lv 13 ➔ Lv 14**: Tiêu tốn **14 ⭐**
- **Tổng chi phí để max 1 nhánh (Lv 14)**:
  $$\text{Chi phí} = 1 + 2 + 3 + \dots + 14 = \frac{14 \times 15}{2} = 105\ \text{Sao ⭐}$$
- **Tổng chi phí để max TOÀN BỘ 5 nhánh**:
  $$5 \times 105 = 525\ \text{Sao ⭐}$$
- **Đánh giá cân bằng toán học**:
  - Người chơi vượt qua trọn vẹn 100 màn chơi tích lũy được đúng **550 ⭐**.
  - Việc thiết lập **Tối đa 14 Cấp Độ (Max Lv 14)** tiêu tốn **525 ⭐**, cho phép người chơi hoàn thành **100% Mastery cây kỹ năng** khi về nước (dư 25 ⭐ dự phòng trường hợp bỏ qua một số màn thử thách cực khó cuối game).

---

## 3. Quản Lý Dữ Liệu Lưu Trữ (`localStorage`)

Key lưu trữ: `mte_player_talents`
```ts
export type PlayerTalents = {
  exp: number // Điểm EXP chưa sử dụng
  clearedLevels: number[] // Danh sách các ID màn đã từng vượt qua để kiểm tra First-Clear
  goldRateLevel: number // 0 -> 14
  weaponRateLevel: number // 0 -> 14
  basePowerLevel: number // 0 -> 14
  keyRateLevel: number // 0 -> 14
  weaponBonusPowerLevel: number // 0 -> 14
}

export const defaultTalents: PlayerTalents = {
  exp: 0,
  clearedLevels: [],
  goldRateLevel: 0,
  weaponRateLevel: 0,
  basePowerLevel: 0,
  keyRateLevel: 0
}
```

---

## 4. Thiết Kế Giao Diện Bảng Nâng Cấp (Talent Upgrade Modal)

- **Nút Mở Bảng Kỹ Năng trên Topbar**: Biểu tượng Ngôi Sao / Huy Hiệu Level `⭐ Talents (EXP: {exp})`.
- **Giao Diện Modal Nâng Cấp (Talent Modal)**:
  - Header: *"HERO TALENTS & MASTERY"* kèm số điểm EXP hiện có.
  - 4 Hàng kỹ năng hiển thị trực quan:
    - Icon + Tên chỉ số + Mô tả ngắn (ví dụ: `+30 Base Power`).
    - Thanh tiến trình cấp độ: Hiển thị 15 ô pips `[■ ■ ■ ■ □ □ ... ] Lv 4/15`.
    - Nút Nâng Cấp:
      - Hiển thị chi phí: `Upgrade (Cost: {currentLevel + 1} ⭐)`.
      - Tự động Disable nếu `stars < currentLevel + 1` hoặc đã đạt cấp độ tối đa (Max Lv 15).
- **Phản hồi khi qua màn (Victory Screen)**:
  - Nếu là **lần đầu vượt màn** (`!clearedLevels.includes(currentLevelId)`):
    - Tính số sao: `earnedStars = Math.ceil(currentLevelId / 10)`.
    - Dòng thông báo nổi bật: `🎉 NEW VICTORY! +{earnedStars} ⭐ GAINED!`
    - Thêm level vào `clearedLevels` và `stars += earnedStars`.
  - Nếu là **chơi lại màn đã thắng**:
    - Dòng thông báo: `🎉 LEVEL COMPLETED! Gold Collected: +{earnedGold}🪙 (Replay: No ⭐)`.

---

## 5. Tác Động Vào Gameplay Trong Trận
- **Khởi tạo ván đấu**:
  - `playerPower = talents.basePowerLevel * 25`.
- **Tỉ lệ rơi đồ khi merge**:
  - `effectiveGoldDropRate = baseRate + (talents.goldRateLevel * 0.020)`
  - `effectiveWeaponDropRate = baseRate + (talents.weaponRateLevel * 0.015)`
  - `effectiveKeyDropRate = baseRate + (talents.keyRateLevel * 0.008)`

---

## 6. Các Tệp Cần Chỉnh Sửa
- [NEW] `components/TalentModal.tsx`: Modal giao diện nâng cấp kỹ năng.
- [MODIFY] `lib/types.ts`: Khai báo Interface `PlayerTalents`.
- [MODIFY] `lib/game_config.json`: Cấu hình hệ số tăng trưởng của 4 chỉ số.
- [MODIFY] `app/page.tsx`:
  - Thêm state `talents`, tích hợp `+1 EXP` khi gọi hàm `onVictory`.
  - Áp dụng các chỉ số nâng cấp vào logic tính toán rớt đồ và base power.
- [MODIFY] `app/globals.css`:
  - Stylesheet cho Talent Modal, thanh pips level, hiệu ứng hào quang nâng cấp.

---

## 7. Checklist Nghiệm Thu
- [ ] Vượt màn mới nhận đúng số Sao theo mốc (Lv 1-10: 1⭐; Lv 11-20: 2⭐;... Lv 91-100: 10⭐) lưu vào `localStorage`.
- [ ] Chơi lại màn đã từng vượt qua chỉ nhận được Vàng trong trận, không được cộng thêm Sao.
- [ ] Nâng cấp Lv 1 trừ 1 ⭐, Lv 2 trừ 2 ⭐, Lv 3 trừ 3 ⭐... Lv 15 trừ 15 ⭐ chuẩn xác.
- [ ] Khi nâng Base Power, vào trận mới nhân vật có sẵn chỉ số Power tương ứng (25 power/lv).
- [ ] Tỉ lệ rơi vàng, vũ khí và chìa khóa tăng rõ rệt khi đầu tư nâng cấp.
- [ ] Không thể nâng cấp nếu không đủ điểm Sao.
