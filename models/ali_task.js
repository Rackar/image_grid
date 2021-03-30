var mongoose = require("../api/db_mongoose");
var Schema = mongoose.Schema;

var AliTaskSchema = new Schema(
  {
    // imageId: String,
    filename: String,
    previousFilename: String,
    shp: String,
    uuid: String,
    status: {
      type: String,
      enum: ["init", "skiped", "backup", "processing", "processed", "invalid"],
    },
  }
  // ,
  // { timestamps: true }
);
module.exports = mongoose.model("AliTask", AliTaskSchema);
// acquisitio:Wed May 27 2020 00:00:00 GMT+0800 (GMT+08:00)
// sensorid:'PMS'
// tarsize:'1974970984'
// batch:'202005290153140'
// scenerow:'93'
// cloudperce:'17.2000007629395'
// filename:'GF1D_PMS_E104.4_N37.4_20200527_L1A1256748026.tar.gz'
// orbitid:'11628'
// satellite:'GF1D'
// scenepath:'22'
