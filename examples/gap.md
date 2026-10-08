# 自評與掃描

來源：example_host_a.json。不判關號，不計分。

answers_file：checkup_answers.json。自評開頭是「過」且 auto 是 fail，列高估。自評開頭是「沒過」且 auto 是 pass，列低估。兩邊同是過或同是沒過，列一致。其餘列無法比。

| 關 | 自評 | 掃描 auto | 一致／高估／低估／無法比 |
| --- | --- | --- | --- |
| 1 能跑工具 | pass 主程式在這台找得到 | pass | 一致 |
| 2 有邊界 | fail 自評認為邊界還沒好 | pass | 低估 |
| 3 有記憶 | pass 有記憶檔 | pass | 一致 |
| 4 有活路徑 | unknown 主路徑還沒對上 | unknown | 無法比 |
| 5 會驗證不吃自報 | unknown 還沒看到讀回 | unknown | 無法比 |
| 6 會派工給副腦 | pass 有把工作派出去 | unknown | 無法比 |
| 7 治理閘上線 | pass 有擋下的紀錄 | pass | 一致 |
| 8 會員／對外平台 | unknown 對外平台還沒做 | manual_only | 無法比 |
