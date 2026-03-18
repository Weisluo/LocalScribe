# 世界观设定 API 文档

## 概述

世界观设定系统提供了一套完整的 API 用于创建、管理和重用世界模板。系统支持模块化设计，每个世界模板包含多个模块（地图、历史、政治、经济、种族、体系、特殊），每个模块可以包含子模块和具体的设定项。

## 基础信息

- **基础路径**: `/api/v1/worldbuilding`
- **认证**: Bearer Token (JWT)
- **数据格式**: JSON
- **字符编码**: UTF-8

## 认证说明

所有 API 请求都需要在请求头中包含认证令牌：

```http
Authorization: Bearer <your_access_token>
```

### 认证错误响应

```json
{
  "detail": "Could not validate credentials"
}
```

**状态码**: 401 Unauthorized

## 数据模型

### 核心实体关系

```
WorldTemplate (世界模板)
├── WorldModule (世界模块)
│   ├── WorldSubmodule (子模块)
│   └── WorldModuleItem (模块项)
└── WorldInstance (世界实例)
```

### 模块类型定义

| 模块类型 | 说明 | 示例 |
|---------|------|------|
| `map` | 地图设定 | 世界地图、区域划分、地理特征 |
| `history` | 历史设定 | 历史事件、文明发展、重要人物 |
| `politics` | 政治设定 | 政权结构、法律体系、外交关系 |
| `economy` | 经济设定 | 经济体系、贸易路线、资源分布 |
| `races` | 种族设定 | 不同种族、文化特征、社会结构 |
| `systems` | 体系设定 | 魔法体系、科技水平、特殊能力 |
| `special` | 特殊设定 | 自定义设定、特殊规则 |

## 错误代码

### HTTP 状态码

| 状态码 | 说明 | 常见原因 |
|--------|------|----------|
| 200 | 成功 | 请求成功处理 |
| 201 | 创建成功 | 资源创建成功 |
| 400 | 请求参数错误 | 参数格式错误、验证失败 |
| 401 | 未认证 | 缺少或无效的认证令牌 |
| 403 | 权限不足 | 无权访问该资源 |
| 404 | 资源不存在 | 请求的资源ID不存在 |
| 409 | 资源冲突 | 名称重复、违反唯一约束 |
| 422 | 验证错误 | 请求体格式错误 |
| 500 | 服务器内部错误 | 数据库错误、系统异常 |

### 错误响应格式

```json
{
  "detail": "错误描述信息"
}
```

### 常见错误示例

#### 400 Bad Request - 参数验证失败

```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "ensure this value has at least 1 characters",
      "type": "value_error.any_str.min_length"
    }
  ]
}
```

#### 404 Not Found - 资源不存在

```json
{
  "detail": "世界模板不存在"
}
```

#### 409 Conflict - 资源冲突

```json
{
  "detail": "世界模板名称已存在"
}
```

#### 500 Internal Server Error - 服务器错误

```json
{
  "detail": "创建世界模板时发生数据库错误"
}
```

## API 端点

### 世界模板管理

#### 创建世界模板

```http
POST /api/v1/worldbuilding/templates
```

**请求体**:
```json
{
  "name": "奇幻世界模板",
  "description": "一个标准的奇幻世界设定模板",
  "cover_image": "https://example.com/cover.jpg",
  "tags": ["奇幻", "中世纪", "魔法"],
  "is_public": false,
  "is_system_template": false
}
```

**字段说明**:
- `name` (string, 必填): 世界名称，长度 1-255 字符
- `description` (string, 可选): 世界描述，最大 1000 字符
- `cover_image` (string, 可选): 封面图片URL，最大 500 字符
- `tags` (array, 可选): 标签列表，最多 10 个标签，每个标签最大 20 字符
- `is_public` (boolean, 可选): 是否公开，默认 false
- `is_system_template` (boolean, 可选): 是否系统模板，默认 false

