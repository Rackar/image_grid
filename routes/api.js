// const multer = require("koa-multer");

const router = require("koa-router")();
const grid = require("./api/grid");

router.prefix("/api");

router.use(grid.routes(), grid.allowedMethods()); // /person

module.exports = router;
