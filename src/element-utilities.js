const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const $ = jQuery = require('jquery')(window);
const cytoscape = require('cytoscape');

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
elementUtilities.PD = {}; // namespace for all PD specific stuff
elementUtilities.PD.connectivityConstraints = {
  "consumption": {
    "macromolecule":        {asSource: {isAllowed: true},    asTarget: {}},
    "simple chemical":      {asSource: {isAllowed: true},    asTarget: {}},
    "unspecified entity":   {asSource: {isAllowed: true},    asTarget: {}},
    "complex":              {asSource: {isAllowed: true},    asTarget: {}},
    "nucleic acid feature": {asSource: {isAllowed: true},    asTarget: {}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {}},
    "source and sink":      {asSource: {isAllowed: true},    asTarget: {}},
    "perturbing agent":     {asSource: {},   asTarget: {}},
    "submap":               {asSource: {},   asTarget: {}},
    "process":              {asSource: {},   asTarget: {isAllowed: true}},
    "omitted process":      {asSource: {},   asTarget: {isAllowed: true}},
    "uncertain process":    {asSource: {},   asTarget: {isAllowed: true}},
    "phenotype":            {asSource: {},   asTarget: {}},
    "association":          {asSource: {},   asTarget: {isAllowed: true}},
    "dissociation":         {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1, maxTotal: 1}},
    "and":                  {asSource: {},   asTarget: {}},
    "or":                   {asSource: {},   asTarget: {}},
    "not":                  {asSource: {},   asTarget: {}}
  },
  "production": {
    "macromolecule":        {asSource: {},   asTarget: {isAllowed: true}},
    "simple chemical":      {asSource: {},   asTarget: {isAllowed: true}},
    "unspecified entity":   {asSource: {},   asTarget: {isAllowed: true}},
    "complex":              {asSource: {},   asTarget: {isAllowed: true}},
    "nucleic acid feature": {asSource: {},   asTarget: {isAllowed: true}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {}},
    "source and sink":      {asSource: {},   asTarget: {isAllowed: true}},
    "perturbing agent":     {asSource: {},   asTarget: {}},
    "submap":               {asSource: {},   asTarget: {}},
    "process":              {asSource: {isAllowed: true},    asTarget: {}},
    "omitted process":      {asSource: {isAllowed: true},    asTarget: {}},
    "uncertain process":    {asSource: {isAllowed: true},    asTarget: {}},
    "phenotype":            {asSource: {},   asTarget: {}},
    "association":          {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "dissociation":         {asSource: {isAllowed: true},    asTarget: {}},
    "and":                  {asSource: {},   asTarget: {}},
    "or":                   {asSource: {},   asTarget: {}},
    "not":                  {asSource: {},   asTarget: {}}
  },
  "modulation": {
    "macromolecule":        {asSource: {isAllowed: true},    asTarget: {}},
    "simple chemical":      {asSource: {isAllowed: true},    asTarget: {}},
    "unspecified entity":   {asSource: {isAllowed: true},    asTarget: {}},
    "complex":              {asSource: {isAllowed: true},    asTarget: {}},
    "nucleic acid feature": {asSource: {isAllowed: true},    asTarget: {}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {}},
    "source and sink":      {asSource: {isAllowed: true},    asTarget: {}},
    "perturbing agent":     {asSource: {isAllowed: true},    asTarget: {}},
    "submap":               {asSource: {},   asTarget: {}},
    "process":              {asSource: {},   asTarget: {isAllowed: true}},
    "omitted process":      {asSource: {},   asTarget: {isAllowed: true}},
    "uncertain process":    {asSource: {},   asTarget: {isAllowed: true}},
    "phenotype":            {asSource: {},   asTarget: {isAllowed: true}},
    "association":          {asSource: {},   asTarget: {}},
    "dissociation":         {asSource: {},   asTarget: {}},
    "and":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "or":                   {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "not":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}}
  },
  "stimulation": {
    "macromolecule":        {asSource: {isAllowed: true},    asTarget: {}},
    "simple chemical":      {asSource: {isAllowed: true},    asTarget: {}},
    "unspecified entity":   {asSource: {isAllowed: true},    asTarget: {}},
    "complex":              {asSource: {isAllowed: true},    asTarget: {}},
    "nucleic acid feature": {asSource: {isAllowed: true},    asTarget: {}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {}},
    "source and sink":      {asSource: {isAllowed: true},    asTarget: {}},
    "perturbing agent":     {asSource: {isAllowed: true},    asTarget: {}},
    "submap":               {asSource: {},   asTarget: {}},
    "process":              {asSource: {},   asTarget: {isAllowed: true}},
    "omitted process":      {asSource: {},   asTarget: {isAllowed: true}},
    "uncertain process":    {asSource: {},   asTarget: {isAllowed: true}},
    "phenotype":            {asSource: {},   asTarget: {isAllowed: true}},
    "association":          {asSource: {},   asTarget: {}},
    "dissociation":         {asSource: {},   asTarget: {}},
    "and":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "or":                   {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "not":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}}
  },
  "catalysis": {
    "macromolecule":        {asSource: {isAllowed: true},    asTarget: {}},
    "simple chemical":      {asSource: {isAllowed: true},    asTarget: {}},
    "unspecified entity":   {asSource: {isAllowed: true},    asTarget: {}},
    "complex":              {asSource: {isAllowed: true},    asTarget: {}},
    "nucleic acid feature": {asSource: {},   asTarget: {}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {}},
    "source and sink":      {asSource: {isAllowed: true},    asTarget: {}},
    "perturbing agent":     {asSource: {},   asTarget: {}},
    "submap":               {asSource: {},   asTarget: {}},
    "process":              {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1}},
    "omitted process":      {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1}},
    "uncertain process":    {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1}},
    "phenotype":            {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1}},
    "association":          {asSource: {},   asTarget: {}},
    "dissociation":         {asSource: {},   asTarget: {}},
    "and":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "or":                   {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "not":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}}
  },
  "inhibition": {
    "macromolecule":        {asSource: {isAllowed: true},    asTarget: {}},
    "simple chemical":      {asSource: {isAllowed: true},    asTarget: {}},
    "unspecified entity":   {asSource: {isAllowed: true},    asTarget: {}},
    "complex":              {asSource: {isAllowed: true},    asTarget: {}},
    "nucleic acid feature": {asSource: {isAllowed: true},    asTarget: {}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {}},
    "source and sink":      {asSource: {isAllowed: true},    asTarget: {}},
    "perturbing agent":     {asSource: {isAllowed: true},    asTarget: {}},
    "submap":               {asSource: {},   asTarget: {}},
    "process":              {asSource: {},   asTarget: {isAllowed: true}},
    "omitted process":      {asSource: {},   asTarget: {isAllowed: true}},
    "uncertain process":    {asSource: {},   asTarget: {isAllowed: true}},
    "phenotype":            {asSource: {},   asTarget: {isAllowed: true}},
    "association":          {asSource: {},   asTarget: {}},
    "dissociation":         {asSource: {},   asTarget: {}},
    "and":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "or":                   {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "not":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}}
  },
  "necessary stimulation": {
    "macromolecule":        {asSource: {isAllowed: true},    asTarget: {}},
    "simple chemical":      {asSource: {isAllowed: true},    asTarget: {}},
    "unspecified entity":   {asSource: {isAllowed: true},    asTarget: {}},
    "complex":              {asSource: {isAllowed: true},    asTarget: {}},
    "nucleic acid feature": {asSource: {isAllowed: true},    asTarget: {}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {}},
    "source and sink":      {asSource: {isAllowed: true},    asTarget: {}},
    "perturbing agent":     {asSource: {isAllowed: true},    asTarget: {}},
    "submap":               {asSource: {},   asTarget: {}},
    "process":              {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1}},
    "omitted process":      {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1}},
    "uncertain process":    {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1}},
    "phenotype":            {asSource: {},   asTarget: {isAllowed: true, maxEdge: 1}},
    "association":          {asSource: {},   asTarget: {}},
    "dissociation":         {asSource: {},   asTarget: {}},
    "and":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "or":                   {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
    "not":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {}},
  },
  "logic arc": {
    "macromolecule":        {asSource: {isAllowed: true},    asTarget: {}},
    "simple chemical":      {asSource: {isAllowed: true},    asTarget: {}},
    "unspecified entity":   {asSource: {isAllowed: true},    asTarget: {}},
    "complex":              {asSource: {isAllowed: true},    asTarget: {}},
    "nucleic acid feature": {asSource: {isAllowed: true},    asTarget: {}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {}},
    "source and sink":      {asSource: {isAllowed: true},    asTarget: {}},
    "perturbing agent":     {asSource: {},   asTarget: {}},
    "submap":               {asSource: {},   asTarget: {}},
    "process":              {asSource: {},   asTarget: {}},
    "omitted process":      {asSource: {},   asTarget: {}},
    "uncertain process":    {asSource: {},   asTarget: {}},
    "phenotype":            {asSource: {},   asTarget: {}},
    "association":          {asSource: {},   asTarget: {}},
    "dissociation":         {asSource: {},   asTarget: {}},
    "and":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {isAllowed: true}},
    "or":                   {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {isAllowed: true}},
    "not":                  {asSource: {isAllowed: true, maxEdge: 1, maxTotal: 1},      asTarget: {isAllowed: true, maxEdge: 1, maxTotal: 1}},
  },
  "equivalence arc": {
    "macromolecule":        {asSource: {isAllowed: true},   asTarget: {}},
    "simple chemical":      {asSource: {isAllowed: true},   asTarget: {}},
    "unspecified entity":   {asSource: {isAllowed: true},   asTarget: {}},
    "complex":              {asSource: {isAllowed: true},   asTarget: {}},
    "nucleic acid feature": {asSource: {isAllowed: true},   asTarget: {}},
    "compartment":          {asSource: {},   asTarget: {}},
    "tag":                  {asSource: {},   asTarget: {isAllowed: true}},
    "source and sink":      {asSource: {},   asTarget: {}},
    "perturbing agent":     {asSource: {},   asTarget: {}},
    "submap":               {asSource: {},   asTarget: {isAllowed: true}},
    "process":              {asSource: {},   asTarget: {}},
    "omitted process":      {asSource: {},   asTarget: {}},
    "uncertain process":    {asSource: {},   asTarget: {}},
    "phenotype":            {asSource: {},   asTarget: {}},
    "association":          {asSource: {},   asTarget: {}},
    "dissociation":         {asSource: {},   asTarget: {}},
    "and":                  {asSource: {},   asTarget: {}},
    "or":                   {asSource: {},   asTarget: {}},
    "not":                  {asSource: {},   asTarget: {}}
  }
};


