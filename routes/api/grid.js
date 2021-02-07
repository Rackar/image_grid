const router = require("koa-router")();
var Grid = require("../../models/grid");
let lap = require("../../lap");
let gridCtrl = require("../../controler/grid");

var add = async function (ctx, next) {
  // let grids = ctx.request.body.grids;
  let grids = lap.updateGrids().map((grid) => grid.properties.detail); //本地测试赋值
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
module.exports = router;
