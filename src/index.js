const express = require('express');
const app = express();
const cytoscape = require('cytoscape');
const fs = require('fs');
const cors = require('cors');
const { adjustStylesheet } = require('./stylesheet');
const { jsonToSbgnml } = require('./json-to-sbgnml-converter');
const { sbgnmlToJson } = require('./sbgnml-to-json-converter');
const { elementUtilities } = require('./element-utilities');
const cytosnap = require('cytosnap');
cytosnap.use(['cytoscape-fcose'], { sbgnStylesheet: 'cytoscape-sbgn-stylesheet', layoutUtilities: 'cytoscape-layout-utilities', svg: 'cytoscape-svg' });
let currentSbgn;    

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

const $ = jQuery = require('jquery')(window);

function getLabel(node) {
  if ((node.data().class === "process" || node.data().class === "and" || node.data().class === "or" || node.data().class === "not") && node.connectedEdges().length > 0) {
    let labelString = node.data().class + " with input(s)/output(s) ";
    let labelStringInitial = labelString;
    let isFirst = true;
    node.connectedEdges().forEach(edge => {
      let connectedNode = edge.source().id() === node.id() ? edge.target() : edge.source();
      if (elementUtilities.isEPNClass(connectedNode.data().class)) {
        if (isFirst)
          labelString += connectedNode.data().label;
        else
          labelString += ", " + connectedNode.data().label;
        isFirst = false;
      }
    });
    if (labelString !== labelStringInitial) {
      return labelString;
    }
  }
  return node.data().label ? node.data().label : node.data().class;
}

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

