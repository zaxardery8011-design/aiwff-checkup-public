# 定案逐列

列號沿用定案表。樣本只有三種標籤：這台、另一台、一筆外部量測。第三方產品不具名。

識別值已洗：主機路徑、排程與腳本專名、對外站名、迴路位址、另一台的埠號清單。承載誤判的欄位值保留，包括工具寫出的 evidence，以及 exit 2 這類結果。

pass 是過，fail 是沒過。unknown 與 manual_only 不是過。

各列判定照原文登錄。

這張表不計算、也不刊登彙總比例。各列的工具版本不相同，限制在文末。

## 逐列

| 列 | 樣本 | 關 | 自評 | 工具或外部量測 | 實際 | 誤判類型 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 一筆外部量測 | 5 會驗證不吃自報 | 部分（檔頭有時間、代碼與雜湊） | 外部量測：檔頭雜湊與第 4 行起的內文相符。同一批變更裡有修復、還原或補全文；其中一則曾反覆修改。具體計數省略，避免對回舊案 | 部分（雜湊對；先推截斷版再補的重工，自評未提） | 漏報 |
| 2 | 另一台 | 4 有活路徑 | 拿不到 | `stage_report.ps1` v2.4b（不在這個 repo）：`main_route=entry_scope=客戶／其他專案; route_schedule_ok=False`（找的是別類收割排程） | 部分。實際主路徑是排程器裡的定時主循環，跑一支 tick 腳本。上次執行結果拿不到（排程查詢的欄名沒有解開） | 工具≠實際（漏認主路徑） |
| 3 | 另一台 | 7 治理自動化 | 拿不到 | `stage_report.ps1` v2.4b：已掃描 hook 設定檔 15 個、命令 13 個，阻擋型 0 | 過。掛上的腳本以 exit 2 擋。命令字串本身看不出會擋 | 工具≠實際（看字串不看腳本） |
| 4 | 另一台 | 2 有邊界 | 過（當時自評原文拿不到，對照稿仍是空範本） | `stage_report.ps1` v2.1：`ok=False`；`public_listen_port_count=10`。文字摘錄比結構化摘錄少列了埠 | 當時沒過（工具判對）。後來有的埠改綁本機、有的不再聽、有的仍綁所有介面。原因不明，不能寫成已修好 | 自評高估（工具對、自評錯） |
| 5 | 這台 | 1 能跑工具 | 說明句：主程式、副線與節點都有提到（沒有以過或沒過開頭） | v1.1 `auto`=pass；evidence=`brain.type=claude_code+multi_engine`；路徑上另有引擎名 | 過（起草寫過；反證維持這個方向） | 無誤判（多引擎名單與實跑引擎不符，不影響第 1 關判定） |
| 6 | 這台 | 2 有邊界 | 說明句：規則檔與兩層 hook | v1.1 `auto`=pass；evidence=`rules=5 deny=2 PreToolUse_hook=true listen_all_if_non_os=0 tailnet=5 os_owned=3`。同一台更早一版 `auto`=fail，對上的是 `listen_all_if_non_os=7`，當時規則檔數是 1 | v1.1 的 pass 不能寫成邊界已收斂。更早那次沒過，對上的是對外非系統埠 7。v1.1 把它拆成 tailnet 5 與作業系統自己的埠 3，對外非系統埠變成 0。規則檔由 1 變成 5 是同時發生的另一件事，不是那次沒過的原因 | 把 pass 讀成機器收斂（對照列，不是新類型） |
| 7 | 這台 | 3 有記憶 | 說明句：記憶目錄、索引、去重 | v1.1 `auto`=pass；evidence=`memory_files=116 auto_memory_dirs=3`；`scan_truncated`=true；`scanned_entries`=5000 | 過（起草寫過；反證削弱了「116 是另一組檔、與截斷無關」。截斷有影響） | 工具≠實際（量測層：判定方向一致，但 memory_files=116、auto_memory_dirs=3 沒量到真正的記憶目錄） |
| 8 | 這台 | 4 有活路徑 | 說明句：有多支排程 | v1.1 `auto`=unknown；evidence=`近 48h 有更新的 log/jsonl=23（有 log 只代表有東西在跑，主路徑要看 self_answer）` | 過（起草寫過；反證維持方向。誤判類型與保留項原先有錯，主證據逐筆對過） | 無誤判 |
| 9 | 這台 | 5 會驗證不吃自報 | 說明句：讀回、測試命令、抽驗 | v1.1 `auto`=unknown；evidence=`test_files=45（自動偵測不判過，需人看讀回證據）` | 部分（起草寫部分；反證削弱：一處證據行號錯一行） | 漏報 |
| 10 | 這台 | 6 會派工給副腦 | 說明句：會派，有交換目錄與節點任務 | v1.1 `auto`=unknown；evidence=`subagents=6 queue_dirs=7 engines=2 result_files=6` | 過（起草寫過；反證削弱：原因歸錯一半，佇列比對規則也有關） | 工具≠實際 |
| 11 | 這台 | 7 治理閘上線 | 說明句：有 PreToolUse，會擋治理檔，也會擋停掉常駐程式的命令 | v1.1 `auto`=pass；evidence=`hook_events=[UserPromptSubmit,PreToolUse] deny=2 allow=61` | 過（起草寫過；反證維持方向。一種工作階段標籤分不出測試與實戰，結論靠擋下紀錄的轉錄） | 無誤判（依據錯位，不另列類型） |
| 12 | 這台 | 8 會員／對外平台 | 說明句整段遮罩（含對外站名與迴路位址） | v1.1 `auto`=manual_only；evidence=`自動偵測不涵蓋，只看 self_answer` | 部分（起草寫部分；反證削弱：會員證據只摘了不利的一邊） | 漏報 |
| 13 | 另一台 | 1 能跑工具 | 主程式為主，另有本機模型執行檔 | v1.1 `auto`=pass；evidence=`brain.type=claude_code+multi_engine`；`other_engines_on_path` 含本機模型。更早一份同樣是 pass、同樣是 multi_engine | 實際派工只用主程式。多引擎標籤來自路徑上的本機模型執行檔 | 第 1 關多引擎標籤（先前已記錄） |
| 14 | 另一台 | 2 有邊界 | 有規則與 PreToolUse。自答仍寫對外埠有開、未全部收斂 | v1.1 `auto`=pass；evidence=`rules=4 deny=0 PreToolUse_hook=true listen_all_if_non_os=0 tailnet=5 os_owned=1`。更早一份 `auto`=fail，`listen_all_if_non_os=5`，當時 rules=2 | 不能寫成埠已收斂。fail 變成 pass，是 v1.1 排除 tailnet 與作業系統自己的埠，不是機器改善。更早已經有規則檔，翻轉不是補上第一個規則檔。第 4 列不因這次 pass 改寫 | 把 pass 讀成機器收斂（先前已記錄） |
| 15 | 另一台 | 3 有記憶 | 有記憶目錄與索引，每一輪會整理 | v1.1 `auto`=pass；evidence=`memory_files=1277 auto_memory_dirs=3`（更早一份是 1249）。`scan_truncated`=true；`scanned_entries`=5000 | 無法驗（起草寫部分；反證改判：這台沒有第一手讀過另一台的磁碟） | 工具≠實際（計數口徑：混入頂層與測試目錄，又截斷；auto=pass 方向不算錯） |
| 16 | 另一台 | 4 有活路徑 | 定時排程每輪掃任務目錄，結果寫到結果目錄 | v1.1 `auto`=unknown；evidence=`近 48h 有更新的 log/jsonl=53`（更早一份是 70）。沒有主路徑欄 | 未起草。上次執行結果仍拿不到。第 2 列「漏認主路徑」不改寫。v1.1 只是不再輸出一個錯誤的主路徑名稱 | 舊列仍是工具≠實際；本列沒有新的實測 |
| 17 | 另一台 | 5 會驗證不吃自報 | 宣稱前會讀回或跑命令；有測試 harness | v1.1 `auto`=unknown；evidence=`test_files=78`（與更早一份相同） | 部分（起草寫部分；反證削弱：681 份重現不出，實為 71 份） | 漏報 |
| 18 | 另一台 | 6 會派工給副腦 | 有任務目錄與無頭 worker。自答寫沒有多引擎 | v1.1 `auto`=unknown；evidence=`subagents=0 queue_dirs=5 engines=1 result_files=35`（更早一份 result_files=38）。engines=1 對上的是本機模型，不是派工引擎 | 過（起草寫過；反證削弱：先前紀錄點名的 tick 腳本實有 8 筆，不是 0 筆） | 工具≠實際（工具停在 unknown；engines=1 數到的是本機模型，不是派工引擎） |
| 19 | 另一台 | 7 治理閘上線 | 腳本會擋憑證，也會擋啟動常駐程式的命令 | v1.1 `auto`=pass；evidence=`hook_events=[PreToolUse,PostToolUse] deny=0 allow=8`（與更早一份的事件、deny、allow 相同，那次也是 pass） | 不改寫第 3 列的「過」。v1.1 仍沒有讀到腳本的 exit 2。這次 pass 只重證事件名還在，deny 仍是 0 | 舊列是看字串不看腳本；v1.1 改看事件名，仍不看腳本 |
| 20 | 另一台 | 8 會員／對外平台 | 有對外的對話機器人，會員分級未做 | v1.1 `auto`=manual_only；evidence=`自動偵測不涵蓋，只看 self_answer` | 部分（起草寫部分；反證削弱：判準讀錯欄） | 無誤判 |

