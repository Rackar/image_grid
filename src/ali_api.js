const request = require("request");
const urlencode = require("urlencode");
const config = {
  alibaba_ai: {
    server_dir: "/home/admin/tianxun/data/", //阿里AI服务器的数据路径 不管是不是nas出来，uploadtask的参数都应该是这个路径
    local_dir: "/ali_data/", //本机时的地址,与阿里AI服务器的server_dir是一样的 不过这是本机mount路径
    url: "http://173.0.0.186:30801/", //阿里AI服务器的服务地址
  },
};
const fs = require("fs");
const _app = "construction_change";
class ALI_API {
  static CONFIG = config.alibaba_ai
  constructor() {
  }
  static guid() {
    //用户自定义，全局唯一，只能包含数字、小写字母、下划线、中划线，最长32个字符
    return "xxxxxxxx_xxxx_4xxx_yxxx_xxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  static GetUrlByte(_url, qs, method = "get") {
    return new Promise((resolve) => {
      try {
        request(
          {
            url: _url,
            method: method,
            json: true,
            useQuerystring: true,
            headers: {
              "User-Agent":
                "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; QQWubi 133; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; CIBA; InfoPath.2)",
            },
            encoding: null,
            timeout: 10000,
            qs,
          },
          (error, response, result) => {
            if (error == null) {
              if (response.statusCode == 200) {
                if (result.code == "0") {
                  //成功
                  resolve({
                    status: true,
                    result: result,
                    session_id: qs.session_id,
                  });
                } else {
                  resolve({
                    status: false,
                    message: result.msg,
                    session_id: qs.session_id,
                  });
                }
              } else {
                resolve({
                  status: false,
                  message: result,
                  session_id: qs.session_id,
                });
              }
            } else {
              resolve({
                status: false,
                message: error.message,
                session_id: qs.session_id,
              });
            }
          }
        );
      } catch (error) {
        resolve({
          status: false,
          message: error.message,
          session_id: qs.session_id,
        });
      }
    });
  }
  static upload_task(_src, _des, _shp, _SESSION_ID) {
    let uri = `${config.alibaba_ai.url}bin/execute`;
    if (!_SESSION_ID) {
      _SESSION_ID = ALI_API.guid();
    }
    let shpfile_name = `${config.alibaba_ai.server_dir}result/${_SESSION_ID}.shp`;
    let shpfile_dir = `${config.alibaba_ai.local_dir}result`; //和上面的对应 不过一个是ai服务器地址 一个是本机mount地址
    if (!fs.existsSync(shpfile_dir)) {
      fs.mkdirSync(shpfile_dir, { recursive: true });
    }
    let out_file_shp = {
      shp: shpfile_name,
      shx: shpfile_name.replace(".shp", ".shx"),
      dbf: shpfile_name.replace(".shp", ".dbf"),
      cpg: shpfile_name.replace(".shp", ".cpg"),
      prj: shpfile_name.replace(".shp", ".prj"),
    };
    let src_file_json = {
      src: `${config.alibaba_ai.server_dir}${_src}`, //src  "/home/admin/tianxun/data/changping_2014-03-14_18_merged.tif"
      des: `${config.alibaba_ai.server_dir}${_des}`, //des "/home/admin/tianxun/data/changping_2019-03-24_18_merged.tif"
    };
    if (_shp) {
      src_file_json[
        "shp"
      ] = `${config.alibaba_ai.server_dir}yangxu_result/${_shp}.shp`;
    }
    let out_file_shp_string = JSON.stringify(out_file_shp);
    let data = {
      app: _app,
      src_file: urlencode(JSON.stringify(src_file_json)),
      session_id: _SESSION_ID,
      out_file: urlencode(out_file_shp_string),
      access_token: "access_token",
      user_id: "user_id",
      timestamp: Date.now(),
    };
    return ALI_API.GetUrlByte(uri, data);
  }
  static search_task(_SESSION_ID) {
    let uri = `${config.alibaba_ai.url}bin/query`;
    let data = {
      app: _app,
      session_id: _SESSION_ID,
      access_token: "access_token",
      user_id: "user_id",
      timestamp: Date.now(),
    };
    return ALI_API.GetUrlByte(uri, data);
  }
  static download_task(_SESSION_ID) {
    let uri = `${config.alibaba_ai.url}bin/download`;
    let data = {
      app: _app,
      session_id: _SESSION_ID,
      access_token: "access_token",
      user_id: "user_id",
      timestamp: Date.now(),
    };
    return ALI_API.GetUrlByte(uri, data);
  }
  static delete_task(_SESSION_ID) {
    let uri = `${config.alibaba_ai.url}bin/delete`;
    let data = {
      app: _app,
      session_id: _SESSION_ID,
      access_token: "access_token",
      user_id: "user_id",
      timestamp: Date.now(),
    };
    return ALI_API.GetUrlByte(uri, data);
  }
}
module.exports = ALI_API;
