# TASTO 图片后台（通俗版）

这套后台已经和 TASTO 前端接通。你可以把它理解成：

```text
你在后台上传图片并选择菜单目录
              ↓
只读图片接口自动提供“已发布”的图片
              ↓
TASTO 前端刷新后，在对应菜单里显示图片
```

本地地址：

- 图片管理后台：<http://localhost:8055>
- 前端图片接口：<http://localhost:8060/catalog>
- 本地 TASTO 网页：<http://localhost:3000>

## 你在 Docker Desktop 里会看到什么

Docker Desktop 的 **Containers** 页面会显示一行 `tasto-media`。它是一个应用分组，不是只有一个容器：

1. 点击 `tasto-media` 左边的小箭头展开。
2. 里面应该有 `database`、`directus`、`media-api` 三项。
3. 三项都是绿色或显示 `Running`，就表示后台正常。
4. `directus` 的 8055 端口是管理后台；`media-api` 的 8060 端口是前端读取图片的接口。

蓝色方块是停止按钮。平时不需要点击右侧红色垃圾桶；删除容器或 Volume 前要先备份，否则可能丢失后台数据和图片。

登录 Docker Personal 账号不是必须步骤，但不会影响这套本地后台。Docker Desktop 负责在你的电脑上运行容器；Docker 账号本身不会把后台自动变成公网网站。

## 平时怎么管理图片

1. 打开 <http://localhost:8055>，用 `backend/.env` 里的管理员邮箱和密码登录。
2. 左边进入 **TASTO 图片 / TASTO Images**。
3. 新建或编辑一条图片，填写：
   - **Status**：选 `Published / 前端显示` 才会出现在网页；选 `Draft` 就先不显示。
   - **Menu Path**：必选，决定图片属于 TASTO 左侧哪个菜单，例如 `Minimal & Modern / SWISS STYLE`。
   - **Title**：前端卡片显示的标题。
   - **Alt Text**：图片说明，可以不填。
   - **Image**：上传或选择图片。
4. 点击保存，然后刷新 TASTO 前端。接口有 30 秒缓存，极少数情况下最多等约 30 秒再刷新。

删除图片前，建议先把状态改成 `Draft`，确认前端不再显示后再删除。

后台的 **文件 / Files** 页面中，现有图片已经按以下方式分好文件夹：

```text
TASTO Website
├── 01 Minimal & Modern · 现代极简
│   ├── SWISS STYLE
│   ├── WARM MINIMALISM
│   └── ...
├── 02 Graphic & Experimental · 图形与实验
└── ...
```

每条图片记录还必须选择 `Menu Path`。文件夹方便人查看；`Menu Path` 才是前端实际使用的目录关系。

## 第一次安装或在新电脑恢复

需要 Docker Desktop 和 Node.js 18 或更新版本。

```bash
cd backend
cp .env.example .env
```

先修改 `.env` 中的密码和管理员账号，然后执行：

```bash
docker compose up -d database directus
docker compose ps
node scripts/sync-catalog.mjs
docker compose exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v gateway_password="$GATEWAY_DB_PASSWORD"' < database/gateway.sql
docker compose up -d --build media-api
```

`sync-catalog.mjs` 会创建 TASTO 图片表、菜单下拉选项、文件夹，并把当前前端的 38 张图片导入后台。重复运行不会重复导入同一个菜单的图片。

以后启动和停止：

```bash
docker compose up -d
docker compose down
```

不要执行 `docker compose down -v`，因为 `-v` 会连数据库和已上传图片一起删除。

## 前后端是怎么连接的

- 后台管理系统是 Directus，负责登录、上传、修改和分类。
- `media-api` 只读取状态为 `Published` 的图片，不拥有修改或删除权限。
- TASTO 前端读取 `/catalog`，并根据每条记录的 `menu_path` 放到对应菜单。
- 图片由 `/images/<图片ID>` 提供，并自动缩放成适合网页的 WebP、AVIF 或 JPEG。
- 如果本地后台暂时没有启动，前端会退回项目内原有图片，网页不会整个坏掉。

这种连接方式不会把管理员密码或后台令牌写进网页，相比直接开放整个图片库更安全。

## 正式网站使用 Vercel 原生后台

正式的 `tasto.world` 不运行这组 Docker 容器。线上改用 Neon PostgreSQL、Vercel Blob、Vercel Functions 和自定义 `/admin` 页面；本地 Docker 继续作为开发和备份环境。

线上部署和操作说明见项目根目录的 `VERCEL_ADMIN.md`。

如果要新增一个目前菜单里不存在的全新风格，先在 `index.html` 增加该菜单和风格定义，再运行：

```bash
node backend/scripts/sync-catalog.mjs
```

## 备份

数据库和图片必须一起备份。数据库示例：

```bash
cd backend
mkdir -p backups
docker compose exec -T database pg_dump -U directus directus > backups/directus.sql
```

图片保存在 Docker 的 `directus_uploads` 卷。正式上线时更推荐使用支持版本控制的 S3、Cloudflare R2 或阿里云 OSS。
