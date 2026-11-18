# Kế Hoạch 9: Màn Hình Chính & Nâng Cấp Ngoài Trận (Main Menu & Meta Progression)

← Quay lại: [Kế hoạch 8: Talent Tree](08_roguelite_exp_and_talent_tree.md) | [Về Mục lục kế hoạch](README.md)

> Kế hoạch này **thay thế phần triển khai** của Kế hoạch 5 (Shop) và Kế hoạch 8 (Talent Tree) cho khớp luật chơi hiện tại (nhân vật trượt hết đường, Boss di chuyển, Fire Tome, ❤️, save local). Số liệu thiết kế của KH 8 (Sao theo mốc, chi phí L Sao, Max Lv 14) được giữ nguyên.

---

## 1. Hiện Trạng (đã có trong commit `e1f6c89`)
- **Một màn hình duy nhất** (`app/page.tsx`, ~630 dòng): bàn cờ, HUD, dropdown chọn màn, bảng kết quả. Không có màn hình chính, bản đồ chương, shop hay talent.
- **Save local** (`lib/save.ts`, key `merge-to-escape:save:v1`): `unlocked`, `current`, `gold`, `records` (kỷ lục), `run` (màn đang chơi dở).
- **Tiền tệ**: Vàng (lưu vĩnh viễn). Chìa khóa, Power, Cuộn phép **reset mỗi màn** và hiện **chưa có chỗ dùng** (Power chỉ cộng vào sát thương Fire Tome; chìa & cuộn phép chưa dùng được).
- **Config** đã có `talentTreeConfig` (5 nhánh, `maxLevel: 14`) và `shopPrices.hammer: 150` nhưng chưa được code dùng.

## 2. Mục Tiêu
1. **Màn hình chính (Home)** khi mở game: tiếp tục chơi, bản đồ chương, nâng cấp, cửa hàng, cài đặt.
2. **Bản đồ chương (Level Map)** thay cho dropdown: 10 chương × 10 màn, trạng thái khóa/đã qua/kỷ lục, đánh dấu Boss.
3. **Nâng cấp ngoài trận (Talent Tree)** bằng ⭐ Sao nhận khi **qua màn lần đầu** — mạnh lên vĩnh viễn.
4. **Cửa hàng (Shop)** bằng 🪙 Vàng — mua vật phẩm tiêu hao mang vào trận (Búa, Cuộn phép, Bình máu).
5. Giữ save cũ của người chơi (chuyển đổi tự động v1 ➔ v2), không làm hỏng bản lưu đang có.

## 3. Thiết Kế

### 3.1. Hai loại tiền
| Tiền | Nguồn | Dùng để | Ghi chú |
|---|---|---|---|
| ⭐ Sao | Qua màn **lần đầu**: `ceil(levelId / 10)` (Lv 1–10: 1⭐ … Lv 91–100: 10⭐), tổng **550⭐** | Nâng Talent (vĩnh viễn) | Chơi lại màn đã qua: 0⭐ (KH 8) |
| 🪙 Vàng | Rơi khi merge, thưởng Boss (đã có) | Mua đồ tiêu hao trong Shop | Đã lưu vĩnh viễn |

### 3.2. Talent Tree — 5 nhánh (dùng đúng `talentTreeConfig`)
Chi phí lên Lv **L** = **round(L × 1.2)⭐** (`costMultiplier`); max Lv 14 ➔ 126⭐/nhánh, 630⭐ cả cây (> 550⭐ kiếm được cả game ➔ không max được mọi nhánh, người chơi phải chọn đường). Reset từng nhánh hoặc toàn bộ: hoàn lại ⭐, tốn **5 vàng / ⭐ hoàn lại** (`resetGoldPerStar`). (Trước đây: L⭐, 525⭐ cả cây, reset miễn phí.)

