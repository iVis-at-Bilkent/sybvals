const express = require('express');
const app = express();
const cytoscape = require('cytoscape');
const fs = require('fs');
//const { Console } = require('node:console');
const cors = require('cors');
const convertSBGNtoCytoscape = require('sbgnml-to-cytoscape'); // to support sbgnml type of input
const { adjustStylesheet } = require('./stylesheet');
const { stylesheetForSbgn } = require('./stylesheetNewt');
const { jsonToSbgnml } = require('./json-to-sbgnml-converter');
const { sbgnmlToJson } = require('./sbgnml-to-json-converter');
const { elementUtilities } = require('./element-utilities');
const sbgnStylesheet = require('cytoscape-sbgn-stylesheet');
const puppeteer = require('puppeteer');


const cytosnap = require('cytosnap');
cytosnap.use(['cytoscape-fcose'], { sbgnStylesheet: 'cytoscape-sbgn-stylesheet', layoutUtilities: 'cytoscape-layout-utilities', svg: 'cytoscape-svg' });
let snap = cytosnap();
let currentSbgn;
let dims;

const port = process.env.PORT || 3400;

// to serve the html
const path = require("path");

// for graphml
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const { document } = (new JSDOM('')).window;
global.document = document;
let unsolvedErrorInformation = {};
let previousErrorCode = "";
let previousErrorRole = "";
let fixExplanation = {};

const xml2js = require('xml2js');
const SaxonJS = require('saxon-js');
const Issue = require('./Issue').Issue;

let errorHighlightColors = ['#1e90ff', '#ff0000', '#b0b000', '#006400', '#0000ff', '#257359', '#c71585', '#fd713d'];
let imageOptions = {
  format: 'png',
  background: 'transparent',
  width: 1280,
  height: 720,
  color: 'greyscale',
  highlightColor: '#ff0000',
  highlightWidth: 30,
  autoSize: true
};

const $ = jQuery = require('jquery')(window);

function postProcessForLayouts(cy) {
  let processNodes = cy.nodes('[class = "process",class = "uncertain process"]', '[class = "uncertain process"]');
  for (let i = 0; i < processNodes.length; i++) {
    let compartment;
    let connectedNodes = processNodes[i].connectedEdges().map(edge => (edge.source() == processNodes[i] ? edge.target() : edge.source()));
    if (processNodes[i].parent() !== undefined && processNodes[i].parent().data("class") === "compartment") {
      continue;
    }
    for (let j = 0; j < connectedNodes.length; j++) {
      if (compartment === undefined) {
        compartment = connectedNodes[j].parent();
      }
      if (compartment !== -1 && compartment.id() != connectedNodes[j].parent().id()) {
        compartment = -1;
      }
    }
    if (compartment !== -1 && compartment !== undefined) {
      processNodes[i].move({ "parent": compartment.id() });
    }
  }

}

function reduceErrors(errors){
  let reducedErrors = [];
  //console.log( "Errors length : " + errors.length);
  for( let i = 0; i < errors.length;i++){
    if( errors[i].pattern != "pd10125" && errors[i].pattern != "pd10142" && 
    errors[i].pattern != "pd10109" && errors[i].pattern != "pd10124" 
    && errors[i].pattern != "pd10111" && errors[i].pattern != "pd10126"){
      reducedErrors.push( errors[i]);
      continue;
    }
    var ele = cy.getElementById(errors[i].role);
    //console.log( i + " " + errors[i].pattern + " " + errors[i].role + " " + ele.target().data().class );
    if( (errors[i].pattern == "pd10125" || errors[i].pattern == "pd10142" )  && (ele.target().data().class == "and" || ele.target().data().class == "or" || ele.target().data().class == "not" ) ) {
      continue;
    }
    else if( (errors[i].pattern == "pd10124" || errors[i].pattern == "pd10109" ) && (ele.source().data().class == "and" || ele.source().data().class == "or" || ele.source().data().class == "not" ) ){
      continue;
    }
    else if( (errors[i].pattern == "pd10111")){
      var connectedEdges = cy.edges('[source =  "' + ele.id() + '"]');
      if( connectedEdges.length == 1 ) {
        continue;
       }
    }
    else {
      let connectedEdges = ele.connectedEdges().filter('[class="logic arc"]');
      if( connectedEdges.length == 1 ){
        continue;
      }
    }

    reducedErrors.push(errors[i]);
  }
  return reducedErrors;
  errors = reducedErrors;
}





// for fcose
const fcose = require('cytoscape-fcose');
const { privateDecrypt } = require('crypto');
cytoscape.use(fcose);

// for logging
const errorOutput = fs.createWriteStream('./syblars_error.log');
// Custom simple logger
//const logger = new Console({ stdout: errorOutput });

let cy;
let options;
let data;
let errors = [];
let body;
let image;

function distanceBetween(a, b) {
  let xDiff = a.position().x - b.position().y;
  let yDiff = a.position().y - b.position().y;
  return xDiff * xDiff + yDiff * yDiff;
}

