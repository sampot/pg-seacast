# 港邊釣夢（`pg-seacast`）— 遊戲規劃文檔

> **用途：** 本 repo 的遊戲權威規格——coding agent 改動前必讀：這個遊戲是什麼、規則、設計限制、優化方向。
> **整理方式：** 從本 repo 實作反向整理（2026-08-23）。**改玩法先改此檔再改碼**；本檔與程式碼衝突時，以「規則（§3）」描述的設計意圖為準回報差異。
> **上游契約：** [PG-GAME-AGENT-GUIDE.md](https://github.com/sampot/playgrounds/blob/main/docs/PG-GAME-AGENT-GUIDE.md)（唯一必讀；本檔不重複其全文）· 型錄條目 `playgrounds/catalog/entries/pg-seacast.yaml`

## 1. 一句話

十天的釣季海釣養成：在三個漁場看天候換餌升裝備，拋竿後按住收線把張力控制在甜區，集齊六種魚完成圖鑑即通關。

## 2. 定案速覽

| 項 | 值 |
| --- | --- |
| catalog id / kind / series | `pg-seacast` / `game` / `懷舊` |
| status | `unlisted`（待上架驗收） |
| 模式 | 單人單季制（**10 天**上限）；hub 整備＋釣點即時搏魚雙畫面（canvas 390×320） |
| 圖鑑 | **6 魚種 × 3 漁場**（各 2 種）；集滿即勝；天數耗盡或體力歸零即敗 |
| 天候 | 晴／雨／風，由 seed＋日數決定性產生，影響咬餌與張力係數 |
| 裝備 | 釣竿／魚線各 3 級（6/14 與 5/12 金幣）；三種餌（0/4/7 金幣） |
| 素材 | Kenney Fish Pack 2.0 PNG＋Kenney CC0 音效＋Not Jam BGM |
| 交付形 | 純 HTML＋CSS＋ESM JS（game/ 模組化）；無 build；`npx vitest run` 測試 |

## 3. 完整規則（現行實作）

### 3.1 季節與資源

- 開局第 1 天、金幣 **10**、體力 **100**。拋竿一次扣體力 **12**；斷線額外扣 **18**；過夜回復 **28**（上限 100）。天數用盡仍休息 →「季節結束」敗北。
- 天候由 `weatherForDay(seed, day)` 雜湊決定：晴（咬餌 ×1／張力 ×1）、雨（×0.72／×0.82——難咬但線軟）、風（×0.88／×1.28——更常咬也更易斷）。同 seed 同日必同天候。

### 3.2 漁場與魚種表

| 漁場 | 魚種 | rarity | 價 | fight | bite | 體重 kg |
| --- | --- | --- | --- | --- | --- | --- |
| 防波堤 | 竹筴魚 | 1 | 4 | 0.32 | 0.62 | 0.2–0.6 |
| 防波堤 | 鯖魚 | 2 | 7 | 0.48 | 0.42 | 0.5–1.2 |
| 紅樹林 | 彈塗魚 | 1 | 5 | 0.36 | 0.58 | 0.1–0.35 |
| 紅樹林 | 烏魚 | 2 | 9 | 0.54 | 0.38 | 0.8–2.1 |
| 外海礁 | 石斑 | 2 | 14 | 0.68 | 0.30 | 1.5–4.2 |
| 外海礁 | 旗魚 | 3 | 28 | 0.86 | 0.16 | 5–16 |

- 中魚池抽樣：權重＝`bite × weather.biteMod × (1+bait.biteBonus) ÷ rarity` 正規化後輪盤抽取——稀有度直接壓低出線率。
- 餌：沙蚕免費／小蝦 +0.14（4 幣）／擬餌 +0.24（7 幣），買斷切換不消耗庫存。

### 3.3 搏魚迴圈（session 狀態機）

- 階段流 idle→dropping（深度 95/s 到 100）→waiting→fighting→landed/failed。waiting 每 dt 以 `0.55 × biteMod × (1+餌加成)` 機率咬鉤，超過 **4.5 秒**未咬收竿（不另扣體力）。
- fighting 參數：按住收線時張力 +(魚掙扎 ? 1.35 : 0.42)×dt×28×張力係數、距離 −(掙扎 ? 8 : 22)/s；放開時張力 −0.95×dt×24、距離 +fight×16/s。張力落在甜區內且收線再加收 4/s。
- **甜區**＝中心 `52−竿級×2`、寬 `16+線級×2`，乘天候張力係數後夾限——升竿讓甜區下移、升線讓它變寬。**斷線閾**＝clamp(78+線級×7, 84, 98)；張力觸頂即斷（扣 18 體力）；距離回到 100 即脫鉤（不扣體力）；距離歸零起魚入護。
- 入護結算：體重於區間均勻隨機；圖鑑記 count 與 bestWeight；金幣入帳。**第 6 種魚入袋瞬間即勝**（海洋館策展結局），不必撐完十天。

### 3.4 邊界處理

- 體力 <12 不能拋竿；斷線後體力 ≤0 直接敗北（體力耗盡結局）；dt 夾限 0.12s、rAF 幀夾 0.05s，切頁暫停並重置收線輸入。
- 全部規則為純函式回傳新 state（immutable spread）；非法漁場/餌 id 擲錯、金幣不足回訊息不動狀態。

## 4. 操作與畫面

| 輸入 | 動作 |
| --- | --- |
| 漁場列／餌列／升級鈕 | hub 整備（金幣不足擋下並提示） |
| 出發釣魚 | 切到釣點畫面 |
| 拋竿（鈕或 Space） | 扣體力開始下沉 |
| 收線鈕按住（或 Space 按住） | fighting 期間收線；放開洩壓 |
| 休息一晚 | 體力回復、推進天數換天候 |
| 音效鈕 | 開/關 |

- HUD 八格：天數、天候、金幣、體力、圖鑑 x/6、竿/線等級、當前餌。釣點畫面有張力條（甜區綠帶即時重算）＋階段標籤（待機/下沉/等咬/搏魚/入護/收竿）；canvas 繪漸層海水、沙底、海草與上鉤魚 sprite。
- 結局面板分「圖鑑完成！」與「本季結束」。toast 3.2s；離開分頁 suspend 音效與模擬。Mobile-first 直向單欄；禁原生對話框。

## 5. 持久化（KV 權威）

| key | 內容 | 讀寫時機 |
| --- | --- | --- |
| `/api/kv/seacast:save` | 遊戲 state 全量 JSON（seed/day/weather/equipment/dex/catches/session…） | 休息過夜與結局落定時 PUT；boot 讀取，`outcome==="playing"` 才續關 |
| `/api/kv/seacast:best` | 歷史最佳圖鑑數（純數字字串） | 每次 persist 時取 max 後 PUT（未進步不寫） |

- 存檔 schema：state 即存檔（無版本號欄位——改 state 形狀須自驗相容）；dex 為 `{魚id: {count, bestWeight}}`，catches 逐尾記錄魚id/重量/金幣/日/場。
- 同步失敗靜默降級（靜態直開可玩）；注意**同一天內的進度只在過夜或結局時落盤**，中途關頁會回到上次過夜狀態。
- 無自訂 functions.js；boot 等 `window.PG.ready` 後才讀 KV。

## 6. 美術／音效／署名

- 使用中素材：`assets/art/*.png` 10 張（Kenney Fish Pack 2.0，CC0——魚/海草/沙地）；`assets/sfx/{click,bite,splash,catch,snap}.ogg`（Kenney UI Audio＋Impact Sounds，CC0）；`assets/music/bgm.ogg`（Not Jam「ChillMenu」，授權依 itch 頁附檔）。詳 `ATTRIBUTION.md` 與 `assets/licenses/`。
- **異常（已確認）**：manifest 內的 `assets/images/{fish3,hero,rival}.png`、根層 `click/error/music/win.ogg`、`scene.png`、`audio/` 六支舊音效與 `blippy-bits/kenney-toon` 授權檔皆未被程式引用（原型殘留）；且 `bite.ogg` 未列在 ATTRIBUTION 的 Kenney 明細（僅 splash/catch/snap）——清理與補署名時須同步 manifest。
- 新增素材一律拷進 `assets/`、更新 `ATTRIBUTION.md`（CC0 也署名）、同步 `sam-manifest.json`。

## 7. 測試（`npx vitest run`，單檔 `game/rules.test.js`）

現有覆蓋：開局結構（10 天/裝備初始值/空圖鑑）；天候同 seed 決定性且逐日不同；六魚對應三場完整性；漁場選擇與非法索引擲錯；竿/線升級扣款與餘額不足拒絕；換餌扣款；體力不足不能拋竿、拋竿扣體力入 dropping；下沉到底轉 waiting；咬中轉 fighting 帶魚；控張力收線可入護（圖鑑 +1、金幣增加）；張力超限斷線事件與扣 18 體力；集滿圖鑑即 won；最後一天休息即 lost；過夜回體力換天候；回 hub 清 session；甜區寬度與斷線閾隨裝備提升；summarize HUD 欄位；random01 決定性；持久化（loadProgress 解析 save+best、離線/壞 JSON 回退 null/0、saveProgress PUT 路徑、saveBest 只在進步時寫）。

UI/canvas 不在測試範圍。缺口：waiting 4.5s 逾時 miss 分支、脫鉤（distance≥100）分支、雨/風係數對甜區的實際位移未直測——調整搏魚參數前先補。

## 8. 硬約束（不可違反）

1. 僅 HTML＋CSS＋JS（ESM）；**無 build**、不入庫 `node_modules`、不安套件；工具一律 `npx <pkg>` 臨時執行。
2. 禁瀏覽器原生 `alert`／`confirm`／`prompt`；提示一律 message 區與 toast。
3. Mobile-first；主操作（收線）為 pointer 按住，不可 hover-only。
4. 進度以 `/api/kv/seacast:save`、`seacast:best` 為唯一權威；禁止裸 localStorage 當權威；KV 不可用時可玩但不假裝已存。
5. 不自行載入 `sdk.js`；宿主注入 `window.PG`（standalone 直開也要能玩）。
6. 改動可執行邏輯前先寫失敗測試（TDD）。
7. 檔案清單變動須同步 `sam-manifest.json`（下載契約）。
8. 隨機一律走 seed 雜湊（`random01(seed, salt)`）或注入的 random 函式：天候與魚種分布不得引入裸 `Math.random` 於規則層（搏魚手感可用注入 random 保持可測）。

## 9. 優化建議（可玩性與樂趣）

依優先級；實作前先在此登記並補測試。原則：強化搏魚手感與收集誘因，不改變「看天選場×張力收線」的核心認同。

**高優先**

1. **圖鑑獎勵縱深**：目前集滿即結束、單尾只有金幣。加入每魚「最大重量紀錄」挑戰（dex 已記 bestWeight）與全圖鑑後的金牌章（如旗魚 ≥12kg 特殊稱號），讓通關後仍有追分目標；做法：end 畫面依 dex 資料運算即可，零新 schema。
2. **天候策略提示**：雨/風係數存在但玩家看不見影響。在 hub 顯示一行「今日建議」（如雨天宜軟線慢收、外海礁風大慎行），把隱藏數值變成決策素材；純文案映射 WEATHER_KINDS。
3. **每日誘因**：加「今日熱門魚」（seed 決定一種魚 bite ×1.5），讓天天打開有不同目標；在 pickFish 權重乘一項即可，補一條測試。

**中優先**

4. **魚種擴充與深度分層**：6 種偏少且一場兩種缺乏場內驚喜。每場加 1 種低機率隱藏魚（如防波堤夜間大頭鰱），並讓部分魚限定特定天候（雨天彈塗魚 +50%）——沿用權重表即可擴充。
5. **連續起魚 combo**：同一拋竿日連續起魚給小額加成（第二尾 +10% 金幣），鼓勵把握好天候衝量；需在 state 加日內連殺計數。
6. **裝備第三軸**：只有竿/線兩級略單薄。加「浮標」升級縮短 waiting 逾時或提高 base 0.55 咬率，讓 10 天經濟有更多取捨；UPGRADE_COST 加一列即可。

**低優先**

7. **清理殘留資產**：刪除未引用 images/root ogg/scene.png/audio 舊檔與 toon 授權檔，補 bite.ogg 署名，同步 manifest——縮短下載契約。
8. **音效鈕持久化**：靜音偏好重載即忘；比照其他作品存偏好 key。
