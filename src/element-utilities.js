const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const $ = jQuery = require('jquery')(window);

let elementUtilities = {};

// initialize map type
elementUtilities.mapType = 'PD';

elementUtilities.logicalOperatorTypes = ['and', 'or', 'not', 'delay'];
elementUtilities.processTypes = ['process', 'omitted process', 'uncertain process',
'association', 'dissociation', 'phenotype'];
elementUtilities.epnTypes = ['macromolecule', 'nucleic acid feature', 'simple chemical',
'source and sink', 'unspecified entity', 'perturbing agent', 'complex', 
'nucleic acid feature multimer', 'macromolecule multimer', 'simple chemical multimer', 'complex multimer'];
elementUtilities.otherNodeTypes = ['compartment', 'tag', 'submap', 'topology group'];

elementUtilities.nodeTypes = elementUtilities.epnTypes
.concat( elementUtilities.logicalOperatorTypes )
.concat( elementUtilities.processTypes )
.concat( elementUtilities.otherNodeTypes );

elementUtilities.compoundNodeTypes = ['complex', 'compartment', 'submap'];

elementUtilities.simpleNodeTypes = $(elementUtilities.nodeTypes)
  .not(elementUtilities.compoundNodeTypes).get();

elementUtilities.edgeTypes = ['consumption', 'production', 'modulation',
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

elementUtilities.elementTypes = elementUtilities.nodeTypes
.concat( elementUtilities.edgeTypes );

// Returns whether the given element or elements with the given class can have ports.
elementUtilities.canHavePorts = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );
  return sbgnclass != 'phenotype' && sbgnclass != 'delay'
          && ( elementUtilities.isLogicalOperator( sbgnclass )
                || elementUtilities.isPNClass( sbgnclass ) );
};

// Returns whether the give element have state variable
elementUtilities.canHaveStateVariable = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );

  if (sbgnclass == 'macromolecule' || sbgnclass == 'nucleic acid feature'
          || sbgnclass == 'complex'
          || sbgnclass == 'macromolecule multimer' || sbgnclass == 'nucleic acid feature multimer'
          || sbgnclass == 'complex multimer') {
    return true;
  }
  return false;
};

// Returns whether the give element have unit of information
elementUtilities.canHaveUnitOfInformation = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );

  if (sbgnclass == 'simple chemical'
          || sbgnclass == 'macromolecule' || sbgnclass == 'nucleic acid feature'
          || sbgnclass == 'complex' || sbgnclass == 'simple chemical multimer'
          || sbgnclass == 'macromolecule multimer' || sbgnclass == 'nucleic acid feature multimer'
          || sbgnclass == 'complex multimer' || (sbgnclass.startsWith('BA') && sbgnclass != "BA plain")
          || sbgnclass == 'compartment' || sbgnclass == 'SIF macromolecule' || sbgnclass == 'SIF simple chemical') {
    return true;
  }
  return false;
};

// Returns whether the given element can have more than one units of information
elementUtilities.canHaveMultipleUnitOfInformation = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );
  return !sbgnclass.startsWith('BA');
};

/*
* Get sbgn class omitting the multimer information
*/
elementUtilities.getPureSbgnClass = function( ele ) {
  if ( ele == null ) {
    return null;
  }

  return elementUtilities.getSbgnClass( ele ).replace( ' multimer', '' );
};

/*
* Get sbgnclass of the given element. If the parameter is a string return it
* by assuming that it is the sbgnclass itself.
*/
elementUtilities.getSbgnClass = function( ele ) {
  if ( ele == null ) {
    return null;
  }

  var sbgnclass = typeof ele === 'string' ? ele : ele.data('class');

  return sbgnclass;
};

elementUtilities.getUnitOfInfoShapeOptions = function(ele) {
  var type = elementUtilities.getPureSbgnClass(ele);

  if ( !elementUtilities.canHaveUnitOfInformation( type ) ) {
    return null;
  }

  var opts = ['rectangle'];

  return opts;
};

