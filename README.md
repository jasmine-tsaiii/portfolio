# Jasmine Tsai｜作品集

純 HTML / CSS / JS 網站，不需要安裝或打包，直接就能上線。

```
index.html   頁面內容（文案都在這裡改）
style.css    樣式
main.js      動效：首頁光影、燒穿轉場、點擊顯影、燈箱
assets/img   圖片
assets/video 短影音（720p 壓縮版，原檔在 桌面/剪片）
```

## 在本機預覽

WebGL 讀取圖片需要透過伺服器，**直接雙擊 index.html 會看不到著色器效果**。

```bash
cd ~/profolio && python3 -m http.server 8765
```

然後打開 http://127.0.0.1:8765

## 換個人照

照片放在 `assets/img/portrait.jpg`（目前是 IMG_8815 夕陽那張，1200×1600）。要換的話：

```bash
cd ~/profolio && sips -s format jpeg -Z 1600 你的照片.heic --out assets/img/portrait.jpg
```

裁切位置在 `index.html` 個人照那行的 `object-position:50% 72%`，數字越大越往下。

## 上線到 Cloudflare Pages（你的網域在 Cloudflare）

1. Cloudflare 後台 → Workers & Pages → Create → Pages → **Upload assets**
2. 把整個 `profolio` 資料夾拖進去，按 Deploy
3. 部署完成後 → Custom domains → 加上你的網域
4. 上線後，把 `index.html` 的 `og:image` 改成完整網址（例如 `https://你的網域/assets/img/case-threads.jpg`），分享到社群時預覽圖才會出現

## 檢查用參數

- `?slow=10`：所有轉場放慢 10 倍，方便檢查每一格畫面
- `?qa=900`：關掉進場動畫，方便整頁截圖