function findCandidatesOrFix(errors, cy, isFix) {
  let currentErrors = errors;
  let check = 0;
  let numberOfUnsolvedErrors = 0;
  while (check < currentErrors.length) {
    previousErrorCode = currentErrors[check].pattern;
    previousErrorRole = currentErrors[check].role;
    if (currentErrors[check].status === "solved") {
      check++;
      continue;
    }
    currentErrors[check].selectedOption = "default";
    currentErrors[check].status = "unsolved";
    let errorFixParam = {};
    if (isFix === false) {
      currentErrors[check].fixCandidate = [];
    }
    errorFixParam.errorCode = currentErrors[check].pattern;
    let ele = cy.getElementById(currentErrors[check].role);
    if (currentErrors[check].pattern == "pd10112") {
      var compartments = cy.nodes('[class= "compartment"]');
      var listedNodes = [];
      for (var i = 0; i < compartments.length; i++) {
        if (compartments[i].parent().length == 0) {
          if (isFix === false) {
            currentErrors[check].fixCandidate.push({ label: getLabel(compartments[i]), id: compartments[i].data().id });
            currentErrors[check].selectedOption = 0;
          }
          else {
            listedNodes.push(compartments[i]);
          }
        }
      }
      if (isFix === false) {
        check++;
        continue;
      }
      if (listedNodes.length === 0) {
        numberOfUnsolvedErrors++;
      }
      else {
        ele.move({ "parent": listedNodes[0].data().id });
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Fixed by moving " + " inside " + getLabel(listedNodes[0]) + ".";
      }
    }
    else if (currentErrors[check].pattern == "pd10126") {
      let connectedEdges = ele.connectedEdges().filter('[class="logic arc"]');
      let selectedEdge = connectedEdges[check]; // 0 is default, it should be decided later.
      selectedEdge = findClosestNode(ele, connectedEdges);

      if (isFix === false) {
        currentErrors[check].fixCandidate = [];
        for (let i = 0; i < connectedEdges.length; i++) {
          currentErrors[check].fixCandidate.push({
            label: (getLabel(connectedEdges[i].source())
              + " - " + getLabel(connectedEdges[i].target())), id: connectedEdges[i].data().id
          });
          if (selectedEdge.data().id === connectedEdges[i].data().id) {
            currentErrors[check].selectedOption = i;
          }
        }
        let temp = currentErrors[check].fixCandidate[0];
        currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
        currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
        currentErrors[check].selectedOption = 0;
        check++;
        continue;
      }
      errorFixParam.edges = [];
      errorFixParam.nodes = [];
      selectedEdge = findClosestNode(ele, connectedEdges);
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (selectedEdge.id() != connectedEdges[i].id()) {
          errorFixParam.nodes.push(connectedEdges[i].source());
          errorFixParam.edges.push(connectedEdges[i]);
        }
      }
      if (connectedEdges.length !== 0) {
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Edge between this node and " + getLabel(selectedEdge.source()) + " is kept.";
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
      let selectedNode = closestNodeForEdges(ele.target(), listedNodes);
      if (isFix === false) {
        currentErrors[check].fixCandidate = [];
        for (let i = 0; i < listedNodes.length; i++) {
          currentErrors[check].fixCandidate.push({ label: getLabel(listedNodes[i]), id: listedNodes[i].data().id });
          if (listedNodes[i].data().id === selectedNode.data().id) {
            currentErrors[check].selectedOption = i;
          }
        }
        let temp = currentErrors[check].fixCandidate[0];
        currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
        currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
        currentErrors[check].selectedOption = 0;
        check++;
        continue;
      }
      if (listedNodes.length !== 0) {
        errorFixParam.newTarget = ele.target().id();
        errorFixParam.newSource = selectedNode.id();
        errorFixParam.edge = ele;
        errorFixParam.portsource = selectedNode.id();
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Arc is connected to " + getLabel(selectedNode) + ".";
        fixError(errorFixParam);
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (currentErrors[check].pattern == "pd10127") {
      let ele = cy.getElementById(currentErrors[check].role);
      let nodes = cy.nodes();
      let listedNodes = [];
      nodes.forEach(node => {
        if (elementUtilities.isEPNClass(node.data().class)) {
          listedNodes.push(node);
        }
      });
      let closestNode = closestNodeForEdges(ele.target(), listedNodes);
      currentErrors[check].fixCandidate = [];
      if (isFix === false) {
        for (let i = 0; i < listedNodes.length; i++) {
          currentErrors[check].fixCandidate.push({ label: getLabel(listedNodes[i]), id: listedNodes[i].data().id });
          if (closestNode.data().id == listedNodes[i].data().id) {
            currentErrors[check].selectedOption = i;
          }
        }
        let temp = currentErrors[check].fixCandidate[0];
        currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
        currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
        currentErrors[check].selectedOption = 0;
        check++;
        continue;
      }
      let newSource = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele.target(), listedNodes);
      errorFixParam.edge = ele;
      errorFixParam.newEdge = { source: newSource.id(), target: ele.target().id() };
      fixError(errorFixParam);
    }
    else if (currentErrors[check].pattern == "pd10128" || currentErrors[check].pattern == "pd10110") {
      let ele = cy.getElementById(currentErrors[check].role);
      let nodes = cy.nodes();
      let listedNodes = [];
      var sourcePosX = ele.source().position().x;
      var targetPosX = ele.target().position().x;
      var sourcePosY = ele.source().position().y;
      var targetPosY = ele.target().position().y;
      var minX = Math.min(sourcePosX, targetPosX) - 150;
      var maxX = Math.max(sourcePosX, targetPosX) + 150;
      var minY = Math.min(sourcePosY, targetPosY) - 150;
      var maxY = Math.max(sourcePosY, targetPosY) + 150;
      nodes.forEach(node => {
        if (node.position().x >= minX && node.position().x <= maxX && node.position().y >= minY && node.position().y <= maxY){
        if (currentErrors[check].pattern == "pd10128" && (node.data().class == "submap" || node.data().class == "terminal" || node.data().class == "tag")) {
          listedNodes.push(node);
        }
        if (currentErrors[check].pattern == "pd10110" && (elementUtilities.isPNClass(node.data().class))) {
          listedNodes.push(node);
        }
        }
      });
      let closestNode = closestNodeForEdges(ele.target(), listedNodes);
      currentErrors[check].fixCandidate = [];
      if (isFix === false) {
        for (let i = 0; i < listedNodes.length; i++) {
          currentErrors[check].fixCandidate.push({ label: getLabel(listedNodes[i]), id: listedNodes[i].data().id });
          if (closestNode.data().id == listedNodes[i].data().id) {
            currentErrors[check].selectedOption = i;
          }
        }
        let temp = currentErrors[check].fixCandidate[0];
        currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
        currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
        currentErrors[check].selectedOption = 0;
        check++;
        continue;
      }
      let newTarget = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele.target(), listedNodes);
      errorFixParam.edge = ele;
      errorFixParam.newEdge = { source: ele.source().id(), target: newTarget.id() };
      fixError(errorFixParam);
    }
    else if (currentErrors[check].pattern == "pd10141") {
      let ele = cy.getElementById(currentErrors[check].role);
      errorFixParam.newEdges = [];
      if (ele.incomers().length === 0) {
        let nodes = cy.nodes();
        let listedNodes = [];
        for (let i = 0; i < nodes.length; i++) {
          if (elementUtilities.isEPNClass(nodes[i].data().class)) {
            listedNodes.push(nodes[i]);
          }
        }
        let selectedNode = closestNodeForEdges(ele, listedNodes);
        currentErrors[check].fixCandidate = [];
        for (let i = 0; i < listedNodes.length; i++) {
          if (listedNodes[i].data().id != ele.id()) {
            currentErrors[check].fixCandidate.push({ label: getLabel(listedNodes[i]), id: listedNodes[i].data().id });
          }
          if (selectedNode.id() === nodes[i].data().id) {
            currentErrors[check].selectedOption = i;
          }
        }
        let temp = currentErrors[check].fixCandidate[0];
        currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
        currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
        currentErrors[check].selectedOption = 0;
        check++;
        continue;
      }
      else {
        let nodes = cy.nodes();
        let listedNodes = [];
        for (let i = 0; i < nodes.length; i++) {
          if (elementUtilities.isEPNClass(nodes[i].data().class)) {
            listedNodes.push(nodes[i]);
          }
        }
        let selectedNode = closestNodeForEdges(ele, listedNodes);
        nodes = listedNodes;
        if (isFix === false) {
          currentErrors[check].fixCandidate = [];
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].data().id != ele.id() && elementUtilities.isEPNClass(nodes[i].data().class)) {
              currentErrors[check].fixCandidate.push({ label: getLabel(nodes[i]), id: nodes[i].data().id });
              if (selectedNode.id() === nodes[i].data().id) {
                currentErrors[check].selectedOption = i;
              }
            }
          }
          let temp = currentErrors[check].fixCandidate[0];
          currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
          currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
          currentErrors[check].selectedOption = 0;
          check++;
          continue;
        }
        errorFixParam.newEdges.push({ source: selectedNode.id(), target: ele.id() });
        fixError(errorFixParam);
      }
    }
    else if (currentErrors[check].pattern == "pd10103" || currentErrors[check].pattern == "pd10107") {
      if (isFix === false) {
        check++;
        continue;
      }
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
      if (isFix === false) {
        check++;
        continue;
      }
      if (elementUtilities.isEPNClass(targetTmp)) {
        errorFixParam.edge = ele;
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Source and target of consumption arc have been swapped.";
      }
      else {
        numberOfUnsolvedErrors++;
      }
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

      if (isFix === false) {
        currentErrors[check].fixCandidate = [];
        let selectedNode = closestNodeForEdges(ele.source(), listedNodes);
        for (let i = 0; i < listedNodes.length; i++) {
          currentErrors[check].fixCandidate.push({ label: getLabel(listedNodes[i]), id: listedNodes[i].data().id });
          if (selectedNode.id() === listedNodes[i].id()) {
            currentErrors[check].selectedOption = i;
          }
        }
        let temp = currentErrors[check].fixCandidate[0];
        currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
        currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
        currentErrors[check].selectedOption = 0;
        check++;
        continue;
      }
      if (listedNodes.length > 0) {
        let selectedNode = closestNodeForEdges(ele.source(), listedNodes);
        var source = ele.source();
        var target = selectedNode;
        errorFixParam.edge = ele;
        errorFixParam.newEdge = { source: source.id(), target: target.id(), edgeParams: edgeParams };
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc has a target reference to " + getLabel(target) + ".";
      }
    }

    else if (currentErrors[check].pattern == "pd10111") {
      let ele = cy.getElementById(currentErrors[check].role);
      errorFixParam.edges = [];
      let connectedEdges = cy.edges('[source =  "' + ele.id() + '"]');
      if (isFix === false) {
        currentErrors[check].fixCandidate = [];
        let selectedEdge = findClosestNode(ele, connectedEdges); // default , the selection of edge will be determined later.
        for (let i = 0; i < connectedEdges.length; i++) {
          currentErrors[check].fixCandidate.push({
            label: (getLabel(connectedEdges[i].source())
              + " - " + getLabel(connectedEdges[i].target())), id: connectedEdges[i].data().id
          });
          if (connectedEdges[i].id() == selectedEdge.id()) {
            currentErrors[check].selectedOption = i;
          }
        }
        check++;
        continue;
      }
      if (connectedEdges.length !== 0) {
        let selectedEdge = findClosestNode(ele, connectedEdges); // default , the selection of edge will be determined later.
        for (let i = 0; i < connectedEdges.size(); i++) {
          if (connectedEdges[i].id() != selectedEdge.id()) {
            errorFixParam.edges.push(connectedEdges[i]);
          }
        }
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Arc between this node and " + getLabel(selectedEdge.target()) + " is kept.";
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (currentErrors[check].pattern == "pd10104") {
      var connectedEdges = ele.connectedEdges().filter('[class="consumption"]');
      if (isFix === false) {
        currentErrors[check].fixCandidate = [];
        let selectedEdge = findClosestNode(ele, connectedEdges); // default selection, it will be determined. closest one will be kept. 
        for (let i = 0; i < connectedEdges.length; i++) {
          currentErrors[check].fixCandidate.push({
            label: (getLabel(connectedEdges[i].source())
              + " - " + getLabel(connectedEdges[i].target())), id: connectedEdges[i].data().id
          });
          if (connectedEdges[i].id() == selectedEdge.id()) {
            currentErrors[check].selectedOption = i;
          }
        }
        let temp = currentErrors[check].fixCandidate[0];
        currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
        currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
        currentErrors[check].selectedOption = 0;
        check++;
        continue;
      }
      errorFixParam.nodes = [];
      errorFixParam.edges = [];
      let selectedEdge = findClosestNode(ele, connectedEdges); 
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (connectedEdges[i].id() != selectedEdge.id()) {
          errorFixParam.nodes.push(connectedEdges[i].source().id() == ele.id() ? connectedEdges[i].target() : connectedEdges[i].source());
          errorFixParam.edges.push(connectedEdges[i]);
        }
      }
      fixError(errorFixParam);
      fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc between dissocation glyph and consumption glyph(" + (selectedEdge.source().id() === ele.id() ?
        getLabel(selectedEdge.target()) : getLabel(selectedEdge.source())) + ") is kept.";
    }
    else if (currentErrors[check].pattern == "pd10108") {
      let connectedEdges = ele.connectedEdges().filter('[class = "production"]');
      if (isFix === false) {
        currentErrors[check].fixCandidate = [];
        let selectedEdge = findClosestNode(ele, connectedEdges);  
        for (let i = 0; i < connectedEdges.length; i++) {
          currentErrors[check].fixCandidate.push({
            label: (getLabel(connectedEdges[i].source())
              + " - " + getLabel(connectedEdges[i].target())), id: connectedEdges[i].data().id
          });
          if (connectedEdges[i].id() == selectedEdge.id()) {
            currentErrors[check].selectedOption = i;
          }
        }
        if (connectedEdges.length > 0) {
          let temp = currentErrors[check].fixCandidate[0];
          currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
          currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
          currentErrors[check].selectedOption = 0;
        }
        check++;
        continue;
      }
      let selectedEdge = findClosestNode(ele, connectedEdges);
      errorFixParam.edges = [];
      errorFixParam.nodes = [];
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (connectedEdges[i].id() != selectedEdge.id()) {
          errorFixParam.edges.push(connectedEdges[i]);
          errorFixParam.nodes.push(connectedEdges[i].source().id() == ele.id() ? connectedEdges[i].target() : connectedEdges[i].source());
        }
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc between assocation glyph and production glyph(" + (selectedEdge.source().id() === ele.id() ?
          getLabel(selectedEdge.target()) : getLabel(selectedEdge.source())) + ") is kept.";
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
            if (elementUtilities.isEPNClass(nodes[i].data().class)) {
              listedNodes.unshift(nodes[i]);
            }
            else if (elementUtilities.isLogicalOperator(nodes[i].data().class)) {
              listedNodes.push(nodes[i]);
            }
          }
      }
      let selectedNode = closestNodeForEdges(ele.target(), listedNodes);
      if (isFix === false) {
        currentErrors[check].fixCandidate = [];
        for (let i = 0; i < listedNodes.length; i++) {
          currentErrors[check].fixCandidate.push({ label: getLabel(listedNodes[i]), id: listedNodes[i].data().id });
          if (listedNodes[i].id() == selectedNode.id()) {
            currentErrors[check].selectedOption = i;
          }
        }
        let temp = currentErrors[check].fixCandidate[0];
        currentErrors[check].fixCandidate[0] = currentErrors[check].fixCandidate[currentErrors[check].selectedOption];
        currentErrors[check].fixCandidate[currentErrors[check].selectedOption] = temp;
        currentErrors[check].selectedOption = 0;
        check++;
        continue;
      }
      if (listedNodes.length > 0) {
        errorFixParam.newTarget = ele.target().id();
        errorFixParam.newSource = selectedNode.id();
        errorFixParam.edge = ele;
        errorFixParam.portsource = selectedNode.id();
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Modulation arc has a source reference to " + getLabel(selectedNode) + ".";
      }
    }
    else if (currentErrors[check].pattern == "pd10105" || currentErrors[check].pattern == "pd10106") {
      let sourceNode = ele.source();
      let targetNode = ele.target();
      if (isFix === false) {
        check++;
        continue;
      }
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
    if (isFix === false) {
      check++;
      continue;
    }
    let currentErrorRole = currentErrors[check].role;
    let currentErrorPattern = currentErrors[check].pattern;
    let isSolved = true;
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
        if (currentErrorPattern === error.pattern && currentErrorRole === error.role) {
          isSolved = false;
        }
        currentErrors.push(error);
      }
    }
    currentErrors = reduceErrors(currentErrors, cy);
    if (!isSolved) {
      check++;
      unsolvedErrorInformation[previousErrorCode + previousErrorRole] = true;
    }
  }
  if (isFix === false) {
    return currentErrors;
  }
}

