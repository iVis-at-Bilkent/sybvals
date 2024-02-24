const cytoscape = require('cytoscape');
const { elementUtilities } = require('./element-utilities');
let stylesheetForSbgn = function () {
  let mapType = 'PD';

  let logicalOperatorTypes = ['and', 'or', 'not', 'delay'];
  let processTypes = ['process', 'omitted process', 'uncertain process',
  'association', 'dissociation', 'phenotype'];
  let epnTypes = ['macromolecule', 'nucleic acid feature', 'simple chemical',
  'source and sink', 'unspecified entity', 'perturbing agent', 'complex', 
  'nucleic acid feature multimer', 'macromolecule multimer', 'simple chemical multimer', 'complex multimer'];
  let otherNodeTypes = ['compartment', 'tag', 'submap', 'topology group'];

  let nodeTypes = epnTypes
.concat( logicalOperatorTypes )
.concat( processTypes )
.concat( otherNodeTypes );

 let compoundNodeTypes = ['complex', 'compartment', 'submap'];

let edgeTypes = ['consumption', 'production', 'modulation',
  'stimulation', 'catalysis', 'inhibition', 'necessary stimulation',
  'logic arc', 'equivalence arc', 'unknown influence', 'positive influence',
  'negative influence', 'controls-state-change-of',
  'controls-transport-of', 'controls-phosphorylation-of',
  'controls-expression-of', 'catalysis-precedes', 'in-complex-with',
  'interacts-with', 'neighbor-of', 'consumption-controled-by',
  'controls-production-of', 'controls-transport-of-chemical',
  'chemical-affects', 'reacts-with', 'used-to-produce',
  'activates', 'inhibits', 'phosphorylates', 'dephosphorylates',
  'upregulates-expression', 'downregulates-expression'
];

const extraComplexPadding = 10;
const extraCompartmentPadding = 14;
    function getCyShape  (ele) {
        var _class = ele.data('class');
        // Get rid of rectangle postfix to have the actual node class
        if (_class.endsWith(' multimer')) {
            _class = _class.replace(' multimer', '');
        }

        if( _class == 'process'){
          return 'square';
        }
      
        if (_class == 'compartment') {
            return 'barrel';
        }
        if (_class == 'phenotype') {
            return 'hexagon';
        }
        if (_class == 'perturbing agent' || _class == 'tag') {
            return 'polygon';
        }
        if (_class == 'SIF macromolecule') {
            return 'macromolecule';
        }
        if (_class == 'SIF simple chemical') {
            return 'simple chemical';
        }
      
        if (_class.startsWith('BA')){
            return 'biological activity';
        }
      
        if (_class == 'submap' || _class == 'topology group'){
            return 'rectangle';
        }

        if( _class == 'complex'){
          return 'cutrectangle';
        }
        if( _class == 'macromolecule'){
          return 'roundrectangle';
        }

        if( _class == 'source and sink'){
          return 'polygon';
        }
      
        // We need to define new node shapes with their class names for these nodes
        if (_class == 'source and sink' || _class == 'nucleic acid feature' || _class == 'macromolecule'
                || _class == 'simple chemical' || _class == 'complex' || _class == 'biological activity' ) {
            return _class;
        }
      
        // These shapes can have ports. If they have ports we represent them by polygons, else they are represented by ellipses or rectangles
        // conditionally.
       /* if ( this.canHavePorts(_class) ) {
      
          if (graphUtilities.portsEnabled === true && ele.data('ports').length === 2) {
            return 'polygon'; // The node has ports represent it by polygon
          }
          else if (_class == 'process' || _class == 'omitted process' || _class == 'uncertain process') {
            return 'rectangle'; // If node has no port and has one of these classes it should be in a rectangle shape
          }
      
          return 'ellipse'; // Other nodes with no port should be in an ellipse shape
        }*/
      
        // The remaining nodes are supposed to be in ellipse shape
        return 'ellipse';
      };

      function getComplexPadding(ele) {
    // this property needs to take into account:
    // - presence of a label
    // - option to display complex labels
    // - presence of states and info box on the bottom
    var padding =  5 ;
    if (options.showComplexName && getElementContent(ele)) {
      padding += extraComplexPadding * 0.5;
      // if there is something on the bottom side

      if (ele.data('auxunitlayouts') && ele.data('auxunitlayouts').bottom && ele.data('auxunitlayouts').bottom.units.length > 0) {
        padding += extraComplexPadding * 0.5;
      }else{  
        
        
        for(var i=0; i < ele.data('statesandinfos').length; i++) {          
          var statesandinfos = ele.data('statesandinfos')[i]; 
          
          var thisY = statesandinfos.bbox.y;
          var thisH = statesandinfos.bbox.h;
          var parentY = (ele.data('class') == "compartment" || ele.data('class') == "complex") ? ele.data('bbox').y : ele.position().y;
          var height = ele.data("originalH") ? ele.data("originalH") : ele.height();
          var parentY2 = Number((parentY + height/ 2).toFixed(2));
          var centerY = Number((thisY+thisH/2).toFixed(2));
          if(centerY == parentY2){
            padding += options.extraComplexPadding * 0.5;
            break;
          }
        }

      }
    }}

    function getComplexMargin(ele) {
    // this property needs to take into account:
    // - presence of a label
    // - option to display complex labels
    // - presence of states and info box on the bottom
    var margin =  -1 * options.extraComplexPadding;

    if ( getElementContent(ele) &&
        ele.data('auxunitlayouts') && // check if there is something on the bottom side
        ele.data('auxunitlayouts').bottom &&
        ele.data('auxunitlayouts').bottom.units.length > 0) {
      margin -= extraComplexPadding * 0.5;
    }

    if (ele.css("font-size") == "14px")
      margin -= 2;

    return margin;
  };


      function getElementContent (ele) {
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
        else if(_class == 'compartment'){
            content = ele.data('label') ? ele.data('label') : "";
        }
        else if(_class == 'complex'){
            if(ele.children().length == 0 /*|| options.showComplexName*/){
                if(ele.data('label')){
                    content = ele.data('label');
                }
                else if(ele.data('infoLabel')){
                    content = ele.data('infoLabel');
                }
                else{
                    content = '';
                }
            }
            else{
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
        else if (_class == 'delay'){
            content = '\u03C4'; // tau
        }
  
        var textWidth = ele.outerWidth() || ele.data('bbox').w;
  
        var textProp = {
            label: content,
            width: ( _class == 'perturbing agent' ? textWidth / 2 : textWidth)
        };
        
        return textProp.label;
    };
    function getDynamicLabelTextSize  (ele, dynamicLabelSizeCoefficient) {
        var sbgnclass, h;
    
        // ele can either be node itself or an object that has class and height fields
        if ( ele.isNode && ele.isNode() ) {
          sbgnclass = ele.data( 'class' );
          h = ele.height();
        }
        else {
          sbgnclass = ele[ 'class' ];
          h = ele[ 'height' ];
        }
    
        var dynamicLabelSize = options.dynamicLabelSize;
        dynamicLabelSize = typeof dynamicLabelSize === 'function' ? dynamicLabelSize.call() : dynamicLabelSize;
    
        if (dynamicLabelSizeCoefficient === undefined) {
          if (dynamicLabelSize == 'small') {
            if (sbgnclass.startsWith("complex"))
              return 10;
            else if (sbgnclass == "compartment" || sbgnclass == "submap")
              return 12;
          }
          else if (dynamicLabelSize == 'regular') {
            if (sbgnclass.startsWith("complex"))
              return 11;
            else if (sbgnclass == "compartment" || sbgnclass == "submap")
              return 14;
          }
          else if (dynamicLabelSize == 'large') {
            if (sbgnclass.startsWith("complex"))
              return 12;
            else if (sbgnclass == "compartment" || sbgnclass == "submap")
              return 16;
          }
    
          dynamicLabelSizeCoefficient = getDynamicLabelSizeCoefficient( dynamicLabelSize );
        }
    
        var textHeight = parseInt(h / 2.45) * dynamicLabelSizeCoefficient;
    
        return textHeight;
      };
      function getSbgnClass ( ele ) {
        if ( ele == null ) {
          return null;
        }
    
        var sbgnclass = typeof ele === 'string' ? ele : ele.data('class');
    
        return sbgnclass;
      };
    
      function getPureSbgnClass ( ele ) {
        if ( ele == null ) {
          return null;
        }
    
        return getSbgnClass( ele ).replace( ' multimer', '' );
      };
      function isLogicalOperator ( ele ) {
        var sbgnclass = getPureSbgnClass( ele );
        return logicalOperatorTypes.includes(sbgnclass);
      };
    
    
      function canHavePorts (ele) {
        var sbgnclass = getPureSbgnClass( ele );
        return sbgnclass != 'phenotype' && sbgnclass != 'delay'
                && ( isLogicalOperator( sbgnclass )
                      || isPNClass( sbgnclass ) );
      };
      function isPNClass (ele) {
        var sbgnclass = getPureSbgnClass( ele );
    
        return  processTypes.includes(sbgnclass);
      };

      function getPointOnCircle (centerX, centerY, radius, angleInDegree) {
        var angleInRadian = angleInDegree * ( Math.PI / 180 ); // Convert degree to radian
        return {
          x: radius * Math.cos(angleInRadian) + centerX,
          y: -1 * radius * Math.sin(angleInRadian) + centerY // We multiply with -1 here because JS y coordinate sign is the oposite of the Mathamatical coordinates system
        };
      };
  

      function generateCircleString (centerX, centerY, radius, angleFrom, angleTo, numOfPoints) {
        var circleStr = "";
        var stepSize = ( angleTo - angleFrom ) / numOfPoints; // We will increment the current angle by step size in each iteration
        var currentAngle = angleFrom; // current angle will be updated in each iteration
  
        for ( var i = 0; i < numOfPoints; i++ ) {
          var point = getPointOnCircle(centerX, centerY, radius, currentAngle);
          currentAngle += stepSize;
          circleStr += point.x + " " + point.y + " ";
        }
  
        return circleStr;
      };
  
      function generateShapeWithPortString (lineHW, shapeHW, type, orientation) {
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
    
    
    function getLabelTextSize  (ele) {
        var _class = ele.data('class');
        // These types of nodes cannot have label but this is statement is needed as a workaround
        if (_class === 'association') {
          return 20;
        }
    
        if (canHavePorts(_class)) {
          var coeff = 1; // The dynamic label size coefficient for these pseudo labels, it is 1 for logical operators
    
          // Coeff is supposed to be 2 for dissociation and 1.5 for other processes
          if (_class === 'dissociation') {
            coeff = 2;
          }
          else if (_class.endsWith('process')) {
            coeff = 1.5;
          }
    
          var ports = ele.data('ports');
    
          if (ports.length === 2) {
            // We assume that the ports are symmetric to the node center so using just one of the ports is enough
            var port = ports[0];
            var orientation = port.x === 0 ? 'vertical' : 'horizontal';
            // This is the ratio of the area occupied with ports over without ports
            var ratio = orientation === 'vertical' ? Math.abs(port.y) / 50 : Math.abs(port.x) / 50;
            coeff /= ratio; // Divide the coeff by ratio to fit into the bbox of the actual shape (discluding ports)
          }
    
          return getDynamicLabelTextSize(ele, coeff);
        }
    
        if (_class === 'delay'){
          return getDynamicLabelTextSize(ele, 2);
        }
    
        return getDynamicLabelTextSize(ele);
      };
  
    return cytoscape.stylesheet()
      .selector('node')
      .css({
        'text-valign': 'center',
        'text-halign': 'center',
        'text-opacity': 1,
        'opacity': 1,
        'padding': 0,
        'background-color':  '#d9d9d9', // function (node) { return bgColor(node, bgColors);}, //'#c6dbef'
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
        }})
        .selector('node[class]').css({
        'shape': function (node) {
            return getCyShape(node);
        },
        'content': function (node) {
            return getElementContent(node);
          },
        'font-size': function (node) {
            // If node labels are expected to be adjusted automatically or element cannot have label
            // or ele.data('font-size') is not defined return elementUtilities.getLabelTextSize()
                      // else return ele.data('font-size')
            //var opt = options.adjustNodeLabelFontSizeAutomatically;
            //var adjust = typeof opt === 'function' ? opt() : opt;

            if (node.data('font-size') != undefined) {
              return node.data('font-size');
            }

            return getLabelTextSize(node);
          }
          /*function(node) {
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
      .selector("node[class][text-wrap]")
			      .style({
              'text-wrap': function (ele) {
               /* var opt = options.fitLabelsToNodes;
                var isFit = typeof opt === 'function' ? opt() : opt;
                if (isFit) {
                  return 'ellipsis';
                }*/
                return ele.data('text-wrap');
              }
      })
    .selector("node")
    .style({
      'text-max-width': function (ele) {
        /*var opt = options.fitLabelsToNodes;
        var isFit = typeof opt === 'function' ? opt() : opt;
        if (isFit) {
          return ele.width();
        }*/
        return '1000px';
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
      //'text-margin-y': elementUtilities.getComplexMargin,
      //'padding': elementUtilities.getComplexPadding,
      'compound-sizing-wrt-labels' : 'exclude',
    })
    .selector("node[class='compartment']")
    .css({
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y' : -1 * extraCompartmentPadding,
      'compound-sizing-wrt-labels' : 'exclude',
    })
    .selector("node:parent[class='compartment']")
    .css({
      'padding': function() {
        return extraCompartmentPadding;
      }
    })
    .selector("node[class='submap']")
    .css({
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y' : -1 * extraCompartmentPadding,
      'compound-sizing-wrt-labels' : 'exclude',
    })/*
    .selector("node:parent[class='submap'],[class='topology group']")
    .css({
      'padding': function() {
        return graphUtilities.getCompoundPaddings() + options.extraCompartmentPadding;
      }
    })*/
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
        }
        
      })
      .selector('edge[class]')
      .css({
        'target-arrow-shape': function (ele) {
          var _class = ele.data('class');
          //return 'triangle';
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
      
      .selector("edge[width]")
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
      })*/
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
      })/*
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
      })*/
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
          //return '-1 -1 1 1 1 0';
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
         'text-margin-y' : getComplexMargin,
         'padding': getComplexPadding,
        'compound-sizing-wrt-labels': 'exclude',
      })
      
      .selector("node[class='compartment']")
      .css({
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': -1 * extraCompartmentPadding,
        'compound-sizing-wrt-labels': 'exclude',
      })
      .selector("node:parent[class='compartment']")
      .css({
        'padding': function () {
          return extraCompartmentPadding;
          // return graphUtilities.getCompoundPaddings() + options.extraCompartmentPadding;
        }
      })
      .selector("node[class='submap']")
      .css({
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': -1 * extraCompartmentPadding,
        'compound-sizing-wrt-labels': 'exclude',
      })
      .selector("node:parent[class='submap'],[class='topology group']")
      .css({
        'padding': function () {
          return 5 + extraCompartmentPadding;
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
        },*/
        'source-arrow-fill': 'hollow',
        /*'text-border-color': function (ele) {
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
        },*/
        'arrow-scale': 1.25
      })
      .selector("edge.cy-expand-collapse-meta-edge")
      .css({
        'line-color': '#C4C4C4',
        'source-arrow-color': '#C4C4C4',
        'target-arrow-color': '#C4C4C4'
      })
      /*.selector("edge:selected")
      .css({
        'line-color': selectionColor,
        'source-arrow-color': selectionColor,
  'target-arrow-color': selectionColor,
  'width': function(ele){
    return Math.max(parseFloat(ele.data('width')) + 2, 3);
    }
      })*/
      /*.selector("edge:active")
      .css({
        'background-opacity': 0.7, //'overlay-color': selectionColor,
        'overlay-padding': '8'
      })*/
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
        }*/
      })
      .selector("edge[class='production'][cardinality > 0]")
      .css({
        'target-label': function (ele) {
          return '' + ele.data('cardinality');
        },
        'target-text-margin-y': '-10',
        /* 'target-text-offset': function (ele) {
          return elementUtilities.getCardinalityDistance(ele);
        }*/
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
              }*/
      })
    /*.selector("core")
    .css({
      'selection-box-color': selectionColor,
      'selection-box-opacity': '0.2', 'selection-box-border-color': selectionColor
    })*/

  };

  module.exports= {
    stylesheetForSbgn
  };