function findClosestNode(ele, connectedEdges) {
  let shortestDistance = 100000000.0;
  let closestEdge;
  for (let i = 0; i < connectedEdges.size(); i++) {
    if (distanceBetween(ele, connectedEdges[i].source()) < shortestDistance) {
      shortestDistance = distanceBetween(ele, connectedEdges[i].source());
      closestEdge = connectedEdges[i];
    }
  }
  return closestEdge;
}

app.use(express.static(path.join(__dirname, "../public/")));
app.use(cors());

// middleware to manage the formats of files
app.use(async (req, res, next) => {
  
  if (req.method === "POST") {
    console.log( "request started");

    let body = '';
    let isJson = false;
    let options = '';
    let data = '';
    let errorMessage = undefined;
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
        logger.log('---- %s', date + ": \n" + errorMessage.replace(/<br\s*[\/]?>/gi, "\n").replace(/<b\s*\/?>/mg, "") + "\n");
      }
      /*if (req.query.errorFixing === "true") {
        return next();
      }*/

      // convert sbgn data to json for cytoscape

      var parser = new window.DOMParser;
      var xml = parser.parseFromString(data, 'text/xml');
      data = data.replace('libsbgn/0.3', 'libsbgn/0.2');

      currentSbgn = data;
      let cyJsonData = sbgnmlToJson.convert(xml, data);


      fs.writeFileSync('./src/sbgnFile.sbgn', currentSbgn);
      data = cyJsonData;
      fs.unlinkSync('./src/sbgnFile.sbgn');


      cy = cytoscape({
        styleEnabled: true,
        headless: true,
        isStyleEnabled: true
      });
      let sbgnNodes = data["nodes"];
      sbgnNodes.forEach(function (node) {
        if (node["data"].bbox) {
          node["position"] = { x: node["data"].bbox.x, y: node["data"].bbox.y };
        }
      });
      try {
        cy.add(data);
      } catch (err) { };
      postProcessForLayouts(cy);
      data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('renderInformation') : undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('mapProperties') : undefined, cy.nodes(), cy.edges(), cy);
      data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
      currentSbgn = data;
      fs.writeFileSync('./src/sbgnFile.sbgn', currentSbgn);
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
      let errors = [];
      if (parsedResult["svrl:schematron-output"]["svrl:failed-assert"] == undefined) {
      }
      else {
        let errCount = parsedResult["svrl:schematron-output"]["svrl:failed-assert"].length;
        for (let i = 0; i < errCount; i++) {
          let error = new Issue();
          error.setText(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:text"]);
          error.setPattern(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["$"]["id"]);
          error.setRole(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:diagnostic-reference"][0]["_"]);
          errors.push(error);
        }
      }
      errors = reduceErrors(errors);
      data = cyJsonData;
      let unsolvedErrorInformation = {};
      errors.forEach(error => {
        unsolvedErrorInformation[error.pattern + error.role] = true;
      })
      res.locals.body =  body;
      res.locals.unsolvedErrorInformation = unsolvedErrorInformation;
      res.locals.isJson = isJson;
      res.locals.options = options;
      res.locals.data = data ;
      res.locals.errorMessage = errorMessage;
      res.locals.currentSbgn = currentSbgn;
      res.locals.cy = cy;
      res.locals.errors = errors;
      res.locals.imageOptions = {
        format: 'png',
        background: 'transparent',
        width: 1280,
        height: 720,
        color: 'greyscale',
        highlightColor: '#ff0000',
        highlightWidth: 30,
        autoSize: true
      };      
      next();
    });
  }
  else
   next();
  ;
});