elementUtilities.getMapType = function(){
  return elementUtilities.mapType;
}
elementUtilities.isModulationArcClass = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );
  return (sbgnclass == 'modulation'
          || sbgnclass == 'stimulation' || sbgnclass == 'catalysis'
          || sbgnclass == 'inhibition' || sbgnclass == 'necessary stimulation');
};

// Returns whether the class of given element is an arc of AF specs except logical arc
elementUtilities.isAFArcClass = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele );
  return (sbgnclass == 'positive influence' || sbgnclass == 'negative influence'
          || sbgnclass == 'unknown influence' || sbgnclass == 'necessary stimulation');
};
// This function gets an edge, and ends of that edge (Optionally it may take just the classes of the edge as well) as parameters.
    // It may return 'valid' (that ends is valid for that edge), 'reverse' (that ends is not valid for that edge but they would be valid
    // if you reverse the source and target), 'invalid' (that ends are totally invalid for that edge).
    elementUtilities.validateArrowEnds = function (edge, source, target) {
      // if map type is Unknown -- no rules applied
      if (elementUtilities.getMapType() == "HybridAny" || elementUtilities.getMapType() == "HybridSbgn" || !elementUtilities.getMapType())
        return "valid";

      var edgeclass = typeof edge === 'string' ? edge : edge.data('class');
      var sourceclass = source.data('class');
      var targetclass = target.data('class');
      var mapType = elementUtilities.getMapType();
      //console.log(mapType);
      //console.log(elementUtilities[mapType]);
      var edgeConstraints = elementUtilities[mapType].connectivityConstraints[edgeclass];

      if (mapType == "AF"){
        if (sourceclass.startsWith("BA")) // we have separate classes for each biological activity
          sourceclass = "biological activity"; // but same rule applies to all of them

        if (targetclass.startsWith("BA")) // we have separate classes for each biological activity
          targetclass = "biological activity"; // but same rule applies to all of them
      }
      else if (mapType == "PD"){
        sourceclass = sourceclass.replace(/\s*multimer$/, '');
        targetclass = targetclass.replace(/\s*multimer$/, '');
      }

      // given a node, acting as source or target, returns boolean wether or not it has too many edges already
      function hasTooManyEdges(node, sourceOrTarget) {
        var nodeclass = node.data('class');
        nodeclass = nodeclass.replace(/\s*multimer$/, '');
        if (nodeclass.startsWith("BA"))
          nodeclass = "biological activity";

        var totalTooMany = true;
        var edgeTooMany = true;
        if (sourceOrTarget == "source") {
            var sameEdgeCountOut = node.outgoers('edge[class="'+edgeclass+'"]').size();
            var totalEdgeCountOut = node.outgoers('edge').size();
            // check that the total edge count is within the limits
            if (typeof edgeConstraints[nodeclass].asSource.maxTotal == 'undefined'
                || totalEdgeCountOut < edgeConstraints[nodeclass].asSource.maxTotal ) {
                totalTooMany = false;
            }
            // then check limits for this specific edge class
            if (typeof edgeConstraints[nodeclass].asSource.maxEdge == 'undefined'
                || sameEdgeCountOut < edgeConstraints[nodeclass].asSource.maxEdge ) {
                edgeTooMany = false;
            }
            // if only one of the limits is reached then edge is invalid
            return totalTooMany || edgeTooMany;
        }
        else { // node is used as target
            var sameEdgeCountIn = node.incomers('edge[class="'+edgeclass+'"]').size();
            var totalEdgeCountIn = node.incomers('edge').size();
            if (typeof edgeConstraints[nodeclass].asTarget.maxTotal == 'undefined'
                || totalEdgeCountIn < edgeConstraints[nodeclass].asTarget.maxTotal ) {
                totalTooMany = false;
            }
            if (typeof edgeConstraints[nodeclass].asTarget.maxEdge == 'undefined'
                || sameEdgeCountIn < edgeConstraints[nodeclass].asTarget.maxEdge ) {
                edgeTooMany = false;
            }
            return totalTooMany || edgeTooMany;
        }
        return false;
      }

      function isInComplex(node) {
        var parentClass = node.parent().data('class');
        return parentClass && parentClass.startsWith('complex');
      }

      if (isInComplex(source) || isInComplex(target)) { // subunits of a complex are no longer EPNs, no connection allowed
        return 'invalid';
      }

      // check nature of connection
      if (edgeConstraints[sourceclass].asSource.isAllowed && edgeConstraints[targetclass].asTarget.isAllowed) {
        // check amount of connections
        if (!hasTooManyEdges(source, "source") && !hasTooManyEdges(target, "target") ) {
          return 'valid';
        }
      }
      // try to reverse
      if (edgeConstraints[targetclass].asSource.isAllowed && edgeConstraints[sourceclass].asTarget.isAllowed) {
        if (!hasTooManyEdges(target, "source") && !hasTooManyEdges(source, "target") ) {
          return 'reverse';
        }
      }
      return 'invalid';
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
  //console.log( oldSource + " " + oldTarget + " " + oldPortSource + " " + oldPortTarget );

  edge.data().source = oldTarget;
  edge.data().target = oldSource;
  edge.data().portsource = oldPortTarget;
  edge.data().porttarget = oldPortSource;
  edge = edge.move({
     //porttarget: oldPortSource,
     //portsource : oldPortTarget,
     source: oldTarget,
     target: oldSource
  });
  //console.log("Fixed edge after fixing");
  //console.log(edge.data());

/*   if(Array.isArray(segmentPoints)){
    segmentPoints.reverse();
    edge.data().bendPointPositions = segmentPoints;
    var edgeEditing = cy.edgeEditing('get');
    edgeEditing.initBendPoints(edge);
  } */

  return edge;
}

