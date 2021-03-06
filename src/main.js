const shp = require("../libs/shp-read");
const fs = require("fs");
const log = require('single-line-log').stdout;
const turf_geometry = require("./turf_geometry");
const gridCtrl = require("./gridCtrl");
const Grid = require("../models/grid");
const Task = require("../models/ali_task");
const shpwrite = require("../libs/shp-write");
const request = require("request");

const ALI_API = require("./ali_api");

const latSecs = 50,
  longSecs = 50;
const params = {
  changguang: {
    filename: "proId",
    acquisitio: "time",
    cloudperce: "cloud",
    angle: 4.5,
    elevation: 24.6066,
    imageGsd: 0.76
  },
  zrzyb: {
    filename: "filename",
    acquisitio: "acquisitio",
    cloudperce: "cloudperce",
  },
  biaozhun: {
    filename: "filename",
    acquisitio: "time",
  }
}

// findImagesInFeature()

// readShapeFile("./myshapes/02", 'changguang')
// readJSONFile("./myshapes/01.json", 'changguang')
// readJSONFile("./myshapes/202101.geojson", 'biaozhun')

async function readJSONFile(url = "./myshapes/01.json", type = "") {
  let string = fs.readFileSync(url, 'utf-8')
  // string = string.toString('utf8').replace(/^\uFEFF/, '') //去除bom文件头
  let geojson = JSON.parse(string)
  await workflow(geojson, url, type)
}

async function readShapeFile(url = "./myshapes/test_end", type = "") {
  // http服务器下的test.shp或者程序根目录下的相对路径或绝对路径
  await shp(url)
    .then(
      async function (geojson) {
        workflow(geojson, url, type)
      },
      (e) => {
        console.log("shp读取出错，检查路径", e);
      }
    )
    .catch((e) => {
      console.log(e)
    });
}

async function workflow(geojsonString, url, type) {
  let geojson = geojsonString
  if (typeof geojsonString === 'string') {
    try {
      geojson = JSON.stringify(geojson)
    } catch (error) {
      console.log(error)
      return error.toString()
    }
  }

  let msg = "" + url;
  let features = geojson.features
  let time1 = new Date()
  if (type === "changguang") {
    features = features.map(feature => {
      return {
        type: feature.type,
        geometry: feature.geometry,
        properties: {
          filename: feature.properties.proId + "_PAN_funse.tif", //TODO 这里硬改写了长光文件名，添加了正射后缀
          acquisitio: feature.properties.time,
          cloudperce: feature.properties.cloud
        }
      }
    }
    )
  } else if (type === "biaozhun") {
    features = features.map(feature => {
      return {
        type: feature.type,
        geometry: feature.geometry,
        properties: {
          filename: feature.properties.filename, //标准名.tif 无需修改
          acquisitio: feature.properties.time,
        }
      }
    }
    )
  }
  console.log("影像数量为：", features.length);
  msg += "影像数量为" + features.length;
  let uniqueImages = await checkImageExist(features)
  let time1_1 = new Date()
  msg += `，检查重复耗时${(time1_1 - time1) / 1000}`;
  let allNewGrids = [];
  allNewGrids = await featuresToGrids(uniqueImages);
  let time1_2 = new Date()

  msg += taskLog("，涉及格网" + allNewGrids.length);
  msg += taskLog(`，转换格网耗时${(time1_2 - time1_1) / 1000}`);
  //主要优化与查重逻辑
  let uniqueBackupArray = optimizeImages(allNewGrids);
  let time1_3 = new Date()
  msg += taskLog(`，优化调整耗时${(time1_3 - time1_2) / 1000}`);
  let group = gridsToGroupImage(uniqueBackupArray);
  let time2 = new Date()
  msg += taskLog("，待处理非重格网" + uniqueBackupArray.length + `，分组耗时${(time2 - time1_3) / 1000}，总计算耗时${(time2 - time1) / 1000}`);
  //生产shp文件
  groupImagesToShp(group);
  let time3 = new Date()
  msg += taskLog(`，任务数量为${group.length}，保存shp耗时${(time3 - time2) / 1000}`);
  //编号对齐
  addUuidToGrids(allNewGrids, group);
  //更新数据库 滞后
  await insertToDatabase(allNewGrids);

  //进行处理发送命令
  let tasks = await beginProcessing(group, url);

  // //添加给tml的回退
  // let cbMsg = await tasksCallback(tasks)
  // console.log("任务给谭回调状态: ", cbMsg.result || cbMsg.message)

  //TODO 修改数据库状态
  await changeProcessed(group);
  let time4 = new Date()
  msg += taskLog(`，数据库更新条数为${allNewGrids.length}，耗时${(time4 - time3) / 1000}，任务总耗时${(time4 - time1) / 1000}。\n`);
  fs.writeFileSync("./log.txt", msg, { flag: "a" });
  console.log(msg);
  return msg;
}

