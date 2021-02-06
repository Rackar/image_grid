// const multer = require("koa-multer");

const router = require("koa-router")();
const grid = require("./api/grid");
// const star = require("./api/star/index");
// const cards = require("./api/cardManage/index");
// const lianyue = require("./noauth/lianyue/addArticle");
// const Article = require("../models/article");
router.prefix("/api");

router.use(grid.routes(), grid.allowedMethods()); // /person
// router.use(star.routes(), star.allowedMethods()); // /stars
// router.use(cards.routes(), cards.allowedMethods()); // /stars
// router.use(lianyue.routes(), lianyue.allowedMethods()); // /person
module.exports = router;
