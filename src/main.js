const shp = require("../libs/shp-read");
const fs = require("fs");
const turf_geometry = require("./turf_geometry");
const gridCtrl = require("./gridCtrl");
const Grid = require("../models/grid");
const shpwrite = require("../libs/shp-write");

const ALI_API = require("./ali_api");

// readShapeFile();
async function readShapeFile(url = "./myshapes/test_end") {
  let msg = "";
  // http服务器下的test.shp或者程序根目录下的相对路径或绝对路径
  await shp(url).then(
    async function (geojson) {
      console.log("影像数量为：", geojson.features.length);
      msg += "影像数量为" + geojson.features.length;
      let allNewGrids = [];
      allNewGrids = await featuresToGrids(geojson.features);
      msg += "，涉及格网" + allNewGrids.length;
      let uniqueBackupArray = optimizeImages(allNewGrids);
      msg += "，待处理非重格网" + uniqueBackupArray.length;
      let group = gridsToGroupImage(uniqueBackupArray);
      groupImagesToShp(group);
      addUuidToGrids(allNewGrids, group);
      //更新数据库 滞后
      await insertToDatabase(allNewGrids);
      //进行处理发送命令
      await beginProcessing(group);
      //修改数据库状态
      await changeProcessed(group);
      msg += `，任务数量为${group.length}，数据库更新条数为${allNewGrids.length}`;
    },
    (e) => {
      console.log("shp读取出错，检查路径", e);
    }
  );
  console.log(msg);
  return msg;
}

function addUuidToGrids(gridsArr, groupArr) {
  for (let i = 0; i < groupArr.length; i++) {
    const group = groupArr[i];
    for (let j = 0; j < gridsArr.length; j++) {
      let grid = gridsArr[j];
      if (
        grid &&
        group &&
        group.uuid &&
        grid.filename &&
        grid.previousFilename &&
        group.filename &&
        group.previousFilename &&
        grid.filename === group.filename &&
        grid.previousFilename === group.previousFilename
      ) {
        grid.uuid = group.uuid;
      }
    }
  }
}
async function featuresToGrids(features) {
  let allNewGrids = [];
  for (let i = 0; i < features.length; i++) {
    const imageShp = features[i];
    let shps = turf_geometry.filterGrids(
      turf_geometry.calcGrids(imageShp, 10, 10)
    );
    let gridsFeature = shps.map((grid) => grid.properties.detail);
    let grids = await gridCtrl.addStatus(gridsFeature);
    if (grids && grids.length) allNewGrids.push(...grids);
  }
  return allNewGrids;
}

function changeProcessed(group) {}

function beginProcessing(group) {
  for (let i = 0; i < group.length; i++) {
    const pair = group[i];
    let newDomName = getStandardFilename(pair.filename);
    let oldDomName = getStandardFilename(pair.previousFilename);
    ALI_API.upload_task(newDomName, oldDomName, pair.uuid, pair.uuid);
  }
}

function getStandardFilename(filename) {
  let DOMfilename = filename;
  return DOMfilename;
}

async function insertToDatabase(allBackupGrids) {
  var arr = allBackupGrids.map((grid) => new Grid(grid));
  let result = await Grid.insertMany(arr);
  if (result && result.length) {
    console.log("插入成功", result.length);
  } else {
    console.log("未插入数据库任何记录");
  }
}

