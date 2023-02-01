// This is for using the service with a hostname other than localhost
syblars = !(location.hostname === "localhost");

///////////////////// LOAD & SAVE //////////////////////////////

let graphData; // data read from the file
let blobData; // blob data for image
let imageFormat;
let fileType;
let nodeData; // object keeps node ids and labels 
let areNodesInProcess;
let errors;

let setFileContent = function (fileName) {
    let span = document.getElementById('file-name');
    while (span.firstChild) {
        span.removeChild(span.firstChild);
    }
    span.appendChild(document.createTextNode(fileName));
};

$("#save-file-json").on("click", function (e) {
    let save = [];

    cy.filter((element, i) => {
        return true;
    }).forEach((ele) => {
        if (ele.isNode()) {
            let saveObj = {};
            saveObj["group"] = "nodes";
            saveObj["data"] = { width: ele.data().width, height: ele.data().height, clusterID: ele.data().clusterID, parent: ele.data().parent };
            saveObj["data"].id = ele.data().id;
            saveObj["position"] = { x: ele.position().x, y: ele.position().y };
            save.push(saveObj);
        }
        else {
            let saveObj = { group: "edges", data: { source: ele.data().source, target: ele.data().target, id: ele.id() } };
            saveObj.id = ele.id();
            save.push(saveObj);
        }
    })

    let jsonText = JSON.stringify(save, null, 4);

    let blob = new Blob([jsonText], {
        type: "application/json;charset=utf-8;",
    });
    let filename = "" + new Date().getTime() + ".json";
    saveAs(blob, filename);
});

let processValidation = async function () {

  errors = undefined;
  if (!syblars) {
      url = "http://139.179.50.45:" + port + "/sbgnml?edges=true";
  } else { // NOTE: If you are using the service with a different hostname, please change below accordingly
      url = "http://syblars.cs.bilkent.edu.tr/sbgnml?edges=true";
  }

  imageFormat = $('#formatRadios').find('[name="format"]:checked').val();

  let options = {
    imageOptions: {
      format: imageFormat,
      background: !$('#transparent').is(':checked') ? $('#imageBackground').val() : "transparent",
      width: parseInt($('#imageWidth').val()),
      height: parseInt($('#imageHeight').val()),
      color: $('#colorScheme').val(),
      highlightColor: $('#highlightColor').val(),
      highlightWidth: $('#highlightWidth').val()
    }
  };

  let data = graphData + JSON.stringify(options); 
  
  const settings = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'text/plain'
    },
    body: data
  };

  let res = await fetch(url, settings)
          .then(response => response.json())
          .then(result => {
            return result;
          })
          .catch(e => {
            let errorContent = document.getElementById("errorContent");
            errorContent.innerHTML = "<b>Sorry! Cannot process the given file!</b><br><br>Error detail:<br>" + e;
            $('#errorModal').modal({inverted: true}).modal('show');
          });

  $("#applyValidation").removeClass("loading");
  $("#applyValidation").css("background-color", "#d67664");

  if(!res.errorMessage && (res.errors !== undefined || res.image !== undefined)) {
    $("#errorsArea").empty();
    // get error info
    errors = res.errors;
    if(errors.length > 0) {
      res.errors.forEach((error) => {
        let errorNo = $('<div class="ui item"> <b>Error No:</b> ' + error.errorNo + '</div>');
        let errorPattern = $('<div class="ui item"> <b>Pattern:</b> ' + error.pattern + '</div>');
        let errorRole = $('<div class="ui item"> <b>Role:</b> ' + error.role + '</div>');
        let errorText = $('<div class="ui item"> <b>Message:</b> ' + error.text + '</div>');
        let list = $('<div class="ui list">');
        list.append(errorNo);
        list.append(errorPattern);
        list.append(errorRole);
        list.append(errorText);
        $("#errorsArea").append(list);
        $("#errorsArea").append('<div class="ui divider"></div>');
      });
    }
    else {
      $("#errorsArea").text('Map is valid!');
    }
    // get image info
    blobData = saveImage(res["imageErrorsHighlighted"], imageFormat, document.getElementById("file-name").innerHTML);
    let urlCreator = window.URL || window.webkitURL;
    let imageUrl = urlCreator.createObjectURL(blobData);
    $("#imageArea").css("height", parseInt($('#imageHeight').val()) * parseInt($('#imageArea').css('width')) / (parseInt($('#imageWidth').val())));
    $("#resultImage").attr("src", imageUrl);
  }
  else {
    if(res.errorMessage) {
      let errorContent = document.getElementById("errorContent");
      errorContent.innerHTML = res.errorMessage;
      $('#errorModal').modal({inverted: true}).modal('show');
    }
    else {
      let errorContent = document.getElementById("errorContent");
      errorContent.innerHTML = "<b>Sorry! Cannot process the given file!</b>";
      $('#errorModal').modal({inverted: true}).modal('show');
    }
  }
};