function reduceErrors(errors, cy) {
  let reducedErrors = [];
  let errorInfo = {};
  for (let i = 0; i < errors.length; i++) {
    if (errors[i].pattern != "pd10125" && errors[i].pattern != "pd10142" &&
      errors[i].pattern != "pd10109" && errors[i].pattern != "pd10124"
      && errors[i].pattern != "pd10111" && errors[i].pattern != "pd10126" && errors[i].pattern != "pd10141") {
      reducedErrors.push(errors[i]);
      continue;
    }
    var ele = cy.getElementById(errors[i].role);
    if ((errors[i].pattern == "pd10125" || errors[i].pattern == "pd10142") && (ele.target().data().class == "and" || ele.target().data().class == "or" || ele.target().data().class == "not")) {
      continue;
    }
    else if ((errors[i].pattern == "pd10124" || errors[i].pattern == "pd10109") && (ele.source().data().class == "and" || ele.source().data().class == "or" || ele.source().data().class == "not")) {
      continue;
    }
    else if ((errors[i].pattern == "pd10111")) {
      var connectedEdges = cy.edges('[source =  "' + ele.id() + '"]');
      if (connectedEdges.length == 1) {
        continue;
      }
    }
    else if (errors[i].pattern == "pd10141") {
      if (ele.incomers().length > 0 && ele.outgoers().length > 0) {
        continue;
      }
    }
    else {
      let connectedEdges = ele.connectedEdges().filter('[class="logic arc"]');
      if (connectedEdges.length == 1) {
        continue;
      }
    }
    errorInfo[errors[i].pattern + errors[i].role] = true;
    reducedErrors.push(errors[i]);
  }
  let logicalOperators = cy.nodes();
  logicalOperators.forEach(node => {
    if (node.data().class === "and") {
      var edges = node.incomers();
      var edgess = node.outgoers();
      let error = new Issue();
      error.setText("'and', 'or', and 'not' glyphs must be the source for exactly one arc");
      error.setPattern("pd10111");
      error.setRole(node.data().id);
      if (edgess.length > 2 && errorInfo["pd10111" + node.data().id] !== true)
        reducedErrors.push(error);
    }
    else if (node.data().class === "or") {
      var edges = node.incomers();
      var edgess = node.outgoers();
      let error = new Issue();
      error.setText("'and', 'or', and 'not' glyphs must be the source for exactly one arc");
      error.setPattern("pd10111");
      error.setRole(node.data().id);
      if (edgess.length > 2 && errorInfo["pd10111" + node.data().id] !== true)
        reducedErrors.push(error);
    }
    else if (node.data().class === "not") {
      var edges = node.incomers();
      if (edges.size() > 2 && errorInfo["pd10126" + node.data().id] !== true) {
        let error = new Issue();
        error.setText("The 'not' glyph can only be the target of one logic arc glyph");
        error.setPattern("pd10126");
        error.setRole(node.data().id);
        reducedErrors.push(error);
      }
      var edgess = node.outgoers();
      if (edgess.size() > 2 && errorInfo["pd10111" + node.data().id] !== true) {
        let error = new Issue();
        error.setText("'and', 'or', and 'not' glyphs must be the source for exactly one arc");
        error.setPattern("pd10111");
        error.setRole(node.data().id);
        reducedErrors.push(error);
      }
    }
  })
  return reducedErrors;
}

