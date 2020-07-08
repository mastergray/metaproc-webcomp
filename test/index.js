WEBCOMP = require("../index.js")
UTIL = require("common-fn-js");

  WEBCOMP.ofHTML("./test/header.html", "html")
    .before("<!doctype html>")
    .modify((html, STATE) => STATE.$(html).attr("lang", "en"))
    .select("head")
      .append(WEBCOMP.createElement("meta", {"charset":"utf-8"}))
      .append(WEBCOMP.loadJS("./test/js/important.js", true))
      .append(WEBCOMP.loadJS("./test/js/more.important.js"))
      .append(WEBCOMP.loadCSS("./test/css/styles.css"))
      .append(WEBCOMP.loadCSS("./test/css/more.styles.css", true))
    .select("body")
      .append(WEBCOMP.createElement("main", {"id":"the-main"}, [
        WEBCOMP.createElement("div", {"class":"all-the-div"}),
        WEBCOMP.createElement("div", {"class":"all-the-div"}, [
          WEBCOMP.toHTML("<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>")
        ]),
        WEBCOMP.createElement("div", {"class":"all-the-div"})
      ]))
    .log(WEBCOMP.toString)
    .fail((err) => {
      console.log(err.msg)
    })