$('#applyValidation').click(function(){

  if(graphData !== undefined && !areNodesInProcess) {
    processValidation();
    $("#applyValidation").addClass("loading");
    $("#applyValidation").css("background-color", "#f2711c");
  }
  else {
    $("#file-type").html("You must first load an SBGNML file!");
  }

});

$('#downloadJSON').click(function(){

  if(errors.length > 0) {
    let jsonText = JSON.stringify(errors, null, 2);

    if(jsonText != "") {
      let blob = new Blob([jsonText], {
          type: "application/json;charset=utf-8;"
      });
  
      let filename = document.getElementById("file-name").innerHTML;
      filename = filename.substring(0, filename.lastIndexOf('.')) + ".json";
      saveAs(blob, filename);
    }
  }
});

$('#downloadImage').click(function(){
  
  if(blobData !== undefined) {
    let filename = document.getElementById("file-name").innerHTML;
    filename = filename.substring(0, filename.lastIndexOf('.')) + "." + imageFormat;
    saveAs(blobData, filename);
  }

});

$("body").on("change", "#file-input", function (e, fileObject) {
    let fileInput = document.getElementById('file-input');
    let file = fileInput.files[0] || fileObject;
    let reader = new FileReader();
    setFileContent(file.name);
    reader.onload = async function (e) {
        $("#file-type").html('');
        if(!fileObject)
          $("#sampleType").val('');
        graphData = this.result;
        let isSBGNML = (graphData.search("sbgn") == -1) ? 0 : 1;
        if(isSBGNML) {
          fileType = "sbgnml";
          $("#file-type").html("SBGNML file is detected! <br> Now you can apply validation.");
          $("#colorScheme").attr("disabled", false);
          $("#color").attr("disabled", true);
        }
        else {
          fileType = undefined;
          $("#file-type").html("File format is not valid! <br> Please load an SBGNML file.");
          $("#colorScheme").attr("disabled", true);
          $("#color").attr("disabled", false);
          $("#errorsArea").empty();
          $("#resultImage").attr("src", null);
          graphData = undefined;
          errors = undefined
        }
        $("#errorsArea").empty();
        $("#resultImage").attr("src", null);
        $("#layoutTab").css("pointer-events", "all");
        $("#layoutTab").removeClass("disabled");
        $("#imageTab").css("pointer-events", "all");
        $("#imageTab").removeClass("disabled");
        $("#queryTab").css("pointer-events", "all");
        $("#queryTab").removeClass("disabled");                
        blobData = undefined;
        $("#queryType").trigger('change');       
    };
    reader.readAsText(file);

    $("#file-input").val(null);
});

$("#load-file").on("click", function (e) {
    $("#file-input").trigger('click');
});

$("#informationModal").on("click", function (e) {
   $('#information-modal').modal({inverted: true}).modal('show');
});

$('.ui.accordion').accordion();

$('.menu .item').tab();

