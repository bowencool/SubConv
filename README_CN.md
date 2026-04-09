# SubConv — 订阅转换

[English](README.md) | 中文

![license](https://img.shields.io/github/license/bowencool/SubConv) ![last commit](https://img.shields.io/github/last-commit/bowencool/SubConv)

自托管的订阅转换工具，将 V2Ray / SS / SSR 链接或已有 Clash 配置，转换为兼容 [mihomo](https://github.com/MetaCubeX/mihomo) 的 Clash 配置，支持 proxy-provider 节点自动更新和 rule-provider 规则自动更新。

## 截图

![screenshot](public/screenshot.png)

## 功能

- 支持 V2Ray base64 链接、分享链接或已有 Clash 配置作为输入
- 内置 Web UI，可视化生成转换后的订阅链接
- 基于 ACL 规则集，通过 rule-provider 自动更新
- 通过 proxy-provider 实现节点自动更新，无需重启客户端
- 服务端代理 rule-provider 请求，避免直连 GitHub 失败
- 支持多机场合并成一份配置
- 支持显示剩余流量 / 总流量（需机场和客户端同时支持 `subscription-userinfo` 响应头）
- `/provider` 接口：将订阅直接转换为 proxy-provider YAML
- 通过 `config.yaml` 完全自定义输出配置

## 部署

### Docker（推荐）

```bash
# 1. 按需修改配置文件
vim config.yaml

# 2. 启动
docker compose up -d
```

服务默认监听 `8080` 端口，可在 `docker-compose.yml` 中修改。

```yaml
# docker-compose.yml
services:
  subconv:
    image: ghcr.io/bowencool/subconv:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./config.yaml:/app/config.yaml
```

### Node.js

需要 Node.js 22+。

```bash
npm install
npm run build
npm start          # 默认端口 8080
```

支持的环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8080` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DISALLOW_ROBOTS` | — | 设为 `true` 禁止搜索引擎收录 |

## API

### `GET /sub` — 订阅转换

| 参数 | 必填 | 说明 |
|---|---|---|
| `url` | ✅ | 订阅链接或分享链接，多个用 `\|` 或换行分隔 |
| `urlstandby` | — | 备用节点（格式同上），仅出现在手动选择分组 |
| `interval` | — | 节点 / 规则更新间隔，单位秒（默认 `1800`）|
| `npr` | — | 设为 `1` 则直连 GitHub 获取规则集，不通过本服务代理 |
| `short` | — | 设为 `1` 输出仅含节点的精简配置 |

**示例：**
```
https://your-domain/sub?url=https%3A%2F%2Fexample.com%2Fsub
```

### `GET /provider` — 转为 proxy-provider

将原始订阅转换为 Clash proxy-provider YAML，可在自定义配置中直接引用节点。

```
https://your-domain/provider?url=<订阅链接>
```

### `GET /proxy` — 规则集代理转发

将请求通过服务端转发，用于在 `npr` 未设置时从 GitHub 拉取规则集。

## 配置文件（`config.yaml`）

配置文件控制生成的 Clash 配置内容，核心字段：

```yaml
# HEAD 块 — 直接合并到输出配置的顶层
HEAD:
  mixed-port: 7890
  allow-lan: true
  # ... 其他 Clash 选项

# 延迟测试 URL
TEST_URL: https://www.gstatic.com/generate_204

# 规则集 — 每条格式为 [代理组名, 规则列表URL]
RULESET:
  - ["🌍 国外媒体", "https://cdn.jsdelivr.net/gh/bowencool/SubConv@main/rules/bowen-proxy.list"]
  - ["DIRECT",     "https://cdn.jsdelivr.net/gh/bowencool/SubConv@main/rules/bowen-direct.list"]
  # ... 更多规则
```

## 许可证

[MPL-2.0](LICENSE)