// for fcose
const fcose = require('cytoscape-fcose');
cytoscape.use(fcose);

let cy;
let data;
let image;

function distanceBetween(a, b) {
  let xDiff;
  let yDiff;
  try {
    xDiff = a.position().x - b.position().x;
    yDiff = a.position().y - b.position().y;
  }
  catch {
    throw Error;
  }
  return xDiff * xDiff + yDiff * yDiff;
}

function findClosestNode(ele, connectedEdges) {
  let shortestDistance = 10000000000.0;
  let closestEdge;
  for (let i = 0; i < connectedEdges.length; i++) {
    let distance = (ele.data().id == connectedEdges.source().id ? distanceBetween(ele, connectedEdges[i].target()) :
      distanceBetween(ele, connectedEdges[i].source()));
    if (distance < shortestDistance) {
      shortestDistance = distance;
      closestEdge = connectedEdges[i];
    }
  }
  return closestEdge;
}
function closestNodeForEdges(ele, nodes) {
  let shortestDistance = 10000000000.0;
  let closestNode;
  for (let i = 0; i < nodes.length; i++) {
    try {
      distance = distanceBetween(ele, nodes[i]);
    }
    catch {
    }
    if (distance < shortestDistance) {
      shortestDistance = distance;
      closestNode = nodes[i];
    }
  }
  return closestNode;
}

app.use(express.static(path.join(__dirname, "../public/")));
app.use(cors());

