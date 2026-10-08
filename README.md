## 給群組幫忙測的人

這是測試版，工具會誤判；誤判清單在 `MISJUDGMENTS.md`，請幫忙抓新的問題。先確認電腦有 Node，在這包的資料夾跑 `node aiwff_checkup.js --report`。回報時貼產生的白話報告，貼之前刪掉埠號、檔名、自己的自答原文，以及看起來私人的內容；不要貼原始 json log。

# aiwff-checkup

這個工具會誤判。誤判清單在 MISJUDGMENTS.md。這一版的自動判定還沒完成校準，每一位的結果都由人再看。

離線電腦健檢工具。

免費健檢 5 位的報名、同意與交付流程見 [FREE_CHECKUP_5.md](FREE_CHECKUP_5.md)。公開材料只取本目錄。開發目錄不一起發布。公開每位結果只用經本人確認及人刪稿的白話報告，不公開原始 json。

給主人：這包用來檢查一台電腦上的工具、規則、記憶與對外埠。電腦已經有 Node 就好，不裝套件，也不上傳。跑完會寫出一份 json；加上 `--report` 還會寫一份給人讀的 Markdown 報告。你可以把 json 交給你的 AI，也可以先讀報告。

八關名稱：1 能跑工具、2 有邊界、3 有記憶、4 有活路徑、5 會驗證不吃自報、6 會派工給副腦、7 治理閘上線、8 會員／對外平台。

每關一句：

1. 看主程式在不在這台。
2. 看有沒有規則，對外埠是不是關的。
3. 看有沒有記下來的檔。
4. 看最近有沒有自己在跑。
5. 做完要拿結果來核對。
6. 看會不會把工作派出去。
7. 看有沒有擋下來的紀錄。
8. 會員和對外平台要人來答。

`pass` 是過，`fail` 是沒過。`unknown` 與 `manual_only` 不是過。第 2 關的網路細節交給你的 AI。細則在 `LOG_TO_PLAN.md`。

設定會依序從 `CLAUDE_CONFIG_DIR`、掃描目錄內的 `.claude`、掃描目錄內的 `.claude_home`、使用者家目錄的 `.claude` 選一個可用目錄讀取。技能、設定與 agents 都只讀選中的那一個。`CLAUDE_CONFIG_DIR` 與家目錄設定是 `machine`（這台電腦共用），掃描目錄底下的是 `root`；log 的相關計數會分開列出兩個 scope，不會寫設定路徑。

結果怎麼看：看 `first_auto_gap`，那是第一個沒過的關，先修這個；沒有任何一關沒過時，它是空的。`unknown` 是工具看不出來，問你的 AI，並看你自己填的那句。`manual_only` 是這關只能人答，工具不會自己判。

## 兩種跑法

腳本檔名是 `aiwff_checkup.js`。它會讀選中的工具設定目錄、PATH，以及目前在聽的埠。唯一留下的檔是 LOG，使用 `--report` 時另有報告。寫入時先寫同名 `.tmp`，再改成 LOG。

(a) 把 `aiwff_checkup.js` 和 `gap.js` 一起複製到要檢查的資料夾，在那個資料夾執行：

```text
node aiwff_checkup.js
```

LOG 寫在同一個資料夾，檔名 `aiwff_checkup_log.json`。想同時產生給人看的報告，就加 `--report`。

(b) 人留在腳本所在的資料夾，指定別的目錄：

```text
node aiwff_checkup.js --root <要檢查的目錄> --report
```

沒有 `--out` 時，LOG 與報告寫在你執行命令時所在的目錄，不會寫進 `--root`。要指定輸出位置，加 `--out <目錄>`：

```text
node aiwff_checkup.js --root <要檢查的目錄> --out <輸出目錄> --report
```

測試空資料夾、或只想看單一專案時，加上 `--no-machine`。它只看 `--root`，不讀 `CLAUDE_CONFIG_DIR` 或使用者家目錄的設定：

```text
node aiwff_checkup.js --root <要檢查的目錄> --no-machine --report
```

空目錄 `fixture_blank` 用來試「還沒有自答檔」的跑法，把 `--root` 指到它即可。這個空資料夾在同一包裡，不用自己建。八關結果跟著這台電腦變，不要把某一次的終端稿當成規格。

打錯或漏填 --root 的目錄會顯示 ROOT_NOT_FOUND 並停止，不產生結果。加上 --no-machine 時，第 1 關的理由表示沒有查電腦上的 AI 程式。

## 終端五行

依序是：完成一句、LOG 檔名、sha256、位元組數、八關自動判讀。只印檔名，不印完整路徑。

## log 會留下什麼

log 會留下 `host_id`、CPU 數、記憶體、作業系統、Node 版、埠號、規則檔名的最後一段、自答原文與設定來源類別。它也會分開記錄計入的規則檔數與日期備份數。整段路徑或句中路徑只留檔名，目錄也只留最後一段。句中路徑的最後一段無副檔名、或空白後接 CJK 時，會在該空白停下。IPv4、IPv6、`file://`、以及 `sk-`、`ghp_`、`xox`、bot 加數字、`AKIA`、私鑰開頭會改成 `<redacted>`。不套稱呼表，不改主機別名。

