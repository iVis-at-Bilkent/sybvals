
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
let cy;
let aspectRatio;
let autoSize = false;

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

let applyErrorFix = async function () {
	document.getElementById("draggableImageArea").style.display = "none";
	document.getElementById("sbgnImageUI").style.display = "inline";
	errors = undefined;
	let url = "";
	if (!syblars) {
		url = "http://localhost:" + port + "/fixError?errorFixing=true";
	}
	else {
		url = "http://sybvals.cs.bilkent.edu.tr/fixError?errorFixing=true";
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
			highlightWidth: $('#highlightWidth').val(),
			autoSize: autoSize
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
			$('#errorModal').modal({ inverted: true }).modal('show');
		});
	currentSbgn = res.sbgn;
	$("#applyValidation").prop('disabled', false);
	$("#fixFormatErrors").removeClass("loading");
	$("#fixFormatErrors").prop('disabled', true);
	if (!res.errorMessage && (res.errors !== undefined || res.image !== undefined)) {
		errors = res.errors;
		let remainingErrors = 0;
		errors.forEach( error => {
			if( error.status !== "solved"){
				remainingErrors++;
			}
		});
		document.getElementById("errorsField").innerText = remainingErrors > 0 ? "Errors (" + remainingErrors + ")" : "Errors (none)";
		let errorWidth = 86 - (remainingErrors % 10 === remainingErrors) * 10;
		if (remainingErrors === 0) {
			errorWidth = 140;
		}
		$('#errorsField').css({ width: errorWidth + 'px' });
		$("#errorsArea").empty();
		//$("#errorsArea").css( {'max-height' : '100px', 'overflow':scroll, 'background-color' : 'lightblue'} );
		// get error info

		let numberOfUnsolvedErrors = 0;
		console.log( errors );
		if (errors.length > 0) {
			res.errors.forEach((error) => {
				let imgSource = error.status === "solved" ? "img/check-mark.png" : "img/cross.png";
				let errorNo = $('<div style = "display : flex;" />');
				// let errorNo = $('<img src = "' + imgSource +  '" style=" height: 20px; width: 20px;" />');
				//let errorNo = $('<div class="ui item"> <b>Error No:</b> ' + error.errorNo + '</div>');
				//errorNo.append('<img src = "' + imgSource +  '" style="margin-left : 363px; height: 20px; width: 20px;" />');
				errorNo.append('<img src = "' + imgSource + '" style=" height: 20px; width: 20px;" />');
				errorNo.append('<div class="ui item" style = "margin-left : 5px;"> <b>Error </b> ' + error.errorNo + '</div>');
				let errorPattern = $('<div class="ui item"> <b>Pattern:</b> ' + error.pattern + '</div>');
				let errorRole = $('<div class="ui item"> <b>Role:</b> ' + error.label + '</div>');
				let errorText = $('<div class="ui item"> <b>Message:</b> ' + error.text + '</div>');
				let errorStatus = $('<div class="ui item"> <b>Status:</b> ' + (error.status !== undefined ? error.status : "unknown") + '</div>');
				let list = $('<div class="ui list">');
				let fixExplanation = $('<div class="ui item"> <b>Fix explanation:</b> ' + (error.explanation !== undefined ?
					error.explanation : "-") + '</div>');
				//let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo +  '" style = "border = 10px solid ' +  errorHighlightColors[(error.errorNo - 1) % 8] + '">');
				let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo + '">');
				list.append(errorNo);
				list.append(errorRole);
				list.append(errorPattern);
				list.append(errorText);
				//list.append(errorStatus);
				if (error.explanation !== undefined) {
					list.append(fixExplanation);
				}
				errorRectangle.append(list);
				list.css({ 'margin': '2px' });
				list.css({ 'margin-bottom': '5px' });
				list.css({ 'margin-left': '5px' });
				if (error.errorNo === errors.length) {
					list.css({ 'margin-bottom': '5px' });
				}
				errorRectangle.css({ 'margin-top': '2px' });
				errorRectangle.append('</div>');
				const errorString = "#errorNo" + error.errorNo;
				//if (error.pattern !== "pd10102")
					$("#errorsArea").append(errorRectangle);
				let uiDivider = $('<div class="ui divider"></div>');
				uiDivider.css({ 'margin': '0rem 0' });
				//$("#errorsArea").append(uiDivider);
				console.log( error.colorCode);
				$(errorString).css({
					'border': '3px solid', 'border-color': error.colorCode/*error.status === "unsolved" ? errorHighlightColors[numberOfUnsolvedErrors % 8]
						: "grey"*/
				});
				if (error.status == "unsolved") {
					numberOfUnsolvedErrors++;
				}
				$(errorString).css({ 'margin-right': '7px' });
			});
			//$("#errorsArea").css( {'max-height' : '100px', 'overflow':scroll, 'background-color' : '#fd713d'} );
		}
		else {
			$("#errorsArea").css('overflow', 'hidden');
			document.getElementById("errorsArea").style.overflow = "hidden";

			$("#errorsArea").text('Map is valid!');
		}

		// get image info
		blobData = saveImage(res["image"], imageFormat, document.getElementById("file-name").innerHTML);
		let urlCreator = window.URL || window.webkitURL;
		let imageUrl = urlCreator.createObjectURL(blobData);
		//$("#imageArea").css("height", parseInt($('#imageHeight').val()) * parseInt($('#imageArea').css('width')) / (parseInt($('#imageWidth').val())));
		$("#resultImage").attr("src", imageUrl);
		$("#resultImage1").attr("src", imageUrl);

	}
	else {
		if (res.errorMessage) {
			let errorContent = document.getElementById("errorContent");
			errorContent.innerHTML = res.errorMessage;
			$('#errorModal').modal({ inverted: true }).modal('show');
		}
		else {
			let errorContent = document.getElementById("errorContent");
			errorContent.innerHTML = "<b>Sorry! Cannot process the given file!</b>";
			$('#errorModal').modal({ inverted: true }).modal('show');
		}
	}

}