elementUtilities.addEdge = function (source, target, edgeParams,cy, id, visibility, groupID ) {
  if (typeof edgeParams != 'object'){
    var sbgnclass = edgeParams;
  } else {
      var sbgnclass = edgeParams.class;
      var language = edgeParams.language;
  }

  var css = {};

  if (visibility) {
    css.visibility = visibility;
  }

  var data = {
      source: source,
      target: target,
      class: sbgnclass,
      language: language,
  };

  var defaults = elementUtilities.getDefaultProperties( sbgnclass );

  // extend the data with default properties of edge style
  Object.keys( defaults ).forEach( function( prop ) {
    data[ prop ] = defaults[ prop ];
  } );

  if(id) {
    data.id = id;
  }
  else {
    data.id = elementUtilities.generateEdgeId();
  }

  if(elementUtilities.canHaveSBGNCardinality(sbgnclass)){
    data.cardinality = 0;
  }

  var sourceNode = cy.getElementById(source); // The original source node
  var targetNode = cy.getElementById(target); // The original target node
  var sourceHasPorts = sourceNode.data('ports') !== undefined && sourceNode.data('ports').length === 2;
  var targetHasPorts = targetNode.data('ports') !== undefined && targetNode.data('ports').length === 2;
  // The portsource and porttarget variables
  var portsource;
  var porttarget;

  elementUtilities.getPortsOrdering = function(node) {
    // Return the cached portsordering if exists
    if (node.data('portsordering')) {
      return node.data('portsordering');
    }
 
    var ports = node.data('ports');
    if (ports.length !== 2) {
      node.data('portsordering', 'none'); // Cache the ports ordering
      return 'none'; // Nodes are supposed to have 2 nodes or none
    }
 
    /*
     * Retursn if the given portId is porttarget of any of the given edges.
     * These edges are expected to be the edges connected to the node associated with that port.
     */
    var isPortTargetOfAnyEdge = function(edges, portId) {
      for (var i = 0; i < edges.length; i++) {
        if (edges[i].data('porttarget') === portId) {
          return true;
        }
      }
 
      return false;
    };
 
    // If the ports are located above/below of the node then the orientation is 'vertical' else it is 'horizontal'.
    var orientation = ports[0].x === 0 ? 'vertical' : 'horizontal';
    // We need the connected edges of the node to find out if a port is an input port or an output port
    var connectedEdges = node.connectedEdges();
 
    var portsordering;
    if (orientation === 'horizontal') {
      var leftPortId = ports[0].x < 0 ? ports[0].id : ports[1].id; // Left port is the port whose x value is negative
      // If left port is port target for any of connected edges then the ordering is 'L-to-R' else it is 'R-to-L'
      if (isPortTargetOfAnyEdge(connectedEdges, leftPortId)) {
        portsordering = 'L-to-R';
      }
      else {
        portsordering = 'R-to-L';
      }
    }
    else {
      var topPortId = ports[0].y < 0 ? ports[0].id : ports[1].id; // Top port is the port whose y value is negative
      // If top  port is port target for any of connected edges then the ordering is 'T-to-B' else it is 'B-to-T'
      if (isPortTargetOfAnyEdge(connectedEdges, topPortId)) {
        portsordering = 'T-to-B';
      }
      else {
        portsordering = 'B-to-T';
      }
    }
 
    // Cache the portsordering and return it.
    node.data('portsordering', portsordering);
    return portsordering;
   };
 

  /*
   * Get input/output port id's of a node with the assumption that the node has valid ports.
   */
  var getIOPortIds = function (node) {
    var nodeInputPortId, nodeOutputPortId;
    var nodePortsOrdering = elementUtilities.getPortsOrdering(node);
    var nodePorts = node.data('ports');
    if ( nodePortsOrdering === 'L-to-R' || nodePortsOrdering === 'R-to-L' ) {
      var leftPortId = nodePorts[0].x < 0 ? nodePorts[0].id : nodePorts[1].id; // The x value of left port is supposed to be negative
      var rightPortId = nodePorts[0].x > 0 ? nodePorts[0].id : nodePorts[1].id; // The x value of right port is supposed to be positive
      /*
       * If the port ordering is left to right then the input port is the left port and the output port is the right port.
       * Else if it is right to left it is vice versa
       */
      nodeInputPortId = nodePortsOrdering === 'L-to-R' ? leftPortId : rightPortId;
      nodeOutputPortId = nodePortsOrdering === 'R-to-L' ? leftPortId : rightPortId;
    }
    else if ( nodePortsOrdering === 'T-to-B' || nodePortsOrdering === 'B-to-T' ){
      var topPortId = nodePorts[0].y < 0 ? nodePorts[0].id : nodePorts[1].id; // The y value of top port is supposed to be negative
      var bottomPortId = nodePorts[0].y > 0 ? nodePorts[0].id : nodePorts[1].id; // The y value of bottom port is supposed to be positive
      /*
       * If the port ordering is top to bottom then the input port is the top port and the output port is the bottom port.
       * Else if it is right to left it is vice versa
       */
      nodeInputPortId = nodePortsOrdering === 'T-to-B' ? topPortId : bottomPortId;
      nodeOutputPortId = nodePortsOrdering === 'B-to-T' ? topPortId : bottomPortId;
    }

    // Return an object containing the IO ports of the node
    return {
      inputPortId: nodeInputPortId,
      outputPortId: nodeOutputPortId
    };
  };

  // If at least one end of the edge has ports then we should determine the ports where the edge should be connected.
  if (sourceHasPorts || targetHasPorts) {
    var sourceNodeInputPortId, sourceNodeOutputPortId, targetNodeInputPortId, targetNodeOutputPortId;

    // If source node has ports set the variables dedicated for its IO ports
    if ( sourceHasPorts ) {
      var ioPorts = getIOPortIds(sourceNode);
      sourceNodeInputPortId = ioPorts.inputPortId;
      sourceNodeOutputPortId = ioPorts.outputPortId;
    }

    // If target node has ports set the variables dedicated for its IO ports
    if ( targetHasPorts ) {
      var ioPorts = getIOPortIds(targetNode);
      targetNodeInputPortId = ioPorts.inputPortId;
      targetNodeOutputPortId = ioPorts.outputPortId;
    }

    if (sbgnclass === 'consumption') {
      // A consumption edge should be connected to the input port of the target node which is supposed to be a process (any kind of)
      portsource = sourceNodeOutputPortId;
      porttarget = targetNodeInputPortId;
    }
    else if (sbgnclass === 'production') {
      // A production edge should be connected to the output port of the source node which is supposed to be a process (any kind of)
      // A modulation edge may have a logical operator as source node in this case the edge should be connected to the output port of it
      // The below assignment satisfy all of these condition
      if(groupID == 0 || groupID == undefined) { // groupID 0 for reversible reactions group 0
        portsource = sourceNodeOutputPortId;
        porttarget = targetNodeInputPortId;
      }
      else { //if reaction is reversible and edge belongs to group 1
        portsource = sourceNodeInputPortId;
      }
    }
    else if(elementUtilities.isModulationArcClass(sbgnclass) || elementUtilities.isAFArcClass(sbgnclass)){
      portsource = sourceNodeOutputPortId;
    }
    else if (sbgnclass === 'logic arc') {
      var srcClass = sourceNode.data('class');
      var tgtClass = targetNode.data('class');
      var isSourceLogicalOp = srcClass === 'and' || srcClass === 'or' || srcClass === 'not';
      var isTargetLogicalOp = tgtClass === 'and' || tgtClass === 'or' || tgtClass === 'not';

      if (isSourceLogicalOp && isTargetLogicalOp) {
        // If both end are logical operators then the edge should be connected to the input port of the target and the output port of the input
        porttarget = targetNodeInputPortId;
        portsource = sourceNodeOutputPortId;
      }// If just one end of logical operator then the edge should be connected to the input port of the logical operator
      else if (isSourceLogicalOp) {
        portsource = sourceNodeInputPortId;
        porttarget = targetNodeOutputPortId;
      }
      else if (isTargetLogicalOp) {
        portsource = sourceNodeOutputPortId;
        porttarget = targetNodeInputPortId;
      }
    }
  }

  // The default portsource/porttarget are the source/target themselves. If they are not set use these defaults.
  // The portsource and porttarget are determined set them in data object.
  data.portsource = portsource || source;
  data.porttarget = porttarget || target;

  var eles = cy.add({
    group: "edges",
    data: data,
    css: css
  });

  var newEdge = eles[eles.length - 1];

  return newEdge;
};    
elementUtilities.canHaveSBGNCardinality = function (ele) {
  var sbgnclass = elementUtilities.getPureSbgnClass( ele )

  return sbgnclass == 'consumption' || sbgnclass == 'production';
};