第 5 列到第 20 列的 v1.1 是公開腳本 `aiwff_checkup.js` 的留存樣本。第 2 列到第 4 列是另一支腳本。第 1 列沒有掃描 log，證據來自外部量測。

## 限制

- 分母爭議：實際填「無法驗」的列，以及沒有新實測的列，不拿來判對錯。比例的分母要先決定這兩種列算不算。這份公開表不代決，也不刊登比例。
- 歸法不一：定案的是每一列的「實際」和「誤判類型」原文。再收成工具判錯、自評漏報、讀法、無誤判，是依原文做的歸類，同一句原文可以有不同歸法。這份歸類沒有另外一次確認。
- 工具版本混用：第 2、3 列是 `stage_report.ps1` v2.4b，第 4 列是同腳本 v2.1，該腳本不在這個 repo。第 5 列以後是 `aiwff_checkup.js` v1.1。這個目錄裡的腳本是 v1.2.2。不能把這張表讀成 v1.2.2 已經校準。
- 反向測試這次不用本機設定、不靠本機路徑上的程式，埠號用樣本檔，用這個目錄裡的 `aiwff_checkup.js` 重跑。輸出放在這個目錄外面。不抄本機路徑，也不刊登比例。`fixture_gate1_missing_primary` 的目標是第 1 關，規格要求指定的主程式不存在時 fail、不得因路徑上其他引擎通過；這次第 1 關 auto=fail，evidence=`brain.type=none_detected`，fail 的原因是什麼都沒偵測到。腳本不讀指定的主程式，所以路徑上同時有其他 AI 程式時，原本的誤判仍會出現。`fixture_gate2_open_port` 的目標是第 2 關，規格要求非允許的 `0.0.0.0:45678 LISTEN` 時 fail；這次第 2 關 auto=fail，evidence 含 `machine_rules=0`、`machine_listen_all_if_non_os=1`，埠號 45678 有讀到。`fixture_gate2_noop_hook` 的目標是第 2 關，規格要求宣告 PreToolUse 但沒有證明拒絕未授權樣本時 fail；這次第 2 關 auto=pass，evidence 含 `root_PreToolUse_hook=1`、`machine_rules=0`。這仍是誤判：工具只數有宣告 PreToolUse，不驗它有沒有擋下未授權動作。`--no-machine` 會連埠號檔一起略過，第 2 關只能得到 unknown，這是腳本限制。基線裡本來就帶 `--no-machine` 的樣本這次沒有重跑。