**成功响应** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "奇幻世界模板",
  "description": "一个标准的奇幻世界设定模板",
  "cover_image": "https://example.com/cover.jpg",
  "tags": ["奇幻", "中世纪", "魔法"],
  "is_public": false,
  "is_system_template": false,
  "created_at": "2026-03-18T10:30:00",
  "updated_at": "2026-03-18T10:30:00",
  "created_by": "user_uuid",
  "module_count": 0,
  "instance_count": 0
}
```

**错误响应**:
- 400: 参数验证失败
- 409: 世界模板名称已存在
- 500: 数据库错误

---

#### 获取世界模板列表

```http
GET /api/v1/worldbuilding/templates?skip=0&limit=100&name=奇幻&is_public=true
```

**查询参数**:
- `skip` (integer, 可选): 跳过记录数，默认 0
- `limit` (integer, 可选): 返回记录数，默认 100，最大 100
- `name` (string, 可选): 模板名称模糊搜索
- `is_public` (boolean, 可选): 是否公开
- `is_system_template` (boolean, 可选): 是否系统模板

**成功响应** (200 OK):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "奇幻世界模板",
    "description": "一个标准的奇幻世界设定模板",
    "cover_image": "https://example.com/cover.jpg",
    "tags": ["奇幻", "中世纪", "魔法"],
    "is_public": false,
    "is_system_template": false,
    "created_at": "2026-03-18T10:30:00",
    "updated_at": "2026-03-18T10:30:00",
    "created_by": "user_uuid",
    "module_count": 7,
    "instance_count": 3
  }
]
```

---

#### 高级搜索世界模板

```http
POST /api/v1/worldbuilding/templates/search?skip=0&limit=100
```

**查询参数**:
- `skip` (integer, 可选): 跳过记录数，默认 0
- `limit` (integer, 可选): 返回记录数，默认 100，最大 100

**请求体**:
```json
{
  "name": "奇幻",
  "tags": ["中世纪", "魔法"],
  "is_public": true,
  "is_system_template": false,
  "created_by": "user_uuid"
}
```

**字段说明**:
- `name` (string, 可选): 模板名称模糊搜索
- `tags` (array, 可选): 标签列表筛选，支持多标签
- `is_public` (boolean, 可选): 是否公开
- `is_system_template` (boolean, 可选): 是否系统模板
- `created_by` (string, 可选): 创建者ID

**成功响应** (200 OK):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "奇幻世界模板",
    "description": "一个标准的奇幻世界设定模板",
    "cover_image": "https://example.com/cover.jpg",
    "tags": ["奇幻", "中世纪", "魔法"],
    "is_public": true,
    "is_system_template": false,
    "created_at": "2026-03-18T10:30:00",
    "updated_at": "2026-03-18T10:30:00",
    "created_by": "user_uuid",
    "module_count": 7,
    "instance_count": 3
  }
]
```

**说明**: 支持多条件组合筛选，包括多标签筛选和创建者筛选。

---

#### 获取模板详情

```http
GET /api/v1/worldbuilding/templates/{template_id}?include_modules=true
```

**路径参数**:
- `template_id` (string, 必填): 模板ID

**查询参数**:
- `include_modules` (boolean, 可选): 是否包含模块信息，默认 true

**成功响应** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "奇幻世界模板",
  "description": "一个标准的奇幻世界设定模板",
  "cover_image": "https://example.com/cover.jpg",
  "tags": ["奇幻", "中世纪", "魔法"],
  "is_public": false,
  "is_system_template": false,
  "created_at": "2026-03-18T10:30:00",
  "updated_at": "2026-03-18T10:30:00",
  "created_by": "user_uuid",
  "module_count": 2,
  "instance_count": 0,
  "modules": [
    {
      "id": "module_uuid_1",
      "template_id": "550e8400-e29b-41d4-a716-446655440000",
      "module_type": "map",
      "name": "世界地图",
      "description": "世界地理和区域划分",
      "icon": "🗺️",
      "order_index": 0,
      "is_collapsible": true,
      "is_required": false,
      "created_at": "2026-03-18T10:35:00",
      "updated_at": "2026-03-18T10:35:00",
      "submodule_count": 2,
      "item_count": 3,
      "submodules": [
        {
          "id": "submodule_uuid_1",
          "module_id": "module_uuid_1",
          "name": "大陆",
          "description": "主要大陆设定",
          "order_index": 0,
          "color": "#4A90E2",
          "icon": "🌏",
          "created_at": "2026-03-18T10:40:00",
          "updated_at": "2026-03-18T10:40:00",
          "item_count": 2,
          "items": [
            {
              "id": "item_uuid_1",
              "module_id": "module_uuid_1",
              "submodule_id": "submodule_uuid_1",
              "name": "东部大陆",
              "content": {
                "面积": "约500万平方公里",
                "地形": "多山，沿海平原",
                "气候": "温带海洋性气候"
              },
              "order_index": 0,
              "is_published": true,
              "created_at": "2026-03-18T10:45:00",
              "updated_at": "2026-03-18T10:45:00"
            }
          ]
        }
      ],
      "items": [
        {
          "id": "item_uuid_2",
          "module_id": "module_uuid_1",
          "submodule_id": null,
          "name": "世界总览",
          "content": {
            "总面积": "约2000万平方公里",
            "主要种族": "人类、精灵、矮人",
            "魔法水平": "中等"
          },
          "order_index": 0,
          "is_published": true,
          "created_at": "2026-03-18T10:46:00",
          "updated_at": "2026-03-18T10:46:00"
        }
      ]
    }
  ]
}
```