app.post('/validation', async (req, res, next) => {
  let size = 30;
  let previousErrorCode = "";
  let previousErrorRole = "";
  let body = res.locals.body;
  let isJson = res.locals.isJson;
  let options = res.locals.options;
  let data = res.locals.data;
  let currentSbgn = res.locals.currentSbgn;
  let cy= res.locals.cy;
  let imageOptions = res.locals.imageOptions; 
  let errors = res.locals.errors;
  let unsolvedErrorInformation = res.locals.unsolvedErrorInformation;

  
  fixExplanation = {};
  if (req.query.errorFixing !== undefined && req.query.errorFixing === true) {
    return next();
  }

  let imageWanted = true;
  if (req.query.image == "false") {
    imageWanted = false;
  }
  if (options.imageOptions) {
    $.extend(imageOptions, options.imageOptions);
  }
  if (imageOptions.format == 'jpg' && imageOptions.background == "transparent") {
    imageOptions.background = "white";
  }
  if (imageOptions.format == 'svg' && imageOptions.background == "transparent") {
    imageOptions.background = undefined;
  }
  if (imageOptions.width <= 0) {
    imageOptions.width = 1280;
  }
  if (imageOptions.height <= 0) {
    imageOptions.height = 720;
  }
  let sbgnNodes = data["nodes"];
  sbgnNodes.forEach(function (node) {
    if (node["data"].bbox) {
      node["position"] = { x: node["data"].bbox.x, y: node["data"].bbox.y };
    }
  });
  try {
    cy.add(data);
  }
  catch (e) {
    let date = new Date()
    errorMessage = "<b>Sorry! Cannot process the given file!</b><br><br>Unable to add nodes/edges.<br><br>Error detail: <br>" + e;
    logger.log('---- %s', date + ": \n" + errorMessage.replace(/<br\s*[\/]?>/gi, "\n").replace(/<b\s*\/?>/mg, "") + "\n");
    return res.status(500).send({
      errorMessage: errorMessage
    });
  }
  cy.nodes().forEach((node) => {
    node.css("width", node.data().bbox.w || size);
    node.css("height", node.data().bbox.h || size);
  });

  errors.forEach((errorData, i) => {
    if (errorData.pattern == "pd10109" || errorData.pattern == 'pd10110') {
      let ele = cy.getElementById(errorData.role);
      let elesClass = ele.data("class");
      errorData.text[0] = errorData.text[0].replace(new RegExp("modulation", 'i'), elesClass.charAt(0).toUpperCase() + elesClass.slice(1));
    }
    errorData.errorNo = i + 1;
    let errorText = "";
    for (let i = 0; i < errorData.text.length; i++) {
      if (i == errorData.text.length - 1) {
        errorText += errorData.text[i].replace('\t\t\t', '');
      }
      else {
        errorText += errorData.text[i].replace('\t\t\t', '\n');
      }
    }
    errorData.text = errorText;
  });
  let colorScheme = imageOptions.color || "white";
  let stylesheet = adjustStylesheet('sbgnml', colorScheme);
  let ret = {};
  ret['errors'] = errors;
  let errorCount = 0;
  errors.forEach(error => {
    if (error.pattern !== "pd10102") {
      errorCount++;
    }
  });
  postProcessForLayouts(cy);
  var layout = cy.layout({ name: 'fcose' });
  let snap = cytosnap();
  layout.pon('layoutstop').then(function (event) {
    errors.forEach(error => {
      unsolvedErrorInformation[error.pattern + error.role] = true;
    })
    highlightErrors(errors, cy, imageOptions, true);
    try {

      snap.start().then(function () {

        return snap.shot({
          elements: cy.elements().jsons(),
          layout: { name: 'fcose', randomize: false },
          style: stylesheet,
          resolvesTo: 'all',
          format: imageOptions.format,
          quality: 100,
          width: imageOptions.width,
          height: imageOptions.height,
          background: imageOptions.background,
          fullGraph: imageOptions.autoSize
        }).then(function (result) {
          data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('renderInformation') : undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('mapProperties') : undefined, cy.nodes(), cy.edges(), cy);
          data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
          currentSbgn = data;
          let image = result.image;
          ret["image"] = (result.image);
          ret['errors'] = errors;
          ret['sbgn'] = currentSbgn;
          fs.writeFileSync('./src/sbgnFile.sbgn', data);
          console.log( "before response");
          return res.status(200).send(ret);
        }).then(function () {
          snap.stop();
        });
      });
    }
    catch (e) {
      let date = new Date()
      errorMessage = "<b>Sorry! Cannot process the given file!</b><br><br>Something has gone wrong during either applying layout or generating image.<br><br>Error detail: <br>" + e;
      logger.log('---- %s', date + ": \n" + errorMessage.replace(/<br\s*[\/]?>/gi, "\n").replace(/<b\s*\/?>/mg, "") + "\n");
      return res.status(500).send({
        errorMessage: errorMessage
      });
    }
  });
  layout.run();
});


