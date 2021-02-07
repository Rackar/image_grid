var Grid = require("../models/grid");
async function addStatus(grids) {
  let ids = grids.map((grid) => grid.gridId);
  let existGrids = await Grid.find({
    // occupation: /host/,
    // "name.last": "Ghost",
    // age: { $gt: 17, $lt: 66 },
    status: { $ne: "invalid" },
    gridId: { $in: ids },
  });
  let repeatedIds = [],
    processingIds = [];
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
          processingIds.push(j);
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
          console.log("重复提交");
          repeatedIds.push(j);
          ////重复提交记录，需要标记，循环结束后删除
        }

        if (grid.status === "processing") {
          break;
        } else if (
          grid.status === "processed" &&
          checkTimeGap(grid.imageTime, newGrid.imageTime)
        ) {
          newGrid.status = "processing";
          processingIds.push(j);
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

  //去掉重复提交任务
  if (repeatedIds.length) {
    for (let i = repeatedIds.length - 1; i >= 0; i--) {
      let j = repeatedIds[i];
      grids.splice(j, 1);
    }
  }

  //提交处理队列
  if (processingIds.length) {
    for (let i = 0; i < processingIds.length; i--) {
      let grid = grids[processingIds[i]];
      console.log(grid);
    }
  }

  return grids;
}
function checkTimeGap(beforeTime, afterTime) {
  return afterTime - beforeTime > 7 * 24 * 3600 * 1000;
  // return true;
}

exports.addStatus = addStatus;