function taskLog(text) {
  log(text)
  return text
}

function tasksCallback(tasks) {
  let _url = "http://talatan.com:29111/static/noauth/change/compute_back"
  let method = "POST"
  return new Promise((resolve) => {
    try {
      request(
        {
          url: _url,
          method: method,
          json: true,
          useQuerystring: true,
          encoding: null,
          timeout: 10000,
          body: tasks
        },
        (error, response, result) => {
          if (error == null) {
            if (response.statusCode == 200) {
              if (result.code == "0") {
                //成功
                resolve({
                  status: true,
                  result: result,
                });
              } else {
                resolve({
                  status: false,
                  message: result.msg,
                });
              }
            } else {
              resolve({
                status: false,
                message: result,
              });
            }
          } else {
            resolve({
              status: false,
              message: error.message,
            });
          }
        }
      );
    } catch (error) {
      resolve({
        status: false,
        message: error.message,
      });
    }
  });
}

async function checkImageExist(features) {
  //TODO 内部查重先跳过，认为非重
  let uniqueFeatures = unique(features, ["properties", "filename"])
  let filenames = uniqueFeatures.map((grid) => grid.properties.filename);
  let existGrids = await Grid.find({
    // occupation: /host/,
    // "name.last": "Ghost",
    // age: { $gt: 17, $lt: 66 },
    // status: { $ne: "invalid" },
    filename: { $in: filenames },
  });
  let existFilenames = existGrids.map((grid) => grid.filename)
  let checkedFeatures = uniqueFeatures.filter(feature => !existFilenames.includes(feature.properties.filename))
  return checkedFeatures;
}

//对象数组根据某一属性去重
function unique(arr, keys = ["properties", "filename"]) {
  return arr.reduce((prev, cur) => prev.some(pre => {
    let p, c
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i]
      p = p ? p[key] : pre[key]
      c = c ? c[key] : cur[key]
    }
    return p === c
  }) ? prev : [...prev, cur], []);
}

//废弃
async function singleTask(geometryBefore, geometryAfter) {
  if (!geometryBefore) {
    geometryBefore = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [
              104,
              41,
            ],
            [
              105,
              41,
            ],
            [
              105,
              42,
            ],
            [
              104,
              42,
            ],
            [
              104,
              41,
            ],
          ],
        ],
      },
      properties: {
        filename: "ZY02C_HRC_E105.1_N41.2_20200527_L1C0004586511.tar.gzaa",
        batch: "202005300156540",
        tarsize: "651853029",
        satellite: "ZY02C",
        sensorid: "HRC",
        acquisitio: {
        },
        cloudperce: "8",
        orbitid: "44171",
        scenepath: "27",
        scenerow: "105",
      },
    }
    geometryAfter = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [
              104.5,
              41,
            ],
            [
              105.5,
              41,
            ],
            [
              105.5,
              42,
            ],
            [
              104.5,
              42,
            ],
            [
              104.5,
              41,
            ],
          ],
        ],
      },
      properties: {
        filename: "ZY02C_HRC_E105.1_N41.2_20200527_L1C0004586511.tar.gzaa",
        batch: "202005300156540",
        tarsize: "651853029",
        satellite: "ZY02C",
        sensorid: "HRC",
        acquisitio: {
        },
        cloudperce: "8",
        orbitid: "44171",
        scenepath: "27",
        scenerow: "105",
      },
    }
  }
  let geometry = turf_geometry.intersect(geometryBefore, geometryAfter)
  let allNewGrids = [];
  let msg = ""
  allNewGrids = await featuresToGrids([geometry]);
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
}