app.post('/fixError', (req, res) => {
  let fixExplanation = {};
  let size = 30;
  let previousErrorCode = "";
  let previousErrorRole = "";
  let body = res.locals.body;
  let isJson = res.locals.isJson;
  let options = res.locals.options;
  let data = res.locals.data;
  let currentSbgn = res.locals.currentSbgn;
  let cy= res.locals.cy;
  let imageOptions = res.locals.imageOptions; 
  let errors = res.locals.errors;
  let unsolvedErrorInformation = res.locals.unsolvedErrorInformation;

  /*let imageOptions = {
    format: 'png',
    background: 'transparent',
    width: 1280,
    height: 720,
    color: 'greyscale',
    highlightColor: '#ff0000',
    highlightWidth: 30
  };*/

  if (options.imageOptions) {
    $.extend(imageOptions, options.imageOptions);
  }

  if (imageOptions.format == 'jpg' && imageOptions.background == "transparent") {
    imageOptions.background = "white";
  }

  if (imageOptions.format == 'svg' && imageOptions.background == "transparent") {
    imageOptions.background = undefined;
  }

  if (imageOptions.width <= 0) {
    imageOptions.width = 1280;
  }

  if (imageOptions.height <= 0) {
    imageOptions.height = 720;
  }
  let ret = {};
  ret['errors'] = errors;
  ret["image"] = image;
  let currentErrors;
  let check = 0;
  let numberOfUnsolvedErrors = 0;
  for (let i = 0; i < errors.length; i++) {
    errors[i].errorNo = i + 1;
  }
  currentErrors = errors;
  unsolvedErrorInformation = {};
  previousErrorCode = "";
  previousErrorRole = "";
  fixExplanation = {};
  let count = 0;
  while (check < currentErrors.length) {
    let currentLength = currentErrors.length;
    previousErrorCode = currentErrors[check].pattern;
    previousErrorRole = currentErrors[check].role;
    currentErrors[check].status = "unsolved";
    let errorFixParam = {};
    errorFixParam.errorCode = currentErrors[check].pattern;
    let ele = cy.getElementById(currentErrors[check].role);
    if (currentErrors[check].pattern == "pd10112") {
      var compartments = cy.nodes('[class= "compartment"]');
      var listedNodes = [];
      for (var i = 0; i < compartments.length; i++) {
        if (compartments[i].parent().length == 0)
          listedNodes.push(compartments[i]);
      }
      if (listedNodes.length === 0) {
        numberOfUnsolvedErrors++;
      }
      else {
        ele.move({ "parent": listedNodes[0].data().id });
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Fixed by moving " + " inside " + listedNodes[0].data().id + ".";
      }
    }
    else if (currentErrors[check].pattern == "pd10126") {
      let connectedEdges = ele.connectedEdges().filter('[class="logic arc"]');
      errorFixParam.edges = [];
      errorFixParam.nodes = [];
      let selectedEdge = connectedEdges[check]; // 0 is default, it should be decided later.
      selectedEdge = findClosestNode(ele, connectedEdges);
      //console.log("closest edge selected : " + selectedEdge);
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (selectedEdge.id() != connectedEdges[i].id()) {
          errorFixParam.nodes.push(connectedEdges[i].source());
          errorFixParam.edges.push(connectedEdges[i]);
        }
      }
      if (connectedEdges.length !== 0) {
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Edge between this node and " + selectedEdge.source().id() + " is kept.";
        fixError(errorFixParam);
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (currentErrors[check].pattern == "pd10124") {
      var sourcePosX = ele.source().position().x;
      var targetPosX = ele.target().position().x;
      var sourcePosY = ele.source().position().y;
      var targetPosY = ele.target().position().y;
      var minX = Math.min(sourcePosX, targetPosX) - 150;
      var maxX = Math.max(sourcePosX, targetPosX) + 150;
      var minY = Math.min(sourcePosY, targetPosY) - 150;
      var maxY = Math.max(sourcePosY, targetPosY) + 150;
      var nodes = cy.nodes();
      var listedNodes = [];
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].position().x >= minX && nodes[i].position().x <= maxX && nodes[i].position().y >= minY && nodes[i].position().y <= maxY)
          if (ele.target().data().id != nodes[i].data().id) {
            if (elementUtilities.isEPNClass(nodes[i])) {
              listedNodes.unshift(nodes[i]);
            }
            else if (elementUtilities.isLogicalOperator(nodes[i])) {
              listedNodes.push(nodes[i]);
            }
          }
      }
      if (listedNodes.length !== 0) {
        let selectedNode = listedNodes[0];
        errorFixParam.newTarget = ele.target().id();
        errorFixParam.newSource = selectedNode.id();
        errorFixParam.edge = ele;
        errorFixParam.portsource = selectedNode.id();
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Arc is connected to " + selectedNode.id() + ".";
        fixError(errorFixParam);
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (currentErrors[check].pattern == "pd10103" || currentErrors[check].pattern == "pd10107") {
      errorFixParam.newEdges = [];
      errorFixParam.newNodes = [];
      errorFixParam.oldEdges = [];
      var id = currentErrors[check].role;
      var eles = cy.elements('[id="' + id + '"]');
      errorFixParam.node = eles;
      var edges = cy.nodes('[id = "' + id + '"]').connectedEdges();
      var addedNodeNum = edges.length;
      var nodeParams = { class: eles.data().class, language: eles.data().language };
      for (var i = 0; i < addedNodeNum; i++) {
        var edgeParams = { class: edges[i].data().class, language: edges[i].data().language };
        var shiftX = 22;
        var shiftY = 22;
        var target = edges[i].target();
        var source = edges[i].source();
        var x = edges[i].source().x; // endpoint are removed
        var y = edges[i].source().y;
        if (edges[i].data().class != 'consumption') {
          x = edges[i].target().x;
          y = edges[i].target().y;
        }

        var xdiff = Math.abs(edges[i].target().x - edges[i].source().x);
        var ydiff = Math.abs(edges[i].target().y - edges[i].source().y);
        var ratio = ydiff / xdiff;
        if (xdiff == 0) {
          shiftX = 0;
          shiftY = 22;
        }
        else if (ydiff == 0) {
          shiftY = 0;
          shiftX = 22;
        }
        else {
          var resultt = 22 * 22;
          var ratiosquare = ratio * ratio;
          var dx = Math.sqrt(resultt / (ratiosquare + 1));
          shiftX = dx;
          shiftY = shiftX * ratio;
        }
        if (edges[i].data().class == 'consumption') {
          if (eles.position().x > target.position().x)
            shiftX *= -1;
          if (eles.position().y > target.position().y)
            shiftY *= -1;
        } else {
          if (eles.position().x > source.position().x)
            shiftX *= -1;
          if (eles.position().y > source.position().y)
            shiftY *= -1;
        }
        var cX = x + shiftX;
        var cY = y + shiftY;

        errorFixParam.newNodes.push({ x: cX, y: cY, class: nodeParams, id: "node" + i });
        if (edges[i].data().class == 'consumption') {
          errorFixParam.newEdges.push({ source: "node" + i, target: target.id(), class: edgeParams, property: 'porttarget', value: edges[i].data().porttarget });
        }
        else {
          errorFixParam.newEdges.push({ source: source.id(), target: "node" + i, class: edgeParams, property: 'portsource', value: edges[i].data().portsource });

        }
        errorFixParam.oldEdges.push(edges[i]);
      }
      fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Source and sink glyph is splitted for each consumption arc.";
      fixError(errorFixParam);
    }
    else if (currentErrors[check].pattern == "pd10101" || currentErrors[check].pattern == "pd10102") {
      let targetTmp = ele.target();
      let sourceTmp = ele.source();
      if (elementUtilities.isEPNClass(targetTmp)) {
        errorFixParam.edge = ele;
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Source and target of consumption arc have been swapped.";
        // errors[check].status = "solved";
      }
      else {
        //errors[check].status = "unsolved";
        numberOfUnsolvedErrors++;
      }
    }
    else if (currentErrors[check].pattern == "pd10126") {
      let connectedEdges = ele.connectedEdges().filter('[class="logic arc"]');
      //console.log("connected edges" + connectedEdges.size());
      errorFixParam.edges = [];
      errorFixParam.nodes = [];
      let selectedEdge = connectedEdges[0]; // 0 is default, it should be decided later.
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (selectedEdge.id() != connectedEdges[i].id()) {
          errorFixParam.nodes.push(connectedEdges[i].source());
          errorFixParam.edges.push(connectedEdges[i]);
        }
      }
      fixError(errorFixParam);
    }
    else if (currentErrors[check].pattern == "pd10125") {
      var edgeParams = { class: ele.data().class, language: ele.data().language };
      var sourcePosX = ele.source().position().x;
      var targetPosX = ele.target().position().x;
      var sourcePosY = ele.source().position().y;
      var targetPosY = ele.target().position().y;
      var minX = Math.min(sourcePosX, targetPosX) - 150;
      var maxX = Math.max(sourcePosX, targetPosX) + 150;
      var minY = Math.min(sourcePosY, targetPosY) - 150;
      var maxY = Math.max(sourcePosY, targetPosY) + 150;
      var nodes = cy.nodes();
      var listedNodes = [];
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].position().x >= minX && nodes[i].position().x <= maxX && nodes[i].position().y >= minY && nodes[i].position().y <= maxY)
          if (elementUtilities.isLogicalOperator(nodes[i]))
            listedNodes.push(nodes[i]);
      }

      // node should be selected here, default is 0.
      let selectedNode = listedNodes[0];
      //selectedNode = findClosest( )
      var source = ele.source();
      var target = selectedNode;
      errorFixParam.edge = ele;
      errorFixParam.newEdge = { source: source.id(), target: target.id(), edgeParams: edgeParams };
      fixError(errorFixParam);
      fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc has a target reference to " + target.id() + ".";
    }

    else if (currentErrors[check].pattern == "pd10111") {
      let ele = cy.getElementById( currentErrors[check].role );
      //console.log( ele );
      errorFixParam.edges = [];
      //console.log( ele + " pd10111 fixing");
      let connectedEdges = cy.edges('[source =  "' + ele.id() + '"]');
         console.log(connectedEdges.length);
      if (connectedEdges.length !== 0) {
        let selectedEdge = connectedEdges[0]; // default , the selection of edge will be determined later.
        for (let i = 0; i < connectedEdges.size(); i++) {
          if (connectedEdges[i].id() != selectedEdge.id()) {
            errorFixParam.edges.push(connectedEdges[i]);
          }
        }
        fixError(errorFixParam);
        //errors[check].status = "solved";
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Arc between this node and " + selectedEdge.target.id() + " is kept.";
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (currentErrors[check].pattern == "pd10104") {
      var connectedEdges = ele.connectedEdges().filter('[class="consumption"]');
      errorFixParam.nodes = [];
      errorFixParam.edges = [];
      selectedEdge = connectedEdges[0]; // default selection, it will be determined. closest one will be kept. 
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (connectedEdges[i].id() != selectedEdge.id()) {
          errorFixParam.nodes.push(connectedEdges[i].source().id() == ele.id() ? connectedEdges[i].target() : connectedEdges[i].source());
          errorFixParam.edges.push(connectedEdges[i]);
        }
      }
      fixError(errorFixParam);
      fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc between dissocation glyph and consumption glyph(" + (selectedEdge.source().id() === ele.id() ?
        selectedEdge.target().id() : selectedEdge.source().id()) + ") is kept.";
      // errors[check].status = "solved";
    }
    else if (currentErrors[check].pattern == "pd10108") {
      let connectedEdges = ele.connectedEdges().filter('[class = "production"]');
      // choose deleted edges and nodes each here when the deletion method is determined
      let selectedEdge = connectedEdges[0];
      errorFixParam.edges = [];
      errorFixParam.nodes = [];
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (connectedEdges[i].id() != selectedEdge.id()) {
          errorFixParam.edges.push(connectedEdges[i]);
          errorFixParam.nodes.push(connectedEdges[i].source().id() == ele.id() ? connectedEdges[i].target() : connectedEdges[i].source());
        }
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc between assocation glyph and production glyph(" + (selectedEdge.source().id() === ele.id() ?
          selectedEdge.target().id() : selectedEdge.source().id()) + ") is kept.";
      }
    }
    else if (currentErrors[check].pattern == "pd10109") {
      var sourcePosX = ele.source().position().x;
      var targetPosX = ele.target().position().x;
      var sourcePosY = ele.source().position().y;
      var targetPosY = ele.target().position().y;
      var minX = Math.min(sourcePosX, targetPosX) - 150;
      var maxX = Math.max(sourcePosX, targetPosX) + 150;
      var minY = Math.min(sourcePosY, targetPosY) - 150;
      var maxY = Math.max(sourcePosY, targetPosY) + 150;
      var nodes = cy.nodes();
      var listedNodes = [];
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].position().x >= minX && nodes[i].position().x <= maxX && nodes[i].position().y >= minY && nodes[i].position().y <= maxY)
          if (ele.target().data().id != nodes[i].data().id) {
            if (elementUtilities.isEPNClass(nodes[i])) {
              listedNodes.unshift(nodes[i]);
            }
            else if (elementUtilities.isLogicalOperator(nodes[i])) {
              listedNodes.push(nodes[i]);
            }
          }
      }
      // node should be selected here, default is 0.
      let selectedNode = listedNodes[0];
      errorFixParam.newTarget = ele.target().id();
      errorFixParam.newSource = selectedNode.id();
      errorFixParam.edge = ele;
      errorFixParam.portsource = selectedNode.id();
      fixError(errorFixParam);
      //errors[check].status = "solved";
      fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Modulation arc has a source reference to " + selectedNode.id() + ".";
    }

    else if (currentErrors[check].pattern == "pd10125") {
      var sourcePosX = ele.source().position().x;
      var targetPosX = ele.target().position().x;
      var sourcePosY = ele.source().position().y;
      var targetPosY = ele.target().position().y;
      var minX = Math.min(sourcePosX, targetPosX) - 150;
      var maxX = Math.max(sourcePosX, targetPosX) + 150;
      var minY = Math.min(sourcePosY, targetPosY) - 150;
      var maxY = Math.max(sourcePosY, targetPosY) + 150;
      var nodes = cy.nodes();
      var listedNodes = [];
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].position().x >= minX && nodes[i].position().x <= maxX && nodes[i].position().y >= minY && nodes[i].position().y <= maxY)
          if (elementUtilities.isLogicalOperator(nodes[i]))
            listedNodes.push(nodes[i]);
      }

      // node should be selected here, default is 0.
      let selectedNode = listedNodes[0];
      errorFixParam.newTarget = ele.target().id();
      errorFixParam.newSource = selectedNode.id();
      errorFixParam.edge = ele;
      errorFixParam.portsource = selectedNode.id();
      fixError(errorFixParam);
    }

    else if (currentErrors[check].pattern == "pd10105" || currentErrors[check].pattern == "pd10106") {
      let sourceNode = ele.source();
      let targetNode = ele.target();
      if (elementUtilities.isPNClass(targetNode) && elementUtilities.isEPNClass(sourceNode)) {
        errorFixParam.edge = ele;
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The source and target of production arc have been swapped.";
      }
      else {
        numberOfUnsolvedErrors++;
      }
    }
    else {
      numberOfUnsolvedErrors++;
    }
    data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('renderInformation') : undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('mapProperties') : undefined, cy.nodes(), cy.edges(), cy);
    data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
    currentSbgn = data;
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
    currentErrors = [];
    if (parsedResult["svrl:schematron-output"]["svrl:failed-assert"] == undefined) {
    }
    else {
      let errCount = parsedResult["svrl:schematron-output"]["svrl:failed-assert"].length;
      for (let i = 0; i < errCount; i++) {
        let error = new Issue();
        error.setText(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:text"]);
        error.setPattern(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["$"]["id"]);
        error.setRole(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:diagnostic-reference"][0]["_"]);
        currentErrors.push(error);
      }
    }
    if (currentLength == currentErrors.length) {
      check++;
      unsolvedErrorInformation[previousErrorCode + previousErrorRole] = true;
    }
  }
  data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('renderInformation') : undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('mapProperties') : undefined, cy.nodes(), cy.edges(), cy);
  data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
  ret['sbgn'] = currentSbgn;
  fs.writeFileSync('./src/sbgnFile.sbgn', currentSbgn);
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
  currentErrors = [];
  if (parsedResult["svrl:schematron-output"]["svrl:failed-assert"] == undefined) {
  }
  else {
    currentErrors = [];
    let errCount = parsedResult["svrl:schematron-output"]["svrl:failed-assert"].length;
    for (let i = 0; i < errCount; i++) {
      let error = new Issue();
      error.setText(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:text"]);
      error.setPattern(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["$"]["id"]);
      error.setRole(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:diagnostic-reference"][0]["_"]);
      currentErrors.push(error);
    }
  }
  highlightErrors(errors, cy, imageOptions, false);
  let colorScheme = imageOptions.color || "white";
  let stylesheet = adjustStylesheet('sbgnml', colorScheme);
  postProcessForLayouts(cy);
  for (let i = 0; i < errors.length; i++) {
    if (errors[i].status == "solved" && errors[i].explanation === undefined) {
      errors[i].explanation = "Fix of another error resolved this error."
    }
  }
  let snap = cytosnap();
  try {
    snap.start().then(function () {
      return snap.shot({
        elements: cy.elements().jsons(),
        layout: { name: 'fcose', randomize: false },
        style: stylesheet,
        resolvesTo: 'all',
        format: imageOptions.format,
        quality: 100,
        width: imageOptions.width,
        height: imageOptions.height,
        background: imageOptions.background,
        fullGraph: imageOptions.autoSize
      }).then(function (result) {
        data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('renderInformation') : undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('mapProperties') : undefined, cy.nodes(), cy.edges(), cy);
        data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
        fs.writeFileSync('./src/sbgnFile.sbgn', data);
        currentSbgn = data;
        ret["sbgn"] = currentSbgn;
        ret["image"] = result.image;
        ret['errors'] = errors;
        return res.status(200).send(ret);
      }).then(function () {
        snap.stop();
      });
    });
  }
  catch (e) {
    let date = new Date()
    errorMessage = "<b>Sorry! Cannot process the given file!</b><br><br>Something has gone wrong during either applying layout or generating image.<br><br>Error detail: <br>" + e;
    logger.log('---- %s', date + ": \n" + errorMessage.replace(/<br\s*[\/]?>/gi, "\n").replace(/<b\s*\/?>/mg, "") + "\n");
    return res.status(500).send({
      errorMessage: errorMessage
    });
  }

});

