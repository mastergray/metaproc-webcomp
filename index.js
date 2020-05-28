const UTIL = require("common-fn-js");
const METAPROC = require("metaproc");
const cheerio = require("cheerio");
const axios = require("axios");

module.exports = WEBCOMP = () => METAPROC.init([
  METAPROC.standard,
  WEBCOMP.ops
], (STATE, fn) => {
  return function (HTMLString, model) {
    return METAPROC.init()
      .run({
        "$":cheerio.load(HTMLString), // HTML to operate on
        "controllers":[],             // Stores controllers that will need to be transpiled to run client side
        "model":model || {}           // Client side STATE
      })
      .then(expandControllers);      // Creates client side HTML and returns STRING
  }
});

/**
 *
 *  WEBCOMP Operations
 *
 */

WEBCOMP.ops = [

  // webcomp.controller :: ((NODE) -> BOOLEAN, STRING, (EVENT) -> VOID) -> PROMISE(STATE)
  // Stores controller to render client-side in STATE:
  // NOTE: pred and fn is applied to a client-side event
  METAPROC.op("controller", (pred, evtName, fn) => {
    STATE.controllers.push({
      "pred":pred,              // BOOLEAN function that determines if function to be applied to event
      "evtName":evtName,        // Event type to apply function to
      "fn":fn                   // function that gets applied
    })
  }),

  // webcomp.style :: (STRING, STRING, {attr:val}, STRING) -> PROMISE(STATE)
  // Adds a new element with the given tagname and attributes to the given selector:
  // Appends by default:
  METAPROC.op("createElement", (selector, tagname, attributes, howToApply) => (STATE) => {
    let elem = UTIL.foldObj((result, attr, val) => {
      result += `{attr}="${val}" `;
      return result;
    }, `<${tagname} `) + "></${tagname}>";
    attachNode(STATE.$(selector), elem, howToApply || "append");
  }),

  // webcomp.loadElement :: (STRING, STRING) -> PROMISE(STATE)
  // Loads in HTML and appends it to the given seletor:
  // NOTE: Appends by default;
  MEATAPROC.op("loadElement", (selector, path) => async (STATE) => {
    try {
      let html = await loadResource(path, "utf8");
      attachNode(STATE.$(selector), elem, howToApply || "append");
    } catch (err) {
      console.log(err);
      attachNode(STATE.$(selector), `<!-- Could not load ${path} -->`, howToApply || "append");
    }
  }),

  // webcomp.style :: (STRING, BOOLEAN) -> PROMISE(STATE)
  // Appends CSS to node stored in STATE:
  METAPROC.op("style", (path, load) => async (STATE) => {
    try {
      if (load) {
        let css = await loadResource(path, 'utf8');
        STATE.$("head").append(`<style>${css}</style>`);
      } else {
        STATE.$("head").append(`<link rel="stylesheet" href="${path}">`);
      }
    } catch (err) {
      console.log(err);
      STATE.$("head").append(`<!-- Could not load ${path} -->`);
    }
  }),

  // webcomp.script :: (STRING, BOOLEAN) -> PROMISE(STATE)
  // Appends SCRIPT to node stored in STATE:
  METAPROC.op("script", (path, load) => async (STATE) => {
    try {
      if (load) {
        let js = await loadResource(path, 'utf8');
        STATE.$("head").append(`<script>${js}</script>`)
      } else {
        STATE.$("head").append(`<script src="${path}></script>"`)
      }
    } catch (err) {
      console.log(err);
      STATE.$("head").append(`<!-- Could not load ${path} -->`);
    }
  }),

  // webcomp.html :: (STRING, (NODE, STATE) -> VOID) -> PROMISE(STATE)
  // Append function to node stored in STATE:
  // NOTE: Node value passed to function is a NODE object from cheerio:
  METAPROC.op("html", (selector, fn) => async (STATE) => {
    $(selector).toArray(async (node) => {
      try {
        await fn(node, STATE);
      } catch (err) {
        console.log(err);
      }
    })
  }),

  // webcomp.webcomp :: (STRING, WEBCOMP, STRING) -> PROMISE(STATE)
  // Initalizes a web component and modifies node stored in state accordingly:
  // NOTE: By default, webcomp REPLACES selected node:
  METAPROC.op("webcomp", (selector, webcomp, howToApply) => async (STATE) {
    $(selector).toArray.map(async (node) => {
      try {
        let result = await webcomp(node, STATE.model);
        let $$ = cheerio.load(result);
        attachNode(STATE.$, node, $("body").html(), howToApply || "replace");
      } catch (err) {
        console.log(err)
      }
    })
  })

]

/**
 *
 *  Subprocesses
 *
 */

 // :: (STATE) -> PROMISE(STRING)
 // Attaches event handlers to HTML and returns that HTML as a STRING:
 function expandControllers(STATE) {

   // Expand controllers into a composeable functions to applied to events of a certian type:
   let controllers = STATE.controllers.reduce((controllers, controller) => {
     if (controllers[controller.evtName] === undefined) {
       controllers[controller.evtName] = [];
     }
     controllers[controller.evtName].push(`function (evt) {
         let isNode = (`${controller.pred}`)(evt.target);
         if (isNode) {
           (`${controller.fn}`)(evt)
         }
     }`);
     return controllers;
   }, {});

   // Expand those composeable functions into client-side event handlers attached to BODY:
   let eventHandlers = UTIL.foldObj(controllers, (js, evtName, controllers) => {
     js += `d.querySelector("body").addEventListener("${evtName}", function (evt) {
       composeAll(${JSON.stringify(controllers)})(evt)
     });\n`
     return js;
   }, `(function () {
     let d = document;\n
     let composeAll = ${UTIL.composeAll.toString()};\n
   `) + '})()';

   // Append event handlers to BODY:
   $("body").append(`<script>${eventHandlers}</script>`);

   // Return HTML as STRING:
   return $.html();

 }

 /**
  *
  * Support Functions
  *
  */

// :: (STRING) -> PROMISE(STRING)
// Checks if ref is for a file or absolute URL, then loads that resource:
// NOTE: Only utf8 encoded resources are currently supported:
function loadResource(ref) {
  // https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative
  let patt = /^https?:\/\//i;   // TODO: Sigh
  return patt.test(ref)
    ? UTIL.loadText(ref)
    : axios.get(ref).then((res) => res.data)
}

// :: (CHEERIO, STRING, STRING) -> VOID
// NOTE: DOM is referring to $(selector), where $ is an instance of CHEERIO
function attachNode(DOM, html, howToApply) {
  let cases = {
    "append":(html) => DOM.append(html),
    "prepend":(html) => DOM.prepend(html),
    "after":(html) => DOM.after(html),
    "before":(html) => DOM.before(html),
    "insertBefore":(html) => DOM.insertBefore(html),
    "insertAfter":(html) => DOM.insertAfter(html),
    "replace":(html) => DOM.replace(html),
    "innerHTML":(html) => {
      DOM.empty();      // Remove all children
      DOM.append(html); // Adds given HTML as only child
    }
  };
  // Check if case is defined and apply to HTML, otherwise throw error:
  if (cases[howToApply] !== undefined) {
    cases[howToApply](html);
  } else {
    throw "Don't know how to apply result";
  }
}