**错误响应**:
- 404: 世界模板不存在
- 500: 加载模板数据时发生错误

---

#### 更新世界模板

```http
PUT /api/v1/worldbuilding/templates/{template_id}
```

**路径参数**:
- `template_id` (string, 必填): 模板ID

**请求体**:
```json
{
  "name": "更新后的奇幻世界模板",
  "description": "更新后的描述",
  "cover_image": "https://example.com/new_cover.jpg",
  "tags": ["奇幻", "中世纪", "魔法", "冒险"],
  "is_public": true
}
```

**字段说明**: 所有字段均为可选，只更新提供的字段

**成功响应** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "更新后的奇幻世界模板",
  "description": "更新后的描述",
  "cover_image": "https://example.com/new_cover.jpg",
  "tags": ["奇幻", "中世纪", "魔法", "冒险"],
  "is_public": true,
  "is_system_template": false,
  "created_at": "2026-03-18T10:30:00",
  "updated_at": "2026-03-18T11:00:00",
  "created_by": "user_uuid",
  "module_count": 7,
  "instance_count": 3
}
```

**错误响应**:
- 400: 参数验证失败
- 404: 世界模板不存在
- 409: 世界模板名称已存在

---

#### 删除世界模板

```http
DELETE /api/v1/worldbuilding/templates/{template_id}
```

**路径参数**:
- `template_id` (string, 必填): 模板ID

**成功响应** (200 OK):
```json
{
  "message": "世界模板删除成功"
}
```

**错误响应**:
- 404: 世界模板不存在
- 400: 无法删除正在使用的世界模板
- 500: 数据库错误

---

### 世界模块管理

#### 创建模块

```http
POST /api/v1/worldbuilding/templates/{template_id}/modules
```

**路径参数**:
- `template_id` (string, 必填): 模板ID

**请求体**:
```json
{
  "module_type": "races",
  "name": "种族设定",
  "description": "世界中的各种族设定",
  "icon": "👥",
  "order_index": 0,
  "is_collapsible": true,
  "is_required": true
}
```

**字段说明**:
- `module_type` (enum, 必填): 模块类型，可选值: map, history, politics, economy, races, systems, special
- `name` (string, 必填): 模块名称，长度 1-255 字符
- `description` (string, 可选): 模块描述，最大 1000 字符
- `icon` (string, 可选): 模块图标，最大 100 字符
- `order_index` (integer, 可选): 排序索引，默认 0，必须 >= 0
- `is_collapsible` (boolean, 可选): 是否可折叠，默认 true
- `is_required` (boolean, 可选): 是否必需，默认 false

**成功响应** (201 Created):
```json
{
  "id": "module_uuid",
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "module_type": "races",
  "name": "种族设定",
  "description": "世界中的各种族设定",
  "icon": "👥",
  "order_index": 0,
  "is_collapsible": true,
  "is_required": true,
  "created_at": "2026-03-18T10:35:00",
  "updated_at": "2026-03-18T10:35:00",
  "submodule_count": 0,
  "item_count": 0
}
```

**错误响应**:
- 400: 参数验证失败、该模块类型已存在
- 404: 世界模板不存在

---

#### 获取模板模块列表

```http
GET /api/v1/worldbuilding/templates/{template_id}/modules
```

**路径参数**:
- `template_id` (string, 必填): 模板ID

**成功响应** (200 OK):
```json
[
  {
    "id": "module_uuid_1",
    "template_id": "550e8400-e29b-41d4-a716-446655440000",
    "module_type": "map",
    "name": "世界地图",
    "description": "世界地理和区域划分",
    "icon": "🗺️",
    "order_index": 0,
    "is_collapsible": true,
    "is_required": false,
    "created_at": "2026-03-18T10:35:00",
    "updated_at": "2026-03-18T10:35:00",
    "submodule_count": 2,
    "item_count": 3
  }
]
```

---

#### 更新模块

```http
PUT /api/v1/worldbuilding/modules/{module_id}
```

**路径参数**:
- `module_id` (string, 必填): 模块ID

**请求体**:
```json
{
  "name": "更新后的种族设定",
  "description": "更新后的描述",
  "icon": "🎭",
  "order_index": 1
}
```

**成功响应** (200 OK):
```json
{
  "id": "module_uuid",
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "module_type": "races",
  "name": "更新后的种族设定",
  "description": "更新后的描述",
  "icon": "🎭",
  "order_index": 1,
  "is_collapsible": true,
  "is_required": true,
  "created_at": "2026-03-18T10:35:00",
  "updated_at": "2026-03-18T11:00:00",
  "submodule_count": 2,
  "item_count": 5
}
```

**错误响应**:
- 400: 参数验证失败、该模块类型已存在
- 404: 世界模块不存在

---

#### 删除模块

```http
DELETE /api/v1/worldbuilding/modules/{module_id}
```

**路径参数**:
- `module_id` (string, 必填): 模块ID

**成功响应** (200 OK):
```json
{
  "message": "世界模块删除成功"
}
```

**错误响应**:
- 400: 无法删除包含子模块或项的模块
- 404: 世界模块不存在

---

### 子模块管理

#### 创建子模块

```http
POST /api/v1/worldbuilding/modules/{module_id}/submodules
```

**路径参数**:
- `module_id` (string, 必填): 模块ID

**请求体**:
```json
{
  "name": "人类",
  "description": "人类种族设定",
  "order_index": 0,
  "color": "#FF6B6B",
  "icon": "👤"
}
```

**字段说明**:
- `name` (string, 必填): 子模块名称，长度 1-255 字符
- `description` (string, 可选): 子模块描述，最大 1000 字符
- `order_index` (integer, 可选): 排序索引，默认 0，必须 >= 0
- `color` (string, 可选): 颜色标识，格式: #RRGGBB
- `icon` (string, 可选): 图标，最大 100 字符

**成功响应** (201 Created):
```json
{
  "id": "submodule_uuid",
  "module_id": "module_uuid",
  "name": "人类",
  "description": "人类种族设定",
  "order_index": 0,
  "color": "#FF6B6B",
  "icon": "👤",
  "created_at": "2026-03-18T10:40:00",
  "updated_at": "2026-03-18T10:40:00",
  "item_count": 0
}
```

**错误响应**:
- 400: 参数验证失败
- 404: 世界模块不存在

---

#### 获取模块子模块列表

```http
GET /api/v1/worldbuilding/modules/{module_id}/submodules
```

**路径参数**:
- `module_id` (string, 必填): 模块ID

**成功响应** (200 OK):
```json
[
  {
    "id": "submodule_uuid_1",
    "module_id": "module_uuid",
    "name": "人类",
    "description": "人类种族设定",
    "order_index": 0,
    "color": "#FF6B6B",
    "icon": "👤",
    "created_at": "2026-03-18T10:40:00",
    "updated_at": "2026-03-18T10:40:00",
    "item_count": 3
  }
]
```

---

#### 更新子模块

```http
PUT /api/v1/worldbuilding/submodules/{submodule_id}
```

**路径参数**:
- `submodule_id` (string, 必填): 子模块ID

**请求体**:
```json
{
  "name": "更新后的人类",
  "description": "更新后的描述",
  "color": "#4A90E2",
  "order_index": 1
}
```

**成功响应** (200 OK):
```json
{
  "id": "submodule_uuid",
  "module_id": "module_uuid",
  "name": "更新后的人类",
  "description": "更新后的描述",
  "order_index": 1,
  "color": "#4A90E2",
  "icon": "👤",
  "created_at": "2026-03-18T10:40:00",
  "updated_at": "2026-03-18T11:00:00",
  "item_count": 3
}
```

**错误响应**:
- 400: 参数验证失败
- 404: 子模块不存在

---

#### 删除子模块

```http
DELETE /api/v1/worldbuilding/submodules/{submodule_id}
```

**路径参数**:
- `submodule_id` (string, 必填): 子模块ID

**成功响应** (200 OK):
```json
{
  "message": "子模块删除成功"
}
```

**错误响应**:
- 400: 无法删除包含项的模块
- 404: 子模块不存在

---

### 模块项管理

#### 创建模块项

```http
POST /api/v1/worldbuilding/modules/{module_id}/items
```

**路径参数**:
- `module_id` (string, 必填): 模块ID

**请求体**:
```json
{
  "name": "人类历史",
  "content": {
    "起源": "人类起源于中央大陆",
    "文化": "多元文化融合",
    "特点": "适应性强，学习能力突出",
    "寿命": "平均80年",
    "分布": "遍布世界各地"
  },
  "order_index": 0,
  "is_published": true,
  "submodule_id": "submodule_uuid"
}
```

**字段说明**:
- `name` (string, 必填): 项名称，长度 1-255 字符
- `content` (object, 必填): 结构化内容，最多 50 个字段，每个键最大 100 字符，每个值最大 5000 字符
- `order_index` (integer, 可选): 排序索引，默认 0，必须 >= 0
- `is_published` (boolean, 可选): 是否发布，默认 true
- `submodule_id` (string, 可选): 子模块ID

**成功响应** (201 Created):
```json
{
  "id": "item_uuid",
  "module_id": "module_uuid",
  "submodule_id": "submodule_uuid",
  "name": "人类历史",
  "content": {
    "起源": "人类起源于中央大陆",
    "文化": "多元文化融合",
    "特点": "适应性强，学习能力突出",
    "寿命": "平均80年",
    "分布": "遍布世界各地"
  },
  "order_index": 0,
  "is_published": true,
  "created_at": "2026-03-18T10:45:00",
  "updated_at": "2026-03-18T10:45:00"
}
```

**错误响应**:
- 400: 参数验证失败
- 404: 世界模块不存在、子模块不存在

---

#### 获取模块项列表

```http
GET /api/v1/worldbuilding/modules/{module_id}/items?submodule_id=submodule_uuid
```

**路径参数**:
- `module_id` (string, 必填): 模块ID

**查询参数**:
- `submodule_id` (string, 可选): 子模块ID，不提供则返回不属于任何子模块的项

**成功响应** (200 OK):
```json
[
  {
    "id": "item_uuid_1",
    "module_id": "module_uuid",
    "submodule_id": "submodule_uuid",
    "name": "人类历史",
    "content": {
      "起源": "人类起源于中央大陆",
      "文化": "多元文化融合"
    },
    "order_index": 0,
    "is_published": true,
    "created_at": "2026-03-18T10:45:00",
    "updated_at": "2026-03-18T10:45:00"
  }
]
```

---

#### 更新模块项

```http
PUT /api/v1/worldbuilding/items/{item_id}
```

**路径参数**:
- `item_id` (string, 必填): 模块项ID

**请求体**:
```json
{
  "name": "更新后的人类历史",
  "content": {
    "起源": "更新后的起源信息",
    "文化": "更新后的文化信息"
  },
  "order_index": 1,
  "is_published": false
}
```

**成功响应** (200 OK):
```json
{
  "id": "item_uuid",
  "module_id": "module_uuid",
  "submodule_id": "submodule_uuid",
  "name": "更新后的人类历史",
  "content": {
    "起源": "更新后的起源信息",
    "文化": "更新后的文化信息"
  },
  "order_index": 1,
  "is_published": false,
  "created_at": "2026-03-18T10:45:00",
  "updated_at": "2026-03-18T11:00:00"
}
```

**错误响应**:
- 400: 参数验证失败
- 404: 模块项不存在、子模块不存在

---

#### 删除模块项

```http
DELETE /api/v1/worldbuilding/items/{item_id}
```

**路径参数**:
- `item_id` (string, 必填): 模块项ID

**成功响应** (200 OK):
```json
{
  "message": "模块项删除成功"
}
```

**错误响应**:
- 404: 模块项不存在

---

### 世界实例管理

#### 创建世界实例

```http
POST /api/v1/worldbuilding/instances
```

**请求体**:
```json
{
  "template_id": "template_uuid",
  "project_id": "project_uuid",
  "name": "我的奇幻世界",
  "description": "基于模板创建的具体世界",
  "custom_data": {
    "world_name": "艾泽拉斯",
    "era": "第三纪元",
    "special_rules": "魔法充盈"
  }
}
```

**字段说明**:
- `template_id` (string, 必填): 模板ID
- `project_id` (string, 必填): 项目ID
- `name` (string, 必填): 实例名称，长度 1-255 字符
- `description` (string, 可选): 实例描述，最大 1000 字符
- `custom_data` (object, 可选): 自定义数据，最多 100 个字段

**成功响应** (201 Created):
```json
{
  "id": "instance_uuid",
  "template_id": "template_uuid",
  "project_id": "project_uuid",
  "name": "我的奇幻世界",
  "description": "基于模板创建的具体世界",
  "custom_data": {
    "world_name": "艾泽拉斯",
    "era": "第三纪元",
    "special_rules": "魔法充盈"
  },
  "created_at": "2026-03-18T10:50:00",
  "updated_at": "2026-03-18T10:50:00"
}
```

**错误响应**:
- 400: 参数验证失败
- 404: 世界模板不存在、项目不存在
- 500: 数据库错误

---

#### 获取项目世界实例列表

```http
GET /api/v1/worldbuilding/projects/{project_id}/instances
```

**路径参数**:
- `project_id` (string, 必填): 项目ID

**成功响应** (200 OK):
```json
[
  {
    "id": "instance_uuid_1",
    "template_id": "template_uuid",
    "project_id": "project_uuid",
    "name": "我的奇幻世界",
    "description": "基于模板创建的具体世界",
    "custom_data": {
      "world_name": "艾泽拉斯"
    },
    "created_at": "2026-03-18T10:50:00",
    "updated_at": "2026-03-18T10:50:00"
  }
]
```

---

#### 更新世界实例

```http
PUT /api/v1/worldbuilding/instances/{instance_id}
```

**路径参数**:
- `instance_id` (string, 必填): 实例ID

**请求体**:
```json
{
  "name": "更新后的世界名称",
  "description": "更新后的描述",
  "custom_data": {
    "world_name": "新世界名",
    "era": "第四纪元"
  }
}
```

**成功响应** (200 OK):
```json
{
  "id": "instance_uuid",
  "template_id": "template_uuid",
  "project_id": "project_uuid",
  "name": "更新后的世界名称",
  "description": "更新后的描述",
  "custom_data": {
    "world_name": "新世界名",
    "era": "第四纪元"
  },
  "created_at": "2026-03-18T10:50:00",
  "updated_at": "2026-03-18T11:00:00"
}
```

**错误响应**:
- 400: 参数验证失败
- 404: 世界实例不存在

---

#### 删除世界实例

```http
DELETE /api/v1/worldbuilding/instances/{instance_id}
```

**路径参数**:
- `instance_id` (string, 必填): 实例ID

**成功响应** (200 OK):
```json
{
  "message": "世界实例删除成功"
}
```

**错误响应**:
- 404: 世界实例不存在

---

### 导入导出功能

#### 导出世界模板

```http
GET /api/v1/worldbuilding/templates/{template_id}/export
```

**路径参数**:
- `template_id` (string, 必填): 模板ID

**成功响应** (200 OK):
```json
{
  "template": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "奇幻世界模板",
    "description": "一个标准的奇幻世界设定模板",
    "cover_image": "https://example.com/cover.jpg",
    "tags": ["奇幻", "中世纪", "魔法"],
    "is_public": false,
    "is_system_template": false,
    "created_at": "2026-03-18T10:30:00",
    "updated_at": "2026-03-18T10:30:00",
    "created_by": "user_uuid",
    "module_count": 2,
    "instance_count": 0
  },
  "modules": [
    {
      "id": "module_uuid_1",
      "template_id": "550e8400-e29b-41d4-a716-446655440000",
      "module_type": "map",
      "name": "世界地图",
      "description": "世界地理和区域划分",
      "icon": "🗺️",
      "order_index": 0,
      "is_collapsible": true,
      "is_required": false,
      "created_at": "2026-03-18T10:35:00",
      "updated_at": "2026-03-18T10:35:00",
      "submodule_count": 1,
      "item_count": 1,
      "submodules": [
        {
          "id": "submodule_uuid_1",
          "module_id": "module_uuid_1",
          "name": "大陆",
          "description": "主要大陆设定",
          "order_index": 0,
          "color": "#4A90E2",
          "icon": "🌏",
          "created_at": "2026-03-18T10:40:00",
          "updated_at": "2026-03-18T10:40:00",
          "item_count": 1,
          "items": [
            {
              "id": "item_uuid_1",
              "module_id": "module_uuid_1",
              "submodule_id": "submodule_uuid_1",
              "name": "东部大陆",
              "content": {
                "面积": "约500万平方公里",
                "地形": "多山，沿海平原"
              },
              "order_index": 0,
              "is_published": true,
              "created_at": "2026-03-18T10:45:00",
              "updated_at": "2026-03-18T10:45:00"
            }
          ]
        }
      ],
      "items": []
    }
  ]
}
```

**错误响应**:
- 404: 世界模板不存在
- 500: 加载模板数据时发生错误

**说明**: 导出完整的模板数据，包括所有模块、子模块和项，可用于备份或分享。

---

#### 导入世界模板

```http
POST /api/v1/worldbuilding/templates/import
```

**请求体**:
```json
{
  "name": "导入的奇幻世界",
  "description": "从外部导入的世界模板",
  "modules": [
    {
      "module_type": "races",
      "name": "种族设定",
      "description": "世界中的各种族设定",
      "icon": "👥",
      "order_index": 0,
      "is_collapsible": true,
      "is_required": true,
      "submodules": [
        {
          "name": "人类",
          "description": "人类种族设定",
          "order_index": 0,
          "color": "#FF6B6B",
          "icon": "👤",
          "items": [
            {
              "name": "人类特点",
              "content": {
                "特点": "适应性强",
                "寿命": "平均80年"
              },
              "order_index": 0,
              "is_published": true
            }
          ]
        }
      ],
      "items": [
        {
          "name": "通用设定",
          "content": {
            "通用": "基础设定"
          },
          "order_index": 0,
          "is_published": true
        }
      ]
    }
  ]
}
```

**成功响应** (201 Created):
```json
{
  "id": "new_template_uuid",
  "name": "导入的奇幻世界",
  "description": "从外部导入的世界模板",
  "cover_image": null,
  "tags": null,
  "is_public": false,
  "is_system_template": false,
  "created_at": "2026-03-18T11:00:00",
  "updated_at": "2026-03-18T11:00:00",
  "created_by": null,
  "module_count": 1,
  "instance_count": 0
}
```

**错误响应**:
- 400: 参数验证失败、世界模板名称已存在
- 500: 数据库错误

**说明**: 导入完整的模板数据，会创建新的模板ID和所有子项ID。

---

### 批量操作

#### 批量删除

```http
POST /api/v1/worldbuilding/batch/delete
```

**请求体**:
```json
{
  "ids": [
    "template_uuid_1",
    "module_uuid_2",
    "submodule_uuid_3",
    "item_uuid_4"
  ]
}
```

**字段说明**:
- `ids` (array, 必填): 要删除的ID列表，最多 100 个ID

**成功响应** (200 OK):
```json
{
  "message": "成功删除 3 个项",
  "deleted_count": 3
}
```

**错误响应**:
- 400: 参数验证失败
- 500: 数据库错误

**说明**: 
- 支持批量删除模板、模块、子模块和模块项
- 系统会自动识别ID类型并进行相应的删除操作
- 如果某个项无法删除（如正在使用），会跳过该项继续删除其他项
- 返回实际删除的数量

---

#### 批量更新排序

```http
POST /api/v1/worldbuilding/batch/order
```

**请求体**:
```json
{
  "items": [
    {"id": "module_uuid_1", "order_index": 0},
    {"id": "module_uuid_2", "order_index": 1},
    {"id": "submodule_uuid_3", "order_index": 0},
    {"id": "item_uuid_4", "order_index": 2}
  ]
}
```

**字段说明**:
- `items` (array, 必填): 排序项列表，最多 100 项
  - `id` (string, 必填): 项目ID
  - `order_index` (integer, 必填): 排序索引，必须 >= 0

**成功响应** (200 OK):
```json
{
  "message": "排序更新成功，更新了 4 个项",
  "updated_count": 4
}
```

**错误响应**:
- 400: 参数验证失败
- 500: 数据库错误

**说明**: 
- 支持批量更新模板、模块、子模块和模块项的排序
- 系统会自动识别ID类型并进行相应的排序更新
- 如果某个ID不存在，会跳过该项继续更新其他项
- 返回实际更新的数量

---

## 使用示例

### 创建完整的世界模板

#### 1. 创建世界模板

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "标准奇幻世界",
    "description": "包含完整设定的奇幻世界模板",
    "tags": ["奇幻", "完整"]
  }'
```