function fixError(errorFixParam) {
  var errorCode = errorFixParam.errorCode;
  var result = {};
  result.errorCode = errorCode;
  if (errorCode == "pd10101" || errorCode == "pd10102") {
    elementUtilities.reverseEdge(errorFixParam.edge);
  }
  if (errorCode == "pd10103" || errorCode == "pd10107") {
    errorFixParam.newNodes.forEach(function (newNode) {
      elementUtilities.addNode(newNode.x, newNode.y, newNode.class, newNode.id, undefined, "visible", cy);
    });
    errorFixParam.newEdges.forEach(function (newEdge) {
      //console.log(newEdge);
      var newwEdge = elementUtilities.addEdge(newEdge.source, newEdge.target, newEdge.class, cy);
      // elementUtilities.reverseEdge(newwEdge);
    });
    errorFixParam.oldEdges.forEach(function (oldEdge) {
      cy.elements().unselect();
      oldEdge.remove();
    });
    errorFixParam.node.remove();
  }
  if (errorCode == "pd10105" || errorCode == "pd10106") {
    elementUtilities.reverseEdge(errorFixParam.edge);
  }
  if (errorCode == "pd10108" || errorCode == "pd10104") {
    for (let i = 0; i < errorFixParam.nodes.length(); i++) {
      errorFixParam.nodes[i].remove();
    }
    for (let i = 0; i < errorFixParam.edges.length(); i++) {
      errorFixParam.edges[i].remove();
    }
  }
  if (errorCode == "pd10109" || errorCode == "pd10124") {
    result.newSource = errorFixParam.edge.data().source;
    result.newTarget = errorFixParam.edge.data().target;
    result.portsource = errorFixParam.edge.data().portsource;
    var clonedEdge = errorFixParam.edge.clone();
    var edgeParams = { class: clonedEdge.data().class, language: clonedEdge.data().language };
    clonedEdge.data().source = errorFixParam.newSource;
    clonedEdge.data().target = errorFixParam.newTarget;
    cy.remove(errorFixParam.edge);
    result.edge = elementUtilities.addEdge(errorFixParam.newSource, errorFixParam.newTarget, edgeParams, cy, clonedEdge.data().id);
    return result;
  }
  else if (errorCode == "pd10125") {
    result.edge = errorFixParam.edge.remove();
    result.newEdge = {};
    var edgeclass = errorFixParam.newEdge.edgeParams.class ? errorFixParam.newEdge.edgeParams.class : errorFixParam.newEdge.edgeParams;
    var validation = elementUtilities.validateArrowEnds(edgeclass, cy.getElementById(errorFixParam.newEdge.source), cy.getElementById(errorFixParam.newEdge.target));
    if (validation === 'reverse') {
      var temp = errorFixParam.newEdge.source;
      errorFixParam.newEdge.source = errorFixParam.newEdge.target;
      errorFixParam.newEdge.target = temp;
    }
    result.newEdge.id = elementUtilities.addEdge(errorFixParam.newEdge.source, errorFixParam.newEdge.target, errorFixParam.newEdge.edgeParams, cy).id();
    result.newEdge.source = errorFixParam.newEdge.source;
    result.newEdge.target = errorFixParam.newEdge.target;
    result.newEdge.edgeParams = errorFixParam.newEdge.edgeParams;
    return result;
  }
  else if (errorCode == "pd10126") {
    errorFixParam.edges.forEach(function (edge) {
      edge.remove();
    });
    errorFixParam.nodes.forEach(function (node) {
      node.remove();
    });
  }
  if (errorCode == "pd10111") {
    param.edges.forEach(function (edge) {
      edge.remove();
    });
  }
};
function addNode(x, y, nodeParams, id, parent, visibility) {
  if (typeof nodeParams != 'object') {
    var sbgnclass = nodeParams;
  } else {
    var sbgnclass = nodeParams.class;
    var language = nodeParams.language;
  }

  var css = {};
  // if there is no specific default width or height for
  // sbgnclass these sizes are used
  var defaultWidth = 50;
  var defaultHeight = 50;

  if (visibility) {
    css.visibility = visibility;
  }

  var data = {
    class: sbgnclass,
    language: language,
    bbox: {
      w: defaultWidth,
      h: defaultHeight,
      x: x,
      y: y
    },
    statesandinfos: [],
    ports: []
  };

  if (id) {
    data.id = id;
  }
  else {
    data.id = elementUtilities.generateNodeId();
  }

  if (parent) {
    data.parent = parent;
  }

  this.extendNodeDataWithClassDefaults(data, sbgnclass);

  // some defaults are not set by extendNodeDataWithClassDefaults()
  var defaults = this.getDefaultProperties(sbgnclass);

  if (defaults['multimer']) {
    data.class += ' multimer';
  }

  if (defaults['clonemarker']) {
    data['clonemarker'] = true;
  }

  data.bbox['w'] = defaults['width'];
  data.bbox['h'] = defaults['height'];

  var eles = cy.add({
    group: "nodes",
    data: data,
    css: css,
    position: {
      x: x,
      y: y
    }
  });

  var newNode = eles[eles.length - 1];
  // Get the default ports ordering for the nodes with given sbgnclass
  var ordering = defaults['ports-ordering'];

  // If there is a default ports ordering for the nodes with given sbgnclass and it is different than 'none' set the ports ordering to that ordering
  if (ordering && ordering !== 'none') {
    this.setPortsOrdering(newNode, ordering);
  }

  if (language == "AF" && !elementUtilities.canHaveMultipleUnitOfInformation(newNode)) {
    if (sbgnclass != "BA plain") { // if AF node can have label i.e: not plain biological activity
      var uoi_obj = {
        clazz: "unit of information"
      };
      uoi_obj.label = {
        text: ""
      };

      uoi_obj.bbox = {
        w: 12,
        h: 12
      };
      elementUtilities.addStateOrInfoBox(newNode, uoi_obj);
    }
  }
  var bgImage = newNode.data('background-image');
  if (bgImage) {
    newNode.data('background-image', bgImage);
  }
  return newNode;
}

