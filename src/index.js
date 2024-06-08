const express = require('express');
const app = express();
const cytoscape = require('cytoscape');
const fs = require('fs');
//const { Console } = require('node:console');
const cors = require('cors');
const sbgnviz = require('sbgnviz');
const convertSBGNtoCytoscape = require('sbgnml-to-cytoscape'); // to support sbgnml type of input
const { adjustStylesheet } = require('./stylesheet');
const { stylesheetForSbgn } = require('./stylesheetNewt');
const { jsonToSbgnml } = require('./json-to-sbgnml-converter');
const { sbgnmlToJson } = require('./sbgnml-to-json-converter');
const { elementUtilities } = require('./element-utilities');
const sbgnStylesheet = require('cytoscape-sbgn-stylesheet');

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
  highlightWidth: 30
};

const $ = jQuery = require('jquery')(window);

function base64_encode(file) {
  // read binary data
  var bitmap;
  bitmap = fs.readFileSync(file);
  // convert binary data to base64 encoded string
  return new Buffer(bitmap).toString('base64');
}

function postProcessForLayouts(cy) {
  let processNodes = cy.nodes('[class = "process",class = "uncertain process"]', '[class = "uncertain process"]');
  for (let i = 0; i < processNodes.length; i++) {
    //console.log( i );
    //console.log( processNodes[i].id() );
    let compartment;
    let connectedNodes = processNodes[i].connectedEdges().map(edge => (edge.source() == processNodes[i] ? edge.target() : edge.source()));
    for (let j = 0; j < connectedNodes.length; j++) {
      //console.log( connectedNodes[j].parent().label);
      if (compartment === undefined) {
        compartment = connectedNodes[j].parent();
      }
      if (compartment !== -1 && compartment.id() != connectedNodes[j].parent().id()) {
        compartment = -1;
      }
    }
    if (compartment !== -1 && compartment !== undefined ) {
      processNodes[i].move({ "parent": compartment.id() });
    }
  }


}
  async function  cropImage(image){
    /*var img = new Image(),
    $canvas = $("<canvas>"),
    canvas = $canvas[0],
    context;
    const gm = require('gm'); */
    /*blobData = saveImage(image, imageOptions.format, "adasd");
    let urlCreator = window.URL || window.webkitURL;
    let imageUrl = urlCreator.createObjectURL(blobData);*/
    image = image.replace(/^data:image\/png;base64,/,"");
    const buffer = Buffer.from(image,"base64");
    //image = image.replace(/^data:image\/png;base64,/,"");
    //fs.unlinkSync('./src/1.png');
    //fs.unlinkSync('./src/out.png');
     await trimm(buffer);//fs.writeFileSync('./src/1.png', buffer)
    //console.log(image);


    // Import the image 
     /*gm('./src/1.png') 
  
   // Invoke trim function 
    .trim() 
  
    // Process and Write the image 
    .write("trim1.png", function (err) { 
     if (!err) console.log('done'); 
     }); */
     //trimImage("1.png", "out.png");
     //fs.unlinkSync( "./src/out.png");
     //var dims;

    await imageTrim().then(response => {console.log(response + " succesfully done");  
      //console.log(dimensions.width, dimensions.height);
      /*sizeOf("./src/out.png", async function (err, dimensions) {
      //await console.log(dimensions.width, dimensions.height);
      width = dimensions.width;height = dimensions.height;
      dims = dimensions;
   })*/
      
      
   });;/*trimImage("./src/1.png", "./src/out.png", async function (err)  {
      if (err) {
        console.log(err);
        return 2;
      }
      else {
        await sizeOf("./src/out.png", async function (err, dimensions) {
          /*console.log(dimensions.width, dimensions.height);
          width = dimensions.width;height = dimensions.height;
          dims = dimensions;
          console.log( "no error " + dims );
          return dims;
       });
      }
      });*/
      //for( let i = 0; i < 1000000000000; i++);
     
     //await console.log( dims.width + " " + dims.height );
      //fs.unlinkSync("./src/out.png");
     console.log("sdasdasdas");
     await console.log( dims);
     return dims;
      
     
  };

