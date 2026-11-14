# Kế Hoạch 7: Hoàn Thiện Giao Diện HUD, Selector 5 Chapters & Đóng Gói Tối Ưu

← Quay lại: [Kế hoạch 6: Cửa Chạy & Mọc Đá](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/06_shifting_exit_and_step_hazard.md) | Tiếp theo: [Kế hoạch 8: Nâng Cấp EXP Roguelite](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/08_roguelite_exp_and_talent_tree.md) | [Về Mục lục kế hoạch](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/README.md)

---

## 1. Mục Tiêu
Hoàn thiện toàn bộ diện mạo UI/UX của game ở mức độ thương mại cao (Polished Casual Mobile Game):
1. **Dropdown Selector Nhóm Theo 5 Chapters**: Quản lý gọn gàng 50 level với `<optgroup>`, hiển thị huy hiệu Boss, Target và kích thước bàn cờ.
2. **Thanh Trạng Thái Đầy Đủ (Comprehensive HUD)**:
   - TARGET | BOSS HP & POWER | KEYS | STEP/LIMIT | GOLD.
3. **Hiệu Ứng Hình Ảnh Đỉnh Cao (Visual & Audio Polish)**:
   - Hiệu ứng rào năng lượng tường 1 chiều.
   - Hiệu ứng nổ tung và rơi quà khi chém Boss.
   - Hiệu ứng hào quang vàng khi nhặt chìa khóa.
4. **Kiểm Thử & Đóng Gói (Production Build Verification)**:
   - Đảm bảo build sạch 100%, không lỗi TypeScript hay Tailwind CSS.
   - Chuẩn bị sẵn sàng cho việc đóng gói Capacitor lên Android / iOS.

## 2. Thiết Kế Dropdown 5 Chapters
Thay vì một danh sách 50 dòng cuộn dài, cấu trúc thành các nhóm chương:
```tsx
<select
  className="level-select-native"
  value={levelIndex}
  onChange={(e) => chooseLevel(Number(e.target.value))}
>
  <optgroup label="📜 Chapter 1: The Catacombs (Lv 1 - 10)">
    {levels.slice(0, 10).map((lvl, idx) => (
      <option key={lvl.id} value={idx}>
        {lvl.name}: Target {lvl.target} ({lvl.size}x{lvl.size}) {lvl.hasBoss ? '👑 BOSS' : ''}
      </option>
    ))}
  </optgroup>
  <optgroup label="⛏️ Chapter 2: The Forgotten Mines (Lv 11 - 20)">
    ...
  </optgroup>
  <optgroup label="🏺 Chapter 3: The Ancient Labyrinth (Lv 21 - 30)">
    ...
  </optgroup>
  <optgroup label="🔮 Chapter 4: The Shifting Vault (Lv 31 - 40)">
    ...
  </optgroup>
  <optgroup label="🌌 Chapter 5: The Abyssal Apex (Lv 41 - 50)">
    ...
  </optgroup>
</select>
```

## 3. Nâng Cấp Thanh Trạng Thái (Game HUD)
Bảng thông số phía trên bàn cờ được tối ưu hiển thị thành 2 hàng tinh tế trên di động:
- **Hàng 1 - Mục Tiêu & Công Thức Cổng (Portal Recipe)**:
  - Nếu là màn thường ($2^n$ thuần): `[ 🎯 TARGET: {target} ➔ 🚪 ]`
  - Nếu là màn dung hợp ($A + B = \text{Target}$): Hiển thị công thức trực quan phản ứng theo thời gian thực:
    - Chưa có đủ: `[ 64 ] + [ 16 ] ➔ 🚪 ({target})` (màu mờ nhẹ).
    - Đã có ô 64: `[ ✅ 64 ] + [ 16 ] ➔ 🚪 ({target})` (ô 64 sáng xanh).
    - Có cả 64 và 16 trên bàn cờ: `[ ✨ 64 ] + [ ✨ 16 ] ➔ 🚪 (FUSION READY!)` (nhấp nháy neon, báo hiệu sẵn sàng vuốt gộp).
    - Đã gộp thành công: `[ 🚪 PORTAL OPENED! ]` (chuyển sang trạng thái hướng dẫn vào cửa).
  - `[🔑 KEYS: {collectedKeys}/{level.requiredKeys}]`
  - `[🪙 GOLD: {economy.gold}]`
- **Hàng 2**:
  - Nếu có Boss: `[⚔️ Power: {playerPower} / ❤️ Boss: {bossHp}]`
  - Nếu có Step Limit: `[👣 Moves: {moves}/{level.stepLimit}]`

## 4. Modal Chiến Thắng / Thất Bại Tương Ứng
- **Chiến Thắng Level Thường**: Thông báo mở cửa thành công + Nút "Next Level →".
- **Chiến Thắng Level Boss**: Hiệu ứng cúp vàng + Thống kê chiến lợi phẩm nhặt được (Vàng, Búa, Chìa khóa).
- **Chiến Thắng Level 50 (Final Escape)**: Màn hình danh hiệu "GRAND ESCAPE CHAMPION - MASTER OF 50 CHAMBERS!" kèm nút Replay từ đầu.
- **Thất Bại**: Nêu rõ nguyên nhân thua cuộc (Bị Boss bắt, hoặc Kẹt hết nước đi) + Nút "Thử Lại Ngay".

## 5. Các Tệp Cần Chỉnh Sửa
- [MODIFY] `app/page.tsx`:
  - Hoàn thiện render thanh HUD đa thông số.
  - Render thẻ dropdown nhóm `<optgroup>`.
  - Nâng cấp modal kết quả có thống kê thưởng.
- [MODIFY] `app/globals.css`:
  - Hoàn thiện toàn bộ stylesheet, đảm bảo không có layout shift hay vỡ giao diện trên bất kỳ dòng iPhone / Android nào.

## 6. Checklist Nghiệm Thu
- [ ] Dropdown chọn 50 màn hiển thị theo 5 Chapter rõ ràng, có nhãn Boss ở các màn tương ứng.
- [ ] Thanh HUD hiển thị sắc nét, không bị tràn hay đè chữ trên màn hình điện thoại 375px.
- [ ] Màn hình thắng/thua hiển thị đúng ngữ cảnh (kẹt nước đi, bị Boss hạ, qua màn thành công).
- [ ] Lệnh `npm run build` chạy qua mượt mà 0 lỗi.
- [ ] Commit & push toàn bộ 7 kế hoạch và mã nguồn hoàn thiện lên GitHub.
