const router = require("koa-router")();
var Grid = require("../../models/grid");
let lap = require("../../lap");

var add = async function (ctx, next) {
  // let grids = ctx.request.body.grids;
  let grids = lap.updateGrids.map((grid) => grid.properties.detail); //本地测试赋值
  grids = addStatus(grids);
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
  if (existGrids) {
    for (let j = 0; j < grids.length; j++) {
      let newGrid = grids[j];
      //按照时间倒排
      let sortedGrids = existGrids
        .filter((grid) => grid.gridId === newGrid.gridId)
        .sort((a, b) => b.imageTime - a.imageTime);
      if ((sortedGrids.length = 0)) {
        newGrid.status = "init";
        break;
      }
      if (
        sortedGrids.filter(
          (grid) => grid.status === "processing" || grid.status === "processed"
        ).length === 0 &&
        checkTimeGap(
          sortedGrids.find((grid) => grid.status === "init").imageTime,
          newGrid.imageTime
        )
      ) {
        newGrid.status = "processing";
      }
      if (sortedGrids.every((grid) => grid.status === "init")) {
      }
      for (let k = 0; k < sortedGrids.length; k++) {
        const grid = sortedGrids[k];
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
      if (newGrid.status !== "processing") {
        newGrid.status = "init";
      } else {
        //此处可以触发监测任务
      }
    }
  }
  return grids;
}
function checkTimeGap(beforeTime, afterTime) {
  return afterTime - beforeTime > 7 * 24 * 3600 * 1000;
}

var total = async function (ctx, next) {
  // let id = ctx.params.id;
  //   let id = ctx.state.user.userid;
  //   let user = await User.findOne({ _id: id });
  //   if (user) {
  //     let arr = user.starsLogs;
  //     var sum = arr.length
  //       ? arr.reduce((prev, next, index, array) => {
  //           // console.log(prev);
  //           return { stars: prev.stars + next.stars };
  //         })
  //       : 0;
  //     let data = {
  //       stars: sum,
  //       real_name: user.username,
  //       history: arr,
  //     };
  //     ctx.body = {
  //       status: 1,
  //       msg: "星星总数",
  //       data: data,
  //     };
  //   }
};

router.post("/total", total);
router.post("/grids", add);
module.exports = router;
