var mongoose = require("mongoose");
//1.无密码登录方式
// var testDB = 'mongodb://10.163.6.211:27017/rackar'
// let testDB = "mongodb://localhost:27017/rackar";
// let option = { useNewUrlParser: true, useUnifiedTopology: true }
// mongoose.connect(
//   testDB,
//   option,
//   function (err) {
//     if (err) {
//       console.log("connect fail");
//     } else {
//       console.log("connect success");
//     }
//   }
// );
// 2.密码登录方式
let secret = require("./secret")
let db = {
  domin: "172.16.100.111",
  port: "27017",
  db: "rackar"
}
let testDB = `mongodb://${db.domin}:${db.port}/${db.db}?authSource=${db.db}`
//  "172.16.100.111:27017/rackar";
// let testDB = new String('').format('mongodb://{0}:{1}/{2}?authSource={2}', db.domin, db.port, db.db) // 
let option = {
  useNewUrlParser: true, useUnifiedTopology: true, user: secret.user,
  pass: secret.pass,
}
mongoose.connect(
  testDB,
  option,
  function (err) {
    if (err) {
      console.log("connect fail");
    } else {
      console.log("connect success");
    }
  }
);
module.exports = mongoose;