let processValidation = async function () {
	document.getElementById("draggableImageArea").style.display = "none";
	document.getElementById("sbgnImageUI").style.display = "inline";

	errors = undefined;
	if (!syblars) {
		//console.log( "request  " + port );
		url = "http://localhost:" + port + "/validation?edges=true";
	} else { // NOTE: If you are using the service with a different hostname, please change below accordingly
		url = "http://sybvals.cs.bilkent.edu.tr/validation?edges=true";
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
			highlightWidth: $('#highlightWidth').val(),
			autoSize: autoSize
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
			$('#errorModal').modal({ inverted: true }).modal('show');
		});

	/*cy = cytoscape({styleEnabled: true});  
		console.log(res.cyjson);
	cy.add(res.cyjson);
	console.log(cy);
	 let pngContent = cy.png({ scale: 3, full: true });*/

	//saveImage(pngContent, "png", document.getElementById("file-name").innerHTML);
	$("#applyValidation").removeClass("loading");
	$("#applyValidation").css("background-color", "#d67664");
	if (res.errors.length > 0) {
		$("#fixFormatErrors").prop('disabled', false);
	}
	aspectRatio = res.aspectRatio;
	currentSbgn = res.sbgn;
	//console.log(aspectRatio);
	//document.getElementById("imageAreaSmall").style.aspectRatio =  aspectRatio;
	console.log(res.image);

	if (!res.errorMessage && (res.errors !== undefined || res.image !== undefined)) {
		let remainingErrors = 0;
		errors = res.errors;
		errors.forEach( error => {
			if( error.status !== "solved"){
				remainingErrors++;
			}
		});
		//document.getElementById("errorsField").innerText = "Errors (" + res.remainingErrors + ")";
		document.getElementById("errorsField").innerText = remainingErrors > 0 ? "Errors (" + remainingErrors + ")" : "Errors (none)";
		let errorWidth = 86 - (remainingErrors % 10 === remainingErrors) * 10;
		if (remainingErrors === 0) {
			errorWidth = 140;
		}
		//let errorWidth = 86 - ( res.remainingErrors % 10 === res.remainingErrors) * 10;
		$('#errorsField').css({ width: errorWidth + 'px' });
		$("#errorsArea").empty();
		// get error info
		if (errors.length > 0) {
			res.errors.forEach((error) => {
				let errorNo = $('<div class="ui item"> <b>Error </b> ' + error.errorNo + '</div>');
				let errorPattern = $('<div class="ui item"> <b>Pattern:</b> ' + error.pattern + '</div>');
				let errorRole = $('<div class="ui item"> <b>Role:</b> ' + error.label + '</div>');
				let errorText = $('<div class="ui item"> <b>Message:</b> ' + error.text + '</div>');
				let list = $('<div class="ui list">');
				//let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo +  '" style = "border = 10px solid ' +  errorHighlightColors[(error.errorNo - 1) % 8] + '">');
				let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo + '">');
				list.append(errorNo);
				list.append(errorRole);
				list.append(errorPattern);
				list.append(errorText);
				errorRectangle.append(list);
				errorRectangle.append('</div>');
				list.css({ 'margin': '2px' });
				//console.log( error.errorNo);
				//console.log( document.getElementById("errorNo1") !== undefined ? document.getElementById("errorNo1")?.style : undefined);
				const errorString = "#errorNo" + error.errorNo;
				errorRectangle.css({ 'margin-top': '2px' });
				//if (error.pattern !== "pd10102")
					$("#errorsArea").append(errorRectangle);
				let uiDivider = $('<div class="ui divider"></div>');
				uiDivider.css({ 'margin': '0rem 0' });
				//$("#errorsArea").append(uiDivider);
				//console.log(errorString);
				//console.log( $(errorString).css('border') );
				$(errorString).css({ 'border': '3px solid', 'border-color': error.colorCode /*errorHighlightColors[(error.errorNo - 1) % 8]*/ });
				$(errorString).css({ 'margin-right': '7px' });
				//console.log( $(errorString).css('border') );
			});
		}
		else {
			$("#errorsArea").text('Map is valid!');
		}
		// get image info
		blobData = saveImage(res["image"], imageFormat, document.getElementById("file-name").innerHTML);
		let urlCreator = window.URL || window.webkitURL;
		let imageUrl = urlCreator.createObjectURL(blobData);
		var img = new Image();
		img.src = imageUrl;
		aspectRatio = img.naturalWidth / img.naturalHeight;
		//console.log(aspectRatio);
		//$("#imageArea").css("height", parseInt($('#imageHeight').val()) * parseInt($('#imageArea').css('width')) / (parseInt($('#imageWidth').val())));
		//$("#imageArea").css("height", parseInt($('#imageArea').css('width')) / aspectRatio);
		//$("#resultImage1").css("height", parseInt($('#imageArea').css('width')) / aspectRatio);
		$("#resultImage").attr("src", imageUrl);
		$("#resultImage1").attr("src", imageUrl);
		//$("#resultImage1").attr("aspect-ratio", aspectRatio);

		document.getElementById("resultImage1").style.aspectRatio = aspectRatio;

	}
	else {
		if (res.errorMessage) {
			let errorContent = document.getElementById("errorContent");
			errorContent.innerHTML = res.errorMessage;
			$('#errorModal').modal({ inverted: true }).modal('show');
		}
		else {
			let errorContent = document.getElementById("errorContent");
			errorContent.innerHTML = "<b>Sorry! Cannot process the given file!</b>";
			$('#errorModal').modal({ inverted: true }).modal('show');
		}
	}
};