| Nhánh (key config) | Hiệu ứng mỗi Lv (config) | Áp vào luật hiện tại |
|---|---|---|
| 🪙 `goldRate` | +2% tỉ lệ rơi vàng | cộng vào `dropRate` của mọi `goldDropRules` |
| 📖 `weaponRate` | +1.5% tỉ lệ rơi trang bị | cộng vào `dropRate` của sword/armor/gauntlet **và** `bossTomeDrop` |
| ⚔️ `basePower` | +10 Power khởi đầu | Power đầu mỗi màn = `Lv × 10`; mỗi Fire Tome gây thêm **Power %** sát thương (tối đa +140%). Trước đây Power cộng thẳng (+25/Lv) nên Power cao khiến boss chết sau 1–2 sách |
| ❤️ `bonusHearts` (thay `keyRate` — **đã chốt**) | `heartLevels: [5, 10, 14]` | +1 ❤️ ở màn Boss tại Lv 5 / 10 / 14 (tối đa 6 ❤️) |
| 🛡️ `weaponBonusPower` = **Gear Mastery** (đổi sau 9.8) | `armorLevels: [5, 10, 14]` | Bắt đầu mỗi màn với 1 / 2 / 3 giáp (trước đây: +5% Power từ trang bị — bị bỏ vì trang bị không còn cho Power, xem KH 4 §5b) |

### 3.3. Shop — đồ tiêu hao (Vàng)
| Vật phẩm | Giá (config `shopPrices`) | Dùng trong trận |
|---|---|---|
| 🔨 Búa (`hammer`) | 150 (đã có) | chọn 1 đá thường / đá khắc số ➔ vỡ |
| 📜 Cuộn Diệt 2 (`purge2`) | 200 (mới) | xóa mọi tile 2 trên bàn (KH 5 §3.2) |
| 📜 Cuộn Diệt 4 (`purge4`) | 300 (mới) | xóa mọi tile 4 |
| 🧪 Bình máu (`heartPotion`) | 250 (mới) | +1 ❤️ trong màn Boss (không vượt max) |
Kho đồ tiêu hao lưu vĩnh viễn trong save; cuộn phép nhặt trong trận cũng cộng vào kho này (thay vì mất khi qua màn).

### 3.4. Màn hình & điều hướng (App Router)
| Route | Màn hình | Nội dung chính |
|---|---|---|
| `/` | **Home** | Logo, pháp sư idle, nút **Tiếp tục (Màn N)** / **Chơi**, **Bản đồ**, **Nâng cấp** (badge số ⭐ chưa dùng), **Cửa hàng**, ⚙️ Cài đặt; ví 🪙/⭐ |
| `/play?level=N` | **Trận đấu** | Game hiện tại (chuyển từ `app/page.tsx`); nút ← về Home; thanh Booster dưới bàn |
| `/levels` | **Bản đồ chương** | 10 thẻ chương (tiến độ x/10, ⭐ đã nhận, icon Boss); bấm chương ➔ lưới 10 màn (🔒 / ✓ + kỷ lục / 👑 Boss) |
| `/upgrades` | **Talent** | 5 hàng: icon, tên, mô tả hiệu ứng hiện tại ➔ cấp sau, 14 pips, nút `Nâng cấp (L⭐)` |
| `/shop` | **Cửa hàng** | Thẻ vật phẩm: icon, mô tả, số đang có, nút `Mua (giá🪙)` (khóa nếu thiếu vàng) |
| — | **Cài đặt** (modal trên Home) | Bật/tắt âm thanh (lưu save), Xóa tiến trình (xác nhận), Phiên bản |

Bảng kết quả thắng: thêm dòng **"+N⭐ (lần đầu)"** hoặc **"Chơi lại — không có ⭐"**, nút **Màn tiếp**, **Bản đồ**, **Nâng cấp** (nếu có ⭐ chưa dùng).

