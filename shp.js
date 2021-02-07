const shp = require("shpjs");
const lap = require("./lap");
const gridCtrl = require("./controler/grid");
var Grid = require("./models/grid");
shp("http://127.0.0.1:5500/test").then(
  async function (geojson) {
    console.log(geojson);
    let test = geojson.features[0];
    let grids = lap.filterGrids(lap.calcGrids(test, 20, 20));
    grids = await gridCtrl.addStatus(grids);
    var arr = grids.map((grid) => new Grid(grid));
    let result = await Grid.insertMany(arr);
    if (result) {
      console.log("插入成功");
    }
  },
  (e) => {
    console.log(e);
  }
);