$("#imageSettingsDefault").on("click", function (e) {
   $("input[value='png']").prop("checked", true);
   $("#imageWidth").val(1280);
   $("#imageHeight").val(720);
   $("#color").val("#9ecae1");
   $("#colorScheme").val("bluescale");
   $("#imageBackground").val("#ffffff");
   $("#imageBackground").attr("disabled", true);
   $("#transparent").prop("checked", true);
   $("#highlightColor").val("#ff0000");
   $("#highlightWidth").val(10);
});

$("#transparent").change(function() {
    if(this.checked) {
      $("#imageBackground").attr("disabled", true);
    }
    else {
      $("#imageBackground").attr("disabled", false);
    }
});

/* // prevent imageWidth and imageHeight to get negative values

let imageWidth = document.getElementById('imageWidth');
imageWidth.onkeydown = function(e) {
    if(!((e.keyCode > 95 && e.keyCode < 106)
      || (e.keyCode > 47 && e.keyCode < 58)
      || e.keyCode == 8)) {
        return false;
    }
}

let imageHeight = document.getElementById('imageHeight');
imageHeight.onkeydown = function(e) {
    if(!((e.keyCode > 95 && e.keyCode < 106)
      || (e.keyCode > 47 && e.keyCode < 58)
      || e.keyCode == 8)) {
        return false;
    }
} */

// image content is base64 data and imageType is png/jpg
let saveImage = function(imageContent, imageType, fileName){  
    // see http://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
    function b64toBlob(b64Data, contentType, sliceSize) {
        contentType = contentType || '';
        sliceSize = sliceSize || 512;

        let byteCharacters = atob(b64Data);
        let byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            let slice = byteCharacters.slice(offset, offset + sliceSize);

            let byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            let byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
        }

        let blob = new Blob(byteArrays, { type: contentType });
        return blob;
    }
    
    let blob;
    if(imageType == "svg") {
      blob = new Blob([imageContent], {type:"image/svg+xml;charset=utf-8"}); 
    }
    else {
      // this is to remove the beginning of the pngContent: data:img/png;base64,
      let b64data = imageContent.substr(imageContent.indexOf(",") + 1);
      blob = b64toBlob(b64data, "image/"+imageType);      
    }

    return blob;
};

$("#save-as-png").on("click", function (evt) {
    let pngContent = cy.png({ scale: 3, full: true });

    saveImage(pngContent, "png", document.getElementById("file-name").innerHTML);
});

let fcoseLayoutProp = new FCOSELayout({
    el: '#fcose-layout-table'
});

let colaLayoutProp = new COLALayout({
    el: '#cola-layout-table'
});

let ciseLayoutProp = new CISELayout({
    el: '#cise-layout-table'
});

let dagreLayoutProp = new DAGRELayout({
    el: '#dagre-layout-table'
});

let klayLayoutProp = new KLAYLayout({
    el: '#klay-layout-table'
});

let avsdfLayoutProp = new AVSDFLayout({
    el: '#avsdf-layout-table'
});

let presetLayoutProp = new PRESETLayout({
    el: '#preset-layout-table'
});

fcoseLayoutProp.render();
let previousLayout = $('#layoutType').val();
$("#layoutType").on("change", function (e) {
  let currentLayout = $('#layoutType').val();
  $('#' + previousLayout + '-save-layout').trigger("click");
  switch (currentLayout) {
    case 'fcose':      
      fcoseLayoutProp.render(previousLayout);
      previousLayout = $('#layoutType').val();
      break;    
    case 'cola':
      colaLayoutProp.render(previousLayout);
      previousLayout = $('#layoutType').val();
      break;
    case 'cise':
      ciseLayoutProp.render(previousLayout);
      previousLayout = $('#layoutType').val();
      break;
    case 'dagre':
      dagreLayoutProp.render(previousLayout);
      previousLayout = $('#layoutType').val();
      break;
    case 'klay':
      klayLayoutProp.render(previousLayout);
      previousLayout = $('#layoutType').val();
      break;
    case 'avsdf':
      avsdfLayoutProp.render(previousLayout);
      previousLayout = $('#layoutType').val();
      break;
    case 'preset':
      presetLayoutProp.render(previousLayout);
      previousLayout = $('#layoutType').val();
      break;      
  }
});