function highlightErrors(errors, cy, imageOptions, isValidation) {
  let errorColor = {};
  let counter = 0;
  let labels = {};
  cy.nodes().forEach((node) => { node.removeData('highlightColor'); node.removeClass('highlight');/*node.removeData('label');*/ }
  );
  cy.edges().forEach((edge) => { edge.removeData('highlightColor'); edge.removeClass('path');/*edge.removeData('label');*/ });
  errors.forEach((errorData, i) => {
    let ele = cy.getElementById(errorData.role);
    if (ele.isNode() && ele.data('label') && errorData.label === undefined) {
      errorData.label = ele.data('label');
    }
    else if (ele.isEdge() && errorData.label === undefined) {
      errorData.label = (ele.source() !== undefined ? (ele.source().data('label') !== undefined ? ele.source().data('label') : "") : "") + " - " +
        (ele.target() !== undefined ? (ele.target().data('label') !== undefined ? ele.target().data('label') : "") : "");
    }
  });
  errors.forEach((errorData, i) => {
    let ele = cy.getElementById(errorData.role);
    if (unsolvedErrorInformation[errorData.pattern + errorData.role] !== true && !isValidation) {
      errorData.explanation = fixExplanation[errorData.pattern + errorData.role] ? fixExplanation[errorData.pattern + errorData.role] : "Fix of another error resolved this error.";
      errorData.status = "solved";
      errorData.colorCode = "#808080";
      ele.data('highlightColor', "#808080");
    }
    else {
      if (ele.data('label') && isValidation === true) {
        ele.data('label', ele.data('label') + "\n(" + (i + 1) + ")");
      }
      if (ele.isNode()) {
        ele.addClass('highlight');
      }
      else {
        ele.addClass('path');
      }
      if (errorColor[errorData.role] !== undefined) {
        ele.data('highlightColor', errorColor[errorData.role]);
        errorData.colorCode = errorColor[errorData.role];
      }
      else {
        ele.data('highlightColor', errorHighlightColors[counter % 8]);
        errorData.colorCode = errorHighlightColors[counter % 8];
        errorColor[errorData.role] = errorHighlightColors[counter % 8];
        counter++;
      }
      ele.data('highlightWidth', imageOptions.highlightWidth);
    }
  });
}
module.exports = {
  port,
  app
};