#### 2. 添加地图模块

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/templates/{template_id}/modules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "module_type": "map",
    "name": "世界地图",
    "description": "世界地理和区域划分",
    "icon": "🗺️"
  }'
```

#### 3. 为地图模块添加子模块

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/modules/{module_id}/submodules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "大陆",
    "description": "主要大陆设定",
    "color": "#4A90E2",
    "icon": "🌏"
  }'
```

#### 4. 添加具体设定项

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/modules/{module_id}/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "东部大陆",
    "content": {
      "面积": "约500万平方公里",
      "地形": "多山，沿海平原",
      "气候": "温带海洋性气候"
    },
    "submodule_id": "{submodule_id}"
  }'
```

### 导出和导入模板

#### 1. 导出模板

```bash
curl -X GET http://localhost:8000/api/v1/worldbuilding/templates/{template_id}/export \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o template_export.json
```

#### 2. 导入模板

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/templates/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @template_export.json
```

### 批量操作示例

#### 1. 批量删除多个项

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/batch/delete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "ids": ["id1", "id2", "id3"]
  }'
```

#### 2. 批量更新排序

```bash
curl -X POST http://localhost:8000/api/v1/worldbuilding/batch/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [
      {"id": "module1", "order_index": 0},
      {"id": "module2", "order_index": 1},
      {"id": "module3", "order_index": 2}
    ]
  }'