function dragElement(elmnt) {
	var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
	document.getElementById("dragImage").onmousedown = dragMouseDown;

	//document.getElementById("draggableImageArea").onmousedown = dragMouseDown;
	//document.getElementById("draggableImageArea").onmousemove = elementDrag; 

	function dragMouseDown(e) {
		e = e || window.event;

		e.preventDefault();
		// get the mouse cursor position at startup:
		pos3 = e.clientX;
		pos4 = e.clientY;
		//console.log(e);
		//console.log(pos3 + " " + pos4);
		document.onmouseup = closeDragElement;
		// call a function whenever the cursor moves:
		document.onmousemove = elementDrag;
	}

	function elementDrag(e) {
		e = e || window.event;
		e.preventDefault();
		//console.log(e);
		// calculate the new cursor position:
		if (pos3 !== 0 && pos4 !== 0) {
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;
			// set the element's new position:
			elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
			elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
			//console.log(elmnt.offsetTop + " " + elmnt.offsetLeft);
		}
	}

	function closeDragElement(e) {
		/* stop moving when mouse button is released:  <div className = {this.props.showChat ? "ChatBox" : "ChatBoxHidden"}  style={this.state.styles} onMouseDown={this._dragStart} onMouseMove={this._dragging} onMouseUp={this._dragEnd}>
		*/
		//console.log("closeDrag" + e);
		document.onmousedown = null;
		document.onmouseup = null;
		document.onmousemove = null;
		/*document.getElementById("dragImage").onmouseup = null;
		document.getElementById("dragImage").onmousemove = null;
		document.getElementById("dragImage").onmousedown = null;
		document.getElementById("dragImage").onmousemove = null;
		document.getElementById("draggableImageArea").onmouseup = null;
		document.getElementById("draggableImageArea").onmousemove = null;
		document.getElementById("draggableImageArea").onmousedown = null;
		document.getElementById("draggableImageArea").onmousemove = null;*/
	}
}

