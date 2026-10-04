# Particle Lab

互動式粒子演算法實驗室，以 Three.js 即時呈現群體行為與最佳化搜尋。你可以切換演算法、調整參數，並即時觀察粒子的運動與效能指標。

**線上展示：**[Particle Lab on GitHub Pages](https://skywalker0803r.github.io/particle-lab/)

## 功能

- **Boids 群集行為**：透過分離（Separation）、對齊（Alignment）與凝聚（Cohesion）規則，呈現粒子如何形成群集。
- **粒子群最佳化（PSO）**：粒子以個體最佳位置及群體最佳位置為依據，搜尋目標函數 `f(x, y) = x² + y²` 的最小值。
- **Particle Life 粒子生命**：四種粒子依物種間的吸引與排斥規則互動，形成持續變化的群落與圖樣；可調整互動半徑、作用力、速度阻尼及核心排斥。
- **Vicsek 群集模型**：粒子跟隨鄰近方向並受隨機角度雜訊擾動，呈現系統如何從無序轉為集體同步。
- **擴散限制聚集（DLA）**：隨機漫步粒子碰觸既有團簇後附著，逐步形成樹枝狀分形結構。
- **即時控制**：調整演算法參數、粒子數量（500–100,000；預設 10,000），或暫停及重設模擬。
- **效能監測**：顯示目前 FPS；PSO 模式也會顯示目前找到的最佳適應值。
- **響應式介面**：支援桌面與行動裝置版面。

## 使用技術

- [Three.js](https://threejs.org/)：WebGL 粒子渲染
- [TypeScript](https://www.typescriptlang.org/) 與 [Vite](https://vite.dev/)：型別安全的開發及靜態網站建置
- [Tweakpane](https://tweakpane.github.io/docs/)：即時演算法參數控制
- [Stats.js](https://github.com/mrdoob/stats.js/)：FPS 效能監測
- GitHub Actions 與 GitHub Pages：自動建置及部署

Boids、Particle Life 與 Vicsek 使用空間網格索引查找附近粒子，避免每個粒子都與整個群體逐一比對。這些群集模型採週期性邊界；DLA 則在中心周圍累積粒子。實際 FPS 會依粒子數量、瀏覽器及裝置效能而異。

## 本機開發

### 需求

- Node.js **20.19+** 或 **22.12+**
- npm（隨 Node.js 提供）
- 支援 WebGL 的現代瀏覽器

### 安裝與啟動

```sh
npm ci
npm run dev
```

Vite 會在終端機顯示本機網址，通常為 <http://localhost:5173/>。

## 指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動本機開發伺服器 |
| `npm run build` | 執行 TypeScript 型別檢查並建置正式版至 `dist/` |
| `npm run preview` | 在本機預覽 `dist/` 中的正式版網站 |

## 專案結構

```text
.
├── .github/workflows/deploy.yml   # GitHub Pages 自動部署
├── index.html                     # 頁面結構與控制介面
├── src/
│   ├── algorithms/
│   │   ├── BaseAlgorithm.ts       # 粒子資料與演算法基底
│   │   ├── BoidsAlgorithm.ts      # Boids 群集行為
│   │   ├── DiffusionLimitedAggregation.ts
│   │   ├── ParticleLifeAlgorithm.ts
│   │   ├── ParticleSwarmOptimization.ts
│   │   └── VicsekAlgorithm.ts
│   ├── ParticleRenderer.ts        # Three.js 粒子渲染
│   ├── main.ts                    # 介面、控制與動畫迴圈
│   └── style.css                  # 響應式樣式
├── package.json
└── vite.config.ts
```

## 部署至 GitHub Pages

此 repository 已設定 GitHub Actions 部署工作流程：

1. 確認 repository 的 **Settings → Pages → Build and deployment → Source** 設為 **GitHub Actions**。
2. 將變更推送至 `main` 分支，或在 Actions 頁面手動執行 **Deploy to GitHub Pages**。
3. 等待工作流程完成；網站網址為 <https://skywalker0803r.github.io/particle-lab/>。

工作流程先使用 `actions/configure-pages` 檢查 Pages 網站設定，再使用 `npm ci` 安裝鎖定版本的相依套件、執行 `npm run build`，最後將 `dist/` 發佈至 GitHub Pages。首次部署前須由 repository 管理者完成上述 Pages 設定；工作流程的預設 `GITHUB_TOKEN` 無法自動啟用 Pages。

## 疑難排解

- **無法啟動模擬或畫面沒有粒子：**確認瀏覽器及裝置支援 WebGL，並更新顯示卡驅動程式或嘗試其他現代瀏覽器。
- **動畫不流暢：**先降低粒子數量；100,000 粒子所需效能依裝置而異。
- **部署未觸發：**確認變更已推送至 `main`，且 Pages 的部署來源為 **GitHub Actions**。
- **部署失敗並顯示 `404 Not Found` 或 `Ensure GitHub Pages has been enabled`：**在 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions** 並儲存，待設定生效後重新執行 **Deploy to GitHub Pages**。僅重新建置網站無法修復尚未啟用 Pages 的設定問題。
