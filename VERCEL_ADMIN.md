# TASTO 的 Vercel 图片后台

线上版本不运行 Docker。它使用：

- `https://www.tasto.world/admin`：图片管理页面
- Vercel Functions：登录、图片记录和公开目录接口
- Neon PostgreSQL：保存标题、状态、排序和 TASTO 菜单目录
- Vercel Blob：保存真正的图片文件

本地 `backend/` 中的 Directus + Docker 可以继续作为开发和备份环境，两套数据不会自动混用。

## Vercel 项目需要的环境变量

- `DATABASE_URL`：连接 Neon PostgreSQL 后自动提供
- `BLOB_READ_WRITE_TOKEN`：连接 Vercel Blob 后自动提供
- `TASTO_ADMIN_PASSWORD`：后台登录密码，至少 12 个字符
- `TASTO_SESSION_SECRET`：登录签名密钥，至少 32 个随机字符

不要把这些值写进 Git、`index.html` 或聊天记录。

## 第一次上线顺序

1. 登录真正拥有 `tasto.world` 的 Vercel 账号。
2. 把当前文件夹关联到已有的 TASTO 项目。
3. 在该项目的 Storage 中创建 Neon PostgreSQL 和 Vercel Blob。
4. 添加两个管理员环境变量。
5. 拉取环境变量并迁移现有 38 张图片：

```bash
vercel env pull .env.local
node scripts/migrate-vercel-media.mjs
```

6. 部署到 Production，并检查 `/admin`、`/api/catalog` 和网站菜单。

## 平时怎么用

1. 打开 `https://www.tasto.world/admin`。
2. 输入管理员密码。
3. 上传图片并选择对应的 TASTO 菜单目录。
4. 状态选“前端显示”后保存；最多约 30 秒同步到前端。
5. 选“草稿”或“已归档”时，图片不会出现在前端。

上传支持 JPG、PNG、WebP、AVIF 和 GIF，单张图片不超过 4 MB。
