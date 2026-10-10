# 給 AI 代理：怎麼跑 aiwff-checkup

這份健檢是參與者電腦上的指令，不是網頁裡的掃描。唯一手順在首頁的 for-ai 區塊。README「複製給你的 AI」的指令正文與此相同。兩處不一致時，以首頁 `#for-ai` 為準。

## 先讀
- https://zaxardery8011-design.github.io/aiwff-checkup-public/#for-ai
- https://zaxardery8011-design.github.io/aiwff-checkup-public/README.md

檔案在倉庫根目錄的 `index.html`（`#for-ai`）與 `README.md`。

## 請遵守
- 人同意之前不要執行命令。沒有同意就停，也不要輸出回報塊。
- 這台還沒有健檢這包時，先問人要放在哪個資料夾（不能放進要被掃的資料夾），同意後才 `git clone` 或下載 main.zip。
- 先問兩件事：要掃哪個資料夾；要不要讀這台共用設定。資料夾必須是人平常跟 AI 工作的資料夾，不是健檢這包自己的資料夾。
- 同意之後才依人講的實際情況代寫八關自評。不確定寫 unknown。不要猜成 pass。
- 命令、自評檔路徑、六欄填法，只照 `#for-ai` 裡的那一段。不要另組一條比較短的命令。
- 跑完先看 log 的 checkup_version、gates 八筆、first_auto_gap。answers_file 是 null 就不要輸出回報塊。
- 最後只輸出那六列，不要加欄，不要寫別的。不要貼報告全文，不要貼 json。
- 回報塊不要出現路徑、埠號、名字、帳號、客戶或專案名、主機名，也不要出現 host_id、root_scanned、answers_file、evidence、自答理由。
- 不要改腳本。不要把設定檔內文抄出來。
- 同意被記錄填否時，叫人改走私訊，不要把回報塊貼進群組。

## 不要用的跑法
- 不要省略 `--root`。省略時掃到的是健檢這包自己的資料夾，包內測試檔會算進第 5 關。
- 不要使用 README 的跑法 (a)（把腳本抄進被掃的資料夾後不帶 `--root` 執行）。
