const router = require("koa-router")();
var Grid = require("../../models/grid");
let lap = require("../../lap");

var add = async function (ctx, next) {
  // let grids = ctx.request.body.grids;
  let grids = lap.updateGrids().map((grid) => grid.properties.detail); //本地测试赋值
  grids = await addStatus(grids);
  var arr = grids.map((grid) => new Grid(grid));
  let result = await Grid.insertMany(arr);

  if (result) {
    ctx.body = {
      status: 1,
      msg: "增加成功",
    };
  }
};

async function addStatus(grids) {
  let ids = grids.map((grid) => grid.gridId);
  let existGrids = await Grid.find({
    // occupation: /host/,
    // "name.last": "Ghost",
    // age: { $gt: 17, $lt: 66 },
    status: { $ne: "invalid" },
    gridId: { $in: ids },
  });
  //只要查询不报错，不用管length
  if (existGrids) {
    for (let j = 0; j < grids.length; j++) {
      let newGrid = grids[j];
      //按照时间倒排
      let sortedGrids = existGrids
        .filter((grid) => grid.gridId === newGrid.gridId)
        .sort((a, b) => b.imageTime - a.imageTime);

      //本格网数据为0
      if (sortedGrids.length === 0) {
        newGrid.status = "init";
        break;
      }

      //本格网仅初始化过，尚未比对
      if (
        sortedGrids.filter(
          (grid) => grid.status === "processing" || grid.status === "processed"
        ).length === 0
      ) {
        let init = sortedGrids.find((grid) => grid.status === "init");
        if (
          init &&
          init.imageTime &&
          checkTimeGap(init.imageTime, newGrid.imageTime)
        ) {
          newGrid.status = "processing";
          break;
        }
      }

      //正常的
      for (let k = 0; k < sortedGrids.length; k++) {
        const grid = sortedGrids[k];
        if (
          grid.imageFilename === newGrid.imageFilename &&
          grid.gridId === newGrid.gridId
        ) {
          ////重复提交记录，需要标记，循环结束后删除
        }

        if (grid.status === "processing") {
          break;
        } else if (
          grid.status === "processed" &&
          checkTimeGap(grid.imageTime, newGrid.imageTime)
        ) {
          newGrid.status = "processing";
          break;
        }
      }

      //漏网的
      if (newGrid.status === "init" || newGrid.status === "processing") {
      } else {
        newGrid.status = "skiped";
      }
    }
  } else {
  }
  return grids;
}
function checkTimeGap(beforeTime, afterTime) {
  return afterTime - beforeTime > 7 * 24 * 3600 * 1000;
}

var total = async function (ctx, next) {
  // let id = ctx.params.id;
  //   let id = ctx.state.user.userid;
  let grids = await Grid.find({});
  if (grids) {
    ctx.body = {
      status: 1,
      msg: "总数",
      data: grids,
    };
  }
};

router.get("/grids", total);
router.post("/grids", add);
module.exports = router;
