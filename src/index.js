const express = require('express');
const app = express();
const cytoscape = require('cytoscape');
const fs = require('fs');
const { Console } = require('node:console');
const cors = require('cors');
const sbgnviz = require('sbgnviz');
const convertSBGNtoCytoscape = require('sbgnml-to-cytoscape'); // to support sbgnml type of input
const { adjustStylesheet } = require('./stylesheet');

const { jsonToSbgnml } = require('./json-to-sbgnml-converter');
const { sbgnmlToJson } = require('./sbgnml-to-json-converter');
const { elementUtilities } = require('./element-utilities');

const cytosnap = require('cytosnap');
cytosnap.use(['cytoscape-fcose'], { sbgnStylesheet: 'cytoscape-sbgn-stylesheet', layoutUtilities: 'cytoscape-layout-utilities', svg: 'cytoscape-svg' });
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
const Issue = require('./Issue').Issue;

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


let fun22 = function () {
  return 'rectangle';
}
let generateShapeWithPortString = function (lineHW, shapeHW, type, orientation) {
  var polygonStr;
  var numOfPoints = 30; // Number of points that both halves of circle will have
  if (orientation === 'horizontal') {
    var abovePoints, belowPoints;

    if (type === 'circle') {
      abovePoints = generateCircleString(0, 0, shapeHW, 180, 0, numOfPoints);
      belowPoints = generateCircleString(0, 0, shapeHW, 360, 180, numOfPoints);
    }
    else if (type === 'rectangle') {
      abovePoints = '-' + shapeHW + ' -' + shapeHW + ' ' + shapeHW + ' -' + shapeHW + ' ';
      belowPoints = shapeHW + ' ' + shapeHW + ' -' + shapeHW + ' ' + shapeHW + ' ';
    }

    polygonStr = "-1 -" + lineHW + " -" + shapeHW + " -" + lineHW + " ";
    polygonStr += abovePoints;
    polygonStr += shapeHW + " -" + lineHW + " 1 -" + lineHW + " 1 " + lineHW + " " + shapeHW + " " + lineHW + " ";
    polygonStr += belowPoints;
    polygonStr += "-" + shapeHW + " " + lineHW + " -1 " + lineHW;
  }
  else {
    var leftPoints, rightPoints;

    if (type === 'circle') {
      leftPoints = generateCircleString(0, 0, shapeHW, 90, 270, numOfPoints);
      rightPoints = generateCircleString(0, 0, shapeHW, -90, 90, numOfPoints);
    }
    else if (type === 'rectangle') {
      leftPoints = '-' + shapeHW + ' -' + shapeHW + ' -' + shapeHW + ' ' + shapeHW + ' ';
      rightPoints = shapeHW + ' ' + shapeHW + ' ' + shapeHW + ' -' + shapeHW + ' ';
    }

    polygonStr = "-" + lineHW + " -" + 1 + " -" + lineHW + " -" + shapeHW + " ";
    polygonStr += leftPoints;
    polygonStr += "-" + lineHW + " " + shapeHW + " -" + lineHW + " 1 " + lineHW + " 1 " + lineHW + " " + shapeHW + " ";
    polygonStr += rightPoints;
    polygonStr += lineHW + " -" + shapeHW + " " + lineHW + " -1";
  }

  return polygonStr;
};


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
      console.log("ziya");
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

      // convert sbgn data to json for cytoscape

      var parser = new window.DOMParser;
      var xml = parser.parseFromString(data, 'text/xml');
      data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
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

      data = convertSBGNtoCytoscape(data);
      data.nodes.forEach((node) => {
        console.log(node.data);
        //  console.log( node.data.id);
      });
      // data = sbgnmlToJson.convert(xml,data);
      data = cyJsonData;
      // console.log(data);
      // console.log(data);
      data.nodes.forEach((node) => {
        if( node.data.class == 'process')
        console.log(node.data.class);
      });
      //  console.log( node.data.id);
      data.nodes.forEach((node) => {
        if (node.data.id === 'glyph1')
          console.log(node.data);
        //  console.log( node.data.id);
      });
      /*console.log(cyJsonData);
      /*console.log(cyJsonData);
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
  if (req.query.image == "false") {
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
    color: 'bluescale',
    highlightColor: '#ff0000',
    highlightWidth: 10
  };

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
  console.log("ziyaaaaaaaaaaaaaaaaaaaaaaaa");
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
  console.log("ziyaaaaaaaaaaaaaaaaaaaaaaaa");

  var selectionColor = imageOptions.color || "white";
  /*let stylesheetForSbgnn = cytoscape.stylesheet()
  .selector('node')
  .css({
    /*'text-valign': 'center',
    'text-halign': 'center',
    'text-opacity': 1,
    'opacity': 1,
    'padding': 0,
    'background-color': '#0000ff',
    'shape': 'rectangle'
  }); /*
  .selector("node[class]")
  .css({
    'shape': function (ele) {
      return elementUtilities.getCyShape(ele);
    },
    'content': function (ele) {
      return elementUtilities.getElementContent(ele);
    },
    'font-size': function (ele) {
      // If node labels are expected to be adjusted automatically or element cannot have label
      // or ele.data('font-size') is not defined return elementUtilities.getLabelTextSize()
      // else return ele.data('font-size')
      var opt = options.adjustNodeLabelFontSizeAutomatically;
      var adjust = typeof opt === 'function' ? opt() : opt;

      if (!adjust && ele.data('font-size') != undefined) {
        return ele.data('font-size');
      }

      return elementUtilities.getLabelTextSize(ele);
    }
  })
  .selector("node[class][font-family]")
  .style({
    'font-family': function( ele ) {
      return ele.data('font-family');
    }
  })
  .selector("node[class][font-style]")
  .style({
    'font-style': function( ele ) {
      return ele.data('font-style')
    }
  })
  .selector("node[class][font-weight]")
  .style({
    'font-weight': function( ele ) {
      return ele.data('font-weight');
    }
  })
  .selector("node[class][color]")
  .style({
    'color': function( ele ) {
      return ele.data('color');
    }
  })
  .selector("node[class][background-color]")
  .style({
    'background-color': function( ele ) {
      return ele.data('background-color');
    }
  })
  .selector("node[class][background-opacity]")
  .style({
    'background-opacity': function( ele ) {
      return ele.data('background-opacity');
    }
  })
  .selector("node[class][border-width]")
  .style({
    'border-width': function( ele ) {
      return ele.data('border-width');
    }
  })
  .selector("node[class][border-color]")
  .style({
    'border-color': function( ele ) {
      return ele.data('border-color');
    }
  })
  .selector("node[class][text-wrap]")
  .style({
    'text-wrap': function (ele) {
      var opt = options.fitLabelsToNodes;
      var isFit = typeof opt === 'function' ? opt() : opt;
      if (isFit) {
        return 'ellipsis';
      }
      return ele.data('text-wrap');
    }
  })
  .selector("node")
  .style({
    'text-max-width': function (ele) {
      var opt = options.fitLabelsToNodes;
      var isFit = typeof opt === 'function' ? opt() : opt;
      if (isFit) {
        return ele.width();
      }
      return '1000px';
    },
    'color': function(){
      return "Red";
    }
  })
  .selector("edge[class][line-color]")
  .style({
    'line-color': function( ele ) {
      return ele.data('line-color');
    },
    'source-arrow-color': function( ele ) {
      return ele.data('line-color');
    },
    'target-arrow-color': function( ele ) {
      return ele.data('line-color');
    }
  })
  .selector("edge[class][width]")
  .style({
    'width': function( ele ) {
      return ele.data('width');
    }
  })
  .selector("node[class='association'],[class='dissociation'],[class='and'],[class='or'],[class='not'],[class='process'],[class='omitted process'],[class='uncertain process']")
  .css({
    'shape-polygon-points': function(ele) {
      if (graphUtilities.portsEnabled === true && ele.data('ports').length === 2) {
        // We assume that the ports of the edge are symetric according to the node center so just checking one port is enough for us
        var port = ele.data('ports')[0];
        // If the ports are located above/below of the node then the orientation is 'vertical' else it is 'horizontal'
        var orientation = port.x === 0 ? 'vertical' : 'horizontal';
        // The half width of the actual shape discluding the ports
        var shapeHW = orientation === 'vertical' ? 50 / Math.abs(port.y) : 50 / Math.abs(port.x);
        // Get the class of the node
        var _class = ele.data('class');
        // If class is one of process, omitted process or uncertain process then the type of actual shape is 'rectangle' else it is 'circle'
        var type = _class.endsWith('process') ? 'rectangle' : 'circle';

        // Generate a polygon string with above parameters and return it
        return generateShapeWithPortString(0.01, shapeHW, type, orientation);
      }

      // This element is not expected to have a poygonial shape (Because it does not have 2 ports) just return a trivial string here not to have a run time bug
      return '-1 -1 1 1 1 0';
    }
  })
  .selector("node[class='perturbing agent']")
  .css({
    'shape-polygon-points': '-1, -1,   -0.5, 0,  -1, 1,   1, 1,   0.5, 0, 1, -1'
  })
  .selector("node[class='tag']")
  .css({
    'shape-polygon-points': '-1, -1,   0.25, -1,   1, 0,    0.25, 1,    -1, 1'
  })
  .selector("node:parent[class^='complex']") // start with complex
  .css({
    'text-valign': 'bottom',
    'text-halign': 'center',
    'text-margin-y': elementUtilities.getComplexMargin,
    'padding': elementUtilities.getComplexPadding,
    'compound-sizing-wrt-labels' : 'exclude',
  })
  .selector("node[class='compartment']")
  .css({
    'text-valign': 'bottom',
    'text-halign': 'center',
    'text-margin-y' : -1 * options.extraCompartmentPadding,
    'compound-sizing-wrt-labels' : 'exclude',
  })
  .selector("node:parent[class='compartment']")
  .css({
    'padding': function() {
     return options.extraCompartmentPadding;
      return graphUtilities.getCompoundPaddings() + options.extraCompartmentPadding;
    }
  })
  .selector("node[class='submap']")
  .css({
    'text-valign': 'bottom',
    'text-halign': 'center',
    'text-margin-y' : -1 * options.extraCompartmentPadding,
    'compound-sizing-wrt-labels' : 'exclude',
  })
  .selector("node:parent[class='submap'],[class='topology group']")
  .css({
    'padding': function() {
      return graphUtilities.getCompoundPaddings() + options.extraCompartmentPadding;
    }
  })
  .selector("node:childless[bbox]")
  .css({
    'width': 'data(bbox.w)',
    'height': 'data(bbox.h)'
  })
  .selector("node:parent[minHeight]")
  .css({
    'min-height': function(ele) {
     // if (graphUtilities.compoundSizesConsidered) {
        return ele.data('minHeight');
   //   }

      return 0;
    }
  })
  .selector("node:parent[minHeightBiasTop]")
  .css({
    'min-height-bias-top': function(ele) {
      var min = parseFloat(ele.data('minHeightBiasTop'));
      return (min >= 0 ? min : 100) + '%';
    }
  })
  .selector("node:parent[minHeightBiasBottom]")
  .css({
    'min-height-bias-bottom': function(ele) {
      var min = parseFloat(ele.data('minHeightBiasBottom'));
      return (min >= 0 ? min : 100) + '%';
    }
  })
  .selector("node:parent[minWidth]")
  .css({
    'min-width': function(ele) {
      //if (graphUtilities.compoundSizesConsidered) {
        return ele.data('minWidth');
      //}

      return 0;
    }
  })
  .selector("node:parent[minWidthBiasLeft]")
  .css({
    'min-width-bias-left': function(ele) {
      var min = parseFloat(ele.data('minWidthBiasLeft'));
      return (min >= 0 ? min : 100) + '%';
    }
  })
  .selector("node:parent[minWidthBiasRight]")
  .css({
    'min-width-bias-right': function(ele) {
      var min = parseFloat(ele.data('minWidthBiasRight'));
      return (min >= 0 ? min : 100) + '%';
    }
  })
  .selector("node.cy-expand-collapse-collapsed-node")
  .css({
    'border-style': 'dashed'
  })
  .selector("node:selected")
  .css({
    'border-color': selectionColor,
    'target-arrow-color': '#000',
'text-outline-color': '#000',
'border-width': function(ele){
return Math.max(parseFloat(ele.data('border-width')) + 2, 3);
}
  })
  .selector("node:active")
  .css({
    'background-opacity': 0.7, 'overlay-color': selectionColor,
    'overlay-padding': '14'
  })
  .selector("edge")
  .css({
    'curve-style': 'bezier',
    'target-arrow-fill': function(ele) {
      return elementUtilities.getCyTargetArrowFill(ele);
    },
    'source-arrow-fill': 'hollow',
    'text-border-color': function (ele) {
      if (ele.selected()) {
        return selectionColor;
      }
      return ele.css('line-color');
    },
    'color': function (ele) {
      if (ele.selected()) {
        return selectionColor;
      }
      return ele.css('line-color');
    },
    'arrow-scale': 1.25
  })
  .selector("edge.cy-expand-collapse-meta-edge")
  .css({
    'line-color': '#C4C4C4',
    'source-arrow-color': '#C4C4C4',
    'target-arrow-color': '#C4C4C4'
  })
  .selector("edge:selected")
  .css({
    'line-color': selectionColor,
    'source-arrow-color': selectionColor,
'target-arrow-color': selectionColor,
'width': function(ele){
return Math.max(parseFloat(ele.data('width')) + 2, 3);
}
  })
  .selector("edge:active")
  .css({
    'background-opacity': 0.7, 'overlay-color': selectionColor,
    'overlay-padding': '8'
  })
  .selector("edge[cardinality > 0]")
  .css({
    'text-rotation': 'autorotate',
    'text-background-shape': 'rectangle',
    'text-border-opacity': '1',
    'text-border-width': '1',
    'text-background-color': 'white',
    'text-background-opacity': '1'
  })
  .selector("edge[class='consumption'][cardinality > 0]")
  .css({
    'source-label': function (ele) {
      return '' + ele.data('cardinality');
    },
    'source-text-margin-y': '-10',
    'source-text-offset': function (ele) {
      return elementUtilities.getCardinalityDistance(ele);
    }
  })
  .selector("edge[class='production'][cardinality > 0]")
  .css({
    'target-label': function (ele) {
      return '' + ele.data('cardinality');
    },
    'target-text-margin-y': '-10',
    'target-text-offset': function (ele) {
      return elementUtilities.getCardinalityDistance(ele);
    }
  })
  .selector("edge[class]")
  .css({
    'target-arrow-shape': function (ele) {
      return elementUtilities.getCyArrowShape(ele);
    },
    'source-arrow-shape': 'none',
    'source-endpoint': function(ele) {
      return elementUtilities.getEndPoint(ele, 'source');
    },
    'target-endpoint': function(ele) {
      return elementUtilities.getEndPoint(ele, 'target');
    },
    'line-style': function (ele) {
      return elementUtilities.getArrayLineStyle(ele);
    }
  })
  .selector("core")
  .css({
    'selection-box-color': selectionColor,
    'selection-box-opacity': '0.2', 'selection-box-border-color': selectionColor
  }));*/


  cy.nodes().forEach((node) => {
    node.css("width", node.data().bbox.w || size);
    node.css("height", node.data().bbox.h || size);
    //console.log(node.data());
  });
  console.log("ziyaaaaaaaaaaaaaaaaaaaaaaaa");
  errors.forEach((errorData, i) => {
    if (errorData.pattern == "pd10109" || errorData.pattern == 'pd10110') {
      let ele = cy.getElementById(errorData.role);
      let elesClass = ele.data().class;
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
  console.log("ziyaaaaaaaaaaaaaaaaaaaaaaaa2");
  errors.forEach((errorData, i) => {
    let ele = cy.getElementById(errorData.role);
    if (ele.data('label')) {
      ele.data('label', ele.data('label') + "\n(" + (i + 1) + ")");
    }
    else {
      ele.data('label', "\n(" + (i + 1) + ")");
    }
    ele.addClass('error');
    ele.data('highlightColor', imageOptions.highlightColor);
    ele.data('highlightWidth', imageOptions.highlightWidth);
  });

  let colorScheme = imageOptions.color || "white";
  let stylesheet = adjustStylesheet('sbgnml', colorScheme);
  //console.log(adjustStylesheet('sbgnml', colorScheme));
  //console.log(stylesheet);

  let ret = {};

  ret['errors'] = errors;

  errors = [];
  console.log("ziyaaaaaaaaaaaaaaaaaaaaaaaa2");
  let bgColors = [];
  console.log(colorScheme);
  if (colorScheme == "greyscale") {
    bgColors = ['#f0f0f0', '#d9d9d9', '#bdbdbd'];
  }
  else if (colorScheme == "bluescale") {
    bgColors = ['#eff3ff', '#c6dbef', '#9ecae1'];
  }
  else if (colorScheme == "red_blue") {
    bgColors = ['#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de'];
  }
  else if (colorScheme == "green_brown") {
    bgColors = ['#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1'];
  }
  else if (colorScheme == "purple_brown") {
    bgColors = ['#fdb863', '#fee0b6', '#f7f7f7', '#d8daeb', '#b2abd2'];
  }
  else if (colorScheme == "purple_green") {
    bgColors = ['#a6dba0', '#d9f0d3', '#f7f7f7', '#e7d4e8', '#c2a5cf'];
  }
  else if (colorScheme == "grey_red") {
    bgColors = ['#bababa', '#e0e0e0', '#ffffff', '#fddbc7', '#f4a582'];
  }
  else {
    bgColors = ['#ffffff', '#000000'];
  }
  console.log(bgColors.length);

  const elementStyle = { 
  bgColor(node, bgColors) {
    console.log(node.data().class);
    console.log(bgColors.length);
    if (bgColors.length == 2) {
      return bgColors[0];
    }
    else if (bgColors.length == 3) {
      const sbgnClass = node.data().class;
      if (sbgnClass == 'unspecified entity' || sbgnClass == 'simple chemical' || sbgnClass == 'simple chemical multimer' || sbgnClass == 'macromolecule' || sbgnClass == 'macromolecule multimer'
        || sbgnClass == 'nucleic acid feature' || sbgnClass == 'nucleic acid feature multimer' || sbgnClass == 'perturbing agent' || sbgnClass == 'source and sink'
        || sbgnClass == 'phenotype' || sbgnClass == 'tag') {
        return bgColors[2];
      }
      if (sbgnClass == 'complex' || sbgnClass == 'complex multimer') {
        return bgColors[1];
      }
      if (sbgnClass == 'compartment') {
        return bgColors[0];
      }
      return "#ffffff";
    }
    else if (bgColors.length == 5) {
      const sbgnClass = sbgnData.sbgnClass(node);
      if (sbgnClass == 'unspecified entity' || sbgnClass == 'perturbing agent' || sbgnClass == 'source and sink'
        || sbgnClass == 'phenotype' || sbgnClass == 'tag' || sbgnClass == 'compartment') {
        return bgColors[2];
      }
      if (sbgnClass == 'simple chemical' || sbgnClass == 'simple chemical multimer') {
        return bgColors[1];
      }
      if (sbgnClass == 'macromolecule' || sbgnClass == 'macromolecule multimer') {
        return bgColors[4];
      }
      if (sbgnClass == 'nucleic acid feature' || sbgnClass == 'nucleic acid feature multimer') {
        return bgColors[0];
      }
      if (sbgnClass == 'complex' || sbgnClass == 'complex multimer') {
        return bgColors[3];
      }
      return "#ffffff";
    }
  } } ;
  //return res.status(200).send(ret);
  //console.log(cy.elements().jsons());
  console.log(cy.nodes()[0].data().class);
  let selectionColorr = function () { return imageOptions.color || "white"; }
  let stylesheetForSbgn = function () {
    return cytoscape.stylesheet()
   /* .selector("node")
    .css({
      'width': 'data(bbox.w)',
      'height': 'data(bbox.h)'
    })*/
      .selector('node')
      .css({
        'text-valign': 'center',
        'text-halign': 'center',
        'text-opacity': 1,
        'opacity': 1,
        'padding': 0,
        'background-color': '#c6dbef',
        'border-width': 1,
        'font-size': function(node){
          return node.data('font-size');
        },
        'font-style': function(node){
          return node.data('font-style');
        },
        'height': function(node){
          return node.data().bbox.h;
        },
        'width': function(node){
          return node.data().bbox.w;
        },
        'shape': function(node) {
          sbgnStyle = new Map()
          .set('unspecified entity', {w: 32, h: 32, shape: 'ellipse'})
          .set('simple chemical', {w: 48, h: 48, shape: 'ellipse'})
          .set('simple chemical multimer', {w: 48, h: 48, shape: 'ellipse'})
          .set('macromolecule', {w: 96, h: 48, shape: 'roundrectangle'})
.set('macromolecule multimer', {w: 96, h: 48, shape: 'roundrectangle'})
.set('nucleic acid feature', {w: 88, h: 56, shape: 'bottomroundrectangle'})
.set('nucleic acid feature multimer', {w: 88, h: 52, shape: 'bottomroundrectangle'})
.set('complex', {w: 10, h: 10, shape: 'cutrectangle'})
.set('complex multimer', {w: 10, h: 10, shape: 'cutrectangle'})
.set('source and sink', {w: 60, h: 60, shape: 'polygon'})
.set('perturbing agent', {w: 140, h: 60, shape: 'concavehexagon'})

.set('phenotype', {w: 140, h: 60, shape: 'hexagon'})
.set('process', {w:25, h: 25, shape: 'square'})
.set('uncertain process', {w:25, h: 25, shape: 'square'})
.set('omitted process', {w:25, h: 25, shape: 'square'})
.set('association', {w:25, h: 25, shape: 'ellipse'})
.set('dissociation', {w:25, h: 25, shape: 'ellipse'})

.set('compartment', {w: 50, h: 50, shape: 'barrel'})

.set('tag', {w: 100, h: 65, shape: 'tag'})
.set('and', {w: 40, h: 40, shape: 'ellipse'})
.set('or', {w: 40, h: 40, shape: 'ellipse'})
.set('not', {w: 40, h: 40, shape: 'ellipse'});
          var _class = node.data().class;
          if( _class == 'unspecified entity' || _class == 'simple chemical' || 
          _class == 'association' || _class == 'dissociation' || _class == 'simple chemical multimer' || _class == 'and'
          || _class == 'or' || _class == 'not')
               return 'ellipse';
          if( _class == 'perturbing agent')
               return 'concavehexagon';
          if( _class == 'nucleic acid feature' || _class == 'nucleic acid feature multimer')
               return 'bottomroundrectangle';
               if( _class == 'process' || _class == 'uncertain process')
               return 'square';
          if( _class == 'macromolecule')
               return 'roundrectangle'
               if( _class == 'compartment')
               return 'barrel'
               if( _class == 'source and sink')
               return 'polygon'
               if( _class == 'complex' || _class == 'complex multimer')
               return 'cutrectangle';
               if( _class == 'tag')
               return 'tag';
          return 'rectangle';
        }
      })
      .selector(':parent').css({
        'background-opacity': 0.3,
        'text-valign': 'bottom',
        'text-halign': 'center',
      })
      .selector('node.error').css({
          'overlay-color': function(node){
            return node.data('highlightColor') ? node.data('highlightColor') : "#ff0000";
          },
          'overlay-padding': function(node){
            return node.data('highlightWidth') ? node.data('highlightWidth') : "0px";
          },
          'overlay-opacity': function(node){
            return node.data('highlightWidth') ? 0.5 : 0;
          },
        })
      .selector('edge.error').css({
          'underlay-color': function(edge){
            return edge.data('highlightColor') ? edge.data('highlightColor') : "#00ff00";
          },
          'underlay-padding': function(edge){
            return edge.data('highlightWidth') ? edge.data('highlightWidth') : "0px";
          },
          'underlay-opacity': function(edge){
            return edge.data('highlightWidth') ? 0.5 : 0;
          },
        })
      .selector("node[class]").css({
        'content': function (ele) {
          var _class = ele.data('class');

          if (_class.endsWith(' multimer')) {
            _class = _class.replace(' multimer', '');
          }

          var content = "";
          if (_class == 'macromolecule' || _class == 'simple chemical'
            || _class == 'phenotype'
            || _class == 'unspecified entity' || _class == 'nucleic acid feature'
            || _class == 'perturbing agent' || _class == 'tag'
            || _class == 'biological activity' || _class.startsWith('BA')
            || _class == 'submap' || _class == 'SIF macromolecule'
            || _class == 'SIF simple chemical' || _class == 'complex') {
            content = ele.data('label') ? ele.data('label') : "";
          }
          else if (_class == 'compartment') {
            content = ele.data('label') ? ele.data('label') : "";
          }
          else if (_class == 'complex') {
            if (ele.children().length == 0) {
              if (ele.data('label')) {
                content = ele.data('label');
              }
              else if (ele.data('infoLabel')) {
                content = ele.data('infoLabel');
              }
              else {
                content = '';
              }
            }
            else {
              content = '';
            }
          }
          else if (_class == 'and') {
            content = 'AND';
          }
          else if (_class == 'or') {
            content = 'OR';
          }
          else if (_class == 'not') {
            content = 'NOT';
          }
          else if (_class == 'omitted process') {
            content = '\\\\';
          }
          else if (_class == 'uncertain process') {
            content = '?';
          }
          else if (_class == 'dissociation') {
            content = 'o';
          }
          else if (_class == 'delay') {
            content = '\u03C4'; // tau
          }

          var textWidth = ele.outerWidth() || ele.data('bbox').w;

          var textProp = {
            label: content,
            width: (_class == 'perturbing agent' ? textWidth / 2 : textWidth)
          };

          return textProp.label;
        },
         
      })
      .selector("edge")
      .css({
        'target-arrow-shape': function (ele) {
          var _class = ele.data('class');

          switch (_class) {
            case 'necessary stimulation':
              return 'triangle-cross';
            case 'inhibition': case 'negative influence': case 'inhibits':
            case 'downregulates-expression': case 'dephosphorylates':
              return 'tee';
            case 'catalysis':
              return 'circle';
            case 'stimulation': case 'production': case 'positive influence':
            case 'activates': case 'phosphorylates': case 'upregulates-expression':
            case 'controls-state-change-of': case 'chemical-affects':
            case 'controls-transport-of': case 'controls-phosphorylation-of':
            case 'controls-expression-of': case 'catalysis-precedes':
            case 'consumption-controled-by': case 'controls-production-of':
            case 'controls-transport-of-chemical': case 'used-to-produce':
              return 'triangle';
            case 'modulation': case 'unknown influence':
              return 'diamond';
            default:
              return 'none';
          }
        },
        'source-arrow-shape': 'none',
        'source-endpoint': function (ele) {
          var endNode = ele.source();
          var portId = ele.data('portsource');

          if (portId == null) {
            return 'outside-to-node'; // If there is no portsource return the default value which is 'outside-to-node'
          }

          var ports = endNode.data('ports');
          var port;
          for (var i = 0; i < ports.length; i++) {
            if (ports[i].id === portId) {
              port = ports[i];
            }
          }

          if (port === undefined) {
            return 'outside-to-node'; // If port is not found return the default value which is 'outside-to-node'
          }

          var x, y;
          // Note that for drawing ports we represent the whole shape by a polygon and ports are always 50% away from the node center
          if (port.x != 0) {
            x = Math.sign(port.x) * 50;
            y = 0;
          }
          else {
            x = 0;
            y = Math.sign(port.y) * 50;
          }

          return '' + x + '% ' + y + '%';
        }/*,
              'target-endpoint': function(ele) {
                return elementUtilities.getEndPoint(ele, 'target');
              },
              'line-style': function (ele) {
                return elementUtilities.getArrayLineStyle(ele);
              }*/
      })
      /*
      .selector("node[class]")
      .css({
        'shape': function (ele) {
          var _class = ele.data('class');
          // Get rid of rectangle postfix to have the actual node class
          // return 'compartment';
          if (_class.endsWith(' multimer')) {
            _class = _class.replace(' multimer', '');
          }

          if (_class == 'compartment') {
            console.log("compartment dsadas");
            return 'compartment';
          }
          if (_class == 'phenotype') {
            console.log("compartment2 dsadas");
            return 'hexagon';
          }
          if (_class == 'perturbing agent' || _class == 'tag') {
            return 'polygon';
          }
          if (_class == 'SIF macromolecule') {
            return 'macromolecule';
          }
          if (_class == 'simple chemical') {
            return 'hexagon';
          }

          if (_class.startsWith('BA')) {
            return 'biological activity';
          }

          if (_class == 'submap' || _class == 'topology group') {
            return 'rectangle';
          }
        },
        'content': function (ele) {
          var _class = ele.data('class');

          if (_class.endsWith(' multimer')) {
            _class = _class.replace(' multimer', '');
          }

          var content = "";
          if (_class == 'macromolecule' || _class == 'simple chemical'
            || _class == 'phenotype'
            || _class == 'unspecified entity' || _class == 'nucleic acid feature'
            || _class == 'perturbing agent' || _class == 'tag'
            || _class == 'biological activity' || _class.startsWith('BA')
            || _class == 'submap' || _class == 'SIF macromolecule'
            || _class == 'SIF simple chemical') {
            content = ele.data('label') ? ele.data('label') : "";
          }
          else if (_class == 'compartment') {
            content = ele.data('label') ? ele.data('label') : "";
          }
          else if (_class == 'complex') {
            if (ele.children().length == 0) {
              if (ele.data('label')) {
                content = ele.data('label');
              }
              else if (ele.data('infoLabel')) {
                content = ele.data('infoLabel');
              }
              else {
                content = '';
              }
            }
            else {
              content = '';
            }
          }
          else if (_class == 'and') {
            content = 'AND';
          }
          else if (_class == 'or') {
            content = 'OR';
          }
          else if (_class == 'not') {
            content = 'NOT';
          }
          else if (_class == 'omitted process') {
            content = '\\\\';
          }
          else if (_class == 'uncertain process') {
            content = '?';
          }
          else if (_class == 'dissociation') {
            content = 'o';
          }
          else if (_class == 'delay') {
            content = '\u03C4'; // tau
          }

          var textWidth = ele.outerWidth() || ele.data('bbox').w;

          var textProp = {
            label: content,
            width: (_class == 'perturbing agent' ? textWidth / 2 : textWidth)
          };

          return textProp.label;
        },
        'font-size': function (ele) {
          // If node labels are expected to be adjusted automatically or element cannot have label
          // or ele.data('font-size') is not defined return elementUtilities.getLabelTextSize()
          // else return ele.data('font-size')
          var opt = options.adjustNodeLabelFontSizeAutomatically;
          var adjust = typeof opt === 'function' ? opt() : opt;

          if (!adjust && ele.data('font-size') != undefined) {
            return ele.data('font-size');
          }

          //return elementUtilities.getLabelTextSize(ele);
        }
      })
      /*.selector("edge[width]")
      .style({
        'width': function( ele ) {
          return ele.data('width');
        }
      })
      .selector('node[class][font-family]')
      .style({
        'font-family': function (ele) {
          return ele.data('font-family');
        }
      })

      .selector("node[class][font-style]")
      .style({
        'font-style': function (ele) {
          return ele.data('font-style')
        }
      })
      .selector("node[class][font-weight]")
      .style({
        'font-weight': function (ele) {
          return ele.data('font-weight');
        }
      })
      .selector("node[class][color]")
      .style({
        'color': function (ele) {
          return ele.data('color');
        }
      })
      /*.selector("node[class][background-color]")
      .style({
        'background-color': function( ele ) {
          return ele.data('background-color');
        }
      })
      .selector("node[class][background-opacity]")
      .style({
        'background-opacity': function (ele) {
          return ele.data('background-opacity');
        }
      })
      .selector("node[class][border-width]")
      .style({
        'border-width': function (ele) {
          return ele.data('border-width');
        }
      })
      .selector("node[class][border-color]")
      .style({
        'border-color': function (ele) {
          return ele.data('border-color');
        }
      })
      .selector("node[class][text-wrap]")
      .style({
        'text-wrap': function (ele) {
          var opt = options.fitLabelsToNodes;
          var isFit = typeof opt === 'function' ? opt() : opt;
          if (isFit) {
            return 'ellipsis';
          }
          return ele.data('text-wrap');
        }
      })
      .selector("node")
      .style({
        'text-max-width': function (ele) {
          var opt = options.fitLabelsToNodes;
          var isFit = typeof opt === 'function' ? opt() : opt;
          if (isFit) {
            return ele.width();
          }
          return '1000px';
        },
        'color': function () {
          return "Red";
        }
      })
      .selector("edge[class][line-color]")
      .style({
        'line-color': function (ele) {
          return ele.data('line-color');
        },
        'source-arrow-color': function (ele) {
          return ele.data('line-color');
        },
        'target-arrow-color': function (ele) {
          return ele.data('line-color');
        }
      })
      .selector("edge[class][width]")
      .style({
        'width': function (ele) {
          return ele.data('width');
        }
      })
      .selector("node[class='association'],[class='dissociation'],[class='and'],[class='or'],[class='not'],[class='process'],[class='omitted process'],[class='uncertain process']")
      .css({
        'shape-polygon-points': function (ele) {
          //return '-1 -1 1 1 1 0';
          return '-1 -1 1 1 1 0';
          if (ele.data('ports').length === 2) {
            // We assume that the ports of the edge are symetric according to the node center so just checking one port is enough for us
            var port = ele.data('ports')[0];
            // If the ports are located above/below of the node then the orientation is 'vertical' else it is 'horizontal'
            var orientation = port.x === 0 ? 'vertical' : 'horizontal';
            // The half width of the actual shape discluding the ports
            var shapeHW = orientation === 'vertical' ? 50 / Math.abs(port.y) : 50 / Math.abs(port.x);
            // Get the class of the node
            var _class = ele.data('class');
            // If class is one of process, omitted process or uncertain process then the type of actual shape is 'rectangle' else it is 'circle'
            var type = _class.endsWith('process') ? 'rectangle' : 'circle';

            // Generate a polygon string with above parameters and return it
            return generateShapeWithPortString(0.01, shapeHW, type, orientation);
          }

          // This element is not expected to have a poygonial shape (Because it does not have 2 ports) just return a trivial string here not to have a run time bug
          return '-1 -1 1 1 1 0';
        }
      })
      .selector("node[class='perturbing agent']")
      .css({
        'shape-polygon-points': '-1, -1,   -0.5, 0,  -1, 1,   1, 1,   0.5, 0, 1, -1'
      })
      .selector("node[class='tag']")
      .css({
        'shape-polygon-points': '-1, -1,   0.25, -1,   1, 0,    0.25, 1,    -1, 1'
      })
      .selector("node:parent[class^='complex']") // start with complex
      .css({
        'text-valign': 'bottom',
        'text-halign': 'center',
        // 'text-margin-y': elementUtilities.getComplexMargin,
        // 'padding': elementUtilities.getComplexPadding,
        'compound-sizing-wrt-labels': 'exclude',
      })
      .selector("node[class='compartment']")
      .css({
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': -1 * options.extraCompartmentPadding,
        'compound-sizing-wrt-labels': 'exclude',
      })
      .selector("node:parent[class='compartment']")
      .css({
        'padding': function () {
          return options.extraCompartmentPadding;
          // return graphUtilities.getCompoundPaddings() + options.extraCompartmentPadding;
        }
      })
      .selector("node[class='submap']")
      .css({
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': -1 * options.extraCompartmentPadding,
        'compound-sizing-wrt-labels': 'exclude',
      })
      .selector("node:parent[class='submap'],[class='topology group']")
      .css({
        'padding': function () {
          return options.extraCompartmentPadding;
          //  return graphUtilities.getCompoundPaddings() + options.extraCompartmentPadding;
        }
      })
      .selector("node:childless[bbox]")
      .css({
        'width': 'data(bbox.w)',
        'height': 'data(bbox.h)'
      })
      .selector("node:parent[minHeight]")
      .css({
        'min-height': function (ele) {
          // if (graphUtilities.compoundSizesConsidered) {
          return ele.data('minHeight');
          //   }

          return 0;
        }
      })
      .selector("node:parent[minHeightBiasTop]")
      .css({
        'min-height-bias-top': function (ele) {
          var min = parseFloat(ele.data('minHeightBiasTop'));
          return (min >= 0 ? min : 100) + '%';
        }
      })
      .selector("node:parent[minHeightBiasBottom]")
      .css({
        'min-height-bias-bottom': function (ele) {
          var min = parseFloat(ele.data('minHeightBiasBottom'));
          return (min >= 0 ? min : 100) + '%';
        }
      })
      .selector("node:parent[minWidth]")
      .css({
        'min-width': function (ele) {
          //if (graphUtilities.compoundSizesConsidered) {
          return ele.data('minWidth');
          //}

          return 0;
        }
      })
      .selector("node:parent[minWidthBiasLeft]")
      .css({
        'min-width-bias-left': function (ele) {
          var min = parseFloat(ele.data('minWidthBiasLeft'));
          return (min >= 0 ? min : 100) + '%';
        }
      })
      .selector("node:parent[minWidthBiasRight]")
      .css({
        'min-width-bias-right': function (ele) {
          var min = parseFloat(ele.data('minWidthBiasRight'));
          return (min >= 0 ? min : 100) + '%';
        }
      })
      .selector("node.cy-expand-collapse-collapsed-node")
      .css({
        'border-style': 'dashed'
      })
      .selector("node:selected")
      .css({
        // 'border-color': selectionColor,
        'target-arrow-color': '#000',
        'text-outline-color': '#000',
        'border-width': function (ele) {
          return Math.max(parseFloat(ele.data('border-width')) + 2, 3);
        }
      })
      .selector("node:active")
      .css({
        'background-opacity': 0.7, //'overlay-color': selectionColor,
        'overlay-padding': '14'
      })
      .selector("edge")
      .css({
        'curve-style': 'bezier',
        /*'target-arrow-fill': function(ele) {
          return elementUtilities.getCyTargetArrowFill(ele);
        },
        'source-arrow-fill': 'hollow',
        'text-border-color': function (ele) {
          /*if (ele.selected()) {
            return selectionColor;
          }
          return ele.css('line-color');
        },
        'color': function (ele) {
          /*if (ele.selected()) {
            return selectionColor;
          }
          return ele.css('line-color');
        },
        'arrow-scale': 1.25
      })
      .selector("edge.cy-expand-collapse-meta-edge")
      .css({
        'line-color': '#C4C4C4',
        'source-arrow-color': '#C4C4C4',
        'target-arrow-color': '#C4C4C4'
      })
      /* .selector("edge:selected")
       .css({
         'line-color': selectionColor,
         'source-arrow-color': selectionColor,
   'target-arrow-color': selectionColor,
   'width': function(ele){
     return Math.max(parseFloat(ele.data('width')) + 2, 3);
     }
       })
      .selector("edge:active")
      .css({
        'background-opacity': 0.7, //'overlay-color': selectionColor,
        'overlay-padding': '8'
      })
      .selector("edge[cardinality > 0]")
      .css({
        'text-rotation': 'autorotate',
        'text-background-shape': 'rectangle',
        'text-border-opacity': '1',
        'text-border-width': '1',
        'text-background-color': 'white',
        'text-background-opacity': '1'
      })
      .selector("edge[class='consumption'][cardinality > 0]")
      .css({
        'source-label': function (ele) {
          return '' + ele.data('cardinality');
        },
        'source-text-margin-y': '-10',
        /*'source-text-offset': function (ele) {
          return elementUtilities.getCardinalityDistance(ele);
        }
      })
      .selector("edge[class='production'][cardinality > 0]")
      .css({
        'target-label': function (ele) {
          return '' + ele.data('cardinality');
        },
        'target-text-margin-y': '-10',
        /* 'target-text-offset': function (ele) {
           return elementUtilities.getCardinalityDistance(ele);
         }
      })
      .selector("edge[class]")
      .css({
        'target-arrow-shape': function (ele) {
          var _class = ele.data('class');

          switch (_class) {
            case 'necessary stimulation':
              return 'triangle-cross';
            case 'inhibition': case 'negative influence': case 'inhibits':
            case 'downregulates-expression': case 'dephosphorylates':
              return 'tee';
            case 'catalysis':
              return 'circle';
            case 'stimulation': case 'production': case 'positive influence':
            case 'activates': case 'phosphorylates': case 'upregulates-expression':
            case 'controls-state-change-of': case 'chemical-affects':
            case 'controls-transport-of': case 'controls-phosphorylation-of':
            case 'controls-expression-of': case 'catalysis-precedes':
            case 'consumption-controled-by': case 'controls-production-of':
            case 'controls-transport-of-chemical': case 'used-to-produce':
              return 'triangle';
            case 'modulation': case 'unknown influence':
              return 'diamond';
            default:
              return 'none';
          }
        },
        'source-arrow-shape': 'none',
        'source-endpoint': function (ele) {
          var endNode = ele.source();
          var portId = ele.data('portsource');

          if (portId == null) {
            return 'outside-to-node'; // If there is no portsource return the default value which is 'outside-to-node'
          }

          var ports = endNode.data('ports');
          var port;
          for (var i = 0; i < ports.length; i++) {
            if (ports[i].id === portId) {
              port = ports[i];
            }
          }

          if (port === undefined) {
            return 'outside-to-node'; // If port is not found return the default value which is 'outside-to-node'
          }

          var x, y;
          // Note that for drawing ports we represent the whole shape by a polygon and ports are always 50% away from the node center
          if (port.x != 0) {
            x = Math.sign(port.x) * 50;
            y = 0;
          }
          else {
            x = 0;
            y = Math.sign(port.y) * 50;
          }

          return '' + x + '% ' + y + '%';
        }/*,
              'target-endpoint': function(ele) {
                return elementUtilities.getEndPoint(ele, 'target');
              },
              'line-style': function (ele) {
                return elementUtilities.getArrayLineStyle(ele);
              }
      })
    /*.selector("core")
    .css({
      'selection-box-color': selectionColor,
      'selection-box-opacity': '0.2', 'selection-box-border-color': selectionColor
    })*/

  };
  // console.log(stylesheet);

  try {
    snap.start().then(function () {
      return snap.shot({
        elements: cy.elements().jsons(),
        layout: { name: 'fcose' },
        style: stylesheetForSbgn,
        resolvesTo: 'all',
        format: imageOptions.format,
        quality: 100,
        width: imageOptions.width,
        height: imageOptions.height,
        background: imageOptions.background
      }).then(function (result) {
        ret["imageErrorsHighlighted"] = result.image;
        //console.log(ret);
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

/*{
  id: 'glyph1',
  class: 'compartment',
  label: 'nucleus',
  parent: 'glyph0',
  clonemarker: false,
  stateVariables: [],
  unitsOfInformation: [],
  bbox: {
    x: 727.7495969419266,
    y: 995.9220986448931,
    w: 928.2491938838532,
    h: 687.3441972897863
  }
}*/


/*{
  id: 'glyph1',
  bbox: {
    x: 727.7495969419266,
    y: 995.9220986448931,
    w: 900.2491938838532,
    h: 659.3441972897863
  },
  originalW: 928.2491938838532,
  originalH: 687.3441972897863,
  class: 'compartment',
  label: 'nucleus',
  parent: 'glyph0',
  language: 'PD',
  'border-width': 3.25,
  'border-color': '#bfbfbf',
  'background-color': '#ffffff',
  'background-opacity': 0.5,
  'background-image-opacity': 1,
  'text-wrap': 'wrap',
  'font-size': 14,
  'font-family': 'Helvetica',
  'font-style': 'normal',
  'font-weight': 'normal',
  color: '#000',
  clonemarker: undefined,
  ports: []
}*/




