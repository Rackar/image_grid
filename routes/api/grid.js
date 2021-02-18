const router = require("koa-router")();
const Grid = require("../../models/grid");
const turf_geometry = require("../../src/turf_geometry");
const gridCtrl = require("../../src/gridCtrl");
const main = require("../../src/main");

var add = async function (ctx, next) {
  let grids = ctx.request.body.grids;
  if (!grids) {
    grids = turf_geometry
      .testUpdateGrids()
      .map((grid) => grid.properties.detail); //本地测试赋值
  }
  grids = await gridCtrl.addStatus(grids);
  var arr = grids.map((grid) => new Grid(grid));
  let result = await Grid.insertMany(arr);

  if (result) {
    ctx.body = {
      status: 1,
      msg: "增加成功",
    };
  }
};

let shpAdd = async function (ctx, next) {
  let url = ctx.request.body.url;
  if (!url) {
    ctx.body = {
      status: 0,
      msg: "shp url参数不能为空。可使用本地路径或网络路径，无需后缀",
    };
    ctx.response.status = 400;
    return;
  }
  let msg = await main.readShapeFile(url);

  ctx.body = {
    status: 1,
    msg: "新增成功：" + msg,
  };
};

async function changeStatus() {
  let gridId = ctx.request.body.gridID;
  let filename = ctx.request.body.filename;
  let status = ctx.request.body.status; //processed,invalid
  let grids = await Grid.updateOne(
    {
      gridId,
      filename,
    },
    {
      status,
    }
  );
  if (grids) {
    ctx.body = {
      msg: "设置状态成功",
    };
  }
}

async function processComplete(ctx, next) {
  let uuid = ctx.request.body.uuid;
  // let status = ctx.request.body.status; //processed,invalid
  let grids = await Grid.updateMany(
    {
      uuid,
      status: "processing",
    },
    {
      status: "processed",
    }
  );
  if (grids) {
    ctx.body = {
      msg: "设置状态成功",
    };
  }
}
var total = async function (ctx, next) {
  // let id = ctx.params.id;
  let grids = await Grid.find({});
  if (grids) {
    ctx.body = {
      status: 1,
      msg: "全部数据",
      data: grids,
    };
  }
};

router.get("/grids", total);
router.post("/grids", add);
router.put("/grids", changeStatus);
router.post("/shape", shpAdd); //传入url，为shp文件的路径，开始添加影像
router.put("/shape", processComplete); //传入uuid，将本批次的status由processing改为processed
module.exports = router;
