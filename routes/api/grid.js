const router = require("koa-router")();
const Grid = require("../../models/grid");
const turf_geometry = require("../../src/turf_geometry");
const gridCtrl = require("../../src/gridCtrl");
const main = require("../../src/main");

router.prefix("/api");

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

async function changeStatus(ctx, next) {
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
let total = async function (ctx, next) {
  let params = ctx.query || {};
  let grids = await Grid.find(params);
  if (grids) {
    let group = grids.reduce((pre, cur) => {
      let existIndex = pre.findIndex(
        (value) =>
          value.gridId === cur.gridId
      );
      if (existIndex !== -1) {
        pre[existIndex].info.push({
          filename: cur.filename,
          previousFilename: cur.previousFilename,
        });
        return pre;
      } else {
        pre.push({
          gridId: cur.gridId,

          // uuid: ALI_API.guid(),
          info: [{
            filename: cur.filename,
            previousFilename: cur.previousFilename,
          }],
        });
        return pre;
      }
    }, []);
    console.log(grids.length, group.length)
    ctx.body = {
      status: 1,
      msg: "全部数据",
      data: grids,
    };
  }
};

let getImages = async function (ctx, next) {
  let params = ctx.query || {};
  let images = await main.findImagesInFeature(params)
  if (images) {
    ctx.body = {
      status: 1,
      msg: "全部涉及的影像名",
      data: images,
    };
  }
};

let forceProcess = async function (ctx, next) {
  let params = ctx.query || {};
  let res = await main.forceProcessWithTwoImages(params.oldFilename, params.newFilename)
  if (res) {
    ctx.body = {
      status: 1,
      msg: "已更新处理状态",
      data: res,
    };
  }
};


router.get("/grids", total); //查询数据库，可用query传入筛选参数
router.post("/grids", add);
router.put("/grids", changeStatus);
router.post("/shape", shpAdd); //传入url，为shp文件的路径，开始添加影像
router.put("/shape", processComplete); //传入uuid，将本批次的status由processing改为processed
router.get("/images", getImages); //获取范围所包含的影像。查询数据库，可用query传入筛选参数
router.get("/forceprocess", forceProcess); //获取范围所包含的影像。查询数据库，可用query传入筛选参数
module.exports = router;
