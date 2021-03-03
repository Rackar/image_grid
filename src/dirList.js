const fs = require("fs")
const { dirname } = require("path")
const ALI_API = require('./ali_api')
const config = ALI_API.CONFIG
testSubDir()
function getTIFs(dirOld = "d:/11/", dirNew = "d:/11/") {
    if (!dirOld && !dirNew) {
        dirOld = "d:/11/", dirNew = "d:/11/"
    }
    let filesOld = fs.readdirSync(dirOld)
    let filesNew = fs.readdirSync(dirNew)
    let fileList = filesNew.filter(file => filesOld.includes(file))
    console.log(fileList)
    fileList.forEach(async (filename) => {
        let uuid = ALI_API.guid()
        ALI_API.upload_task(dirNew + filename, dirOld + filename, "", uuid)
    });

}

function testSubDir() {
    let c = ALI_API.CONFIG
    let uuid = ALI_API.guid()
    ALI_API.upload_task("test/CHP_2m1_2.tif", "CHP_2m1_0.tif", "", uuid)
}