var turf = require("@turf/turf");

let latSecs = 5,
  longSecs = 5;
let polygon1 = turf.polygon(
  [
    [
      [111.1, 40.1],
      [111.4, 40.1],
      [111.4, 40.5],
      [111.1, 40.5],
      [111.1, 40.1],
    ],
  ],
  { name: "poly1", imageTime: Date.now(), imageFilename: "filename" }
);

// let updateGrids = filterGrids(calcGrids(polygon1, longSecs, latSecs));
function updateGrids() {
  return filterGrids(calcGrids(polygon1, longSecs, latSecs));
}
// console.log();

//根据格网大小，将外包矩形扩大对齐到网格
function calcExtendBoundingBoxWithTurf(imagePolygon, longSection, latSection) {
  let bbox = turf.bbox(imagePolygon);
  if (!bbox || bbox.length != 4) return new Error("外包矩形计算出错");
  let [MinX, MinY, MaxX, MaxY] = [...bbox];
  console.log(MinX, MinY, MaxX, MaxY);
  let minLong =
    Math.floor((MinX - Math.floor(MinX)) * longSection) / longSection +
    Math.floor(MinX);
  let minLat =
    Math.floor((MinY - Math.floor(MinY)) * latSection) / latSection +
    Math.floor(MinY);
  let maxLong =
    Math.ceil((MaxX - Math.floor(MaxX)) * longSection) / longSection +
    Math.floor(MaxX);
  let maxLat =
    Math.ceil((MaxY - Math.floor(MaxY)) * latSection) / latSection +
    Math.floor(MaxY);
  console.log(minLong, minLat, maxLong, maxLat);
  return [minLong, minLat, maxLong, maxLat];
}

//根据经纬度和代号大小计算网格编号如11140020020018019

function calcGridId(long, lat, longSection, latSection) {
  let startX = prefixNumLength(Math.floor(long), 3);
  let startY = prefixNumLength(Math.floor(lat), 2);
  let SecX = prefixNumLength(longSection, 3);
  let SecY = prefixNumLength(latSection, 3);
  let CountX = prefixNumLength(Math.round((long - startX) * longSection), 3);
  let CountY = prefixNumLength(Math.round((lat - startY) * latSection), 3);
  let id = `${startX}${startY}${SecX}${SecY}${CountX}${CountY}`;
  return id;
}

calcPolygonFromGridId("11140020020017015");
//格网id反算格网
function calcPolygonFromGridId(id) {
  let startX = id.substring(0, 3) - 0;
  let startY = id.substring(3, 5) - 0;
  let longSection = id.substring(5, 8) - 0;
  let latSection = id.substring(8, 11) - 0;
  let CountX = id.substring(11, 14) - 0;
  let CountY = id.substring(14, 17) - 0;
  let long = startX + CountX / longSection;
  let lat = startY + CountY / latSection;
  let grid = generateGrid(long, lat, longSection, latSection);
  return grid;
}

//左下角坐标生成标准格网
function generateGrid(long, lat, longSection, latSection) {
  let grid = turf.polygon([
    [
      [long, lat],
      [long + Math.round((1 * 1000) / longSection) / 1000, lat],
      [
        long + Math.round((1 * 1000) / longSection) / 1000,
        lat + Math.round((1 * 1000) / latSection) / 1000,
      ],
      [long, lat + Math.round((1 * 1000) / latSection) / 1000],
      [long, lat],
    ],
  ]);
  return grid;
}

function calcGrids(imagePolygon, longSection, latSection) {
  let ExtendBbox = calcExtendBoundingBoxWithTurf(
    imagePolygon,
    longSection,
    latSection
  );
  let x = Math.round(
    ((ExtendBbox[2] * 100 - ExtendBbox[0] * 100) * longSection) / 100
  );
  let y = Math.round(
    ((ExtendBbox[3] * 100 - ExtendBbox[1] * 100) * latSection) / 100
  );
  let grids = [];
  for (let i = 0; i < x; i++) {
    let long = ExtendBbox[0] + Math.round((i / longSection) * 1000) / 1000;
    for (let j = 0; j < y; j++) {
      let lat = ExtendBbox[1] + Math.round((j / latSection) * 1000) / 1000;
      let grid = generateGrid(long, lat, longSection, latSection);
      let containStatus = contain(imagePolygon, grid);
      //   if (containStatus) {
      //     console.log("contain");
      //   }
      grid.properties.detail = {
        containStatus,
        imageTime: imagePolygon.properties.imageTime,
        imageFilename: imagePolygon.properties.imageFilename,
        gridId: calcGridId(long, lat, longSection, latSection),
      };
      grids.push(grid);
    }
  }
  return grids;
}

function filterGrids(grids) {
  let filtered = grids.filter(
    (grid) => grid.properties.detail.containStatus === true
  );
  console.log(filtered.length);
  return filtered;
}

function updateToDatabase(grids) {
  //更新grids到数据库
  let object = {
    imageTime: "",
    imageFilename: "",
    id: "gridid",
  };
}

function contain(imagePoly, gridPoly) {
  return turf.booleanContains(imagePoly, gridPoly);
}

console.log(prefixNumLength(2, 2));

//   if (!Number.isInteger(num)) {
//     throw new Error("not integer");
//   }
//递归方式实现整数前补0
function prefixNumLength(num, length) {
  if ((num + "").length >= length) {
    return num;
  }
  return prefixNumLength("0" + num, length);
}

exports.updateGrids = updateGrids;
