# 卫星影像格网化管理

## 已实现功能

循环读取原始影像 shp ，计算出对应格网 ID，查询数据库中格网的前景影像状态。

将待变化监测处理的前后景影像名查出来，根据相同的前后景进行聚合范围框。

结果输出为 shp。

## todo

对接 AI 任务平台的 API

## 问题

shp 使用 https://github.com/cyclomedia/shp-write 这个 fork 库，polygon 中使用多个 ring，shp 文件打开正常，但是单要素，不知道阿里认不认。 经测试可行，但是处理效率降低。生成 shp 来加速处理的方法可以作废了。

如果小块区域不能减少工作量，是否需要判断如何组合，参与计算的影像对数量最小。

## 数据库查询命令

```s
$ne 不等于
$exists 存在字段
db.grids.find({"status":"processing"}).count()
db.grids.find({"status":{$ne:"processing"},"uuid":{"$exists":true}}).pretty()
```