// Returns whether the given element is a logical operator
elementUtilities.isLogicalOperator = function( ele ) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );
  return inArray( sbgnclass, elementUtilities.logicalOperatorTypes );
};

// Returns whether the given element is an EPN
elementUtilities.isEPNClass = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );

  return inArray( sbgnclass, elementUtilities.epnTypes );
};

// Returns whether the given element is a PN
elementUtilities.isPNClass = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );

  return inArray( sbgnclass, elementUtilities.processTypes );
};

let inArray = function( value, arr ) {
  return arr.includes(value);
};

elementUtilities.reverseEdge = function(edge){
  var oldSource = edge.source().id();
  var oldTarget = edge.target().id();
  var oldPortSource = edge.data("portsource");
  var oldPortTarget = edge.data("porttarget");
  // var segmentPoints = edge.segmentPoints();


  edge.data().source = oldTarget;
  edge.data().target = oldSource;
  edge.data().portsource = oldPortTarget;
  edge.data().porttarget = oldPortSource;
  edge = edge.move({
     target: oldSource,
     source : oldTarget        
  });

/*   if(Array.isArray(segmentPoints)){
    segmentPoints.reverse();
    edge.data().bendPointPositions = segmentPoints;
    var edgeEditing = cy.edgeEditing('get');
    edgeEditing.initBendPoints(edge);
  } */

  return edge;
}

// Stylesheet helpers

var defaultProperties = {
};

var getDefaultNodeProperties = function() {
  return {
    'border-width': 1.25,
    'border-color': '#555555',
    'background-color': '#ffffff',
    'background-opacity': 1,
    'background-image-opacity': 1,
    'text-wrap': 'wrap'
  };
};

var getDefaultEdgeProperties = function() {
  return {
    'line-color': '#555555',
    'width': 1.25
  };
};

var getDefaultProcessSize = function() {
  return {
    width: 20,
    height: 20
  };
};

var getDefaultLogicalOperatorSize = function() {
  return {
    width: 30,
    height: 30
  };
};

var getDefaultBASize = function() {
  return {
    width: 60,
    height: 30
  };
};

var defaultSifEdgeColorMap = {
  'neighbor-of': '#FC002C',
  'interacts-with': '#B57261',
  'in-complex-with': '#B4987A',
  'controls-state-change-of': '#B4E1CD',
  'controls-transport-of': '#F0E7C8',
  'controls-phosphorylation-of': '#D970A1',
  'catalysis-precedes': '#8EC3ED',
  'controls-expression-of': '#6A0F30',
  'consumption-controled-by': '#A9A9F7',
  'controls-production-of': '#2D5207',
  'controls-transport-of-chemical': '#3F00FF',
  'chemical-affects': '#D95F23',
  'reacts-with': '#4E214B',
  'used-to-produce': '#FF2F07',
  'phosphorylates': '#62392D',
  'dephosphorylates': '#CC8E12',
  'upregulates-expression': '#32D849',
  'downregulates-expression': '#CC8E12',
  'activates': '#32D849',
  'inhibits': '#4886A5'
};

var defaultSizeMap = {
  'macromolecule': {
    width: 60,
    height: 30
  },
  'nucleic acid feature': {
    width: 60,
    height: 30
  },
  'simple chemical': {
    width: 30,
    height: 30
  },
  'source and sink': {
    width: 22,
    height: 22
  },
  'phenotype': {
    width: 60,
    height: 30
  },
  'unspecified entity': {
    width: 60,
    height: 30
  },
  'perturbing agent': {
    width: 60,
    height: 30
  },
  'complex': {
    width: 44,
    height: 44
  },
  'compartment': {
    width: 80,
    height: 80
  },
  'submap': {
    width: 80,
    height: 80
  },
  'tag': {
    width: 35,
    height: 35
  },
  'SIF macromolecule': {
    width: 60,
    height: 30
  },
  'SIF simple chemical': {
    width: 30,
    height: 30
  },
  'topology group': {
    width: 44,
    height: 44
  }
};