```

---

## 最佳实践

### 1. 模块设计
- 每个模块应该专注于一个特定的设定领域
- 合理使用模块类型，便于分类和检索
- 为模块添加清晰的描述和图标

### 2. 内容结构化
- 使用 JSON 格式存储结构化内容，便于扩展和查询
- 保持内容字段的一致性，便于批量处理
- 避免过度嵌套，保持内容扁平化

### 3. 模板重用
- 创建通用的系统模板，便于不同项目使用
- 使用标签系统对模板进行分类
- 定期维护和更新模板内容

### 4. 性能优化
- 使用批量操作减少API调用次数
- 合理使用include_modules参数，避免不必要的数据加载
- 对于大型模板，考虑分页加载模块数据

### 5. 错误处理
- 始终检查API响应状态码
- 妥善处理错误响应，给用户友好的提示
- 记录错误日志，便于问题排查

### 6. 安全性
- 不要在前端暴露敏感的认证令牌
- 对用户输入进行验证和清理
- 定期检查和更新权限设置

---

## 扩展建议

### 1. 模板版本管理
支持模板的版本控制和历史记录，便于回滚和对比变更。

### 2. 模板评分系统
用户可以对公开模板进行评分和评论，建立社区驱动的模板质量体系。

### 3. 模板市场
建立模板分享和交易平台，支持模板的搜索、筛选和推荐。

### 4. AI辅助生成
集成AI功能自动生成世界设定，提高创作效率。

### 5. 可视化编辑器
提供图形化的世界设定编辑界面，支持拖拽排序和实时预览。

### 6. 协作编辑
支持多人协作编辑同一个世界模板，实时同步变更。

### 7. 导出格式多样化
支持导出为Markdown、PDF、Word等多种格式，便于分享和发布。

---

## 常见问题 (FAQ)

### Q1: 如何创建一个完整的奇幻世界模板？
A: 按照以下步骤：
1. 创建世界模板
2. 为每个设定领域（地图、历史、政治等）创建模块
3. 在模块下创建子模块进行分类
4. 为每个子模块添加具体的设定项
5. 使用导出功能备份模板

### Q2: 模板和实例有什么区别？
A: 
- **模板**: 可重用的世界设定框架，包含通用的设定结构
- **实例**: 基于模板创建的具体世界，可以自定义和扩展设定

### Q3: 如何分享我的模板给其他用户？
A: 将模板的 `is_public` 设置为 `true`，其他用户就可以搜索和查看您的模板。

### Q4: 批量删除操作是否支持事务？
A: 当前实现中，如果某个项无法删除会跳过继续删除其他项，最终提交事务。未来版本可能会支持更严格的事务控制。

### Q5: 如何处理大型模板的性能问题？
A: 
- 使用 `include_modules=false` 参数先获取模板基本信息
- 按需加载特定模块的详细数据
- 使用分页查询避免一次性加载过多数据

### Q6: 内容字段有什么限制？
A: 
- 每个模块项最多 50 个内容字段
- 每个字段键名最大 100 字符
- 每个字段值最大 5000 字符
- 支持字符串、数字、布尔值等基本类型

---

## 更新日志

### v1.0.0 (2026-03-18)
- 初始版本发布
- 支持世界模板、模块、子模块、项的完整CRUD操作
- 支持模板导入导出功能
- 支持批量删除和排序操作
- 完整的API文档和错误处理

---

## 技术支持

如有问题或建议，请通过以下方式联系：
- 提交 Issue 到项目仓库
- 发送邮件至技术支持团队
- 查阅项目文档和FAQ

---

**最后更新时间**: 2026-03-18