elementUtilities.addNode = function (x, y, nodeParams, id, parent, visibility,cy) {
  //console.log("new node");
  if (typeof nodeParams != 'object'){
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

  if(id) {
    data.id = id;
  }
  else {
    data.id = elementUtilities.generateNodeId();
  }

  if (parent) {
    data.parent = parent;
  }

  this.extendNodeDataWithClassDefaults( data, sbgnclass );

  // some defaults are not set by extendNodeDataWithClassDefaults()
  var defaults = this.getDefaultProperties( sbgnclass );

  if ( defaults[ 'multimer' ] ) {
    data.class += ' multimer';
  }

  if ( defaults[ 'clonemarker' ] ) {
    data[ 'clonemarker' ] = true;
  }

  data.bbox[ 'w' ] = defaults[ 'width' ];
  data.bbox[ 'h' ] = defaults[ 'height' ];

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

  if (language == "AF" && !elementUtilities.canHaveMultipleUnitOfInformation(newNode)){
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
  if ( bgImage ) {
    newNode.data( 'background-image', bgImage );
  }

  return newNode;
};
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
elementUtilities.getCyShape = function (ele) {
  var _class = ele.data('class');
  // Get rid of rectangle postfix to have the actual node class
  if (_class.endsWith(' multimer')) {
      _class = _class.replace(' multimer', '');
  }

  if (_class == 'compartment') {
      return 'compartment';
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

elementUtilities.generateEdgeId = function() {
  return 'nwtE_' + elementUtilities.generateUUID();
};

elementUtilities.generateUUID = function () { // Public Domain/MIT
  var d = Date.now();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
      d += performance.now(); //use high-precision timer if available
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

module.exports = {
  elementUtilities
};