function onMouseDrag({ movementX, movementY }) {
	//console.log("drag");
	//return ;
	let getContainerStyle = document.getElementById("draggableImageArea").style;
	//console.log(getContainerStyle);
	let leftValue = parseInt(getContainerStyle.left);
	let topValue = parseInt(getContainerStyle.top);
	//console.log(leftValue + " " + topValue);
	if (leftValue + movementX > 0 && leftValue + movementX < 1000)
		document.getElementById("draggableImageArea").style.left = `${leftValue + movementX}px`;
	if (topValue + movementY > 0 && topValue + movementY < 800)
		document.getElementById("draggableImageArea").style.top = `${topValue + movementY}px`;
}

/*document.getElementById("dragImage").addEventListener("mousedown", () => {
	console.log("event listener added");
	document.getElementById("dragImage").addEventListener("mousemove", onMouseDrag);
});
document.getElementById("dragImage").addEventListener("mouseup", () => {
	console.log("event listener removed");
	document.getElementById("dragImage").removeEventListener("mousemove", onMouseDrag);
});*/

$('#draggableImageArea').mouseenter(function () {
	//console.log("mouseEnter");
	dragElement(document.getElementById("draggableImageArea"));
});

$('#dragImage').mousedown(function () {
	//console.log("mouseDown");
	//dragElement(document.getElementById("draggableImageArea"));
})

