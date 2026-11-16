# Lộ Trình Triển Khai Game 100 Level - Escape Room Merge Puzzle

Hệ thống kế hoạch được phân rã thành 8 giai đoạn độc lập, có tính kế thừa và liên kết chặt chẽ. Mỗi giai đoạn có mục tiêu, thiết kế kỹ thuật, mã nguồn dự kiến và checklist nghiệm thu riêng biệt.

---

## Danh Sách 8 Giai Đoạn

1. **[Giai đoạn 1: Hệ Thống Cấu Hình Cân Bằng Game Tập Trung (game_config.json)](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/01_game_config_system.md)**
   - *Mục tiêu*: Tách biệt toàn bộ dữ liệu 100 level (10 Chapters), công thức mở cổng `targetFormula` (`[A, B]` dung hợp mở Cổng), bảng drop rate vàng, key, trang bị, giá shop và cấu hình Talent Tree vào một file JSON duy nhất để dễ tinh chỉnh (live-tuning).
2. **[Giai đoạn 2: Tường Ngăn Cản 1 Chiều, Đá Khắc Số, Dung Hợp Mở Cổng & Cải Tiến Logic Trượt Lưới](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/02_directional_walls_logic.md)**
   - *Mục tiêu*: Thêm tường cản 1 chiều (quy ước tối đa 1 đá = 3 tường khi 0 đá); cơ chế phá khối Đá Khắc Số khi đâm ô cùng giá trị; dung hợp cộng hưởng cặp ô `[64] + [16]` mở Cổng Thoát Hiểm.
3. **[Giai đoạn 3: Bàn Cờ 2 Lớp, Bẫy Gai & Quà Tặng Nền Sàn (Floor Gifts & Spike Traps)](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/03_two_layer_grid_and_floor_gifts.md)**
   - *Mục tiêu*: Xây dựng lớp sàn cố định (Floor Layer) chứa quà và Bẫy Gai chết người; tile số trượt đè lên không mất quà; nhân vật sượt qua quà thì nhặt, bước vào bẫy gai thì thua ngay.
4. **[Giai đoạn 4: Đấu Boss, Thú Đi Tuần & Hệ Thống Trang Bị RPG (Beasts, Boss & Equipment)](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/04_boss_combat_and_rpg_equipment.md)**
   - *Mục tiêu*: Boss mốc level 10 và +5; Thú săn mồi đi tuần di chuyển ngẫu nhiên mỗi lượt; gom trang bị tính Power; giao chiến tính Power vs HP quái/boss.
5. **[Giai đoạn 5: Nền Kinh Tế Vàng, Kho Đồ & Cuộn Phép Giải Cứu (Shop, Boosters & Purge Scrolls)](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/05_economy_shop_and_boosters.md)**
   - *Mục tiêu*: Quản lý ví vàng tích lũy qua `localStorage`; Modal Shop mua Búa phá đá (150🪙); thanh Booster trong trận tích hợp Búa và Cuộn Phép Hủy Diệt toàn bộ tile số 2 / số 4 (nhặt từ sàn khi merge $\ge 128$) để giải phóng bàn cờ khẩn cấp.
6. **[Giai đoạn 6: Thử Thách Cửa Chạy & Mọc Đá Khi Vượt Bước (Shifting Exit & Step Hazard)](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/06_shifting_exit_and_step_hazard.md)**
   - *Mục tiêu*: Cửa thoát hiểm di chuyển theo mỗi lượt vuốt từ Lv 61+; cảnh báo sập hầm mọc thêm đá sau khi vượt giới hạn bước đi (`stepLimit`).
7. **[Giai đoạn 7: Hoàn Thiện Giao Diện HUD, Selector 10 Chapters & Đóng Gói Tối Ưu](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/07_ui_hud_chapter_selector_and_polish.md)**
   - *Mục tiêu*: Dropdown gom nhóm 10 Chapter `<optgroup>`; thanh HUD hiển thị Power, HP boss, Keys, Moves/Limit, Gold; hiệu ứng vách tường, VFX chém boss, kiểm thử build hoàn chỉnh.
8. **[Giai đoạn 8: Tiến Trình Roguelite - Điểm Kỹ Năng Sao & Nâng Cấp Thuộc Tính (Stars & Talent Tree)](file:///Users/mac/Documents/Code-projects/merge-to-escape/docs/plans/08_roguelite_exp_and_talent_tree.md)**
   - *Mục tiêu*: Vượt màn mới nhận Sao tăng dần theo mốc (Lv 1-10: 1⭐; Lv 11-20: 2⭐;... Lv 91-100: 10⭐, chơi lại chỉ nhận Vàng); dùng Sao nâng cấp 4 chỉ số (Max Lv 15); chi phí nâng Lv L tốn đúng L Sao; giao diện Modal Talent lưu `localStorage`.
9. **[Giai đoạn 9: Màn Hình Chính & Nâng Cấp Ngoài Trận (Main Menu & Meta Progression)](09_main_menu_and_meta_progression.md)**
   - *Mục tiêu*: Home, Bản đồ 10 chương, Talent Tree bằng ⭐ (lần đầu qua màn) và Shop bằng 🪙; save v2 tự chuyển đổi từ v1. Thay phần triển khai của KH 5 & 8 cho khớp luật chơi hiện tại.

---

## Trạng Thái Thực Hiện
*(cập nhật theo commit `e1f6c89`, nhánh `feat/fantasy-rpg-overhaul`)*
- [x] Giai đoạn 1: Xong — config 100 màn; target tối đa 512 (+128) và bàn 4/5/6/7 theo 20/20/30/30 (khác bản gốc, xem ghi chú trong KH 1)
- [x] Giai đoạn 2: Xong — tường 1 chiều, đá khắc số, dung hợp mở cổng
- [x] Giai đoạn 3: Xong — quà nền sàn, bẫy gai; nhân vật trượt hết đường (ghi chú KH 3 §4.3)
- [~] Giai đoạn 4: Boss xong theo luật mới (Boss di chuyển, Fire Tome, ❤️ — ghi chú KH 4 §5b); **thú đi tuần chưa làm**
- [~] Giai đoạn 5: Vàng lưu vĩnh viễn; **Shop, Búa, dùng Cuộn phép chưa làm** ➔ chuyển sang KH 9.7
- [ ] Giai đoạn 6: Chưa bắt đầu (cửa chạy, `stepLimit`)
- [~] Giai đoạn 7: HUD fantasy, hiệu ứng, bảng Boss, chọn màn theo chương (Bản đồ — KH 9.5) xong
- [ ] Giai đoạn 8: Chưa bắt đầu ➔ triển khai theo KH 9.1–9.3, 9.6
- [~] Giai đoạn 9: 9.1 (save v2 + ⭐), 9.2 (logic talent), 9.3 (áp talent vào trận), 9.4 (Home + route /play), 9.5 (Bản đồ chương) xong; 9.6–9.8 chưa làm
