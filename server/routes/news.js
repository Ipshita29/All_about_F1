const router = require("express").Router();
const { getNews } = require("../controllers/newsController");

router.get("/", getNews);
module.exports = router;