async function checkMainLogic(newGrids, oldGrids) {
  //主要逻辑
  return newGrids
}

async function saveToDB(gridsResultTosave) {

}

async function redo(url = "./myshapes/test") {
  let shape = await shp(fileBefore)
  let uniqueImages = await checkImageExist(shape) //有查数据库
  let importGrids = [];
  importGrids = await featuresToGridsNoDB(uniqueImages);
  let existGrids = []
  existGrids = await getOldGrids(importGrids)

  let gridsResultTosave = checkMainLogic(importGrids, existGrids)
  saveToDB(gridsResultTosave)
  let group = gridsToGroupImage(gridsResultTosave);
  //生产shp文件
  groupImagesToShp(group);
  //编号对齐
  addUuidToGrids(gridsResultTosave, group);
  //更新数据库 滞后
  await insertToDatabase(allNewGrids);
  //进行处理发送命令
  await beginProcessing(group);
  //修改数据库状态
  await changeProcessed(group);

  // let allAddedStatusGrids = await addStatusToGrids(importGrids)
}

async function getOldGrids(grids, UseMongoDB = true, DB = []) {
  let ids = [...new Set(grids.map((grid) => grid.gridId))];
  let existGrids = []
  if (UseMongoDB) {
    existGrids = await Grid.find({
      // occupation: /host/,
      // "name.last": "Ghost",
      // age: { $gt: 17, $lt: 66 },
      status: { $ne: "invalid" },
      gridId: { $in: ids },
    });
  } else {
    existGrids = DB.filter(existGridinDB => {
      return ids.includes(existGridinDB.gridId) && existGridinDB.status !== "invalid"
    })
  }
}

async function forceProcessTwoShapes(fileBefore = "./myshapes/test", fileAfter = "./myshapes/test_end", importToDB = false) {
  if (importToDB) {
    return
  }
  let DB = []
  let shapeBefore = await shp(fileBefore)
  let shpaeAfter = await shp(fileAfter)
  let uniqueImagesBefore = await checkImageExist(shapeBefore)
  let uniqueImagesAfter = await checkImageExist(shpaeAfter)
  let allOldGrids = [];
  allOldGrids = await featuresToGridsNoDB(shapeBefore.features);
  allOldGrids = await addStatusToGrids(allOldGrids, false, DB)

  let allNewGrids = [];
  allNewGrids = await featuresToGridsNoDB(shpaeAfter.features);
  allOldGrids = await addStatusToGrids(allOldGrids, false, DB)
}

async function forceProcessWithTwoImages(filenameBefore, filenameAfter) {
  let newDomName = getStandardFilename(filenameAfter);
  let oldDomName = getStandardFilename(filenameBefore);
  let uuid = ALI_API.guid()
  let result = await Grid.updateMany({ filename: filenameAfter }, { status: "processing" });

  if (result && result.length) {
    console.log("区域涉及影像", images.length);
  } else {
    console.log("未找到数据");
  }

  ALI_API.upload_task(newDomName, oldDomName, "", uuid);
  return result
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
        grid.status &&
        grid.status === "processing" &&
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
      turf_geometry.calcGrids(imageShp, longSecs, latSecs)
    );
    let gridsFeature = shps.map((grid) => grid.properties.detail);
    let grids = await gridCtrl.addStatus(gridsFeature);
    if (grids && grids.length) allNewGrids.push(...grids);
  }
  return allNewGrids;
}
async function featuresToGridsRE(features) {
  let allNewGrids = [];
  let girdsList = [];
  let result = []
  for (let i = 0; i < features.length; i++) {
    const imageShp = features[i];
    let shps = turf_geometry.filterGrids(
      turf_geometry.calcGrids(imageShp, longSecs, latSecs)
    );
    let gridsFeature = shps.map((grid) => grid.properties.detail);
    girdsList.push(gridsFeature)
    if (gridsFeature && gridsFeature.length) allNewGrids.push(...gridsFeature);
  }
  let ids = allNewGrids.map((grid) => grid.gridId);
  const existGrids = await Grid.find({
    // occupation: /host/,
    // "name.last": "Ghost",
    // age: { $gt: 17, $lt: 66 },
    status: { $ne: "invalid" },
    gridId: { $in: ids },
  });
  for (let j = 0; j < girdsList.length; j++) {
    let grids = girdsList[j];
    let resultGrids = await gridCtrl.addStatus(grids, existGrids);
    if (resultGrids && resultGrids.length) result.push(...resultGrids);
  }
  return result;
}