elementUtilities.processTypes.forEach( function( type ) {
  // phenotype has a different default size
  if ( type == 'phenotype' ) {
    return;
  }

  defaultSizeMap[ type ] = getDefaultProcessSize();
} );

elementUtilities.logicalOperatorTypes.forEach( function( type ) {
  defaultSizeMap[ type ] = getDefaultLogicalOperatorSize();
} );


var getDefaultSize = function( type ) {
  return defaultSizeMap[ type ];
};

var getDefaultFontProperties = function() {
  return {
    'font-size': 11,
    'font-family': 'Helvetica',
    'font-style': 'normal',
    'font-weight': 'normal',
    'color': '#000'
  };
};

var getDefaultInfoboxProperties = function( nodeClass, infoboxType ) {
  return {
    'font-size': getDefaultInfoboxFontSize( nodeClass, infoboxType ),
    'font-family': 'Arial',
    'font-style': 'normal',
    'font-weight': 'normal',
    'font-color': '#0f0f0f',
    'border-width': 1,
    'border-color': '#555555',
    'background-color': '#ffffff',
    'shape-name': getDefaultInfoboxShapeName( nodeClass, infoboxType ),
    'width': getDefaultInfoboxSize( nodeClass, infoboxType ).w,
    'height': getDefaultInfoboxSize( nodeClass, infoboxType ).h
  };
};

var getDefaultInfoboxFontSize = function( nodeClass, infoboxType ) {
  var fontsize = 9;

  if ( nodeClass === 'SIF macromolecule' || nodeClass === 'SIF simple chemical' ) {
    fontsize = 11;
  }

  return fontsize;
};

var getDefaultInfoboxSize = function( nodeClass, infoboxType ) {
  var w = 12, h = 12;

  if ( nodeClass === 'SIF macromolecule' || nodeClass === 'SIF simple chemical' ) {
    w = 15;
    h = 15;
  }

  return { w, h };
};

var getDefaultInfoboxShapeName = function( nodeClass, infoboxType ) {
  if ( infoboxType === 'state variable' ) {
    return 'stadium';
  }

  var list = elementUtilities.getUnitOfInfoShapeOptions( nodeClass );
  return list[ 0 ];
};

elementUtilities.nodeTypes.forEach( function( type ) {
  defaultProperties[ type ] = $.extend( {}, getDefaultNodeProperties(), getDefaultSize( type ) );
  if (elementUtilities.canHaveStateVariable( type )) {
    var props = getDefaultInfoboxProperties( type, 'state variable' );
    defaultProperties[ type ][ 'state variable' ] = props;
  }
  if (elementUtilities.canHaveUnitOfInformation( type )) {
    var props = getDefaultInfoboxProperties( type, 'unit of information' );
    defaultProperties[ type ][ 'unit of information' ] = props;
  }
} );

elementUtilities.compoundNodeTypes.forEach( function( type ) {
  defaultProperties[ type ] = $.extend( defaultProperties[ type ], {
    'background-opacity': 0.5
  } );
} );

$.extend( defaultProperties['association'], {
  'background-color': '#707070'
} );

elementUtilities.epnTypes
  .concat( elementUtilities.sifTypes )
  .concat( elementUtilities.otherNodeTypes )
  .concat( ['phenotype'] )
  .forEach( function( type ) {
     $.extend( defaultProperties[ type ], getDefaultFontProperties() );
  } );

$.extend( defaultProperties['submap'], {
  'font-size': 14,
  'border-width': 2.25
} );

$.extend( defaultProperties['compartment'], {
  'font-size': 14,
  'border-width': 3.25
} );

elementUtilities.edgeTypes.forEach( function( type ) {
  defaultProperties[ type ] = getDefaultEdgeProperties();

  if ( defaultSifEdgeColorMap[ type ] ) {
    defaultProperties[ type ][ 'line-color' ] = defaultSifEdgeColorMap[ type ];
  }
} );

function getProp( props, name ) {
  var prop = props[ name ];

  if ( typeof prop !== null && typeof prop === 'object' ) {
    return $.extend( {}, prop );
  }

  return prop;
}