// for fcose
const fcose = require('cytoscape-fcose');
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
let imageErrorsHighlighted;

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
      //console.log( "distance : " + shortestDistance);
      closestEdge = connectedEdges[i];
      //console.log( connectedEdges[i].source().id() + " " + connectedEdges[i].target().id() );
    }
  }
  return closestEdge;
}

app.use(express.static(path.join(__dirname, "../public/")));
app.use(cors());

// middleware to manage the formats of files
app.use((req, res, next) => {
  //console.log(req.query.errorFixing);
  if (req.query.errorFixing === true) {
    //console.log("error fixingtrue");
    //while(1);
    next();
  }
  if (req.method === "POST") {
    //console.log("edgesssssssssssssssss " + req.query.edges + " " + req.query.format);
    //while(1);
    body = '';
    isJson = false;
    options = '';
    data = '';
    errorMessage = undefined;

    req.on('data', chunk => {
      body += chunk;
    })

    req.on('end', () => {
      //console.log("ziya");
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
      currentSbgn = data;
      let cyJsonData = sbgnmlToJson.convert(xml, data);

      //data = data.replace('libsbgn/0.3', 'libsbgn/0.2');

      fs.writeFileSync('./src/sbgnFile.sbgn', currentSbgn);
      //while(1);
      data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
      //console.log( data[0] );


      let result = SaxonJS.transform({
        stylesheetFileName: './src/templatelibsbgn.sef.json',
        sourceFileName: "./src/sbgnFile.sbgn",
        destination: "serialized"
      }).principalResult;

      //while(1);

      fs.unlinkSync('./src/sbgnFile.sbgn');

      //console.log( cyJsonData );
      let parseString = xml2js.parseString;
      let parsedResult;
      parseString(result, function (err, data) {
        parsedResult = data;
      });
      //console.log( parsedResult );
      errors = [];
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

      //data = cyJsonData;
      data = convertSBGNtoCytoscape(data);
      //console.log( cyJsonData.nodes );
      //console.log( data.nodes);
      data.nodes.forEach((node) => {
        //  console.log(node.data);
        //  console.log( node.data.id);
      });
      // data = sbgnmlToJson.convert(xml,data);
      data = cyJsonData;
      // console.log(data);
      // console.log(data);
      data.nodes.forEach((node) => {
        //if( node.data.class == 'process')
        //console.log(node.data.class);
      });
      //  console.log( node.data.id);
      data.nodes.forEach((node) => {
        //if (node.data.id === 'glyph1')
        //console.log(node.data);
        //  console.log( node.data.id);
      });

      next();
    });
  }
  else
    next();
  ;
});