async function featuresToGridsNoDB(features) {
  let allNewGrids = [];
  for (let i = 0; i < features.length; i++) {
    const imageShp = features[i];
    let shps = turf_geometry.filterGrids(
      turf_geometry.calcGrids(imageShp, longSecs, latSecs)
    );
    let gridsFeature = shps.map((grid) => grid.properties.detail);
    // let grids = await gridCtrl.addStatus(gridsFeature, false, DB);
    if (gridsFeature && gridsFeature.length) {
      allNewGrids.push(...gridsFeature);
      // DB.push(...grids)
    }
  }
  return allNewGrids;
}

async function checkMainLogic(grids, existGrids) {
  let ids = [...new Set(grids.map((grid) => grid.gridId))];
  let tempDB = []
  for (let i = 0; i < grids.length; i++) {
    const gird = grids[i];

  }


  let processingIds = [];
  let updateGrids = []
  //只要查询不报错，existGrids即为数组，不用管length为0
  if (existGrids) {

    for (let j = 0; j < grids.length; j++) {
      let newGrid = grids[j];
      //按照时间倒排
      let existGridRecords = [...
        (existGrids
          .filter((grid) => grid.gridId === newGrid.gridId)),
      ...(updateGrids
        .filter((grid) => grid.gridId === newGrid.gridId))]
        .sort((a, b) => b.acquisitio - a.acquisitio);

      //本格网数据为0
      if (existGridRecords.length === 0) {
        newGrid.status = "init";
        updateGrids.push(newGrid)
        continue;
      }

      //本格网仅初始化过，尚未比对
      if (
        existGridRecords.filter(
          (grid) => grid.status === "processing" || grid.status === "processed"
        ).length === 0
      ) {
        let init = existGridRecords.find((grid) => grid.status === "init");
        if (init && newGrid.filename === init.filename) {
          continue;
        }
        if (
          init &&
          init.acquisitio &&
          newGrid.filename !== init.filename &&
          checkTimeGap(init.acquisitio, newGrid.acquisitio)
        ) {
          newGrid.status = "backup";
          newGrid.previousFilename = init.filename;
          processingIds.push(j);
          updateGrids.push(newGrid)
          continue;
        }
      }

      //正常的
      for (let k = 0; k < existGridRecords.length; k++) {
        const grid = existGridRecords[k];

        if (grid.status === "processing") {
          continue;
        } else if (
          grid.status === "processed" &&
          checkTimeGap(grid.acquisitio, newGrid.acquisitio)
        ) {
          newGrid.status = "backup";
          newGrid.previousFilename = grid.filename;
          processingIds.push(j);
          updateGrids.push(newGrid)
          continue;
        }
      }

      //漏网的
      if (newGrid.status === "init" || newGrid.status === "processing" || newGrid.status === "backup") {
      } else {
        newGrid.status = "skiped";
        updateGrids.push(newGrid)
      }
    }
  } else {
    console.log("连接数据库失败");
  }



  //提交处理队列
  if (processingIds.length) {
    console.log("需处理数量为", processingIds.length);
    // for (let i = 0; i < processingIds.length; i++) {
    //   let grid = grids[processingIds[i]];
    //   console.log(grid);
    // }
  }

  //更新DB
  if (UseMongoDB) {
    await insertToDatabase(updateGrids)
  } else {
    DB = DB.concat(...updateGrids)
  }


  return grids;
}

