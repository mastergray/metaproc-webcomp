const UTIL = require("common-fn-js");   // Utility methods
const METAPROC = require("metaproc");   // How this gets structured
const cheerio = require("cheerio");     // HTML Parser
const axios = require("axios");         // For making HTTP requests

// Uses metaproc-js to generate HTML files
module.exports = WEBCOMP = (STATE) => METAPROC.Standard(STATE)

  // select :: (STRING) -> (METAPROC) -> METAPROC
  // Binds node returned by selector to "selected" PROPERTY of STATE:
  .augment("select", (selector) => metaproc => metaproc.apto("selected", (selected, STATE) => {
    return STATE.$(selector)
  }))

  // modify :: (NODE, STATE -> VOID) -> (METAPROC) -> METAPROC
  // Applies function to selected node:
  // NOTE: Result of function applied to selected node is not bound to "selected" PROPERTY:
  .augment("modify", (fn) => metaproc => metaproc.apto("selected", async (selected, STATE) => {
    await fn(selected, STATE);
    return selected;
  }))

  /**
   *
   *  DOM Operations
   *
   */

  // append :: (NODE|STRING|PROMISE(NODE|STRING)) -> (METAPROC) -> METAPROC
  // Appends NODE, HTMLString, or PROMISE of NODE or HTMLString to selected element:
  .augment("append", (node) => metaproc => metaproc.apto("selected", async (selected, STATE) => {
    selected.append(await node);
    return selected;
  }))

  // prepend :: (NODE|STRING|PROMISE(NODE|STRING)) -> (METAPROC) -> METAPROC
  // Prepends NODE, HTMLString, or PROMISE of NODE or HTMLString to selected element:
  .augment("prepend", (node) => metaproc => metaproc.apto("selected", async (selected, STATE) => {
    selected.prepend(await node);
    return selected;
  }))

  // after :: (NODE|STRING|PROMISE(NODE|STRING)) -> (METAPROC) -> METAPROC
  // Inserts NODE, HTMLString, or PROMISE of NODE or HTMLString after selected NODE:
  .augment("after", (node) => metaproc => metaproc.apto("selected", async (selected, STATE) => {
    selected.after(await node);
    return selected;
  }))

  // before :: (NODE|STRING|PROMISE(NODE|STRING)) -> (METAPROC) -> METAPROC
  // Inserts NODE, HTMLString, or PROMISE of NODE or HTMLStringg before selected NODE:
  .augment("before", (node) => metaproc => metaproc.apto("selected", async (selected, STATE) => {
    selected.before(await node);
    return selected;
  }))


  // replace :: (NODE|STRING|PROMISE(NODE|STRING)) -> (METAPROC) -> METAPROC
  // Replace selected node with given NODE, HTMLString, or PROMISE of NODE or HTMLString:
  .augment("replace", (node) => metaproc => metaproc.apto("selected", async (selected, STATE) => {
    selected.replaceWith(await node);
    return selected;
  }))

  // innerHTML :: (NODE|STRING|PROMISE(NODE|STRING)) -> (METAPROC) -> METAROC
  // Replace HTML with NODE, HTMLString, or PROMISE of NODE or HTMLString:
  .augment("innerHTML", (HTMLString) => metaproc => metaproc.apto("selected", async (selected, STATE) => {
    selected.empty();
    selected.append(await HTMLString);
    return selected;
  }))

  // remove :: (VOID) -> (METAPROC) -> METAPROC
  // Removes selected NODE:
  // NOTE: UNDEFINED is then set as the "selected" node:
  .augment("remove", () => metaproc => metaproc.apto("selected", (selected, STATE) => {
    selected.remove();
    return undefined;
  }))

