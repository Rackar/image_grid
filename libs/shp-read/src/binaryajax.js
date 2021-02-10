"use strict";
var Promise = require("lie");
var http = require("http");
var https = require("https");
var Url = require("url");
let path = require("path");
let fs = require("fs");
var Buffer = require("buffer").Buffer;
module.exports = binaryAjax;

function binaryAjax(url) {
  return new Promise(function (resolve, reject) {
    var type = url.slice(-3);
    var parsed = Url.parse(url);
    var method = http;
    if (parsed.protocol === "https:") {
      method = https;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      if (!path.isAbsolute(url)) {
        url = path.join(__dirname, "../../../", url);
      }
      let exist = fs.existsSync(url);
      if (exist) {
        let buffer = fs.readFileSync(url);
        if (type === "prj") {
          resolve(buffer.toString());
        } else {
          resolve(buffer);
        }
      } else {
        resolve();
      }
    } else {
      method
        .get(parsed, function (res) {
          var len = 0;
          var buffers = [];

          res.on("data", function (d) {
            len += d.length;
            buffers.push(d);
          });
          res.on("error", function (e) {
            reject(e);
          });
          res.on("end", function () {
            if (res.statusCode > 399) {
              if (type === "prj" || type === "cpg") {
                return resolve(false);
              } else {
                return reject(
                  new Error(Buffer.concat(buffers, len).toString())
                );
              }
            }
            var buffer = Buffer.concat(buffers, len);
            if (type === "prj") {
              resolve(buffer.toString());
            } else {
              resolve(buffer);
            }
          });
        })
        .on("error", function (e) {
          reject(e);
        });
    }
  });
}