async function addStatusToGrids(grids, UseMongoDB = false, DB = []) {
  let ids = [...new Set(grids.map((grid) => grid.gridId))];
  let existGrids = []
  if (UseMongoDB) {
    existGrids = await Grid.find({
      // occupation: /host/,
      // "name.last": "Ghost",
      // age: { $gt: 17, $lt: 66 },
      status: { $ne: "invalid" },
      gridId: { $in: ids },
    });
  } else {
    existGrids = DB.filter(existGridinDB => {
      return ids.includes(existGridinDB.gridId) && existGridinDB.status !== "invalid"
    })
  }


  let repeatedIds = [],
    processingIds = [];
  let updateGrids = []
  //只要查询不报错，existGrids即为数组，不用管length为0
  if (existGrids) {

    for (let j = 0; j < grids.length; j++) {
      let newGrid = grids[j];
      //按照时间倒排
      let existGridRecords = [...
        (existGrids
          .filter((grid) => grid.gridId === newGrid.gridId)), ...updateGrids]
        .sort((a, b) => b.acquisitio - a.acquisitio);

      //本格网数据为0
      if (existGridRecords.length === 0) {
        newGrid.status = "init";
        updateGrids.push(newGrid)
        continue;
      }

      //本格网仅初始化过，尚未比对
      if (
        existGridRecords.filter(
          (grid) => grid.status === "processing" || grid.status === "processed"
        ).length === 0
      ) {
        let init = existGridRecords.find((grid) => grid.status === "init");
        if (init && newGrid.filename === init.filename) {
          repeatedIds.push(j);
          continue;
        }
        if (
          init &&
          init.acquisitio &&
          newGrid.filename !== init.filename &&
          checkTimeGap(init.acquisitio, newGrid.acquisitio)
        ) {
          newGrid.status = "backup";
          newGrid.previousFilename = init.filename;
          processingIds.push(j);
          updateGrids.push(newGrid)
          continue;
        }
      }

      //正常的
      for (let k = 0; k < existGridRecords.length; k++) {
        const grid = existGridRecords[k];
        if (
          grid.filename === newGrid.filename &&
          grid.gridId === newGrid.gridId
        ) {
          repeatedIds.push(j);
          ////重复提交记录，需要标记，循环结束后删除
        }

        if (grid.status === "processing") {
          continue;
        } else if (
          grid.status === "processed" &&
          checkTimeGap(grid.acquisitio, newGrid.acquisitio)
        ) {
          newGrid.status = "backup";
          newGrid.previousFilename = grid.filename;
          processingIds.push(j);
          updateGrids.push(newGrid)
          continue;
        }
      }

      //漏网的
      if (newGrid.status === "init" || newGrid.status === "processing" || newGrid.status === "backup") {
      } else {
        newGrid.status = "skiped";
        updateGrids.push(newGrid)
      }
    }
  } else {
    console.log("连接数据库失败");
  }

  //去掉重复提交任务，测试时屏蔽此代码
  if (repeatedIds.length) {
    console.log("重复提交数为", repeatedIds.length);
    for (let i = repeatedIds.length - 1; i >= 0; i--) {
      let j = repeatedIds[i];
      grids.splice(j, 1);
    }
  }

  //提交处理队列
  if (processingIds.length) {
    console.log("需处理数量为", processingIds.length);
    // for (let i = 0; i < processingIds.length; i++) {
    //   let grid = grids[processingIds[i]];
    //   console.log(grid);
    // }
  }

  //更新DB
  if (UseMongoDB) {
    await insertToDatabase(updateGrids)
  } else {
    DB = DB.concat(...updateGrids)
  }


  return grids;
}



async function findImagesInFeature(feature) {
  if (!feature) {
    feature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [
              104,
              41,
            ],
            [
              105,
              41,
            ],
            [
              105,
              42,
            ],
            [
              104,
              42,
            ],
            [
              104,
              41,
            ],
          ],
        ],
      },
    }
  }
  let shps = turf_geometry.filterGrids(
    turf_geometry.calcGrids(feature, longSecs, latSecs)
  );
  let gridIds = shps.map((grid) => grid.properties.detail.gridId);
  let result = await Grid.find({ gridId: { $in: gridIds } });
  let images =
    [
      ...new Set(result.map(grid => grid.filename)),
    ];
  if (images && images.length) {
    console.log("区域涉及影像", images.length);
  } else {
    console.log("未找到数据");
  }
  return images
}

function changeProcessed(group) { }

async function beginProcessing(group, url) {
  let list = []
  for (let i = 0; i < group.length; i++) {
    const pair = group[i];
    let previousFilename = getStandardFilename(pair.previousFilename);
    let filename = getStandardFilename(pair.filename);

    let json = { previousFilename, filename, shp: pair.uuid, uuid: pair.uuid }
    list.push(json)
    // ALI_API.upload_task(previousFilename, filename, pair.uuid, pair.uuid); //TODO 自动发任务暂时屏蔽
  }
  fs.writeFileSync("./shp/tasks.json", JSON.stringify(list, null, 2), "");
  let tasks = await insertTasksToDatabase(list, url)
  return tasks || []
}