### 3.5. Kiến trúc code
- **`lib/save.ts`** — Save **v2** + chuyển đổi từ v1 (giữ `unlocked/current/gold/records/run`), thêm `stars`, `talents`, `stash`, `settings`.
- **`lib/talents.ts`** (mới, thuần) — định nghĩa nhánh, chi phí, nâng cấp, và **áp hiệu ứng**: `effectiveEconomy()`, `startingRun()`.
- **`lib/shop.ts`** (mới, thuần) — `buy()`, giá từ config.
- **`lib/game-logic.ts`** — thêm `useHammer()`, `usePurge()` (thuần, có test).
- **`components/`** — tách khỏi `app/page.tsx`: `WizardSprite`, `BossSprite`, `Purse`, `ScreenShell` (topbar + nút ←), `useSave()` (hook duy nhất đọc/ghi localStorage, mọi màn hình dùng chung).
- **`app/`** — `page.tsx` (Home), `play/page.tsx` (trận, chuyển từ page cũ), `levels/page.tsx`, `upgrades/page.tsx`, `shop/page.tsx`.

## 4. Mô Hình Dữ Liệu
```ts
// lib/save.ts — v2 (key mới 'merge-to-escape:save:v2'; đọc v1 nếu chưa có v2 rồi chuyển đổi)
export type TalentId = 'goldRate' | 'weaponRate' | 'basePower' | 'bonusHearts' | 'weaponBonusPower'
export type Stash = { hammer: number; purge2: number; purge4: number; heartPotion: number }
export type SaveData = {
  version: 2
  unlocked: number; current: number; gold: number
  records: Record<number, LevelRecord>
  run?: RunState                     // như v1 (RunState bỏ `scrolls`, dùng stash)
  stars: number                      // ⭐ chưa tiêu
  talents: Record<TalentId, number>  // 0..14
  stash: Stash
  settings: { sound: boolean }
}
export function migrateV1(v1: SaveDataV1): SaveData // stars = Σ ceil((i+1)/10) với mọi i trong records
export function starsForLevel(levelIndex: number): number // Math.ceil((levelIndex + 1) / 10)
export function recordWin(save, levelIndex, moves, score, levelCount): { save: SaveData; starsEarned: number }

// lib/talents.ts  (đã làm ở 9.2)
// = economyConfig.talentTreeConfig
export type TalentConfig = {
  statsBonusPerLevel: { goldRate: number; weaponRate: number; basePower: number; weaponBonusPower: number }
  maxLevel: number          // 14
  heartLevels: number[]     // [5, 10, 14] — bonusHearts
}
export function upgradeCost(level: number): number                                  // level + 1
export function canUpgrade(save: SaveData, id: TalentId, cfg: TalentConfig): boolean // < max && stars đủ
export function upgrade(save: SaveData, id: TalentId, cfg: TalentConfig): SaveData   // trừ ⭐, +1 Lv (không đủ ➔ trả nguyên save)
export function refundAll(save: SaveData): SaveData                                  // hoàn toàn bộ ⭐ đã tiêu
export function effectiveEconomy(base: EconomyConfig, t: SaveData['talents'], cfg: TalentConfig): EconomyConfig
export function startingRun(t: SaveData['talents'], cfg: TalentConfig): { power: number; hearts: number }
export function gearPower(itemPower: number, t: SaveData['talents'], cfg: TalentConfig): number

// lib/shop.ts
export function buy(save: SaveData, item: keyof Stash, prices: Record<keyof Stash, number>): SaveData | null

// lib/game-logic.ts
export function useHammer(board: Tile[], index: number): Tile[] | null // chỉ 'stone' | numbered_stone
export function usePurge(board: Tile[], value: 2 | 4): { board: Tile[]; removed: number[] }
```

## 5. Lộ Trình Triển Khai (mỗi giai đoạn chạy được, có test, commit riêng)

### Giai đoạn 9.1 — Save v2 + Sao lần đầu qua màn
- **Tệp**: `lib/save.ts`, `scripts/test_save.mjs`, `app/page.tsx` (chỉ đổi chỗ gọi `recordWin`).
- **Test mới** (`node --test`):
  - `starsForLevel(0)=1`, `starsForLevel(9)=1`, `starsForLevel(10)=2`, `starsForLevel(99)=10`; tổng 100 màn = 550.
  - Qua màn lần đầu ➔ `starsEarned = starsForLevel(i)`, `stars` tăng; chơi lại ➔ `starsEarned = 0`.
  - Save v1 hợp lệ ➔ `migrateV1` giữ `unlocked/current/gold/records/run`; `stars` = tổng sao của các màn trong `records`; talents = 0; stash = 0.
  - Save v2 hỏng/thiếu trường ➔ giá trị an toàn (talent 0..14, stash ≥ 0, stars ≥ 0).