function extendDataWithClassDefaults( data, className, propsToSkip ) {
  if ( !className ) {
    return;
  }

  var defaultProps = elementUtilities.getDefaultProperties( className );

  Object.keys( defaultProps ).forEach( function( name ) {
    if ( !propsToSkip || !propsToSkip[ name ] ) {
      data[ name ] = getProp( defaultProps, name );
    }
  } );
}

elementUtilities.extendNodeDataWithClassDefaults = function( data, className ) {
  // list of properties to skip
  var propsToSkip = {
    'width': true,
    'height': true,
    'state variable': true,
    'unit of information': true,
    'multimer': true,
    'clonemarker': true,
    'ports-ordering': true
  };

  extendDataWithClassDefaults( data, className, propsToSkip );
};

elementUtilities.extendEdgeDataWithClassDefaults = function( data, className ) {
  extendDataWithClassDefaults( data, className );
}

// get infobox properties and filter the ones related to style only
elementUtilities.getDefaultInfoboxStyle = function( nodeClass, infoboxType ) {
  var defaultProps = elementUtilities.getDefaultProperties( nodeClass );
  var infoboxStyle = $.extend( {}, defaultProps[ infoboxType ] );

  // width and height are belonging to bbox object rather than style object
  var nonStyleProps = [ 'width', 'height' ];

  nonStyleProps.forEach( function( propName ) {
    delete infoboxStyle[ propName ];
  } );

  return infoboxStyle;
};

elementUtilities.getDefaultProperties = function( sbgnclass ) {
  if ( sbgnclass == undefined ) {
    return defaultProperties;
  }

  var pureClass = elementUtilities.getPureSbgnClass( sbgnclass );

  // init default properties for the class if not initialized yet
  if ( defaultProperties[ pureClass ] == null ) {
    defaultProperties[ pureClass ] = {};
  }

  return defaultProperties[ pureClass ];
};

elementUtilities.setDefaultProperties = function( sbgnclass, props ) {
  $.extend( elementUtilities.getDefaultProperties( sbgnclass ), props );
};

elementUtilities.lockGraphTopology = function() {
  elementUtilities.graphTopologyLocked = true;
  if ( cy.expandCollapse ) {
    cy.expandCollapse('get').disableCue();
  }
};

elementUtilities.unlockGraphTopology = function() {
  elementUtilities.graphTopologyLocked = false;
  if ( cy.expandCollapse ) {
    cy.expandCollapse('get').enableCue();
  }
};

elementUtilities.isGraphTopologyLocked = function() {
  return elementUtilities.graphTopologyLocked;
};

elementUtilities.languageToMapType = function(lang) {
  switch (lang) {
    case 'process description':
      return 'PD';
    case 'activity flow':
      return 'AF';
    case 'sif':
      return 'SIF';
    case 'hybrid sbgn':
      return 'HybridSbgn';
    default:
      return 'HybridAny';
  }
};

elementUtilities.mapTypeToLanguage = function(mapType) {
  switch (mapType) {
    case 'PD':
      return 'process description';
    case 'AF':
      return 'activity flow';
    case 'SIF':
      return 'sif';
    case 'HybridSbgn':
      return 'hybrid sbgn';
    default:
      return 'hybrid any';
  }
};

elementUtilities.getAllCollapsedChildrenRecursively = function(nodes) {
  var expandCollapse = cy.expandCollapse('get');
  var collapsedChildren = cy.collection();
  var collapsedNodes = nodes.filter(".cy-expand-collapse-collapsed-node");
  collapsedNodes.forEach( function( n ) {
    collapsedChildren = collapsedChildren.union(expandCollapse.getCollapsedChildrenRecursively(n));
  } );
  return collapsedChildren;
};

elementUtilities.getWidthByContent = function( content, fontFamily, fontSize, options ) {
  return textUtilities.getWidthByContent( content, fontFamily, fontSize, options );
};

module.exports = {
  elementUtilities
};