const express = require('express');
const app = express();
const cytoscape = require('cytoscape');
const fs = require('fs');
const { Console } = require('node:console');
const cors = require('cors');
const convertSBGNtoCytoscape = require('sbgnml-to-cytoscape'); // to support sbgnml type of input
const { adjustStylesheet } = require('./stylesheet');

const { jsonToSbgnml } = require('./json-to-sbgnml-converter');
const { sbgnmlToJson } = require('./sbgnml-to-json-converter');
const { elementUtilities } = require('./element-utilities');

const cytosnap = require('cytosnap');
cytosnap.use(['cytoscape-fcose'], {sbgnStylesheet: 'cytoscape-sbgn-stylesheet', layoutUtilities: 'cytoscape-layout-utilities', svg: 'cytoscape-svg'});
let snap = cytosnap();

const port = process.env.PORT || 3000;

// to serve the html
const path = require("path");

// for graphml
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const { document } = (new JSDOM('')).window;
global.document = document;

const xml2js = require('xml2js');
const SaxonJS = require('saxon-js');
const Issue =  require('./Issue').Issue;

const $ = jQuery = require('jquery')(window);

// for fcose
const fcose = require('cytoscape-fcose');
cytoscape.use(fcose);

// for logging
const errorOutput = fs.createWriteStream('./syblars_error.log');
// Custom simple logger
const logger = new Console({ stdout: errorOutput });

let cy;
let options;
let data;
let errors = [];
let body;
let imageErrorsHighlighted;

app.use(express.static(path.join(__dirname, "../public/")));
app.use(cors());