- **Nghiệm thu**: Bảng thắng hiện "+N⭐ (lần đầu)" / "Chơi lại — không có ⭐"; F5 không mất ⭐; save cũ của tester vẫn dùng được.

### Giai đoạn 9.2 — Talent logic (thuần, chưa có UI)
- **Tệp**: `lib/talents.ts` (mới), `scripts/test_talents.mjs` (mới), `lib/game_config.json` (đổi `keyRate` ➔ `bonusHearts` nếu chốt §8).
- **Test**:
  - Chi phí: Lv0➔1 = 1⭐ … Lv13➔14 = 14⭐; tổng 1 nhánh = 105⭐; không nâng quá 14; thiếu ⭐ ➔ không đổi.
  - `effectiveEconomy`: `goldRate` Lv 5 ➔ mọi gold `dropRate` +0.10; `weaponRate` Lv 4 ➔ sword/armor/gauntlet & `bossTomeDrop` +0.06; tỉ lệ không vượt 1.
  - `startingRun`: `basePower` Lv 3 ➔ power 75; `bonusHearts` Lv 0/5/10/14 ➔ hearts 3/4/5/6.
  - `weaponBonusPower` Lv 10 ➔ trang bị 30 Power nhặt được thành 45.
- **Nghiệm thu**: `npm test` xanh.

### Giai đoạn 9.3 — Áp Talent vào trận
- **Tệp**: `app/page.tsx` (sau này `app/play/page.tsx`), `scripts/simulate_levels.mjs`.
- **Việc**: đầu màn dùng `startingRun()` (Power, ❤️); `computeMove` nhận `effectiveEconomy()`; Power trang bị nhân `weaponBonusPower`.
- **Cân bằng**: thêm `--talents expected` cho bot (giả định người chơi đã tiêu toàn bộ ⭐ kiếm được tới màn đó, chia đều 5 nhánh) và chạy `npm run sim`; mục tiêu: không màn nào > 98% ở 6×6/7×7 với talent, đường cong vẫn giảm dần theo màn. Nếu `basePower` 25/Lv làm Boss quá dễ (Fire Tome đã gây 1/2–1/3 HP), giảm hệ số trong config — **không** sửa code.
- **Nghiệm thu**: nâng `basePower` Lv 1 ➔ vào màn Boss, 1 Fire Tome gây thêm đúng 25.
- **Kết quả đo (đã làm)**: `npm run sim -- --talents expected` (30 lượt/màn): tỉ lệ thắng trung bình chỉ **+2.1 điểm** so với không talent (4×4 92%, 5×5 93%, 6×6 83%, 7×7 76%), đường cong vẫn giảm dần; Boss chết nhanh gấp ~2 lần nhờ Power cộng vào Fire Tome. L45/L48/L51 lên 100% nhưng vốn đã 93–97% (trong sai số) ➔ **giữ nguyên config**.

