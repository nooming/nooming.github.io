# noomings 品牌标识

定稿。站名 **noomings**。黑底白门 + 窗内黄月牙。

## 概念

**n 是窗，月亮在窗里。** 圆角黑底 `#141414`，门框为白，窗洞透出黑底，黄色 `#FFFA00` 只用于月牙。

## 文件

| 文件 | 用途 |
|------|------|
| `noomings-mark.svg` | 主标（顶栏、首页 hero） |
| `favicon.svg` | 浏览器标签页（全站 `<head>` 优先引用） |

`assets/icons/` 内 `apple-touch-icon.png`、`android-chrome-*.png` 由主标导出，供主屏幕与 manifest；与 SVG 同步更新时需重新导出。

顶栏：`site-shell` → `/assets/brand/noomings-mark.svg` + 文字 noomings。Citywalk 仍用 `app/citywalk/assets/brand/`。

## 禁忌

- 不要把月牙挪到角上
- 不要给整块图标铺黄底
- 不要改回透明底上的黑门