function optimizeImages(arr) {
  if (arr && arr.length) {
    // let initArrs = arr.filter((grid) => grid.status === "init");
    let backupArrs = arr.filter((grid) => grid.status === "backup");
    let backupHash = {};
    backupArrs.forEach((grid) => {
      if (!backupHash[grid.gridId]) backupHash[grid.gridId] = [];
      backupHash[grid.gridId].push(grid);
    });

    let sortedArr = [];
    let count = 0;
    for (const key in backupHash) {
      if (Object.hasOwnProperty.call(backupHash, key)) {
        const obj = backupHash[key];
        const len = obj.length;
        if (sortedArr.length === 0) {
          sortedArr.push({ info: obj, gridId: key });
          continue;
        }
        //倒序排列，可能不需要
        let importIndex = 0;
        for (let i = 0; i < sortedArr.length; i++) {
          const el = sortedArr[i];
          if (len >= el.info.length) {
            importIndex = i + 1;
          }
        }
        sortedArr.splice(importIndex, 0, { info: obj, gridId: key });
        count++;
      }
    }
    console.log(sortedArr, count);
    let sureImage = sortedArr
      .filter((grid) => grid.info.length === 1)
      .map((grid) => {
        grid.info[0].status = "processing";
        return grid;
      });
    let mustUseImage = [
      ...new Set(sureImage.map((ele) => ele.info[0].filename)),
    ];
    let otherImage = sortedArr.filter((grid) => grid.info.length !== 1);
    for (let i = otherImage.length - 1; i >= 0; i--) {
      let image = otherImage[i];
      for (let j = 0; j < image.info.length; j++) {
        const info = image.info[j];
        if (mustUseImage.includes(info.filename)) {
          info.status = "processing";
          image.info = [info];

          break;
          // otherImage.splice(i, 1);
        }
      }
      //todo 这里用了简化逻辑，将有多个影像都为未确定的情况直接使用序列0，以后可进一步优化
      if (image.info.length > 1) {
        image.info[0].status = "processing";
        image.info = [image.info[0]];
      }
      // otherImage= diedai(otherImage)
    }
    // let resArr = sureImage.concat(otherImage).map((ele) => {
    //   return {
    //     acquisitio: ele.info[0].acquisitio,
    //     filename: ele.info[0].filename,
    //     previousFilename: ele.info[0].previousFilename,
    //     gridId: ele.gridId,
    //     status: ele.info[0].status,
    //   };
    // });
    // console.log(resArr);
    let backupToSkiped = backupArrs.filter((grid) => grid.status === "backup");
    if (backupToSkiped && backupToSkiped.length) {
      backupToSkiped.map((grid) => {
        grid.status = "skiped";
        return grid;
      });
    }

    let resArr = backupArrs.filter((grid) => grid.status === "processing");
    return resArr;
    ///todo 进一步优化逻辑
    function diedai(arr) {
      if (arr.length > 1) {
        let obj = arr[0].info;
        const newArr = function (array) {
          return array.reduce(
            (pre, cur) => pre.concat(Array.isArray(cur) ? newArr(cur) : cur),
            []
          );
        };
        let allInfo = arr.map((single) => single.info);
        let flatAllInfo = newArr(allInfo);
        for (let i = 0; i < obj.length; i++) {
          const info = obj[i];
        }
      }
    }
  } else {
    return [];
  }
}

function gridsToGroupImage(resArr) {
  //按照所涉及影像文件分组
  let group = resArr.reduce((pre, cur) => {
    let existIndex = pre.findIndex(
      (value) =>
        value.filename === cur.filename &&
        value.previousFilename === cur.previousFilename
    );
    if (existIndex !== -1) {
      pre[existIndex].info.push({
        gridId: cur.gridId,
        status: cur.status,
      });
      return pre;
    } else {
      pre.push({
        filename: cur.filename,
        previousFilename: cur.previousFilename,
        uuid: ALI_API.guid(),
        info: [{ gridId: cur.gridId, status: cur.status }],
      });
      return pre;
    }
  }, []);
  console.log(group);
  return group;
}

function groupImagesToShp(arr) {
  for (let i = 0; i < arr.length; i++) {
    const image = arr[i];
    let features = [];
    for (let j = 0; j < image.info.length; j++) {
      const grid = image.info[j];
      let feature = turf_geometry.calcPolygonFromGridId(grid.gridId);
      feature.properties.gridId = grid.gridId;
      features.push(feature);
    }
    let mutilRings = polygonsToMutilRings(features);
    generateShp(mutilRings, image.uuid);
  }
}

function polygonsToMutilRings(processingFeatures) {
  let arr = processingFeatures.map(
    (feature) => feature.geometry.coordinates[0]
  );
  let features = [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: arr,
      },
    },
  ];
  return features;
}

function getProcessingGrids(grids, processingIds) {
  if (
    grids &&
    grids.length &&
    processingIds &&
    processingIds.length &&
    processingIds.length <= grids.length
  ) {
    // let filename = grids[0].filename || Date.now();
    let features = [];
    for (let i = 0; i < processingIds.length; i++) {
      const index = processingIds[i];
      let grid = grids[index];
      let feature = turf_geometry.calcPolygonFromGridId(grid.gridId);
      feature.properties.gridId = grid.gridId;
      features.push(feature);
    }
    return features;
  } else {
    return [];
  }
}

function generateShp(features, filename) {
  // (optional) set names for feature types and zipped folder
  var options = {
    folder: filename,
    types: {
      point: "mypoints",
      polygon: "mypolygons",
      line: "mylines",
    },
  };

  // a GeoJSON bridge for features
  let arr = shpwrite.zip(
    {
      type: "FeatureCollection",
      features,
    },
    options
  );
  //3. fs.writeFile  写入文件（会覆盖之前的内容）（文件不存在就创建）  utf8参数可以省略
  fs.writeFileSync("./shp/" + filename + ".zip", arr, "");

  console.log("保存shp压缩包成功");
}

exports.readShapeFile = readShapeFile;