### Giai đoạn 9.4 — Tách route + Home
- **Tệp**: `app/play/page.tsx` (chuyển game sang), `app/page.tsx` (Home mới), `components/{ScreenShell,Purse,WizardSprite,BossSprite}.tsx`, `components/useSave.ts`, `app/globals.css`.
- **Việc**: Home có Tiếp tục / Bản đồ / Nâng cấp / Cửa hàng / Cài đặt; game đọc `?level=` (chỉ cho màn đã mở; màn khóa ➔ về `/levels`); nút ← trên topbar về Home. `useSave` là nơi **duy nhất** đọc/ghi localStorage. `unlock-all.html` / `reset-progress.html` cập nhật theo key v2.
- **Nghiệm thu**: mở `/` thấy Home; "Tiếp tục" vào đúng màn đang chơi dở (giữ `run`); F5 ở `/play` vẫn giữ bàn cờ; build `npm run build` sạch.
- **Ghi chú (đã làm)**: Thẻ Bản đồ / Nâng cấp / Cửa hàng trên Home hiện ở trạng thái "Soon" cho tới 9.5–9.7; dropdown chọn màn vẫn nằm trong `/play` cho tới 9.5. `?dev` giờ lưu cờ trong `sessionStorage` nên giữ được khi chuyển màn hình (chỉ tab hiện tại). URL `/play?level=N` luôn khớp màn đang chơi (F5 mở lại đúng màn). Nút âm thanh / trợ giúp cũ trên topbar (chưa có chức năng) được thay bằng nút ← (trong trận) và ⚙️ Cài đặt (trên Home).

### Giai đoạn 9.5 — Bản đồ chương
- **Tệp**: `app/levels/page.tsx`, `components/ChapterCard.tsx`, CSS.
- **Việc**: 10 thẻ chương (tên chương, x/10 đã qua, ⭐ đã nhận/tổng, icon Boss chương), lưới 10 màn; bỏ dropdown khỏi màn trận (giữ `?dev` mở khóa toàn bộ để test).
- **Nghiệm thu**: màn khóa không bấm được; màn đã qua hiện ✓ + kỷ lục; bấm màn ➔ `/play?level=N`; vừa khung 375px.
- **Ghi chú (đã làm)**: logic thuần `lib/map.ts` (+ test). Chương đang chơi mở sẵn; dropdown trong trận thay bằng nút **Map**; bảng kết quả thêm nút **Map**; màn khóa / URL sai ➔ `/levels`. Chọn một màn khác trên bản đồ sẽ bỏ màn đang chơi dở (chỉ giữ 1 màn dở một lúc). `tsconfig`: bật `allowImportingTsExtensions` để các file `lib/` import lẫn nhau bằng `./x.ts` (chạy được trực tiếp trong test Node).

### Giai đoạn 9.6 — Màn hình Talent
- **Tệp**: `app/upgrades/page.tsx`, CSS.
- **Việc**: 5 hàng nhánh, 14 pips, "hiện tại ➔ cấp sau" (ví dụ `+50 ➔ +75 Power`), nút nâng cấp hiện giá, hiệu ứng khi nâng; nút "Đặt lại talent" (hoàn toàn bộ ⭐ đã tiêu — miễn phí trong giai đoạn test).
- **Nghiệm thu**: nâng cấp trừ đúng ⭐, F5 vẫn giữ; nút khóa khi thiếu ⭐ hoặc Lv 14.
- **Ghi chú (đã làm)**: tên nhánh: Golden Touch, Treasure Sense, Arcane Might, Stout Heart, Gear Mastery; mô tả "hiện tại ➜ cấp sau" từ `describeTalent()` (+ test). Nâng cấp áp dụng từ màn **bắt đầu tiếp theo** (màn đang dở giữ chỉ số lúc bắt đầu). "Đặt lại talent" **miễn phí** (theo đề xuất §8.4 — đổi được nếu muốn tính phí). Bảng thắng có nút "Upgrades ★N" khi còn sao chưa tiêu.

