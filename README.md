# Jasmine Tsai｜作品集

網站：https://jasmine.jas-soul.com
原始碼：https://github.com/jasmine-tsaiii/portfolio

純 HTML / CSS / JS，放在 GitHub Pages，DNS 由 Cloudflare 管理（jasmine → jasmine-tsaiii.github.io，灰色雲朵）。

```
index.html   所有文字、連結、服務方案（Cmd + F 搜尋文字就能找到）
style.css    顏色、字級、間距
main.js      動效：首頁柔光光塵、燒穿轉場、燈箱
assets/img   圖片
assets/video 短影音（720p 壓縮版，原檔在 桌面/剪片）
CNAME        綁定網域用，不要刪
```

---

## 怎麼修改

### 方式一：直接請 Claude 改（最簡單）

開新對話、工作資料夾設成 `profolio`，說要改什麼，最後說「確認後幫我推上線」。

### 方式二：在 GitHub 網頁上改文字

適合改錯字、改一句話：

1. 打開 https://github.com/jasmine-tsaiii/portfolio
2. 點 `index.html` → 右上角鉛筆 ✏️
3. `Cmd + F` 找到文字直接改
4. 最下面按 **Commit changes**，約一分鐘後網站更新

⚠️ 網頁上改過之後，下次在電腦上改之前先跑 `git pull`。

### 方式三：在電腦上自己改

**改之前**，先抓雲端最新版：

```bash
cd ~/profolio && git pull
```

**預覽**（看完按 `Ctrl + C` 關掉）：

```bash
cd ~/profolio && python3 -m http.server 8765
```

打開 http://127.0.0.1:8765 。直接雙擊 index.html 會看不到著色器效果，一定要用上面的方式開。

**推上線**：

```bash
cd ~/profolio && git add -A && git commit -m "寫這次改了什麼" && git push
```

- `git add -A`：把改過的檔案放進待存檔區
- `git commit`：拍一張快照（存檔點）
- `git push`：上傳到 GitHub，網站約一分鐘後更新

---

## 改壞了怎麼辦

看歷史紀錄：

```bash
cd ~/profolio && git log --oneline
```

取消最近一次推上去的修改（不會刪紀錄，是新增一筆「反向修改」，很安全）：

```bash
cd ~/profolio && git revert HEAD && git push
```

---

## 常見修改

**換個人照**：照片存成 `assets/img/portrait.jpg`

```bash
cd ~/profolio && sips -s format jpeg -Z 1600 你的照片.heic --out assets/img/portrait.jpg
```

裁切位置在 `index.html` 個人照那行的 `object-position:50% 72%`，數字越大越往下。

**換或新增短影音**：影片要先壓縮成 720p（原檔太大網頁跑不動），直接請 Claude 處理最快。

**HTTPS 憑證失效**：到 GitHub 儲存庫 Settings → Pages，把 Custom domain 清空存檔，再填回 `jasmine.jas-soul.com` 存檔，等幾分鐘就會重新核發。

---

## 檢查用參數

- `?slow=10`：所有轉場放慢 10 倍
- `?qa=900`：關掉進場動畫，方便整頁截圖
