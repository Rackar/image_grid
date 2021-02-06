var mongoose = require("../api/db_mongoose");
var Schema = mongoose.Schema;

var GridSchema = new Schema(
  {
    gridId: String,
    imageId: String,
    imageFilename: String,
    imageTime: Date,
    status: {
      type: String,
      enum: ["init", "skiped", "processing", "processed", "invalid"],
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Grid", GridSchema);