// whether to include edges in the output or not
// POST :format?edges=true 
// POST :format?clusters=true
 app.post('/validation', async (req, res, next) => {
  let size = 30;
  //console.log("validationnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn");
  //console.log(req.query.errorFixing);
  if (req.query.errorFixing !== undefined && req.query.errorFixing === true) {
    //console.log("pass to error fixing");
    //while(1);
    return next();
  }
  //console.log(req.params);
  //console.log(req.query);
  //let format = req.params.format;
  let imageWanted = true;
  if (req.query.image == "false") {
    imageWanted = false;
  }

  cy = cytoscape({
    styleEnabled: true,
    headless: true
  });

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


  let sbgnNodes = data["nodes"];
  sbgnNodes.forEach(function (node) {
    if (node["data"].bbox) {
      node["position"] = { x: node["data"].bbox.x, y: node["data"].bbox.y };
    }
  });
  //console.log("ziyaaaaaaaaaaaaaaaaaaaaaaaa");
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
  //console.log("ziyaaaaaaaaaaaaaaaaaaaaaaaa");

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
  cy.edges().forEach((edge) => {
    //node.css("width", node.data().bbox.w || size);
    //node.css("height", node.data().bbox.h || size);
    //console.log(edge.data());
  });
  //console.log(cy.edges().data());
  //console.log("ziyaaaaaaaaaaaaaaaaaaaaaaaa");
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
  errors.forEach((errorData, i) => {
    let ele = cy.getElementById(errorData.role);
    if (ele.data('label')) {
      ele.data('label', ele.data('label') + "\n(" + (i + 1) + ")");
    }
    else {
      ele.data('label', "\n(" + (i + 1) + ")");
    }
    ele.addClass('highlight');
    ele.data('highlightColor', errorHighlightColors[i % 8]);
    //console.log( imageOptions.highlightWidth);
    ele.data('highlightWidth', imageOptions.highlightWidth);
  });

  let colorScheme = imageOptions.color || "white";
  let stylesheet = adjustStylesheet('sbgnml', colorScheme);
  //console.log(adjustStylesheet('sbgnml', colorScheme));
  //console.log(stylesheet);

  let ret = {};

  ret['errors'] = errors;
  ret['remainingErrors'] = errors.length;
  //console.log( errors );

  let bgColors = [];
  //console.log(colorScheme);
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
  //console.log(bgColors.length);
  //return res.status(200).send(ret);

  function bGColor() {
    return '#c6dbef';
  }
  let selectionColorr = function () { return imageOptions.color || "white"; }


  // console.log(stylesheet);
  //console.log(errors);
  /*let adjustStylesheet = function(colorScheme) {
    let stylesheet;
    //console.log("stylesheet is adjusted");
      if(colorScheme == 'black_white') {
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape, 'black_white');
        };
      }
      else if(colorScheme == 'greyscale') {
        console.log("greyscale stylesheet");
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape, 'greyscale');
        };
      }
      else if(colorScheme == 'bluescale') {
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape, 'bluescale');
        };
      }
      else if(colorScheme == 'red_blue') {
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape, 'red_blue');
        };
      }
      else if(colorScheme == 'green_brown') {
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape,'green_brown');
        };
      }
      else if(colorScheme == 'purple_brown') {
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape,'purple_brown');
        };
      }
      else if(colorScheme == 'purple_green') {
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape,'purple_green');
        };
      }
      else if(colorScheme == 'grey_red') {
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape,'grey_red');
        };
      }
      else {
        // default color scheme for SBGNML is bluescale
        stylesheet = function(){
          return stylesheetForSbgn(cytoscape,'bluescale');
        };
      }
      return stylesheet;
    };*/
  let stylesheetForSbgnn = function () {
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
        'font-size': function (node) {
          return node.data('font-size');
        },
        'font-style': function (node) {
          return node.data('font-style');
        },
        'height': function (node) {
          return node.data().bbox.h;
        },
        'width': function (node) {
          return node.data().bbox.w;
        },
        'shape': elementUtilities.getCyShape(node),/*function(node) {
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
            }*/
      })
      .selector(':parent').css({
        'background-opacity': 0.3,
        'text-valign': 'bottom',
        'text-halign': 'center',
      })
      .selector('node.error').css({
        'overlay-color': function (node) {
          return node.data('highlightColor') ? node.data('highlightColor') : "#ff0000";
        },
        'overlay-padding': function (node) {
          return node.data('highlightWidth') ? node.data('highlightWidth') : "0px";
        },
        'overlay-opacity': function (node) {
          return node.data('highlightWidth') ? 0.5 : 0;
        },
      })
      .selector('edge.error').css({
        'underlay-color': function (edge) {
          return edge.data('highlightColor') ? edge.data('highlightColor') : "#00ff00";
        },
        'underlay-padding': function (edge) {
          return edge.data('highlightWidth') ? edge.data('highlightWidth') : "0px";
        },
        'underlay-opacity': function (edge) {
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
  let styleSheet = stylesheetForSbgn();
  //console.log( styleSheet);
  postProcessForLayouts(cy);
  //console.log(cy.json());
  //while(1);
  try {
    //next();

    snap.start().then(function () {

      return snap.shot({
        elements: cy.elements().jsons(),
        layout: { name: 'fcose' },
        style: stylesheet,
        resolvesTo: 'all',
        format: imageOptions.format,
        quality: 100,
        width: imageOptions.width,
        height: imageOptions.height,
        background: imageOptions.background
      }).then(function (result) {
        let image = result.image;
        ret["imageErrorsHighlighted"] = (result.image);
        //cropImage(result.image).then(response => {console.log("sdsdas");});
        /*image = image.replace(/^data:image\/png;base64,/,"");
        const buffer = Buffer.from(image,"base64");
        //image = image.replace(/^data:image\/png;base64,/,"");
        //fs.unlinkSync('./src/1.png');
        //fs.unlinkSync('./src/out.png');
        trimm(buffer);//fs.writeFileSync('./src/1.png', buffer)
        fs.writeFileSync('./src/1.png', buffer);*/
        /*trimImage("./src/1.png", "./src/out.png", async function (err)  {
          if (err) {
            console.log(err);
            return 2;
          }
          else {
            await sizeOf("./src/out.png", async function (err, dimensions) {
              /*console.log(dimensions.width, dimensions.height);
              width = dimensions.width;height = dimensions.height;
              dims = dimensions;
              console.log( "no error " + dims );
              return dims;
           });
          }
          }) 
          console.log( "timeout started");*/

         /*sizeOf("./src/out.png", async function (err, dimensions) {
            //await console.log(dimensions.width, dimensions.height);
            width = dimensions.width;height = dimensions.height;
            dims = dimensions;
         });*/
         setTimeout(()=>{console.log( "before getting dimension");
         /*sizeOf("./src/out.png", function (err, dimensions) {
          //await console.log(dimensions.width, dimensions.height);
          console.log( "timeot and try to get width and height");
          width = dimensions.width;height = dimensions.height;
          dims = dimensions;
       })*/

        //ret["imageErrorsHighlighted"]  = base64_encode('./src/out.png');//console.log(ret["imageErrorsHighlighted"]);
        //let img = new Image();
        //ret["aspectRatio"] = dims.width / dims.height;
        let width, height;
       
        ret['errors'] = errors;
        ret['sbgn'] = currentSbgn;
        ret['cyjson'] = cy.elements().jsons();
        /*let data = jsonToSbgnml.createSbgnml(undefined, undefined, undefined, undefined, undefined, undefined, cy);
        data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
        currentSbgn = data;*/
        //while(1);
        //fs.unlinkSync('./src/1.png');
        //fs.unlinkSync('./src/out.png');
        return res.status(200).send(ret)}, 0);
      }).then(function () {
        snap.stop();
        //   next();
        //console.log( sbgnmlToJson.map.extension);
        //console.log( sbgnmlToJson.map.extension.get('renderInformation'));
        let data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension.get('renderInformation'), sbgnmlToJson.map.extension.get('mapProperties'), cy.nodes(), cy.edges(), cy);
        data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
        currentSbgn = data;



        fs.writeFileSync('./src/sbgnFile.sbgn', data);

        let result = SaxonJS.transform({
          stylesheetFileName: './src/templatelibsbgn.sef.json',
          sourceFileName: "./src/sbgnFile.sbgn",
          destination: "serialized"
        }).principalResult;
        //console.log(data);
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

// whether to include edges in the output or not
// POST :format?edges=true 
// POST :format?clusters=true
/*app.post('/:format', (req, res) => {
  let ret = {};
  
}); */

/*app.post('/fix',(req,res) =>{
  console.log("fixStarted");

});*/

// whether to include edges in the output or not
// POST :format?edges=true 
// POST :format?clusters=true
app.post('/fixError', (req, res) => {
  
  let imageOptions = {
    format: 'png',
    background: 'transparent',
    width: 1280,
    height: 720,
    color: 'greyscale',
    highlightColor: '#ff0000',
    highlightWidth: 30
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

  
  let ret = {};
  //console.log(errors);
  //console.log(errors.length);
  //console.log(cy);
  //console.log(req.query);
  ret['errors'] = errors;
  ret["imageErrorsHighlighted"] = imageErrorsHighlighted;
  //console.log(errors);
  let currentErrors;


  let check = 0;
  let numberOfUnsolvedErrors = 0;
  for (let i = 0; i < errors.length; i++) {
    errors[i].errorNo = i + 1;
  }
  currentErrors = errors;
  //console.log(errors);
  //console.log(errors.length);
  while (check < errors.length) {
    errors[check].status = "unsolved";
    let errorFixParam = {};
    errorFixParam.errorCode = errors[check].pattern;
    let ele = cy.getElementById(errors[check].role);
    //console.log(check + " " +  numberOfUnsolvedErrors );
    //console.log( currentErrors[numberOfUnsolvedErrors] );
    //console.log( errors[check]);
    if (currentErrors[numberOfUnsolvedErrors].text[0] !== errors[check].text[0]
      || currentErrors[numberOfUnsolvedErrors].pattern !== errors[check].pattern || currentErrors[numberOfUnsolvedErrors].role !== errors[check].role) {
      //console.log( "not equal");
      errors[check].status = "solved";
      check++;
      continue;
    }

    if (errors[check].pattern == "pd10112") {
      var compartments = cy.nodes('[class= "compartment"]');
      var listedNodes = [];
      for (var i = 0; i < compartments.length; i++) {
        if (compartments[i].parent().length == 0)
          listedNodes.push(compartments[i]);
      }
      //console.log(listedNodes.length);
      //console.log(listedNodes[0].data());
      if (listedNodes.length === 0) {
        numberOfUnsolvedErrors++;
      }
      else {
        errors[check].status = "solved";
        ele.move({ "parent": listedNodes[0].data().id });
        errors[check].explanation = "Fixed by moving "  + " inside " + listedNodes[0].data().id + ".";
      }
    }
    else if (errors[check].pattern == "pd10126") {
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
        errors[check].status = "solved";
        errors[check].explanation = "Edge between this node and " + selectedEdge.source().id() + " is kept."
        fixError(errorFixParam);
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (errors[check].pattern == "pd10124") {
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
      if (listedNodes.length !== 0) {
        let selectedNode = listedNodes[0];
        errorFixParam.newTarget = ele.target().id();
        errorFixParam.newSource = selectedNode.id();
        errorFixParam.edge = ele;
        errorFixParam.portsource = selectedNode.id();
        errors[check].status = "solved";
        errors[check].explanation = "Arc is connected to " + selectedNode.id() + ".";
        fixError(errorFixParam);
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (errors[check].pattern == "pd10103" || errors[check].pattern == "pd10107") {
      errorFixParam.newEdges = [];
      errorFixParam.newNodes = [];
      errorFixParam.oldEdges = [];
      var id = errors[0].role;
      var eles = cy.elements('[id="' + id + '"]');
      errorFixParam.node = eles;
      var edges = cy.nodes('[id = "' + id + '"]').connectedEdges();
      // console.log("pd10103 edges");
      //console.log(edges.data());
      var addedNodeNum = edges.length;
      //console.log(edges.length);

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
      errors[check].status = "solved";
      errors[check].explanation = "Source and sink glyph is splitted for each consumption arc.";
      fixError(errorFixParam);
    }
    else if (errors[check].pattern == "pd10101") {
      let targetTmp = ele.target();
      if (elementUtilities.isEPNClass(targetTmp)) {
        errorFixParam.edge = ele;
        fixError(errorFixParam);
        errors[check].explanation = "Source and target of consumption arc have been swapped.";
        errors[check].status = "solved";
      }
      else
        numberOfUnsolvedErrors++;
    }

    else if (errors[check].pattern == "pd10126") {
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
      //console.log( errorFixParam );
      //console.log(cy.edges());
      fixError(errorFixParam);
      //console.log(cy.edges());
    }
    else if (errors[check].pattern == "pd10125") {
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
      errors[check].status = "solved";
      errors[check].explanation = "The arc has a target reference to " + target.id() + ".";
    }
    else if (errors[check].pattern == "pd10111") {
      errorFixParam.edges = [];
      let connectedEdges = cy.edges('[source =  "' + ele.id() + '"]');
      console.log(connectedEdges.length);
      if (connectedEdges.length !== 0) {
        let selectedEdge = connectedEdges[0]; // default , the selection of edge will be determined later.
        for (let i = 0; i < connectedEdges.size(); i++) {
          if (connectedEdges[i].id() != selectedEdge.id() ) {
            errorFixParam.edges.push(connectedEdges[i]);
          }
        }
        fixError(errorFixParam);
        errors[check].status = "solved";
        errors[check].explanation = "Arc between this node and " + selectedEdge.target.id() + " is kept."; 
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (errors[check].pattern == "pd10104") {
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
      errors[check].explanation = "The arc between dissocation glyph and consumption glyph(" + (selectedEdge.source().id() === ele.id() ? 
      selectedEdge.target().id() : selectedEdge.source().id()) + ") is kept."; 
      errors[check].status = "solved";
    }
    else if (errors[check].pattern == "pd10108") {
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
        errors[check].explanation = "The arc between assocation glyph and production glyph(" + (selectedEdge.source().id() === ele.id() ? 
        selectedEdge.target().id() : selectedEdge.source().id()) + ") is kept."; 
        errors[check].status = "solved";
      }

    }
    else if (errors[check].pattern == "pd10109") {
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
      errors[check].status = "solved";
      errors[check].explanation = "Modulation arc has a source reference to " + selectedNode.id() + ".";
    }

    else if (errors[check].pattern == "pd10125") {
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
      errors[check].status = "solved";   
     }

    else if (errors[check].pattern == "pd10105" || errors[check].pattern == "pd10106") {
      let sourceNode = ele.source();
      let targetNode = ele.target();
      if (elementUtilities.isPNClass(targetNode) && elementUtilities.isEPNClass(sourceNode)) {
        errorFixParam.edge = ele;
        fixError(errorFixParam);
        errors[check].status = "solved";
        errors[check].explanation = "The source and target of production arc have been swapped.";
      }
    }

    // console.log(errors);
    //fixError(errorFixParam);

    //console.log("edgesss after fixx::::");
    //console.log(cy.edges()[1].data());
    // console.log("AfterFix");
    //errors = [];
    //console.log(sbgnmlToJson.map.extension);
    let data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension.get('renderInformation'), sbgnmlToJson.map.extension.get('mapProperties'), cy.nodes(), cy.edges(), cy);
    data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
    currentSbgn = data;


    fs.writeFileSync('./src/sbgnFile.sbgn', data);

    let result = SaxonJS.transform({
      stylesheetFileName: './src/templatelibsbgn.sef.json',
      sourceFileName: "./src/sbgnFile.sbgn",
      destination: "serialized"
    }).principalResult;
    //console.log(data);

    fs.unlinkSync('./src/sbgnFile.sbgn');
    let parseString = xml2js.parseString;
    let parsedResult;
    parseString(result, function (err, data) {
      parsedResult = data;
    });
    //console.log( parsedResult );
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
    check++;
    //console.log(errors.length);
  }
  let data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension.get('renderInformation'), sbgnmlToJson.map.extension.get('mapProperties'), cy.nodes(), cy.edges(), cy);
  data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
  currentSbgn = data;


  fs.writeFileSync('./src/sbgnFile.sbgn', data);

  let result = SaxonJS.transform({
    stylesheetFileName: './src/templatelibsbgn.sef.json',
    sourceFileName: "./src/sbgnFile.sbgn",
    destination: "serialized"
  }).principalResult;
  //console.log(data);

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
    console.log( "last check");
    currentErrors = [];
    let errCount = parsedResult["svrl:schematron-output"]["svrl:failed-assert"].length;
    for (let i = 0; i < errCount; i++) {
      let error = new Issue();
      error.setText(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:text"]);
      error.setPattern(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["$"]["id"]);
      error.setRole(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:diagnostic-reference"][0]["_"]);
      //error.errorNo = i  + 1;
      currentErrors.push(error);
    }
  }

  let styleSheet = stylesheetForSbgn();
  //console.log( styleSheet);
  //console.log( imageOptions.highlightWidth);
  highlightErrors(currentErrors, cy,imageOptions);

  //console.log( "after return " + errors.length);
  let colorScheme = imageOptions.color || "white";
  let stylesheet = adjustStylesheet('sbgnml', colorScheme);
  postProcessForLayouts(cy);
  for( let i = 0; i < errors.length ; i++ ){
    if( errors[i].status == "solved" && errors[i].explanation === undefined ){
      errors[i].explanation = "Fix of another error triggered fix of this error."
    }
  }
  try {
    //next();

    snap.start().then(function () {

      return snap.shot({
        elements: cy.elements().jsons(),
        layout: { name: 'fcose' },
        style: stylesheet,
        resolvesTo: 'all',
        format: imageOptions.format,
        quality: 100,
        width: imageOptions.width,
        height: imageOptions.height,
        background: imageOptions.background
      }).then(function (result) {
        ret["imageErrorsHighlighted"] = result.image;
        console.log(result.image.width + " " + result.image.height);
        //next();
        ret['errors'] = errors;
        ret['sbgn'] = currentSbgn;
        ret['remainingErrors'] = numberOfUnsolvedErrors;
        console.log("before return ");
        //console.log( errors);
        return res.status(200).send(ret);
        console.log("after return");
      }).then(function () {
        snap.stop();
        //   next();
        let data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension.get('renderInformation'), sbgnmlToJson.map.extension.get('mapProperties'), cy.nodes(), cy.edges(), cy);
        data = data.replace('libsbgn/0.3', 'libsbgn/0.2');


        fs.writeFileSync('./src/sbgnFile.sbgn', data);

        let result = SaxonJS.transform({
          stylesheetFileName: './src/templatelibsbgn.sef.json',
          sourceFileName: "./src/sbgnFile.sbgn",
          destination: "serialized"
        }).principalResult;
        //console.log(data);
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
//console.log("dadasdsdsdsddsdsadsdsdsdsaasd");

function fixError(errorFixParam) {
  //console.log("error fixing started");
  //console.log(errorFixParam.errorCode );
  //console.log(cy);
  var errorCode = errorFixParam.errorCode;
  var result = {};
  result.errorCode = errorCode;
  if (errorCode == "pd10101") {
    elementUtilities.reverseEdge(errorFixParam.edge);
    //console.log(cy.edges().data());
  }
  if (errorCode == "pd10103" || errorCode == "pd10107") {
    errorFixParam.newNodes.forEach(function (newNode) {
      console.log(newNode);
      elementUtilities.addNode(newNode.x, newNode.y, newNode.class, newNode.id, undefined, "visible", cy);
      //console.log(cy.nodes()[0].data().id);
      //console.log(cy.nodes()[1].data().id);
      //console.log(cy.nodes()[2].data().id);
      //console.log(cy.nodes()[3].data().id);


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
    //console.log("Number of nodes after fix :" + cy.nodes().length);
    //console.log("Number of edges after fix :" + cy.edges().length);

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

  // node bg image was unexpectedly not rendered until it is clicked
  // use this dirty hack until finding a solution to the problem
  var bgImage = newNode.data('background-image');
  if (bgImage) {
    newNode.data('background-image', bgImage);
  }

  return newNode;

}
//errors = [];
//return res.status(200).send(ret);

function highlightErrors(errors, cy, imageOptions) {
  //console.log( errors.length );
  //console.log( errors);
  cy.nodes().forEach((node) => { node.removeData('highlightColor'); node.removeClass('highlight');/*node.removeData('label');*/ }
  );
  cy.edges().forEach((edge) => { edge.removeData('highlightColor'); edge.removeClass('highlight');/*edge.removeData('label');*/ });
  errors.forEach((errorData, i) => {
    let ele = cy.getElementById(errorData.role);
    if (ele.data('label')) {
      ele.data('label', ele.data('label') + "\n(" + (i + 1) + ")");
    }
    else {
      ele.data('label', "\n(" + (i + 1) + ")");
    }
    ele.addClass('highlight');
    ele.data('highlightColor', errorHighlightColors[i % 8]);
    console.log( imageOptions.highlightWidth);
    ele.data('highlightWidth', imageOptions.highlightWidth);
  });
}

module.exports = {
  port,
  app
};
