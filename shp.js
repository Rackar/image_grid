const shp = require("shpjs");
const lap = require("./lap");
const gridCtrl = require("./controler/grid");
var Grid = require("./models/grid");
shp("http://127.0.0.1:5500/test").then(
  async function (geojson) {
    // console.log(geojson);
    for (let i = 0; i < geojson.features.length; i++) {
      const imageShp = geojson.features[i];
      // let test = geojson.features[0];
      let shps = lap.filterGrids(lap.calcGrids(imageShp, 10, 10));
      let grids = shps.map((grid) => grid.properties.detail);
      grids = await gridCtrl.addStatus(grids);
      var arr = grids.map((grid) => new Grid(grid));
      let result = await Grid.insertMany(arr);
      if (result) {
        console.log("插入成功");
      }
    }
  },
  (e) => {
    console.log(e);
  }
);
