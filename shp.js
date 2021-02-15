const shp = require("./libs/shp-read");
const fs = require("fs");
const lap = require("./lap");
const gridCtrl = require("./controler/grid");
const Grid = require("./models/grid");
var shpwrite = require("./libs/shp-write");

readShapeFile();
function readShapeFile() {
  // http服务器下的test.shp
  shp("./myshapes/test_end").then(
    async function (geojson) {
      console.log("影像数量为：", geojson.features.length);
      let allBackupGrids = [];
      for (let i = 0; i < geojson.features.length; i++) {
        const imageShp = geojson.features[i];
        let shps = lap.filterGrids(lap.calcGrids(imageShp, 10, 10));
        let gridsFeature = shps.map((grid) => grid.properties.detail);
        let grids = await gridCtrl.addStatus(gridsFeature);
        if (grids && grids.length) allBackupGrids.push(...grids);

        // processingIds = [0, 1, 2]; //test
        // if (
        //   grids &&
        //   grids.length &&
        //   processingIds &&
        //   processingIds.length &&
        //   processingIds.length <= grids.length
        // ) {
        //   for (let i = 0; i < grids.length; i++) {
        //     // const index = processingIds[i];
        //     // let grid = grids[index];
        //     allBackupGrids.push(grids[i]);
        //     // let feature = lap.calcPolygonFromGridId(grid.gridId);
        //     // feature.properties.gridId = grid.gridId;
        //     // features.push(feature);
        //   }
        //   // let processingFeatures = getProcessingGrids(grids, processingIds);
        //   // // console.log(JSON.stringify(processingFeatures));
        //   // let mutilRings = polygonsToMutilRings(processingFeatures);
        //   // generateShp(mutilRings, imageShp.properties.filename);
        // }
      }
      let uniqueArray = optimizeImages(allBackupGrids);
      let gourp = gridsToGroupImage(uniqueArray);
      groupImagesToShp(gourp);

      //更新数据库 滞后
      await insertToDatabase(allBackupGrids);
    },
    (e) => {
      console.log(e);
    }
  );
}

async function insertToDatabase(allBackupGrids) {
  var arr = allBackupGrids.map((grid) => new Grid(grid));
  let result = await Grid.insertMany(arr);
  if (result && result.length) {
    console.log("插入成功", result.length);
  }
  console.log("成功");
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
    let mustUseImage = sureImage.map((ele) => ele.info[0].filename);
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
    let backupToSkiped = backupArrs
      .filter((grid) => grid.status === "backup")
      .map((grid) => {
        grid.status = "skiped";
        return gird;
      });
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
  let newArr = resArr.reduce((pre, cur) => {
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
        info: [{ gridId: cur.gridId, status: cur.status }],
      });
      return pre;
    }
  }, []);
  console.log(newArr);
  return newArr;
}

function groupImagesToShp(arr) {
  for (let i = 0; i < arr.length; i++) {
    const image = arr[i];
    let features = [];
    for (let j = 0; j < image.info.length; j++) {
      const grid = image.info[j];
      let feature = lap.calcPolygonFromGridId(grid.gridId);
      feature.properties.gridId = grid.gridId;
      features.push(feature);
    }
    let mutilRings = polygonsToMutilRings(features);
    generateShp(mutilRings, image.filename);
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
      let feature = lap.calcPolygonFromGridId(grid.gridId);
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
  // console.log(arr);
  //3. fs.writeFile  写入文件（会覆盖之前的内容）（文件不存在就创建）  utf8参数可以省略
  fs.writeFileSync("./shp/" + filename + ".zip", arr, "");

  console.log("保存shp压缩包成功");

  //    function (error) {
  //   if (error) {
  //     console.log(error);
  //     return false;
  //   }

  // }
}

// testSort([1, 3, 1, 2, 2, 3, 4, 5, 6, 1, 2, 23]);
// function testSort(arr) {
//   let sortedArr = [];
//   for (let i = 0; i < arr.length; i++) {
//     const element = arr[i];
//     if (sortedArr.length === 0) sortedArr.push(element);
//     let importIndex = 0;
//     for (let i = 0; i < sortedArr.length; i++) {
//       const el = sortedArr[i];
//       if (element >= el) {
//         importIndex = i + 1;
//       }
//     }
//     sortedArr.splice(importIndex, 0, element);
//   }
//   console.log(sortedArr);
// }