// middleware to manage the formats of files
app.use(async (req, res, next) => {
  if (req.method === "POST") {
    let showResolutionAlternatives = req.query.showResolutionAlternatives;
    let body = '';
    let isJson = false;
    let options = '';
    let data = '';
    let errorMessage = undefined;
    let errors = [];

    req.on('data', chunk => {
      body += chunk;
    })

    req.on('end', () => {
      let indexOfOptions = Math.min(body.includes("layoutOptions") ? body.indexOf("layoutOptions") : Number.MAX_SAFE_INTEGER,
        body.includes("imageOptions") ? body.indexOf("imageOptions") : Number.MAX_SAFE_INTEGER,
        body.includes("queryOptions") ? body.indexOf("queryOptions") : Number.MAX_SAFE_INTEGER);
      let indexOfOptionsStart;
      let indexOfErrorsStart = body.includes("</sbgn>[") ? (body.lastIndexOf("</sbgn>[") + 7) : Number.MAX_SAFE_INTEGER;
      if (indexOfOptions != Number.MAX_SAFE_INTEGER) {
        indexOfOptionsStart = body.substring(0, indexOfOptions).lastIndexOf("{");
        options = body.substring(indexOfOptionsStart);
        data = body.substring(0, indexOfOptionsStart);
      }
      else {
        indexOfOptionsStart = Number.MAX_SAFE_INTEGER;
        data = body;
        options = "";
      }
      if (indexOfErrorsStart === Number.MAX_SAFE_INTEGER) {
        errors = "";
      }
      else {
        errors = indexOfOptionsStart !== Number.MAX_SAFE_INTEGER ? body.substring(indexOfErrorsStart, (indexOfOptionsStart))
          : body.substring(indexOfErrorsStart);
        data = body.substring(0, indexOfErrorsStart);
      }
      data = data.replace(/\n/g, "");

      try {
        if (errors !== "")
          errors = JSON.parse(errors);
        else {
          errors = [];
        }
        options = JSON.parse(options);
      }
      catch (e) {
        let date = new Date();
        errorMessage = "<b>Sorry! Cannot process the given file!</b><br><br>There is something wrong with the format of the options!<br><br>Error detail: <br>" + e;
        errorMessage = "Invalid map or unsupported content!";
      }
      if(errorMessage) {
        return res.status(500).send({
        errorMessage: errorMessage
        });
      }
      // convert sbgn data to json for cytoscape
      var parser = new window.DOMParser;
      var xml = parser.parseFromString(data, 'text/xml');
      data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
      let isErrorsEmpty = errors.length == 0;

      currentSbgn = data;
      let preValidationData = {};
      if (errors.length === 0) {
        let result ;
        try {
        fs.writeFileSync('./src/sbgnFile.sbgn', currentSbgn);
        result = SaxonJS.transform({
          stylesheetFileName: './src/templatelibsbgn.sef.json',
          sourceFileName: "./src/sbgnFile.sbgn",
          destination: "serialized"
        }).principalResult;
        fs.unlinkSync('./src/sbgnFile.sbgn');
        }
        catch {
          errorMessage = "Invalid map or unsupported content!";
        }
        if(errorMessage) {
          return res.status(500).send({
            errorMessage: errorMessage
          });
        }
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
            if ((error.pattern == "00001" || error.pattern == "00002") && preValidationData[error.pattern + error.role] === undefined) {
              preValidationData[error.pattern + error.role] = 1;
              errors.push(error);
            }
          }
        }
      }
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
      cy.nodes().forEach( node => {
        if( node.data().class === "submap" ){
          errorMessage = "Invalid map or unsupported content!";
        }
      });
       if(errorMessage) {
      return res.status(500).send({
        errorMessage: errorMessage
      });
    }
      postProcessForLayouts(cy);
      data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('renderInformation') : undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('mapProperties') : undefined, cy.nodes(), cy.edges(), cy);
      data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
      currentSbgn = data;
      fs.writeFileSync('./src/sbgnFile.sbgn', currentSbgn);
      if (isErrorsEmpty) {
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
        errors = reduceErrors(errors, cy);
      }
      data = cyJsonData;
      let unsolvedErrorInformation = {};
      errors.forEach(error => {
        unsolvedErrorInformation[error.pattern + error.role] = true;
      })
      res.locals.body = body;
      res.locals.unsolvedErrorInformation = unsolvedErrorInformation;
      res.locals.fixExplanation = {};
      res.locals.isJson = isJson;
      res.locals.options = options;
      res.locals.data = data;
      res.locals.errorMessage = errorMessage;
      res.locals.currentSbgn = currentSbgn;
      res.locals.cy = cy;
      res.locals.errors = errors;
      res.locals.showResolutionAlternatives = showResolutionAlternatives;
      res.locals.imageOptions = {
        format: 'png',
        background: 'transparent',
        width: 1280,
        height: 720,
        color: 'greyscale',
        highlightColor: '#ff0000',
        highlightWidth: 10,
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
  let options = res.locals.options;
  let data = res.locals.data;
  let currentSbgn = res.locals.currentSbgn;
  let cy = res.locals.cy;
  let imageOptions = res.locals.imageOptions;
  let errors = res.locals.errors;
  let unsolvedErrorInformation = res.locals.unsolvedErrorInformation;
  let fixExplanation = res.locals.fixExplanation;
  let showResolutionAlternatives = res.locals.showResolutionAlternatives;
  fixExplanation = {};
  if (req.query.errorFixing !== undefined && req.query.errorFixing === true) {
    return next();
  }
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
    data = jsonToSbgnml.createSbgnml(undefined, undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('renderInformation') : undefined, sbgnmlToJson.map.extension !== null ? sbgnmlToJson.map.extension.get('mapProperties') : undefined, cy.nodes(), cy.edges(), cy);
    data = data.replace('libsbgn/0.3', 'libsbgn/0.2');
    currentSbgn = data;
    highlightErrors(errors, cy, imageOptions, true, unsolvedErrorInformation, fixExplanation);
    if (showResolutionAlternatives === "true") {
      errors = findCandidatesOrFix(errors, cy, false);
    }
    else {
      errors.forEach(error => {
        error.selectedOption = "default";
      })
    }
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
          ret["image"] = result.image;
          ret['errors'] = errors;
          ret['sbgn'] = currentSbgn;
          fs.writeFileSync('./src/sbgnFile.sbgn', data);
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
  let fixExplanation = res.locals.fixExplanation;
  let size = 30;
  let previousErrorCode = "";
  let previousErrorRole = "";
  let options = res.locals.options;
  let data = res.locals.data;
  let currentSbgn = res.locals.currentSbgn;
  let cy = res.locals.cy;
  let imageOptions = res.locals.imageOptions;
  let errors = res.locals.errors;
  let unsolvedErrorInformation = res.locals.unsolvedErrorInformation;
  let showResolutionAlternatives = res.locals.showResolutionAlternatives;
  let fixData = {};
  for (let i = 0; i < errors.length; i++) {
    if (errors[i].selectedOption !== undefined && parseInt(errors[i].selectedOption) !== -1 && errors[i].selectedOption !== "default") {
      fixData[errors[i].pattern + errors[i].role] = errors[i].fixCandidate[errors[i].selectedOption].id;
    }
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
  cy.nodes().forEach((node) => {
    node.css("width", node.data().bbox.w || size);
    node.css("height", node.data().bbox.h || size);
  });

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
  let errorsAfterFix = [];
  let errorStillAvailable = {};
  for (let i = 0; i < currentErrors.length; i++) {
    errorStillAvailable[currentErrors[i].pattern + currentErrors[i].role] = true;
  }
  while (check < currentErrors.length) {
    if (currentErrors[check].selectedOption === undefined || parseInt(currentErrors[check].selectedOption) === - 1) {
      check++;
      continue;
    }
    if (errorStillAvailable[currentErrors[check].pattern + currentErrors[check].role] === undefined) {
      check++;
      continue;
    }
    previousErrorCode = currentErrors[check].pattern;
    previousErrorRole = currentErrors[check].role;
    currentErrors[check].status = "unsolved";
    let errorFixParam = {};
    errorFixParam.errorCode = currentErrors[check].pattern;
    let ele = cy.getElementById(currentErrors[check].role);
    if (currentErrors[check].pattern == "pd10112") {
      var compartments = cy.nodes('[class= "compartment"]');
      var listedNodes = [];
      if (fixData[previousErrorCode + previousErrorRole] !== undefined) {
        let node = cy.getElementById(fixData[previousErrorCode + previousErrorRole]);
        ele.move({ "parent": node.data().id });
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Fixed by moving " + " inside " + getLabel(node) + ".";
      }
      else {
        for (var i = 0; i < compartments.length; i++) {
          if (compartments[i].parent().length == 0)
            listedNodes.push(compartments[i]);
        }
        if (listedNodes.length === 0) {
          numberOfUnsolvedErrors++;
        }
        else {
          ele.move({ "parent": listedNodes[0].data().id });
          fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Fixed by moving inside " + getLabel(listedNodes[0]) + ".";
        }
      }
    }
    else if (currentErrors[check].pattern == "pd10126") {
      let connectedEdges = ele.connectedEdges().filter('[class="logic arc"]');
      errorFixParam.edges = [];
      errorFixParam.nodes = [];
      let selectedEdge = connectedEdges[check];
      selectedEdge = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) :
        findClosestNode(ele, connectedEdges);
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (selectedEdge.id() != connectedEdges[i].id()) {
          errorFixParam.nodes.push(connectedEdges[i].source());
          errorFixParam.edges.push(connectedEdges[i]);
        }
      }
      if (connectedEdges.length !== 0) {
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Edge between this node and " + getLabel(selectedEdge.source()) + " is kept.";
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
        let selectedNode = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele.target(), listedNodes);
        errorFixParam.newTarget = ele.target().id();
        errorFixParam.newSource = selectedNode.id();
        errorFixParam.edge = ele;
        errorFixParam.portsource = selectedNode.id();
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Arc is connected to " + getLabel(selectedNode) + ".";
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
        var x = edges[i].source().data().bbox.x; 
        var y = edges[i].source().data().bbox.y;
        if (edges[i].data().class != 'consumption') {
          x = edges[i].target().data().bbox.x;
          y = edges[i].target().data().bbox.y;
        }

        var xdiff = Math.abs(edges[i].target().data().bbox.x - edges[i].source().data().bbox.x);
        var ydiff = Math.abs(edges[i].target().data().bbox.y - edges[i].source().data().bbox.y);
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
      }
      else {
        numberOfUnsolvedErrors++;
      }
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
      if (listedNodes.length > 0) {
        let selectedNode = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele.source(), listedNodes);
        var source = ele.source();
        var target = selectedNode;
        errorFixParam.edge = ele;
        errorFixParam.newEdge = { source: source.id(), target: target.id(), edgeParams: edgeParams };
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc has a target reference to " + getLabel(target) + ".";
      }
    }
    else if (currentErrors[check].pattern == "pd10111") {
      let ele = cy.getElementById(currentErrors[check].role);
      errorFixParam.edges = [];
      let connectedEdges = cy.edges('[source =  "' + ele.id() + '"]');
      if (connectedEdges.length !== 0) {
        let selectedEdge = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : findClosestNode(ele, connectedEdges); 
        for (let i = 0; i < connectedEdges.size(); i++) {
          if (connectedEdges[i].id() != selectedEdge.id()) {
            errorFixParam.edges.push(connectedEdges[i]);
          }
        }
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Arc between this node and " + getLabel(selectedEdge.target()) + " is kept.";
      }
      else
        numberOfUnsolvedErrors++;
    }
    else if (currentErrors[check].pattern == "pd10104") {
      var connectedEdges = ele.connectedEdges().filter('[class="consumption"]');
      errorFixParam.nodes = [];
      errorFixParam.edges = [];
      selectedEdge = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : findClosestNode(ele, connectedEdges); 
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (connectedEdges[i].id() != selectedEdge.id()) {
          errorFixParam.nodes.push(connectedEdges[i].source().id() == ele.id() ? connectedEdges[i].target() : connectedEdges[i].source());
          errorFixParam.edges.push(connectedEdges[i]);
        }
      }
      fixError(errorFixParam);
      fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc between dissocation glyph and consumption glyph(" + (selectedEdge.source().id() === ele.id() ?
        getLabel(selectedEdge.target().id()) : getLabel(selectedEdge.source())) + ") is kept.";
    }
    else if (currentErrors[check].pattern == "pd10127") {
      let ele = cy.getElementById(currentErrors[check].role);
      let nodes = cy.nodes();
      let listedNodes = [];
      nodes.forEach(node => {
        if (elementUtilities.isEPNClass(node.data().class)) {
          listedNodes.push(node);
        }
      });
      if (listedNodes.length > 0) {
        let newSource = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele.target(), listedNodes);
        errorFixParam.edge = ele;
        errorFixParam.newEdge = { source: newSource.id(), target: ele.target().id() };
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Equivalence arc has a source reference to " + getLabel(newSource);
      }
    }
    else if (currentErrors[check].pattern == "pd10128" || currentErrors[check].pattern == "pd10110") {
      let ele = cy.getElementById(currentErrors[check].role);
      let nodes = cy.nodes();
      let listedNodes = [];
      var sourcePosX = ele.source().position().x;
      var targetPosX = ele.target().position().x;
      var sourcePosY = ele.source().position().y;
      var targetPosY = ele.target().position().y;
       var minX = Math.min(sourcePosX, targetPosX) - 150;
       var maxX = Math.max(sourcePosX, targetPosX) + 150;
       var minY = Math.min(sourcePosY, targetPosY) - 150;
       var maxY = Math.max(sourcePosY, targetPosY) + 150;
      nodes.forEach(node => {
        if (node.position().x >= minX && node.position().x <= maxX && node.position().y >= minY && node.position().y <= maxY){
        if (currentErrors[check].pattern == "pd10128" && (node.data().class == "submap" || node.data().class == "terminal" || node.data().class == "tag")) {
          listedNodes.push(node);
        }
        if (currentErrors[check].pattern == "pd10110" && (elementUtilities.isPNClass(node.data().class))) {
          listedNodes.push(node);
        }
        }
      });
      if (listedNodes.length > 0) {
        let newTarget = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele.source(), listedNodes);
        errorFixParam.edge = ele;
        errorFixParam.newEdge = { source: ele.source().id(), target: newTarget.id() };
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = (currentErrors[check].pattern == "pd10128" ? "Equivalence" : "Modulation") +
          " arc has a target reference to " + getLabel(newTarget);
      }
    }
    else if (currentErrors[check].pattern == "pd10108") {
      let connectedEdges = ele.connectedEdges().filter('[class = "production"]');
      let selectedEdge = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : findClosestNode(ele, connectedEdges);
      errorFixParam.edges = [];
      errorFixParam.nodes = [];
      for (let i = 0; i < connectedEdges.size(); i++) {
        if (connectedEdges[i].id() != selectedEdge.id()) {
          errorFixParam.edges.push(connectedEdges[i]);
          errorFixParam.nodes.push(connectedEdges[i].source().id() == ele.id() ? connectedEdges[i].target() : connectedEdges[i].source());
        }
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "The arc between assocation glyph and production glyph(" + (selectedEdge.source().id() === ele.id() ?
          getLabel(selectedEdge.target()) : getLabel(selectedEdge.source())) + ") is kept.";
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
      if (listedNodes.length > 0) {
        let selectedNode = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele.target(), listedNodes);
        errorFixParam.newTarget = ele.target().id();
        errorFixParam.newSource = selectedNode.id();
        errorFixParam.edge = ele;
        errorFixParam.portsource = selectedNode.id();
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Modulation arc has a source reference to " + getLabel(selectedNode) + ".";
      }

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
    else if (currentErrors[check].pattern == "pd10141") {
      let ele = cy.getElementById(currentErrors[check].role);
      errorFixParam.newEdges = [];
      if (ele.incomers().length === 0) {
        let nodes = cy.nodes();
        let listedNodes = [];
        nodes.forEach(node => {
          if (elementUtilities.isEPNClass(node.data().class)) {
            listedNodes.push(node);
          }
        });
        let selectedNode = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele, listedNodes);
        errorFixParam.newEdges.push({ source: selectedNode.id(), target: ele.id(), edgeClass: "consumption" });
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Process node has input from " + getLabel(selectedNode) + ".";
        fixError(errorFixParam);
      }
      else {
        let nodes = cy.nodes();
        let listedNodes = [];
        nodes.forEach(node => {
          if (elementUtilities.isEPNClass(node.data().class)) {
            listedNodes.push(node);
          }
        });
        let selectedNode = fixData[previousErrorCode + previousErrorRole] !== undefined ? cy.getElementById(fixData[previousErrorCode + previousErrorRole]) : closestNodeForEdges(ele, listedNodes);
        errorFixParam.newEdges.push({ source: ele.id(), target: selectedNode.id(), edgeClass: "production" });
        fixError(errorFixParam);
        fixExplanation[currentErrors[check].pattern + currentErrors[check].role] = "Process node has output to " + getLabel(selectedNode) + ".";
      }
    }
    else {
      numberOfUnsolvedErrors++;
    }
    let currentErrorRole = currentErrors[check].role;
    let currentErrorPattern = currentErrors[check].pattern;
    let isSolved = true;
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
    errorsAfterFix = [];
    errorStillAvailable = {};
    if (parsedResult["svrl:schematron-output"]["svrl:failed-assert"] == undefined) {
    }
    else {
      let errCount = parsedResult["svrl:schematron-output"]["svrl:failed-assert"].length;
      for (let i = 0; i < errCount; i++) {
        let error = new Issue();
        error.setText(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:text"]);
        error.setPattern(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["$"]["id"]);
        error.setRole(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:diagnostic-reference"][0]["_"]);
        errorsAfterFix.push(error);
      }
    }
    errorsAfterFix = reduceErrors(errorsAfterFix, cy);
    for (let i = 0; i < errorsAfterFix.length; i++) {
      errorStillAvailable[errorsAfterFix[i].pattern + errorsAfterFix[i].role] = true;
      if (currentErrorPattern === errorsAfterFix[i].pattern && currentErrorRole === errorsAfterFix[i].role) {
        isSolved = false;
      }
    }
    if (!isSolved) {
      unsolvedErrorInformation[previousErrorCode + previousErrorRole] = true;
    }
    else {
      currentErrors[check].status = "solved";
    }
    check++;
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
  errorsAfterFix = [];
  if (parsedResult["svrl:schematron-output"]["svrl:failed-assert"] == undefined) {
  }
  else {
    errorsAfterFix = [];
    let errCount = parsedResult["svrl:schematron-output"]["svrl:failed-assert"].length;
    for (let i = 0; i < errCount; i++) {
      let error = new Issue();
      error.setText(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:text"]);
      error.setPattern(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["$"]["id"]);
      error.setRole(parsedResult["svrl:schematron-output"]["svrl:failed-assert"][i]["svrl:diagnostic-reference"][0]["_"]);
      errorsAfterFix.push(error);
    }
  }
  errorsAfterFix = reduceErrors(errorsAfterFix, cy);
  let indexesOfErrors = {};
  for (let i = 0; i < currentErrors.length; i++) {
    indexesOfErrors[currentErrors[i].pattern + currentErrors[i].role] = i;
  }
  let counter = 1;
  unsolvedErrorInformation = {};
  for (let i = 0; i < errorsAfterFix.length; i++) {
    unsolvedErrorInformation[errorsAfterFix[i].pattern + errorsAfterFix[i].role] = true;
    if (indexesOfErrors[errorsAfterFix[i].pattern + errorsAfterFix[i].role] === undefined) {
      errorsAfterFix[i].errorNo = currentErrors.length + 1;
      currentErrors.push(errorsAfterFix[i]);
    }
  }
  errors = currentErrors;
  if (showResolutionAlternatives) {
    errors = findCandidatesOrFix(errors, cy, false);
  }
  else {
    errors.forEach(error => {
      error.selectedOption = "default";
    })
  }
  highlightErrors(errors, cy, imageOptions, false, unsolvedErrorInformation, fixExplanation);
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
      var newwEdge = elementUtilities.addEdge(newEdge.source, newEdge.target, newEdge.class, cy);
    });
    errorFixParam.oldEdges.forEach(function (oldEdge) {
      cy.elements().unselect();
      oldEdge.remove();
    });
    errorFixParam.node.remove();
  }
  if (errorCode == "pd10141") {
    errorFixParam.newEdges.forEach(function (newEdge) {
      var newwEdge = elementUtilities.addEdge(newEdge.source, newEdge.target, newEdge.edgeClass, cy);
    });
  }
  if (errorCode == "pd10105" || errorCode == "pd10106") {
    elementUtilities.reverseEdge(errorFixParam.edge);
  }
  if (errorCode == "pd10108" || errorCode == "pd10104") {
    for (let i = 0; i < errorFixParam.edges.length; i++) {
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
  if (errorCode == "pd10127") {
    var clonedEdge = errorFixParam.edge.clone();
    var edgeParams = { class: clonedEdge.data().class, language: clonedEdge.data().language };
    cy.remove(errorFixParam.edge);
    elementUtilities.addEdge(errorFixParam.newEdge.source, errorFixParam.newEdge.target, edgeParams, cy, clonedEdge.data().id);
  }
  if (errorCode == "pd10128" || errorCode == "pd10110") {
    var clonedEdge = errorFixParam.edge.clone();
    var edgeParams = { class: clonedEdge.data().class, language: clonedEdge.data().language };
    cy.remove(errorFixParam.edge);
    elementUtilities.addEdge(errorFixParam.newEdge.source, errorFixParam.newEdge.target, edgeParams, cy, clonedEdge.data().id);
  }
  if (errorCode == "pd10125") {
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
  }
  if (errorCode == "pd10111") {
    errorFixParam.edges.forEach(function (edge) {
      edge.remove();
    });
  }
};

function highlightErrors(errors, cy, imageOptions, isValidation, unsolvedErrorInformation, fixExplanation) {
  let errorColor = {};
  let counter = 0;
  cy.nodes().forEach((node) => { node.removeData('highlightColor'); node.removeClass('highlight');/*node.removeData('label');*/ }
  );
  cy.edges().forEach((edge) => { edge.removeData('highlightColor'); edge.removeClass('path');/*edge.removeData('label');*/ });
  errors.forEach((errorData, i) => {
    let ele = cy.getElementById(errorData.role);
    if (ele.isNode()) {
      errorData.label = ele.data('label') ? ele.data('label') : ele.data().class;
    }
    else if (ele.isEdge()) {
      errorData.label = (ele.source() !== undefined ? (ele.source().data('label') !== undefined ? ele.source().data('label') : "") : "") + " - " +
        (ele.target() !== undefined ? (ele.target().data('label') !== undefined ? ele.target().data('label') : "") : "");
    }
  });
  errors.forEach((errorData, i) => {
    let ele = cy.getElementById(errorData.role);
    if (unsolvedErrorInformation[errorData.pattern + errorData.role] !== true && !isValidation && errorData.pattern !== "00001" &&
      errorData.pattern !== "00002") {
      if (errorData.explanation === undefined)
        errorData.explanation = fixExplanation[errorData.pattern + errorData.role] ? fixExplanation[errorData.pattern + errorData.role] : "Fix of another error resolved this error.";
      errorData.status = "solved";
      errorData.colorCode = "#808080";
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
      if (errorData.colorCode !== undefined && errorData.colorCode !== "#808080") {
        errorColor[errorData.role] = errorData.colorCode;
        ele.data('highlightColor', errorData.colorCode);
      }
      else if (errorColor[errorData.role] !== undefined) {
        ele.data('highlightColor', errorColor[errorData.role]);
        errorData.colorCode = errorColor[errorData.role];
      }
      else {
        ele.data('highlightColor', errorHighlightColors[errorData.errorNo % 8]);
        errorData.colorCode = errorHighlightColors[errorData.errorNo % 8];
        errorColor[errorData.role] = errorHighlightColors[errorData.errorNo % 8];
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
