const cytoscape = require('cytoscape');
let stylesheetForSbgn = function () {
    return cytoscape.stylesheet()
      .selector('node')
      .css({
        'text-valign': 'center',
        'text-halign': 'center',
        'text-opacity': 1,
        'opacity': 1,
        'padding': 0,
        'background-color':  '#c6dbef', // function (node) { return bgColor(node, bgColors);}, //'#c6dbef'
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
      /*.selector("node[class='perturbing agent']")
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
      })*/
      /*
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
      })*/
      .selector("node:parent[class='submap'],[class='topology group']")
      .css({
        'padding': function () {
          return options.extraCompartmentPadding;
          //  return graphUtilities.getCompoundPaddings() + options.extraCompartmentPadding;
        }
      })
      /*.selector("node:childless[bbox]")
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
      })*/
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
    /* .selector("edge[class]")
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
        },
              'target-endpoint': function(ele) {
                return elementUtilities.getEndPoint(ele, 'target');
              },
              'line-style': function (ele) {
                return elementUtilities.getArrayLineStyle(ele);
              }
      })*/
    /*.selector("core")
    .css({
      'selection-box-color': selectionColor,
      'selection-box-opacity': '0.2', 'selection-box-border-color': selectionColor
    })*/

  };

  module.exports= {
    stylesheetForSbgn
  };