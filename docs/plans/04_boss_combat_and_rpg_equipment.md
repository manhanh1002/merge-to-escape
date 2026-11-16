# Kế Hoạch 4: Đấu Boss & Hệ Thống Trang Bị RPG (Kiếm, Giáp, Găng Tay)

← Quay lại: [Kế hoạch 3: Bàn Cờ 2 Lớp](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/03_two_layer_grid_and_floor_gifts.md) | Tiếp theo: [Kế hoạch 5: Nền Kinh Tế Vàng & Shop](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/05_economy_shop_and_boosters.md)

---

## 1. Mục Tiêu
Đưa vào cơ chế nhập vai chiến đấu với Boss tại các mốc **Level chia hết cho 5 (Vòng 5, 10, 15, 20, ..., 100)**:
- **Mid-Boss**: Xuất hiện tại Vòng 5 của mỗi Chapter (5, 15, 25, 35, 45, 55, 65, 75, 85, 95).
- **Final Boss**: Xuất hiện tại Vòng 10 của mỗi Chapter (10, 20, 30, 40, 50, 60, 70, 80, 90, 100).
- **Quy tắc tính toán**: Boss là **thực thể duy nhất** trấn giữ phòng Boss, **tính toán hoàn toàn theo Máu (`Boss HP`)**, KHÔNG tính vào số lượng hay điểm Enemy Points (EP) của các vật cản thông thường!
- Người chơi gom nhặt các món trang bị (Kiếm, Giáp, Găng tay) rơi ra từ việc merge để tích lũy **Tổng Sức Mạnh (`Total Player Power`)**.
- **Máu Boss (`Boss HP`)**: Tăng dần từ **20 HP (Lv 5)** đến tối đa **1000 HP (Lv 100)**. Người chơi chỉ cần nhặt khoảng 8–10 trang bị gia tăng Power kết hợp với Base Power của Talent Tree là hoàn toàn có thể chinh phục được Final Boss mà không bị quá tải.
- Khi va chạm với Boss:
  - Nếu `Player Power < Boss HP`: Thua cuộc ngay lập tức!
  - Nếu `Player Power >= Boss HP`: Boss bị tiêu diệt, thưởng ngay **Vàng lớn + 1 Búa phá đá + 1 Chìa khóa**!

## 2. Thiết Kế Trang Bị & Cách Tính Power

### 2.1. Các Loại Trang Bị (Equipment)
- ⚔️ **Kiếm (`Sword`)**: Sức tấn công mạnh mẽ.
- 🛡️ **Giáp (`Armor`)**: Chỉ số phòng thủ gia cường.
- 🥊 **Găng tay (`Gauntlet`)**: Tăng cường bộc phá sát thương.

Mỗi trang bị khi rơi ra sàn có giá trị Power được tính dựa trên cấp độ của tile vừa merge:
$$\text{Item Power} = \text{basePower} \times \left(1 + \frac{\text{tileValue}}{256}\right)$$

### 2.2. Thu Thập & Cộng Dồn Power
- Khi nhân vật nhặt được trang bị:
  - `playerPower += item.power`
  - Hiển thị badge Power trên HUD: `⚔️ Power: {playerPower} / ❤️ Boss: {bossHp}`.

## 3. Cơ Chế Quái Vật Boss (Boss Mechanics)

### 3.1. Tính Chất Của Boss Trên Bàn Cờ
- Boss luôn chiếm 1 ô độc lập trên bàn cờ.
- Boss là vật cản cứng: Không ô số nào có thể trượt xuyên qua ô của Boss.
- Boss có thanh máu nhỏ hiển thị ngay trên đầu ô.

### 3.2. Logic Giao Chiến (Combat Collision)
Khi người chơi vuốt hướng về ô của Boss:
```ts
if (nextCell === 'boss') {
  if (playerPower < bossHp) {
    // Thất bại: Bị Boss hạ gục
    setLost(true)
    setMessage('You were defeated by the Boss! Need more equipment power.')
    return
  } else {
    // Chiến thắng Boss!
    // 1. Tiêu diệt boss, giải phóng ô
    board[bossIndex] = null
    // 2. Thưởng phần thưởng lớn
    setGold((prev) => prev + bossRewardGold)
    setHammers((prev) => prev + 1)
    setCollectedKeys((prev) => prev + 1)
    setMessage('Boss Defeated! Gained +Gold, +1 Hammer, +1 Key!')
    // 3. Nhân vật tiến vào ô của boss
    nextPlayer = bossIndex
  }
}
```

### 3.3. Quy Tắc Hồi Sinh Của Boss (Respawn Cooldown)
- Sau khi Boss chết: Bàn cờ hoàn toàn sạch bóng quái vật cho đến khi hoàn thành vòng chơi.
- (Ở các vòng cực khó Lv 40+, có thể có cooldown $N$ bước mới tái xuất hiện).

### 3.4. Thú Săn Mồi Đi Tuần (Wandering Beasts)
- **Đặc điểm**: Khác với Boss đứng cố định, Thú Săn Mồi là tiểu quái lang thang trong hầm ngục (HP nhỏ: 15 - 35).
- **Hành vi di chuyển theo lượt**:
  - Sau mỗi lượt vuốt thành công của người chơi: Thú tìm các ô trống lân cận (4 hướng Up, Down, Left, Right) không có tường cản hay đá.
  - Di chuyển sang 1 ô trống ngẫu nhiên (tạo cảm giác quái thú đang lượn lờ săn mồi).
- **Giao chiến (Combat)**:
  - Nếu người chơi vuốt nhân vật va vào thú (hoặc thú bước đụng vào nhân vật):
    - `playerPower >= beast.hp`: Nhân vật tiêu diệt thú thành công, nhận thưởng nhẹ (20-40 Vàng), thú biến mất.
    - `playerPower < beast.hp`: Nhân vật bị thú cắn chết ➔ Game Over!
