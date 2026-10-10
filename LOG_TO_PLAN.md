# LOG → 下一步

讀 `aiwff_checkup_log.json`。這份 LOG 沒有「你在第幾關」的標題可以當結論。八關只看 `gates` 每一筆的 `auto`。`pass` 是過，`fail` 是沒過。第一個 `fail` 就是卡點，關號在 `first_auto_gap`。沒有 `fail` 時，`first_auto_gap` 是 null。加 `--report` 會在同一輸出目錄寫白話報告。報告的「第一個缺口」與 `first_auto_gap` 相同，只指第一個 `fail`；沒有 `fail` 時那一節不寫關號。報告的「走到第幾關」是第一個非 `pass` 的前一關，`unknown` 與 `manual_only` 也會讓它停住，不替代 `first_auto_gap`。

v1.2.2 起，`root` 是 `--root` 底下的資料，`machine` 是 `CLAUDE_CONFIG_DIR` 或使用者家目錄的共用設定。相關計數會以 `root`／`machine` 各帶 `scope` 與 `count` 的形式列出；第 2、3、6、7 關 evidence 也各自列兩個範圍。加 `--no-machine` 可只看 `--root`，不讀環境變數或家目錄設定。

`unknown` 不是過，要同時看該關的 `self_answer`。`manual_only` 沒有自動結論。`self_answer` 為 `not_answered` 就是沒有自答。本頁不計分。

埠號在 `ports.all_interfaces_ports`、`ports.tailnet_ports`、`ports.os_owned_ports`，是數字。這三個陣列最多各 30 筆。`all_interfaces_non_os`、`tailnet_only`、`os_owned_count` 是截斷前的個數。第 2 關 evidence 的 `os_owned` 用 `os_owned_count`。規則檔名在 `memory_rules.rules_files`，只有檔名。

第 2 關就算 pass，22／445／3389 仍可能在聽；tailnet 上的固定埠表號碼仍會出現在 log。

| 關 | 看哪裡 | 怎麼判 | 下一步 |
| --- | --- | --- | --- |
| 1 能跑工具 | `brain_type.type`、第 1 關 `auto` | `none_detected` 是 fail，其餘是 pass。PATH 上還有 codex、gemini、ollama、aider、cursor 的任一個，而且主程式也在時，type 會帶 multi_engine。第 6 關的 engines 也把這些名字算進去。本機模型執行檔和派工引擎沒有拆開 | 開啟終端機，輸入主程式的命令並確認能看到版本號 |
| 2 有邊界 | `memory_rules.rules_files`、`ports.all_interfaces_non_os`、第 2 關 evidence | 沒有規則檔是 fail。有規則檔但對外非系統埠大於 0 也是 fail。有規則、有 deny 或 PreToolUse、埠查得到、而且對外非系統埠是 0，才是 pass。有規則、埠查得到、對外非系統埠是 0、同時沒有 deny 也沒有 PreToolUse，是 unknown。埠查不到是 unknown。loopback 與 tailnet 先記入。固定埠表（含 22／445／3389，其餘是 135、139、5040、5357、7680、49664 到 49670、631、5000、7000）只丟掉這兩類以外的列。`tailnet_ports` 可以出現表內號碼。`all_interfaces_ports` 與 `os_owned_ports` 不會出現表內號碼。沒出現不代表沒在聽。三個埠陣列最多各 30 筆。evidence 的 os_owned 是截斷前的個數 | 打開規則檔，補上一條禁止高風險操作的規則，再確認對外非系統埠清單是空的 |
| 3 有記憶 | `memory_rules.memory_file_count`、`project_memory_dirs`、`memory_count_basis` | 大於 0 是 pass，否則 fail。同檔 `scan_truncated` 為 true 時，這個數字可能只是下限，pass 不代表記憶已經點完。`memory_count_basis` 會列出計入的目錄類別、`.md`／`.json` 副檔名與去重規則 | 打開一份記憶檔，新增今天的一條決定，存檔後重新跑健檢確認計數增加 |
| 4 有活路徑 | 第 4 關 evidence 的 48 小時 log 數、`self_answer` | 沒有近期 log 是 fail。有 log 只到 unknown。同檔 `scan_truncated` 為 true 時，這個 log 數可能只是下限 | 寫下一條每天會自己跑的流程，以及你怎麼確認它昨天真的跑了 |
| 5 會驗證不吃自報 | 第 5 關 evidence 的 test_files、`self_answer` | 沒有測試檔是 fail。有測試檔只到 unknown。工具會另外直接列出深度三層內名為 tests、test、__tests__、spec 的目錄，所以常見測試目錄不受總走訪 5000 筆截斷影響；若 `scan_truncated` 為 true，evidence 仍會明說其他位置的計數可能只是下限 | 跑一個測試或檢查命令，讀回終端輸出並寫下成功或失敗 |
| 6 會派工給副腦 | `dispatch` 的 subagent、queue、engine 數。evidence 的 result 只供對照 | subagent、queue、engine 三個都是 0 才是 fail。這三個有任一項不是 0 就是 unknown。`result_files` 不參與 auto。engines 用第 1 關那份 PATH 名單，本機模型執行檔也算進去。同檔 `scan_truncated` 為 true 時，queue 與 result 這兩個走訪計數可能只是下限；subagent 與 engines 同樣不在這次走訪裡，subagent 從固定目錄直接計數 | 派一件小工作給副腦，確認結果已寫進一個檔案 |
| 7 治理閘上線 | 第 7 關 evidence 的 hook 與 deny | 有 PreToolUse 或 deny 大於 0 是 pass，否則 fail | 打開設定，確認一條 PreToolUse 或 deny 規則能擋下一個操作 |
| 8 會員／對外平台 | 第 8 關 `self_answer`（`auto` 固定 `manual_only`） | 自動偵測不判 | 寫下你使用的每個對外平台，以及誰負責確認其會員與公開設定 |

`schema` 應為 `aiwff_checkup_log/v1`。`checkup_version` 為 `1.2.2` 才是這支腳本寫的 LOG。第 3 關的 `memory_count_basis` 會列出計入的目錄類別、`.md`／`.json` 副檔名與去重規則。