$('#applyValidation').click(function () {
	if (graphData !== undefined && !areNodesInProcess) {
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

$('#downloadSBGN').click(function () {
	var blob = new Blob([currentSbgn], {
		type: "text/plain;charset=utf-8;",
	});
	if (document.getElementById("file-name").innerHTML !== "") {
		saveAs(blob, document.getElementById("file-name").innerHTML);
	}
}
);
$('#closeImageBox').click(function () {
	document.getElementById("draggableImageArea").style.display = "none";
	document.getElementById("sbgnImageUI").style.display = "inline";
}
);

$('#downloadJSON').click(function () {
	if (errors !== undefined) {

		errors.forEach(error => {
			if (Array.isArray(error.text)) {
				error.text = error.text[0];
				error.text = error.text.substr(0, error.text.length - 4);
			}
			else {
				error.text = error.text.substr(0, error.text.length - 1);
			}
		});
		if (errors.length > 0) {
			let jsonText = JSON.stringify(errors, null, 2);
			if (jsonText != "") {
				let blob = new Blob([jsonText], {
					type: "application/json;charset=utf-8;"
				});

				let filename = document.getElementById("file-name").innerHTML;
				filename = filename.substring(0, filename.lastIndexOf('.')) + ".json";
				saveAs(blob, filename);
			}
		}
	}
});

$('#downloadImage').click(function () {
	//console.log("image download");
	//let pngContent = cy.png({ scale: 3, full: true });

	//saveImage(pngContent, "png", document.getElementById("file-name").innerHTML);
	//console.log(blobData);
	if (blobData !== undefined) {
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
	//console.log(file.name);
	reader.onload = async function (e) {
		$("#file-type").html('');
		if (!fileObject)
			$("#sampleType").val('');
		graphData = this.result;
		let isSBGNML = (graphData.search("sbgn") == -1) ? 0 : 1;
		if (isSBGNML) {
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
			$("#resultImage1").attr("src", null);
			document.getElementById("draggableImageArea").style.display = "none";
			document.getElementById("sbgnImageUI").style.display = "inline";

			graphData = undefined;
			errors = undefined
		}
		$("#errorsArea").empty();
		$("#resultImage1").attr("src", null);
		$("#resultImage").attr("src", null);
		document.getElementById("draggableImageArea").style.display = "none";
		document.getElementById("sbgnImageUI").style.display = "inline";

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
	document.getElementById("errorsField").innerText = "Errors";
	$('#errorsField').css({ width: '50px' });
});

$("#load-file").on("click", function (e) {
	document.getElementById("errorsField").innerText = "Errors";
	$('#errorsField').css({ width: '50px' });
	$("#file-input").trigger('click');
});

$("#informationModal").on("click", function (e) {
	$('#information-modal').modal({ inverted: true }).modal('show');
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
	$("#highlightWidth").val(10);
	$("#auto-size-graph").prop("checked", false);
	document.getElementById("imageWidth").disabled = false;
	document.getElementById("imageHeight").disabled = false;
	//console.log(document.getElementById("fullGraph"));
});

$("#transparent").change(function () {
	if (this.checked) {
		$("#imageBackground").attr("disabled", true);
	}
	else {
		$("#imageBackground").attr("disabled", false);
	}
});
$("#auto-size-graph").change(function () {
	autoSize = this.checked ? true : false;
	document.getElementById("imageWidth").disabled = this.checked ? true : false;
	document.getElementById("imageHeight").disabled = this.checked ? true : false;
});

$("#fixFormatErrors").click(function () {
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
let saveImage = function (imageContent, imageType, fileName) {
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
	if (imageType == "svg") {
		blob = new Blob([imageContent], { type: "image/svg+xml;charset=utf-8" });
	}
	else {
		// this is to remove the beginning of the pngContent: data:img/png;base64,
		let b64data = imageContent.substr(imageContent.indexOf(",") + 1);
		blob = b64toBlob(b64data, "image/" + imageType);
	}

	return blob;
};

$("#save-as-png").on("click", function (evt) {
	let pngContent = cy.png({ scale: 3, full: true });

	saveImage(pngContent, "png", document.getElementById("file-name").innerHTML);
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

function loadSample(fileName) {
	//console.log(fileName);
	let xmlResponse = loadXMLDoc(fileName);
	let fileObj;

	if (fileName.split('.').pop() == 'json') {
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

$("#sampleType").change(function () {
	let currentSample = $('#sampleType').val();
	let graph = loadSample("samples/" + currentSample);
	$("#file-input").trigger("change", [graph]);
	document.getElementById("file-name").innerHTML = currentSample;
});

$("#save-sbgn").click(function () {
	var blob = new Blob([currentSbgn], {
		type: "text/plain;charset=utf-8;",
	});
	saveAs(blob, document.getElementById("file-name").innerHTML);
});

$("#resultImage1").on("click", function (e) {
	function resize() {
		//console.log("enterred")
		var height = parseInt(document.getElementById("resultImage").width);
		//console.log(height);
		document.getElementById("draggableImageArea").style.width = (height + 18) + "px";
		document.getElementById("draggableImageArea").style.height = 1.10 * parseInt(document.getElementById("draggableImageArea").style.width) / aspectRatio + "px";

		/*$('.parent-div').css({
			minWidth: height,
			maxWidth: height,
		})*/
	}

	let imageContent = document.getElementById("imageContent");
	let imageSource = document.getElementById("resultImage1").src;
	var img = new Image();
	img.src = imageSource;
	imageContent.src = imageSource;
	aspectRatio = img.naturalWidth / img.naturalHeight;
	let imageTitle = document.getElementById("imageTitle");
	imageTitle.innerHTML = document.getElementById("file-name").innerHTML;
	//$( "#draggableImageArea" ).resizable({containment: "#resultImage"}).draggable({ cursor: "move",containment: "#draggableImageArea"      });
	document.getElementById("draggableImageArea").style.position = "absolute";
	document.getElementById("draggableImageArea").style.top = "400px";
	document.getElementById("draggableImageArea").style.left = "850px";
	document.getElementById("draggableImageArea").style.aspectRatio = aspectRatio;
	document.getElementById("draggableImageArea").style.width = "900px";
	document.getElementById("draggableImageArea").style.height = (900 / aspectRatio + 40) + "px";
	document.getElementById("resultImage").style.aspectRatio = aspectRatio;
	document.getElementById("imageAreaPopUp").style.aspectRatio = aspectRatio;
	document.getElementById("dragRegion").innerHTML = document.getElementById("file-name").innerHTML

	//document.getElementById("imageArea").style.aspectRatio = aspectRatio;
	//resize();
	//setInterval(resize, 20);
	document.getElementById("draggableImageArea").style.display = "inline";

	document.getElementById("sbgnImageUI").style.display = "none";


	//$('#imageModal').modal({inverted: true}).modal('show');
});
$("#resultImage").on("click", function (e) {
	//document.getElementById("resultImage").addEventListener("mousemove", onMouseDrag);
});

//$('#imageModal').modal({inverted: true}).modal('show');
document.getElementById("resultImage").addEventListener("mouseup", () => {
	//document.getElementById("resultImage").removeEventListener("mousemove", onMouseDrag);
});