- Thú săn mồi có thể xuất hiện ở các màn thường (1 con) để tạo áp lực sinh tồn linh hoạt.

## 4. Thiết Kế UI & Hiệu Ứng Hình Ảnh
- Ô Boss: Icon đầu lâu/quỷ dữ (`Skull` / `Ghost`) màu đỏ thẫm rực cháy, có thanh máu HP đỏ bên trên.
- Ô Trang bị: Icon Kiếm/Giáp/Găng tay phát sáng hào quang xanh lam/bạc.
- Hiệu ứng chém Boss: Animation chớp sáng (slash effect) khi tiêu diệt boss thành công.

## 5. Các Tệp Cần Chỉnh Sửa
- [MODIFY] `app/page.tsx`:
  - Thêm state `playerPower`, `bossHp`, `bossMaxHp`, `bossPos`.
  - Tích hợp kiểm tra Boss va chạm trong hàm `move`.
  - Khởi tạo Boss trong `makeBoard` dựa theo cấu hình `level.hasBoss` và `level.bossHp`.
- [MODIFY] `app/globals.css`:
  - CSS cho `.tile.boss`: Viền đỏ cảnh báo nguy hiểm, thanh máu `.boss-hp-bar`.
  - CSS cho `.equipment-badge`: Hiển thị chỉ số Power nhỏ xinh xắn.

## 5b. Ghi Chú Triển Khai (khác với bản kế hoạch gốc)
- **Boss di chuyển theo đường đi chung**: mỗi lượt vuốt, Boss trượt theo hướng vuốt như một vật phẩm không bao giờ merge; dừng lại ở tường, đá, cửa và nhân vật. Tile đâm vào Boss chỉ dừng lại, **không** gây sát thương.
- **Sát thương = Sách phép tấn công (Fire Tome)**: khi Boss còn sống, mỗi lần merge ≥ `bossTomeDrop.minTile` (4) có `bossTomeDrop.dropRate` (50%) rơi Fire Tome. Nhân vật **đi sượt qua** sách ➔ sách phóng vào Boss: sát thương = `ceil(HP tối đa / bossTomeHits)` + Power từ giáp/găng. `bossTomeHits` = 2 với Mid-Boss, 3 với Final Boss (màn x10), nên số sách cần không phụ thuộc HP trong bảng.
- **Sau khi hạ Boss**: không còn rơi Fire Tome nữa ở màn đó, và các Fire Tome còn nằm trên sàn biến mất (vàng, chìa, giáp… vẫn giữ).
- **Va chạm**: mỗi khi Boss và nhân vật **mới chạm nhau** (một bên trượt/bước sát bên kia, hoặc nhân vật đi vào Boss) ➔ Boss đánh, mất 1 ❤️ (3 ❤️ mỗi màn Boss). Đứng yên cạnh nhau thì an toàn. Không còn luật "đủ Power thì chém chết Boss".
- **Cửa bị phong ấn** khi Boss còn sống. Giết Boss: thưởng vàng trong `bossRewards.goldRange` + `bonusKeys` chìa. Búa (phase 5) chưa có.
- **Vũ khí của pháp sư là Sách phép**: slot `sword` hiển thị thành *Fire Tome* (pack `free-50-rpg-book-icons`) và **chỉ rơi khi Boss còn sống**. **Hình dạng sách theo Power** (`lib/tomes.ts`, chỉ là hình ảnh): Worn Tome (0) → Ember Tome (50) → Fire Tome (100) → Blaze Tome (175) → Inferno Codex (250) → Phoenix Grimoire (350) — tức Arcane Might Lv 0/2/4/7/10/14. Icon Power trên HUD là *Arcane Tome*.
- **Trang bị có vai trò riêng (không còn cộng Power)**: 🛡️ **Giáp** = 1 lượt đỡ đòn — đỡ một cú chạm của Boss (thay vì mất ❤️) hoặc một bẫy gai trượt qua (thay vì chết; mỗi gai tốn 1 giáp). 🥊 **Găng** = 1 lượt — khi pháp sư trượt đâm vào đá / đá khắc số thì đá vỡ (tự dùng). Mỗi loại mang tối đa 3. **Power chỉ đến từ talent Arcane Might** và cộng vào mỗi Fire Tome. Talent **Gear Mastery** (id cũ `weaponBonusPower`) đổi thành: bắt đầu mỗi màn với 1/2/3 giáp ở Lv 5/10/14 (`armorLevels`).
- **Nhân vật Boss**: Chương 1–3 Caveman, 4–7 Giant Goblin, 8–10 Viking Leader (`scripts/extract_bosses.py`, pack CraftPix). Thú đi tuần (3.4) chưa triển khai.
- Cân bằng: `npm run sim -- --boss` (bot săn sách, tránh va chạm). Bàn 4×4 chật vì Boss chiếm 1 ô di động, nên số sách cần thấp (2/3) và tỉ lệ rơi cao (50%).

## 6. Checklist Nghiệm Thu
- [ ] Level 10 xuất hiện Boss có thanh máu HP rõ ràng.
- [ ] Di chuyển vào Boss khi chưa đủ Power ➔ Màn hình thua Game Over hiển thị chính xác.
- [ ] Nhặt đủ Kiếm/Giáp/Găng tay đến khi Power $\ge$ Boss HP, lao vào Boss ➔ Boss bị chém biến mất.
- [ ] Khi Boss chết, người chơi được cộng Vàng, +1 Búa phá đá, +1 Chìa khóa vào thanh trạng thái.
