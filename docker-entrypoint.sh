#!/bin/sh
set -e

# 容器启动时自动同步数据库表结构（prisma db push 只增列/建表，不动存量数据）
# config.json 由 /setup 初始化向导生成；未初始化时跳过迁移直接启动
if [ -f /app/data/config.json ]; then
  export DATABASE_URL=$(node -e '
    const c = require("/app/data/config.json");
    if (c.databaseType === "sqlite") {
      console.log("file:/app/data/" + (c.database.filename || "clash.db"));
    } else {
      const d = c.database;
      console.log(`mysql://${d.username}:${encodeURIComponent(d.password || "")}@${d.host}:${d.port}/${d.database}`);
    }
  ')
  npx prisma db push --skip-generate
fi

exec node server.js
