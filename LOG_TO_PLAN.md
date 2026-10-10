# LOG → 下一步

讀 `aiwff_checkup_log.json`。這份 LOG 沒有「你在第幾關」的標題可以當結論。八關只看 `gates` 每一筆的 `auto`。`pass` 是過，`fail` 是沒過。第一個 `fail` 就是卡點，關號在 `first_auto_gap`。沒有 `fail` 時，`first_auto_gap` 是 null。加 `--report` 會在同一輸出目錄寫白話報告。報告的「第一個缺口」與 `first_auto_gap` 相同，只指第一個 `fail`；沒有 `fail` 時那一節不寫關號。報告的「走到第幾關」是第一個非 `pass` 的前一關，`unknown` 與 `manual_only` 也會讓它停住，不替代 `first_auto_gap`。

v1.2.2 起，`root` 是 `--root` 底下的資料，`machine` 是 `CLAUDE_CONFIG_DIR` 或使用者家目錄的共用設定。相關計數會以 `root`／`machine` 各帶 `scope` 與 `count` 的形式列出；第 2、3、6、7 關 evidence 也各自列兩個範圍。加 `--no-machine` 可只看 `--root`，不讀環境變數或家目錄設定。

`unknown` 不是過，要同時看該關的 `self_answer`。`manual_only` 沒有自動結論。`self_answer` 為 `not_answered` 就是沒有自答。本頁不計分。

埠號在 `ports.all_interfaces_ports`、`ports.tailnet_ports`、`ports.os_owned_ports`，是數字。這三個陣列最多各 30 筆。`all_interfaces_non_os`、`tailnet_only`、`os_owned_count` 是截斷前的個數。第 2 關 evidence 的 `os_owned` 用 `os_owned_count`。規則檔名在 `memory_rules.rules_files`，只有檔名。

第 2 關就算 pass，22／445／3389 仍可能在聽；tailnet 上的固定埠表號碼仍會出現在 log。

| 關 | 看哪裡 | 怎麼判 | 下一步 |
| --- | --- | --- | --- |
| 1 能跑工具 | `brain_type.type`、第 1 關 `auto` | `none_detected` 是 fail，其餘是 pass。PATH 上還有 codex、gemini、ollama、aider、cursor 的任一個，而且主程式也在時，type 會帶 multi_engine。第 6 關的 engines 也把這些名字算進去。本機模型執行檔和派工引擎沒有拆開 | 先不要安裝、不要改檔。請只檢查這台有沒有已裝好的本機AI程式，不是只開網頁聊天。沒有的話，列出不必付錢的做法給我看，我同意才安裝。不要上傳、不要對外傳訊。做完先停下來等我。 |
| 2 有邊界 | `memory_rules.rules_files`、`ports.all_interfaces_non_os`、第 2 關 evidence | 沒有規則檔是 fail。有規則檔但對外非系統埠大於 0 也是 fail。有規則、有 deny 或 PreToolUse、埠查得到、而且對外非系統埠是 0，才是 pass。有規則、埠查得到、對外非系統埠是 0、同時沒有 deny 也沒有 PreToolUse，是 unknown。埠查不到是 unknown。loopback 與 tailnet 先記入。固定埠表（含 22／445／3389，其餘是 135、139、5040、5357、7680、49664 到 49670、631、5000、7000）只丟掉這兩類以外的列。`tailnet_ports` 可以出現表內號碼。`all_interfaces_ports` 與 `os_owned_ports` 不會出現表內號碼。沒出現不代表沒在聽。三個埠陣列最多各 30 筆。evidence 的 os_owned 是截斷前的個數 | 先不要改檔、不要關任何連線。若最外層沒有CLAUDE.md或AGENTS.md，就起草一份，寫一條：沒我同意不准刪檔、付錢、傳訊、上傳。並只用白話列出對外面開放連線的程式名。先給我看，我點頭才存，不要自己去關。 |
| 3 有記憶 | `memory_rules.memory_file_count`、`project_memory_dirs`、`memory_count_basis` | 大於 0 是 pass，否則 fail。同檔 `scan_truncated` 為 true 時，這個數字可能只是下限，pass 不代表記憶已經點完。`memory_count_basis` 會列出計入的目錄類別、`.md`／`.json` 副檔名與去重規則 | 先不要改檔。請在我平常工作的資料夾裡，找到或新建名字剛好是memory的資料夾，在它最外層放一份副檔名是md的記事，只寫我今天決定的一件事，不要再放進下一層。草稿先給我看，我同意才存。不要刪、不要上傳、不要傳訊。 |
| 4 有活路徑 | 第4關 evidence 的 runner 與近期同名產出計數 | 有runner且近48小時同stem非空log/jsonl為pass；只有近期對應空產出為fail；其餘unknown。out/err/stdout/stderr尾綴不影響配對。 | 先不要改檔、不要設定自動排程。請起草一支很小的程式，先給我看，我同意才存並實際執行。讓程式自己產生同名、非空的log或jsonl紀錄；不可起草或手寫一份紀錄來湊。不要刪、不要上傳、不要傳訊。只寫說明、沒有同名紀錄，不算完成。 |
| 5 會驗證不吃自報 | 第5關 evidence 的測試、結果、CI與提交計數 | 有測試檔，且近14天非空測試結果、非空CI設定或指定目錄自己的近期測試提交任一成立為pass；CI與提交只是代理證據，不代表全綠。有測試檔且只有近期空結果為fail；其餘unknown。 | 先不要改檔、不要上傳。請起草一個檔名含.test.的小檢查，先給我看，我同意才跑。跑完把成功或失敗存成不是空白的test-results.txt，再給我看過才存。不要刪、不要傳訊。 |
| 6 會派工給副腦 | 第6關 evidence 的請求與配對回件計數 | 具名第二引擎佇列有請求，同一bus有近14天同ID的非空_reply或_result為pass；只有配對近期空回件為fail；其餘unknown。安裝引擎或空佇列不算pass。 | 先勿改檔、傳訊、上傳。請先提出一件給另一個AI的小工作，我同意後才實際派出，不要自己代寫回覆。請求放to_後只接codex/grok/gemini/ollama/aider/cursor之一，檔用md。回覆放同組to_brain，名加_reply，近14天且勿空白；同一bus且請求ID要對上。先給我看，同意才存。沒有就停，勿做假檔。 |
| 7 治理閘上線 | 第 7 關 evidence 的 hook 與 deny | 有 PreToolUse 或 deny 大於 0 是 pass，否則 fail | 需要人陪：工具只數設定裡有沒有攔截名稱或拒絕條目，不試它真的擋不擋。叫 AI 補上名稱就能變過，所以不寫可貼的那段。 |
| 8 會員／對外平台 | 第 8 關 `self_answer`（`auto` 固定 `manual_only`） | 自動偵測不判 | 請先問我用了哪些會對外的網站或帳號。每個只記名稱，以及誰負責看會員和公開範圍。不要登入、不要傳訊、不要上傳、不要付錢。清單先給我看，我同意才存。你不能把這關判成過。 |

`schema` 應為 `aiwff_checkup_log/v1`。`checkup_version` 為 `1.3.0` 才是這支腳本寫的 LOG。第 3 關的 `memory_count_basis` 會列出計入的目錄類別、`.md`／`.json` 副檔名與去重規則。

八關白話、貼給AI的話與確認方式見 [NEXT_STEPS_FOR_AI.md](NEXT_STEPS_FOR_AI.md)。上表下一步與該表貼給AI欄相同；第7關需要人陪。第4～6關正反證並存以正證據為準；舊走訪scan_truncated=true時fail降為unknown。