$("#layoutSettingsDefault").on("click", function (e) {
  let currentLayout = $('#layoutType').val();
  $('#' + currentLayout + '-default-layout').trigger("click");
});

let degreeCentralityQueryProp = new degreeCentralityQuery({
  el: '#degreeCentrality-query-table'
});

let closenessCentralityQueryProp = new closenessCentralityQuery({
  el: '#closenessCentrality-query-table'
});

let betweennessCentralityQueryProp = new betweennessCentralityQuery({
  el: '#betweennessCentrality-query-table'
});

let pageRankQueryProp = new pageRankQuery({
  el: '#pageRank-query-table'
});

let shortestPathQueryProp = new shortestPathQuery({
  el: '#shortestPath-query-table'
});

let kNeighborhoodQueryProp = new kNeighborhoodQuery({
  el: '#kNeighborhood-query-table'
});

let commonStreamQueryProp = new commonStreamQuery({
  el: '#commonStream-query-table'
});

let pathsBetweenQueryProp = new pathsBetweenQuery({
  el: '#pathsBetween-query-table'
});

let pathsFromToQueryProp = new pathsFromToQuery({
  el: '#pathsFromTo-query-table'
});

let previousQuery = $('#queryType').val();
$("#queryType").on("change", function (e) {
  let currentQuery = $('#queryType').val();
  $('#' + previousQuery + '-save-query').trigger("click");
  switch (currentQuery) {
    case 'degreeCentrality':
      degreeCentralityQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;    
    case 'closenessCentrality':
      closenessCentralityQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;
    case 'betweennessCentrality':
      betweennessCentralityQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;
    case 'pageRank':
      pageRankQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;
    case 'shortestPath':
      shortestPathQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;
    case 'kNeighborhood':
      kNeighborhoodQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;
    case 'commonStream':
      commonStreamQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;
    case 'pathsBetween':
      pathsBetweenQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;
    case 'pathsFromTo':
      pathsFromToQueryProp.render(previousQuery, nodeData);
      previousQuery = $('#queryType').val();
      break;
    default: 
      $("#" + previousQuery + "-query-table").hide();    
  }
});

$("#querySettingsDefault").on("click", function (e) {
  let currentQuery = $('#queryType').val();
  $('#' + currentQuery + '-default-query').trigger("click");
});

function loadXMLDoc(fileName) {
	let xhttp;
  if (window.XMLHttpRequest) {
    xhttp = new XMLHttpRequest();
  }
  else // for IE 5/6
  {
    xhttp = new ActiveXObject("Microsoft.XMLHTTP");
  }
  xhttp.open("GET", fileName, false);
  xhttp.send();
  return xhttp.response;
}

function loadSample(fileName){
	let xmlResponse = loadXMLDoc(fileName);
  let fileObj;
  
  if(fileName.split('.').pop() == 'json') {
    fileObj = new File([xmlResponse], fileName, {
      type: "application/json"
    });
  }
  else {
    fileObj = new File([xmlResponse], fileName, {
      type: ""
    });
  }

	return fileObj;
}

$("#sampleType").change(function() {
  let currentSample = $('#sampleType').val();
  let graph = loadSample("samples/" + currentSample);
  $("#file-input").trigger("change", [graph]);
  document.getElementById("file-name").innerHTML = currentSample;
});

$("#resultImage").on("click", function (e) {
  let imageContent = document.getElementById("imageContent");
  let imageSource = document.getElementById("resultImage").src;
  imageContent.src = imageSource;
  let imageTitle = document.getElementById("imageTitle"); 
  imageTitle.innerHTML = document.getElementById("file-name").innerHTML;
  $('#imageModal').modal({inverted: true}).modal('show');
});