/**
 *
 *  "Static" Methods
 *
 */

  // unit :: STRING, STRING -> METAPROC
  // "Unit" monadic operator for WEBCOMP
  WEBCOMP.of = (htmlString, selector) => METAPROC.Standard()
    .asifnot("$", cheerio.load(htmlString || ""))
    .chain((STATE) => METAPROC.Standard(STATE)
      .asifnot("selected", selector !== undefined ? STATE.$(selector) : undefined ))
    .lift(WEBCOMP)

  // Initializes WEBCOMP with HTML loaded from res:
  // NOTE: If fragment is loaded - it will be wrapped in <html><head></head><body>[framgent]</body></html>
  WEBCOMP.ofHTML = (res, selector) => METAPROC.Standard()
    .asifnot("$", WEBCOMP.loadResource(res).then(cheerio.load))
    .chain((STATE) => METAPROC.Standard(STATE)
      .asifnot("selected", selector !== undefined ? STATE.$(selector) : undefined ))
    .lift(WEBCOMP)

  // :: (STRING, {attributeName:attributeValue}, [NODE]) -> NODE
  // Returns PROMISE of NODE of newly created element with given tagname, attributes, and optional children:
  // NOTE: Children are all appended to new node:
  WEBCOMP.createElement  = (tagname, attributes, children) => {
    let elem = UTIL.foldObj(attributes || {}, (result, attr, val) => {
      result += `${attr}="${val}" `;
      return result;
    }, `<${tagname} `) + `></${tagname}>`;
    return children === undefined
      ? Promise.resolve(WEBCOMP.toHTML(elem))
      : children.reduce((elem, child) => {
        return elem.then(async (parent) => {
          parent.children.push(await child)
          return parent;
        });
      }, Promise.resolve(WEBCOMP.toHTML(elem)))
  }

  // :: STRING -> NODE
  // Return NODE of newly create element from given STRING of HTML:
  WEBCOMP.toHTML = (HTMLString) => cheerio.parseHTML(HTMLString)[0];

  // loadResource :: (STRING) -> PROMISE(*)
  // Checks if ref is for a file or absolute URL, then loads that resource:
  WEBCOMP.loadResource = (ref, encoding) => {
    // https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative
    let patt = /^https?:\/\//i;   // TODO: Sigh
    return patt.test(ref)
      ? axios.get(ref).then((res) => res.data)
      : UTIL.loadFile(ref, encoding).catch((err) => {
        throw err;
      })
  }

  // loadHTML :: (STRING) -> PROMISE(NODE)
  // Loads HTML and returns promise of HTML as NODE:
  WEBCOMP.loadHTML = (ref) => WEBCOMP.loadResource(ref, "utf8").then((html) => {
    return cheerio.parseHTML(html);
  })

  // loadStyle :: (STRING, BOOLEAN) -> PROMISE(NODE)
  // If download is TRUE, dowloads CSS from ref and wraps in STYLE tag, otherwise
  // returns LINK tag with HREF set to ref:
  WEBCOMP.loadCSS = (ref, download) => {
    let elem = download === true
      ? WEBCOMP.loadResource(ref, "utf8").then((css) => `<styles>${css}</styles>`)
      : Promise.resolve(`<link rel="stylesheet" type="text/css" href="${ref}" />`)
    return elem.then(WEBCOMP.toHTML);
  }

  // loadJS :: (STRING, BOOLEAN) -> PROMISE(NODE)
  // If download is TRUE, dowloads JS from ref and wraps in SCRIPT tag, otherwise
  // returns SCRIPT tag with SRC set to ref:
  // NOTE: $.parseHTML does not return SCRIPT element:
  WEBCOMP.loadJS = (ref, download) => {
    let elem = download === true
      ? WEBCOMP.loadResource(ref, "utf8").then((js) => `<script>${js}</script>`)
      : Promise.resolve(`<script src="${ref}"></script>`)
    return elem.then(cheerio.load).then(($) => $("head").first())
  }

  // :: (STATE) -> STRING
  // Convenience method for returning $ as STRING:
  // e.g. WEBCOMP.log(WEBCOMP.toString)
  WEBCOMP.toString = (STATE) => STATE.$.html();

  // :: (STATE) -> STRING
  // Convenience method for selected NODE as STRING:
  // e.g. WEBCOMP.log(WEBCOMP.selectedToString)
  WEBCOMP.selectedToString = (STATE) => STATE.$(STATE.selected).html()