// middleware to manage the formats of files
app.use((req, res, next) => {
    if (req.method === "POST") {
        body = '';
        isJson = false;
        options = '';
        data = '';
        errorMessage = undefined;

        req.on('data', chunk => {
            body += chunk;
        })

        req.on('end', () => {
          let indexOfOptions = Math.min(body.includes("layoutOptions") ? body.indexOf("layoutOptions") : Number.MAX_SAFE_INTEGER,
          body.includes("imageOptions") ? body.indexOf("imageOptions") : Number.MAX_SAFE_INTEGER, 
          body.includes("queryOptions") ? body.indexOf("queryOptions") : Number.MAX_SAFE_INTEGER);
          let indexOfOptionsStart;
          if (indexOfOptions != Number.MAX_SAFE_INTEGER) {
            indexOfOptionsStart = body.substring(0, indexOfOptions).lastIndexOf("{");
            options = body.substring(indexOfOptionsStart);
            data = body.substring(0, indexOfOptionsStart);
          }
          else {
            data = body;
            options = "";
          }

          try {
            options = JSON.parse(options);
          }
          catch (e) {
            let date = new Date()
            errorMessage = "<b>Sorry! Cannot process the given file!</b><br><br>There is something wrong with the format of the options!<br><br>Error detail: <br>" + e;                  
            logger.log('---- %s', date + ": \n" + errorMessage.replace(/<br\s*[\/]?>/gi,"\n").replace(/<b\s*\/?>/mg,"") + "\n");
          }

          // convert sbgn data to json for cytoscape

          var parser = new window.DOMParser;
          var xml = parser.parseFromString(data, 'text/xml');
          let cyJsonData = sbgnmlToJson.convert(xml, data);

          data = data.replace('libsbgn/0.3', 'libsbgn/0.2');

          fs.writeFileSync('./src/sbgnFile.sbgn', data);

          let result = SaxonJS.transform({
            stylesheetFileName: './src/templatelibsbgn.sef.json',
            sourceFileName: "./src/sbgnFile.sbgn",
            destination: "serialized"
          }).principalResult;

          fs.unlinkSync('./src/sbgnFile.sbgn');

          let parseString = xml2js.parseString;
          let parsedResult;
          parseString(result, function (err, data) {
            parsedResult = data;
          });

          if(parsedResult["svrl:schematron-output"]["svrl:failed-assert"] == undefined){
          }
          else{
            let errCount = parsedResult["svrl:schematron-output"]["svrl:failed-assert"].length;
            for(let i=0; i < errCount; i++){
                let error = new Issue();
                error.setText(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:text"]);
                error.setPattern(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["$"]["id"]); 
                error.setRole(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:diagnostic-reference"][0]["_"]);	
                errors.push(error);
            }
          }

          data = convertSBGNtoCytoscape(data);
/*           data = cyJsonData;
          console.log(cyJsonData);
          cyJsonData.nodes.forEach((node) => {
            console.log(node.data);
          }); */
          next();
        });
    }
    else
        next();
});

// whether to include edges in the output or not
// POST :format?edges=true 
// POST :format?clusters=true
app.post('/:format', (req, res) => {
    let size = 30;
    //let format = req.params.format;
    let imageWanted = true;
    if(req.query.image == "false") {
      imageWanted = false;
    }
        
    cy = cytoscape({
        styleEnabled: true,
        headless: true
    });
    
    let imageOptions = {
      format: 'png', 
      background: 'transparent',
      width: 1280,
      height: 720,
      color: '#9ecae1',
      highlightColor: '#ff0000',
      highlightWidth: 10
    };

    if(options.imageOptions) {
      $.extend(imageOptions, options.imageOptions);
    }

    if(imageOptions.format == 'jpg' && imageOptions.background == "transparent") {
      imageOptions.background = "white";
    }

    if(imageOptions.format == 'svg' && imageOptions.background == "transparent") {
      imageOptions.background = undefined;
    }

    if(imageOptions.width <= 0) {
      imageOptions.width = 1280;
    }

    if(imageOptions.height <= 0) {
      imageOptions.height = 720;
    }
    

    let sbgnNodes = data["nodes"];
    sbgnNodes.forEach(function(node) {
      if(node["data"].bbox) {
        node["position"] = {x: node["data"].bbox.x, y: node["data"].bbox.y};
      }
    });

    try{
      cy.add(data);
    }
    catch (e) {
      let date = new Date()
      errorMessage = "<b>Sorry! Cannot process the given file!</b><br><br>Unable to add nodes/edges.<br><br>Error detail: <br>" + e;                  
      logger.log('---- %s', date + ": \n" + errorMessage.replace(/<br\s*[\/]?>/gi,"\n").replace(/<b\s*\/?>/mg,"") + "\n");
      return res.status(500).send({
        errorMessage: errorMessage
      });
    }

    cy.nodes().forEach((node) => {
      node.css("width", node.data().bbox.w || size);
      node.css("height", node.data().bbox.h || size);
    }); 

    errors.forEach((errorData, i) => {
      if(errorData.pattern == "pd10109" || errorData.pattern == 'pd10110'){
        let ele = cy.getElementById(errorData.role);
        let elesClass = ele.data().class;
        errorData.text[0] = errorData.text[0].replace(new RegExp("modulation", 'i'), elesClass.charAt(0).toUpperCase() + elesClass.slice(1));
      }
      errorData.errorNo = i + 1; 
      let errorText = "";
      for(let i = 0; i < errorData.text.length; i++) {
        if(i == errorData.text.length - 1) {
          errorText += errorData.text[i].replace('\t\t\t','');
        }
        else {
          errorText += errorData.text[i].replace('\t\t\t','\n');
        }
      }
      errorData.text = errorText;
    });

    errors.forEach((errorData, i) => {
      let ele = cy.getElementById(errorData.role);
      if(ele.data('label')) {
        ele.data('label', ele.data('label') + "\n(" + (i+1) + ")");
      }
      else {
        ele.data('label', "\n(" + (i+1) + ")");
      }
      ele.addClass('error');
      ele.data('highlightColor', imageOptions.highlightColor);
      ele.data('highlightWidth', imageOptions.highlightWidth);
    });

    let colorScheme = imageOptions.color || "white";
    let stylesheet = adjustStylesheet('sbgnml', colorScheme);

    let ret = {};

    ret['errors'] = errors;

    errors = [];

    try {
      snap.start().then(function(){
        return snap.shot({
          elements: cy.elements().jsons(),
          layout: {name: 'fcose'},
          style: stylesheet,
          resolvesTo: 'all',
          format: imageOptions.format,
          quality: 100,
          width: imageOptions.width,
          height: imageOptions.height,
          background: imageOptions.background
        }).then(function( result ){
            ret["imageErrorsHighlighted"] = result.image;
            return res.status(200).send(ret);
        }).then(function(){
          snap.stop();
        });
      });
    }
    catch (e) {
      let date = new Date()
      errorMessage = "<b>Sorry! Cannot process the given file!</b><br><br>Something has gone wrong during either applying layout or generating image.<br><br>Error detail: <br>" + e;
      logger.log('---- %s', date + ": \n" + errorMessage.replace(/<br\s*[\/]?>/gi,"\n").replace(/<b\s*\/?>/mg,"") + "\n");
      return res.status(500).send({
        errorMessage: errorMessage
      }); 
    }

});

/* // whether to include edges in the output or not
// POST :format?edges=true 
// POST :format?clusters=true
app.post('/:format', (req, res) => {
  let ret = {};

  ret['errors'] = errors;
  ret["imageErrorsHighlighted"] = imageErrorsHighlighted;

  let check = true;
  while(errors.length > 0 && check) {
    let errorFixParam = {};
    errorFixParam.errorCode = errors[0].pattern;
    let ele = cy.getElementById(errors[0].role);

    if (errors[0].pattern == "pd10101") {
      let targetTmp = ele.target();
      if (elementUtilities.isEPNClass(targetTmp)) {
        errorFixParam.edge = ele;
      }
    }
    // console.log(errors);
    fixError(errorFixParam);
    // console.log("AfterFix");
    errors = [];

    let data = jsonToSbgnml.createSbgnml(undefined, undefined, undefined, undefined, undefined, undefined, cy);
    data = data.replace('libsbgn/0.3', 'libsbgn/0.2');

    // console.log(data);

    fs.writeFileSync('./src/sbgnFile.sbgn', data);

    let result = SaxonJS.transform({
      stylesheetFileName: './src/templatelibsbgn.sef.json',
      sourceFileName: "./src/sbgnFile.sbgn",
      destination: "serialized"
    }).principalResult;

    fs.unlinkSync('./src/sbgnFile.sbgn');

    let parseString = xml2js.parseString;
    let parsedResult;
    parseString(result, function (err, data) {
      parsedResult = data;
    });

    if(parsedResult["svrl:schematron-output"]["svrl:failed-assert"] == undefined){
    }
    else{
      let errCount = parsedResult["svrl:schematron-output"]["svrl:failed-assert"].length;
      for(let i=0; i < errCount; i++){
          let error = new Issue();
          error.setText(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:text"]);
          error.setPattern(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["$"]["id"]); 
          error.setRole(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:diagnostic-reference"][0]["_"]);	
          errors.push(error);
      }
    }
    // console.log(errors);

    check = false;
  }

  function fixError(errorFixParam) {
    var errorCode = errorFixParam.errorCode;
    var result = {};
    result.errorCode = errorCode;
    if(errorCode == "pd10101"){
      elementUtilities.reverseEdge(errorFixParam.edge);
    }
  };

  errors = [];
  return res.status(200).send(ret);
}); */

module.exports = {
    port,
    app
};