### Giai đoạn 9.7 — Shop + thanh Booster trong trận
- **Tệp**: `lib/shop.ts`, `lib/game-logic.ts` (`useHammer`, `usePurge`), `scripts/test_shop.mjs`, `scripts/test_game_logic.mjs`, `app/shop/page.tsx`, `app/play/page.tsx`.
- **Test**: mua trừ đúng vàng, thiếu vàng ➔ `null`; Búa chỉ phá `stone`/`numbered_stone` (không phá Boss, cửa, nhân vật); Diệt 2 xóa mọi tile 2 và trả danh sách ô bị xóa; Bình máu không vượt ❤️ tối đa.
- **Việc trong trận**: thanh Booster dưới bàn (🔨 / 📜2 / 📜4 / 🧪 kèm số lượng); Búa ➔ chế độ chọn đá (đá nhấp nháy), bấm đá ➔ vỡ; mỗi lần dùng tính là 1 lượt có thể Undo.
- **Nghiệm thu**: theo Checklist KH 5 §6.
- **Ghi chú (đã làm)**: hàm thuần đặt tên `applyHammer` / `applyPurge` / `applyHeartPotion` (không dùng tiền tố `use…` để khỏi nhầm với React hook) + test; `lib/shop.ts` + test. Giá trong config: Búa 150, Diệt 2 = 200, Diệt 4 = 300, Bình máu 250 (theo đề xuất §8.2, chưa chốt). Cuộn phép nhặt trong trận vào **kho vĩnh viễn** (§8.3 theo đề xuất). Dùng booster **không** tính nước đi, không sinh tile, **Undo được** (Undo trả lại vật phẩm). **Cứu khi kẹt**: thua vì hết nước đi vẫn dùng được booster; nếu đi được lại thì chơi tiếp.

### Giai đoạn 9.8 — Hoàn thiện
- Âm thanh (nếu chốt §8), hiệu ứng nhận ⭐ / nâng cấp, `npm run build`, kiểm tra 375px, cập nhật README kế hoạch.
- **Ghi chú (đã làm)**: sao bay ra khi nhận ⭐ lần đầu; ô ví "nảy" khi vàng/⭐ tăng; viền vàng khi focus bằng bàn phím; tiêu đề tab theo từng màn hình (`metadata` của từng route + `title.template`); sửa mô tả trang; bỏ CSS chết của dropdown cũ; hàng Nâng cấp/Shop gọn hơn trên điện thoại. Đã kiểm tra 5 màn hình ở 375px (không tràn ngang). **Âm thanh chưa làm** (§8.5 chưa chốt, cần file âm thanh có giấy phép).

## 6. Kiểm Thử Chung
- `npm test` (logic, save, talent, shop) — xanh trước mỗi commit.
- `npm run check:levels`, `npm run sim -- --talents expected` sau 9.3 và 9.7.
- Kiểm tra tay trên `localhost:3123`: Home ➔ Bản đồ ➔ chơi ➔ thắng nhận ⭐ ➔ Nâng cấp ➔ chơi lại thấy hiệu ứng; F5 ở mọi màn hình không mất dữ liệu; save v1 cũ chuyển sang v2 đúng.

## 7. Ước Lượng
| Giai đoạn | Khối lượng |
|---|---|
| 9.1 Save v2 + Sao | nhỏ |
| 9.2 Talent logic | nhỏ |
| 9.3 Áp talent + cân bằng | vừa |
| 9.4 Route + Home | vừa (tách ~630 dòng `page.tsx`) |
| 9.5 Bản đồ chương | vừa |
| 9.6 Màn Talent | nhỏ–vừa |
| 9.7 Shop + Booster | vừa |
| 9.8 Hoàn thiện | nhỏ |

## 8. Quyết Định Cần Chốt
1. ~~**Nhánh `keyRate`**~~ — **Đã chốt**: đổi thành `bonusHearts` (+1 ❤️ màn Boss tại Lv 5/10/14), config `heartLevels`.
2. **Giá Shop** (đã giảm ~½ sau khi đo thu nhập vàng): Búa 75, Diệt 2 = 100, Diệt 4 = 150, Bình máu 120, Rune of Passage 120. Bot nhặt ~420–510 vàng mỗi chương 1–2, ~2500 ở chương 5–7, ~4000 ở chương 8–10 — chỉnh trong `shopPrices`.
3. **Cuộn phép nhặt trong trận**: đang cộng vào kho vĩnh viễn (theo đề xuất, chưa chốt).
4. **Đặt lại Talent**: đang làm **miễn phí** (theo đề xuất) — chưa chốt, đổi sang tốn vàng nếu muốn.
5. **Âm thanh**: có làm trong đợt này không (cần nguồn âm thanh có giấy phép).
6. **Dropdown chọn màn trong trận**: bỏ hẳn khi đã có Bản đồ (đề xuất) hay giữ cho tiện test.

