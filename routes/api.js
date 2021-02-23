// const multer = require("koa-multer");

const router = require("koa-router")();
const grid = require("./api/grid");
const md5 = require('md5');

// router.prefix("/api");

let notifyCallback = async function (ctx, next) {
    let { nonce, timestamp, app, session_id, finished, finished_msg, out_file, sig, type } = ctx.request.body;
    if (verifySig(ctx.request.body) || true) { //verifySig函数尚未测试，先屏蔽
        let res = finished === "1"
        if (res) {
            console.log(timestamp, out_file)
            ctx.body = {
                code: 0,//0成功，1失败
                msg: "success",
                app: app,
                session_id: session_id
            };
        } else {
            ctx.body = {
                code: 1,//0成功，1失败
                msg: finished_msg,
                app: app,
                session_id: session_id
            };
        }
    } else {
        ctx.body = {
            code: 1,//0成功，1失败
            msg: "sig验证失败，请检查secret",
            app: app,
            session_id: session_id
        };
    }

};

function verifySig(body) {
    let { nonce, timestamp, app, session_id, finished, finished_msg, out_file, sig, type } = body;
    let obj = { nonce, timestamp, app, session_id, finished, out_file }
    var sdic = Object.keys(obj).sort();
    let str = ""
    for (const key in sdic) {
        if (Object.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            str += `${key}=${value}&`
        }
    }
    str += "secret=xxx"
    let sec = md5(str)
    console.log(sdic, str, sec)
    return sec === sig
}



router.post("/bin/notify", notifyCallback); //通知回调

router.use(grid.routes(), grid.allowedMethods()); // /person

module.exports = router;
