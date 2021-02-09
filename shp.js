const shp = require("shpjs");
const fs = require("fs");
const lap = require("./lap");
const gridCtrl = require("./controler/grid");
var Grid = require("./models/grid");
var shpwrite = require("./libs/shp-write");

readShapeFile();
function readShapeFile() {
  // http服务器下的test.shp
  shp("http://127.0.0.1:5500/test").then(
    async function (geojson) {
      // console.log(geojson);
      for (let i = 0; i < geojson.features.length; i++) {
        const imageShp = geojson.features[i];
        let shps = lap.filterGrids(lap.calcGrids(imageShp, 10, 10));
        let gridsFeature = shps.map((grid) => grid.properties.detail);
        let { grids, processingIds } = await gridCtrl.addStatus(gridsFeature);

        var arr = grids.map((grid) => new Grid(grid));
        let result = await Grid.insertMany(arr);
        if (result && result.length) {
          console.log("插入成功", result.length);
        }

        processingIds = [0, 1, 2]; //test
        if (
          grids &&
          grids.length &&
          processingIds &&
          processingIds.length &&
          processingIds.length <= grids.length
        ) {
          let processingFeatures = getProcessingGrids(grids, processingIds);
          // console.log(JSON.stringify(processingFeatures));
          let mutilRings = polygonsToMutilRings(processingFeatures);
          generateShp(mutilRings, imageShp.properties.filename);
        }
      }
    },
    (e) => {
      console.log(e);
    }
  );
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
  fs.writeFile("./shp/" + filename + ".zip", arr, "", function (error) {
    if (error) {
      console.log(error);
      return false;
    }
    console.log("保存shp压缩包成功");
  });
}
