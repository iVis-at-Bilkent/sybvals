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
let errorHighlightColors = ['#1e90ff', '#ff0000', '#b0b000', '#006400', '#0000ff', '#257359', '#c71585', '#fd713d'];
let currentSbgn;

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

let applyErrorFix = async function(){
  errors = undefined;
  let url = "";
  if( !syblars){
  url = "http://localhost:" + port + "/fixError?errorFixing=true";
  }
  else {
      url = "http://ivis.cs.bilkent.edu.tr:3400/fixError?errorFixing=true";
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
  //console.log("fix request sent");
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
    currentSbgn = res.sbgn;
    $("#applyValidation").prop('disabled', false);
    $("#fixFormatErrors").removeClass("loading");
    $("#fixFormatErrors").prop('disabled', true);
          if(!res.errorMessage && (res.errors !== undefined || res.image !== undefined)) {
            $("#errorsArea").empty();
            //$("#errorsArea").css( {'max-height' : '100px', 'overflow':scroll, 'background-color' : 'lightblue'} );
            // get error info
            errors = res.errors;
            //console.log( errors );
            if(errors.length > 0) {
              res.errors.forEach((error ) => {
                let imgSource = error.status === "solved" ? "img/checkbox.png" : "img/close.png";
                let errorNo = $('<div style = "display : flex;" />');
               // let errorNo = $('<img src = "' + imgSource +  '" style=" height: 20px; width: 20px;" />');
                //let errorNo = $('<div class="ui item"> <b>Error No:</b> ' + error.errorNo + '</div>');
                //errorNo.append('<img src = "' + imgSource +  '" style="margin-left : 363px; height: 20px; width: 20px;" />');
                errorNo.append('<img src = "' + imgSource +  '" style=" height: 20px; width: 20px;" />');
                errorNo.append('<div class="ui item" style = "margin-left : 5px;"> <b>Error No:</b> ' + error.errorNo + '</div>');
                let errorPattern = $('<div class="ui item"> <b>Pattern:</b> ' + error.pattern + '</div>');
                let errorRole = $('<div class="ui item"> <b>Role:</b> ' + error.role + '</div>');
                let errorText = $('<div class="ui item"> <b>Message:</b> ' + error.text + '</div>');
                let errorStatus = $('<div class="ui item"> <b>Status:</b> ' + (error.status !== undefined ? error.status : "unknown") + '</div>');
                let list = $('<div class="ui list">' );
                let fixExplanation = $('<div class="ui item"> <b>Fix explanation:</b> ' + (error.explanation !== undefined ?
                error.explanation : "-") + '</div>');
                //let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo +  '" style = "border = 10px solid ' +  errorHighlightColors[(error.errorNo - 1) % 8] + '">');
                let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo +  '">');
                list.append(errorNo);
                list.append(errorRole);
                list.append(errorPattern);
                list.append(errorText);
                //list.append(errorStatus);
                list.append(fixExplanation);
                errorRectangle.append(list);
                list.css({'margin' : '2px'});
                list.css({'margin-bottom': '5px'});
                list.css({'margin-left' : '5px'});
                if( error.errorNo === errors.length ){
                  list.css({ 'margin-bottom': '5px'});
                }
                errorRectangle.append('</div>');
                //console.log( error.errorNo);
                //console.log( document.getElementById("errorNo1") !== undefined ? document.getElementById("errorNo1")?.style : undefined);
                const errorString = "#errorNo" + error.errorNo;
                $("#errorsArea").append(errorRectangle);
                let uiDivider = $('<div class="ui divider"></div>');
                uiDivider.css({'margin' : '0rem 0'});
                $("#errorsArea").append(uiDivider);
                // console.log(errorString);
                //console.log( $(errorString).css('border') );
                $(errorString ).css({'border' : '3px solid' , 'border-color' : errorHighlightColors[(error.errorNo -1) % 8 ] });
                $(errorString).css({'margin-right': '7px'});
                //console.log( $(errorString).css('border') );
              });
              //$("#errorsArea").css( {'max-height' : '100px', 'overflow':scroll, 'background-color' : '#fd713d'} );
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

}

let processValidation = async function () {

  errors = undefined;
  if (!syblars) {
      //console.log( "request before " + port );
      url = "http://localhost:" + port + "/validation?edges=true";
  } else { // NOTE: If you are using the service with a different hostname, please change below accordingly
      url = "http://ivis.cs.bilkent.edu.tr:3400/validation?edges=true";
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
  if( res.errors.length > 0 ){
      $("#fixFormatErrors").prop('disabled', false);
  }
  currentSbgn = res.sbgn;

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
        //let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo +  '" style = "border = 10px solid ' +  errorHighlightColors[(error.errorNo - 1) % 8] + '">');
        let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo +  '">');
        list.append(errorNo);
        list.append(errorPattern);
        list.append(errorRole);
        list.append(errorText);
        errorRectangle.append(list);
        errorRectangle.append('</div>');
        list.css({'margin': '2px'});
        //console.log( error.errorNo);
        //console.log( document.getElementById("errorNo1") !== undefined ? document.getElementById("errorNo1")?.style : undefined);
        const errorString = "#errorNo" + error.errorNo;
        $("#errorsArea").append(errorRectangle);
        let uiDivider = $('<div class="ui divider"></div>');
        uiDivider.css({'margin' : '0rem 0'});
        $("#errorsArea").append(uiDivider);
        //console.log(errorString);
        //console.log( $(errorString).css('border') );
        $(errorString).css({'border' : '3px solid' , 'border-color' : errorHighlightColors[(error.errorNo -1) % 8 ] });
        $(errorString).css({'margin-right': '7px'});
        //console.log( $(errorString).css('border') );
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

function dragElement(elmnt){
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  document.getElementById("resultImage").onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

   function closeDragElement() {
    /* stop moving when mouse button is released:  <div className = {this.props.showChat ? "ChatBox" : "ChatBoxHidden"}  style={this.state.styles} onMouseDown={this._dragStart} onMouseMove={this._dragging} onMouseUp={this._dragEnd}>
    */
    document.onmouseup = null;
    document.onmousemove = null;
  }
}


$('#resultImage').mouseenter(function(){
  //console.log("mouseEnter");
   dragElement(document.getElementById("resultImage"));
});

$('#resultImage').mousedown(function(){
  //console.log("mouseDown");
   dragElement(document.getElementById("resultImage"));
})

$('#applyValidation').click(function(){

  if(graphData !== undefined && !areNodesInProcess) {
    $("#applyValidation").addClass("loading");
    $("#applyValidation").css("background-color", "#f2711c");
    processValidation();
    /*$("#applyValidation").addClass("loading");
    $("#applyValidation").css("background-color", "#f2711c");*/
  }
  else {
    $("#file-type").html("You must first load an SBGNML file!");
  }

});

$('#downloadSBGN').click( function(){
  var blob = new Blob([currentSbgn], {
    type: "text/plain;charset=utf-8;",
  });
  saveAs(blob, "currentSbgn.sbgn");

}
);
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
   $("#colorScheme").val("greyscale");
   $("#imageBackground").val("#ffffff");
   $("#imageBackground").attr("disabled", true);
   $("#transparent").prop("checked", true);
   $("#highlightColor").val("#ff0000");
   $("#highlightWidth").val(5);
});

$("#transparent").change(function() {
    if(this.checked) {
      $("#imageBackground").attr("disabled", true);
    }
    else {
      $("#imageBackground").attr("disabled", false);
    }
});

$("#fixFormatErrors").click(function (){
  $("#applyValidation").prop('disabled', true);
  $("#fixFormatErrors").addClass("loading");
  //$("#fixFormatErrors").css("background-color", "#d67664");
  applyErrorFix();
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

$("#save-sbgn").click(function(){
  
  var blob = new Blob([currentSbgn], {
    type: "text/plain;charset=utf-8;",
  });
  saveAs(blob, "currentSbgn.sbgn");
});

$("#resultImage").on("click", function (e) {
  let imageContent = document.getElementById("imageContent");
  let imageSource = document.getElementById("resultImage").src;
  imageContent.src = imageSource;
  let imageTitle = document.getElementById("imageTitle"); 
  imageTitle.innerHTML = document.getElementById("file-name").innerHTML;
  $('#imageModal').modal({inverted: true}).modal('show');
});