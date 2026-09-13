# PUBG Insight

基于 Next.js 16、React 19、TypeScript、Tailwind CSS 4 和 shadcn/ui 的 PUBG 官方战绩查询与比赛回放应用。

## 功能

- 按 Steam、Kakao、PlayStation、Xbox 平台查询玩家。
- 查看当前或指定赛季、指定模式的击杀、胜场、伤害、KDA 和趋势图。
- 查看最近比赛的地图、模式、排名、击杀和遥测可用性。
- 战绩查询与比赛回放分为两个模块：战绩页负责玩家/赛季/近期比赛，比赛页提供地图视图、时间轴、播放控制、参赛者状态和击杀标记。
- 延迟加载比赛参赛者、击杀时间线和压缩后的回放时间帧，并展示起始航线、玩家运动轨迹和动态圈层。
- 回放地图底图随项目部署，避免依赖运行时外部 CDN；资源来源和地图 ID 映射见 [`public/maps/README.md`](public/maps/README.md)。
- 使用 Cloudflare D1 保存规范化快照和缓存，不保存无限期原始遥测。

## 本地开发

```bash
pnpm install
pnpm db:migrate:local
pnpm dev:vinext
```

Worker preview（包含生产构建产物）使用：

```bash
pnpm preview:worker
```

本地 API Key 可以写入 `.dev.vars`：

```text
PUBG_API_KEY=your-pubg-api-key
```

`.dev.vars` 不应提交到 Git。Worker 部署环境使用 Secret，不通过客户端环境变量暴露。

## Cloudflare D1 与部署

当前 `wrangler.jsonc` 已声明 `DB` 绑定、`pubg` 数据库名以及 local/preview/production 环境。首次部署前，在已登录 Cloudflare 的终端执行：

```bash
pnpm wrangler login
pnpm wrangler d1 create pubg --location apac
pnpm wrangler secret put PUBG_API_KEY
pnpm wrangler types cloudflare-env.d.ts --env-interface CloudflareBindings --include-runtime=false
pnpm db:migrate:remote
pnpm deploy:vinext
```

生产环境已绑定现有的 `pubg` 数据库；如启用 preview 环境，请先创建 `pubg-preview` 数据库并将返回的 `database_id` 填入 preview 配置。远程迁移不会被部署脚本自动执行。

## API 路由

| 路由 | 用途 |
| --- | --- |
| `GET /api/health` | Worker、D1 和 Secret 配置状态 |
| `GET /api/seasons?platform=steam` | 赛季列表 |
| `GET /api/players?platform=steam&name=playerName` | 玩家与最近比赛 |
| `GET /api/players/:playerId/stats?platform=steam&season=current&gameMode=squad` | 赛季模式统计 |
| `GET /api/matches/:matchId?platform=steam` | 比赛详情与参赛者 |
| `GET /api/matches/:matchId/telemetry?platform=steam&playerId=...` | 遥测解析、回放时间帧、事件和轨迹 |

## 验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:worker
pnpm db:migrate:local
pnpm db:status
```

PUBG API 的真实 smoke test 需要先配置 `PUBG_API_KEY`；未配置时接口会返回明确的 `missing_api_key` 错误，不会把 Secret 放入 HTML 或客户端代码。