## 給人看的報告

加 `--report` 時，LOG 旁會多出 `aiwff_checkup_report.md`。它固定有四段：你目前走到第幾關、八關白話表、第一個缺口與一件最小下一步、以及這份報告看不到的事情。表中的「（來自這台電腦的共用設定）」表示該關有採到 `machine` 範圍；要隔離它就用 `--no-machine`。報告會顯示你的自答。自答可能留下識別線索。對外使用前，必須由人刪稿並交本人確認。

## 自評檔要先放好

掃描會把自評烤進 log。要比差距，就在掃描之前放好。

檔名：`<要檢查的目錄>/checkup_answers.json`。要用別的路徑就加 `--answers <檔>`。

鍵名：`"1"` 到 `"8"`，或 `"gate1"` 到 `"gate8"`。

每一關的值：`pass`、`fail` 或 `unknown`，後面空一格，再一句理由。最長 600 字。

```json
{
  "1": "pass 主程式在這台找得到",
  "2": "fail 還有對外埠",
  "3": "unknown 還沒點過記憶目錄",
  "4": "pass 有一支會自己跑的排程",
  "5": "fail 沒有讀回",
  "6": "unknown 有目錄但沒看到結果",
  "7": "pass 有擋下的紀錄",
  "8": "unknown 對外平台還沒做"
}
```

沒有這份檔時，log 的 `answers_file` 是 null，八關 `self_answer` 都是 `not_answered`，第 8 關 `auto` 固定 `manual_only`。自答不會改變自動判定。它會顯示在「你的自答」欄，供人對照第 4～6 關的實際情況。做法：複製 `checkup_answers.example.json` 成 `checkup_answers.json`，改成你的情況，再跑 `node aiwff_checkup.js --answers checkup_answers.json --report`。

## 怎麼看差距

差距腳本是這包裡的 `gap.js`。`gap.md` 寫在 log 所在目錄。它只讀這份 log，不改 log，不計分，也不寫卡在第幾關。範例是 `examples\gap.md`，由 `examples\example_host_a.json` 產生。那份 log 的八關 auto 是 pass、unknown 或 manual_only。高估要 auto 是 fail，所以那張表的第四欄是一致、低估、無法比。四種結果各有一句，在 `examples\gap_four.md`。那四句用來對照下面的規則。

這兩份 example json 的自答是短句。`host_class_a`、`scan_root_a` 是類別詞。埠陣列裡的號碼是數字，對齊這支腳本寫出的型別。引擎名 `程式代理`、`其他模型`、`本機模型` 是類別詞。腳本寫進 log 的引擎名是 codex、gemini、ollama、aider、cursor。規則檔名是 `CLAUDE.md`、`AGENTS.md`、`GEMINI.md`、`SOUL.md`、`.cursorrules`，或檔名以 SOUL 開頭、以 .md 結尾。公開範例把規則檔數、deny、hook 事件收成同一組。

(a) 目標資料夾裡同時有 `gap.js` 和 log 時，在那個資料夾執行：

```text
node gap.js aiwff_checkup_log.json
```

(b) 人留在腳本所在的資料夾。log 在掃描時的 `--out`，否則在執行命令時所在的目錄。下面兩條都可以：

```text
node gap.js --root <log 所在目錄>
```

```text
node gap.js <log 的路徑>
```

明確路徑先照工作目錄找，找不到再照 `gap.js` 所在目錄找。`--root` 只讀該目錄裡的 `aiwff_checkup_log.json`。

表有八列。第四欄只有：一致、高估、低估、無法比。這四種都由下面這一條規則產生。

自評開頭是 `pass` 或「過」，或是 `fail`、`沒過`、`未過`，而且掃描 auto 是 pass 或 fail，才比得起來。兩邊同方向是一致。開頭是過、auto 是 fail，是高估。開頭是沒過、auto 是 pass，是低估。高估和低估都是比得出來的結果。

這個詞後面必須是結尾、空白，或 `。．.！!，,、：:`。`通過`、`沒通過`、`過了` 不會被當成過或沒過，那一列是無法比。

`answers_file` 是 null，八列都寫無法比。自評是一段說明、`not_answered`、整段被遮罩，或 auto 是 `unknown`、`manual_only`，這一列也是無法比。開頭是 `unknown`、`不確定` 或 `不知道`，而且後面是結尾、空白，或 `。．.！!，,、：:`，這一列也是無法比。

## 給 AI

請用上面兩種跑法的其中一種。然後只讀 LOG。先看 `checkup_version`、`gates` 八筆和 `first_auto_gap`。下一步看同目錄的 `LOG_TO_PLAN.md`。不要改腳本，不要把設定檔內文抄出來。

## 校準與誤判

定案逐列在 `CALIBRATION.md`。誤判、讀法、無誤判和出處待補在 `MISJUDGMENTS.md`。隊長確認了主腦起草的判定。兩份都不寫彙總比例，也不改腳本的判定。表內工具版本混用，不能讀成這個目錄裡的 v1.2.2 已經校準。

## 授權

`aiwff-checkup` 以 MIT 授權釋出；完整條文見 [LICENSE](LICENSE)。