## 9. Checklist Nghiệm Thu Tổng
- [ ] Mở game vào Home; Tiếp tục đúng màn và đúng bàn cờ đang chơi dở.
- [ ] Bản đồ 10 chương hiển thị đúng khóa/đã qua/kỷ lục/Boss.
- [ ] Qua màn lần đầu nhận đúng ⭐ theo mốc; chơi lại không nhận ⭐.
- [ ] Nâng Talent trừ đúng ⭐ (Lv L tốn L⭐), max Lv 14, hiệu ứng thấy được trong trận.
- [ ] Shop mua đồ trừ đúng vàng; Búa, Cuộn phép, Bình máu dùng được trong trận.
- [ ] Save v1 cũ tự chuyển sang v2, không mất tiến trình.
- [ ] `npm test`, `npm run check:levels`, `npm run build` đều sạch; giao diện ổn ở 375px.

## Bổ sung sau 9.8 — Vàng đầu game

Bot đo được: các màn thường L1–16 gần như **0 vàng** (đích 16/32, mà vàng chỉ rơi từ ô ≥ 16), nên Shop xa tầm với.
`economyConfig.earlyGoldBoost` (`lib/economy.ts`, áp dụng sau talent): ở L1 ô ghép 4 rơi 5 vàng (35%), ô 8 rơi 12 vàng (50%), mọi luật vàng +35%; hiệu ứng giảm tuyến tính và hết sau L20.
Lượng vàng rơi mỗi màn đầu tăng từ ~6 lên ~50. `npm run sim` có thêm cột `gold` (vàng nhặt được trung bình mỗi lượt thắng).

## Bổ sung — Đợt chỉnh thiết kế (Undo, chìa khóa, tim, nam châm, giá tăng dần)

- **Undo**: 3 lần miễn phí mỗi màn (`FREE_UNDOS` trong `app/play/page.tsx`); hết thì mỗi lần Undo tiêu 1 **Amulet of Rewind** (`stash.undoCharm`, Shop 80). Undo không trả lại amulet. Tải lại trang thì mất lịch sử Undo (như trước).
- **Chìa khóa**: `requiredKeys` (1 ở mọi màn từ L31 và mọi màn boss) giờ khóa cửa (`doorLocked`, cửa hiện ổ khóa). Màn thường: chìa chỉ rơi khi còn thiếu (đang cầm + đang nằm trên sàn < cần), luật `economyConfig.keyDrop` (ô ≥ 8, 30%). Màn boss: không rơi chìa — boss chết cho 1 chìa (`bossRewards.bonusKeys`). Chìa nằm ở 8 ô quanh chỗ pháp sư dừng sẽ tự bay vào (khó dừng đúng ô khi trượt hết cỡ). Thanh túi đồ hiện `chìa/cần`.
- **Gai chỉ trừ tim**: mỗi gai trượt qua −1 ❤️ (giáp đỡ trước); hết tim mới thua. Tim dùng ở **mọi màn** (talent Stout Heart: "hearts per chamber"); Heart Potion dùng được ở mọi màn.
- **Shop**: mỗi lần mua một món, giá món đó **+15%** (cộng dồn, lưu ở `save.purchases`). Thêm 2 **relic vĩnh viễn** (`save.perks`, mua một lần): **Gilded Lodestone** 900 — hút vàng ở 8 ô quanh pháp sư sau mỗi nước; **Arcane Lodestone** 3500 — hút mọi vật phẩm (vàng, chìa, trang bị, sách — sách hút được vẫn bắn boss).
- **Đầu game dễ để làm quen**: L1–10 mỗi màn tối đa 1 chướng ngại; boss chương 1 chết sau 1 sách (L5) / 2 sách (L10) (`bossTomeHits.early`).
- Bot (không talent, 30 lượt/màn) sau thay đổi: L1–9 97–100%; 6×6 92% → 79% → 71%; 7×7 78% → 72% → 63% — khớp đường mục tiêu (6×6 85→70, 7×7 75→60).