async function insertTasksToDatabase(tasks, url) {
  if (tasks && tasks.length) {
    let now = new Date()
    url = url || now.toLocaleString()
    tasks = tasks.map(task => {
      task.batch = url
      return task
    })
    let result = await Task.insertMany(tasks)
    if (result && result.length) {
      console.log("任务插入成功", result.length);
    } else {
      console.log("未插入数据库任何记录");
    }
  }
  return tasks
}

async function startAliProcess(params) {
  let tasks = await Task.find(params)
  let msgs = []
  if (tasks && tasks.length) {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      let { previousFilename, filename, shp } = task
      let msg = await ALI_API.upload_task(previousFilename, filename, shp, task.uuid)
      msgs.push(msg)

      console.log(msg)
      tasksCallback(tasks)
    }
    let result = await Task.updateMany(params, {
      status: "processing",
    })
    console.log('更新任务处理状态', result)
  } else {
    console.log("未找到任何记录");
  }
  return msgs
}

async function getAliStatus(session_id) {
  let msg = await ALI_API.search_task(session_id)
  console.log(msg)
  return msg
}

async function finishTask(uuid) {
  let res = await Task.updateOne({ uuid }, { status: "processed" })

  return res || "完成任务写入失败"

}

function getStandardFilename(filename) {
  let DOMfilename = filename;
  return DOMfilename;
}

async function insertToDatabase(allBackupGrids) {
  let importBatch = ALI_API.guid()
  var arr = allBackupGrids.map((grid) => {
    grid.importBatch = importBatch
    return new Grid(grid)
  });
  let result = await Grid.insertMany(arr);
  if (result && result.length) {
    console.log("格网插入成功", result.length);
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
  if (!fs.existsSync('./shp')) {
    fs.mkdirSync('shp', { recursive: true });
  }
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

// let features = [{ "type": "Feature", "properties": { "filename": "JKF01007500574500051010020210125111214003F.tif", "time": "20210125111214" }, "geometry": { "type": "Polygon", "coordinates": [[[105.953, 40.8644], [105.893, 40.6549], [106.162, 40.6119], [106.222, 40.8212], [105.953, 40.8644]]] } }, { "type": "Feature", "properties": { "filename": "JKF01007500574500061010020210125111217003F.tif", "time": "20210125111217" }, "geometry": { "type": "Polygon", "coordinates": [[[105.899, 40.6755], [105.84, 40.4658], [106.108, 40.4234], [106.168, 40.6324], [105.899, 40.6755]]] } }, { "type": "Feature", "properties": { "filename": "JKF01007500562200021010020210117112505003F.tif", "time": "20210117112505" }, "geometry": { "type": "Polygon", "coordinates": [[[102.232, 39.2663], [102.175, 39.0576], [102.439, 39.0138], [102.496, 39.2226], [102.232, 39.2663]]] } }]
// let mutilRings = polygonsToMutilRings(features);
// generateShp(mutilRings, "a")
function generateShp(features, filename, zip = false) {
  // (optional) set names for feature types and zipped folder
  var options = {
    folder: '/ali_data/yangxu_result/',
    filename,
    types: {
      point: "mypoints",
      polygon: "mypolygons",
      line: "mylines",
    },
  };



  if (zip) {
    // ///压缩到zip
    let arr = shpwrite.zip(
      {
        type: "FeatureCollection",
        features,
      },
      options
    );
    fs.writeFileSync("/ali_data/yangxu_result/" + filename + ".zip", arr, "");

    console.log("保存shp压缩包成功");
  } else {
    ////  // 不要压缩
    shpwrite.unzip(
      {
        type: "FeatureCollection",
        features,
      },
      options
    );
  }



}

exports.readShapeFile = readShapeFile;
exports.readJSONFile = readJSONFile
exports.forceProcessWithTwoImages = forceProcessWithTwoImages
exports.findImagesInFeature = findImagesInFeature
exports.startAliProcess = startAliProcess
exports.getAliStatus = getAliStatus
exports.workflow = workflow
exports.finishTask = finishTask
