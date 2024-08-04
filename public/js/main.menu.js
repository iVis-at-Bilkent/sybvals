
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
let autoSize = true;
let showResolutionAlternatives = true;

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
	//errors = undefined;
	let url = "";
	if (!syblars) {
		url = "http://localhost:" + port + "/fixError?errorFixing=true&showResolutionAlternatives=" + showResolutionAlternatives;
	}
	else {
		url = "http://sybvals.cs.bilkent.edu.tr/fixError?errorFixing=true&showResolutionAlternatives=" + showResolutionAlternatives;
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

	let data = currentSbgn  + JSON.stringify(errors) + JSON.stringify(options);

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
	//$("#fixFormatErrors").prop('disabled', true);
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
		let numberOfUnsolvedErrors = 0;
		if (errors.length > 0) {
			res.errors.forEach((error) => {
				let imgSource = error.status === "solved" ? "img/check-mark.png" : "img/cross.png";
				let errorNo = $('<div style = "display : flex;" />');
				errorNo.append('<img src = "' + imgSource + '" style=" height: 20px; width: 20px;" />');
				errorNo.append('<div class="ui item" style = "margin-left : 5px;"> <b>Error </b> ' + error.errorNo + '&nbsp &nbsp &nbsp &nbsp <b>Pattern:</b> ' + error.pattern + '</div>');
				let errorPattern = $('<div class="ui item"> <b>Pattern:</b> ' + error.pattern + '</div>');
				let errorRole = $('<div class="ui item"> <b>Role:</b> ' + error.role + '</div>');
				let errorLabel = $('<div class="ui item"> <b>Label:</b> ' + error.label + '&nbsp &nbsp &nbsp &nbsp <b>Role:</b> ' + error.role +'</div>');
				let errorText = $('<div class="ui item"> <b>Message:</b> ' + error.text + '</div>');
				let errorStatus = $('<div class="ui item"> <b>Status:</b> ' + (error.status !== undefined ? error.status : "unknown") + '</div>');
				let list = $('<div class="ui list">');
				let fixExplanation = $('<div class="ui item"> <b>Fix explanation:</b> ' + (error.explanation !== undefined ?
				error.explanation : "-") + '</div>');
				let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo + '">');
				list.append(errorNo);
				//list.append(errorRole);
				if( error.label){
				   list.append(errorLabel);
				}
				//list.append(errorPattern);
				list.append(errorText);
				//list.append(errorStatus);
				if (error.explanation !== undefined) {
					list.append(fixExplanation);
				}
				let accordion = $('<div id ="rec' + error.errorNo + '"class="ui vertical accordion menu" style = "min-height: 0px !important;">');
				let item = $('<div id = "item' + error.errorNo + '"  class="field"> <a class="title" style = "background: grey; padding : 0; width : inherit !important;display:block;"> <i class="dropdown icon"></i>Resolution Alternative</a><div class="content" style = "padding : 0"><div class="ui form"><div class="grouped fields" id ="solutionField' + error.errorNo + '"> </div></div></div></div>' );
				let option = $('<div class="field"><div onchange = "" class="ui radio checkbox"><input onclick = "" type="radio" name="test" value="ds"><label>Data Structure</label></div></div>');
				let classItem =  $('<a class="active title">');
				let str = ("#solutionField" + error.errorNo ).toString();
				//let str = document.getElementById(accordion[0].id).firstChild.children[1].children[0].children[0].id;
				//str += error.errorNo;
				let id = error.errorNo;
				let element = $( `#solutionField${id}` );
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();

				//$( `#solutionField${1}` ).append('<div class="field"><div onchange = "" class="ui radio checkbox"><input onclick = "" type="radio" name="test" value="ds"><label>Data Structure</label></div></div>');
				accordion.append( item);
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();
				if( showResolutionAlternatives && error.status !== "solved" && error.fixCandidate !== undefined && error.fixCandidate.length > 0)
				list.append( accordion);
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
				$("#errorsArea").append(errorRectangle);
				let resolutionAlternative;
				if( showResolutionAlternatives && error.status !== "solved" && error.fixCandidate !== undefined && error.fixCandidate.length > 0){
					for( let i = 0; i < error.fixCandidate.length; i++){
					$( `#solutionField${error.errorNo}` ).append('<div class="field" style = "margin: 0.01em 0;"><div onchange = "" class="ui radio checkbox"><input onclick = "" type="radio" id = "' + 'resAlt' + error.errorNo + '-' + i + '"name="'+ 'fixFor' + error.errorNo + '" value="' + error.fixCandidate[i].id+ '"><label style = "font-size:1em !important;margin-top:0px">' + error.fixCandidate[i].label +'</label></div></div>');
					if( (error.defaultOption  ) === i){
						console.log( error.errorNo + " " + error.defaultOption + " " + i)
						$('#resAlt' + error.errorNo + '-' + i).click();

					}
					}
					}
					$('.ui.accordion').accordion();
					$('.ui.radio.checkbox').checkbox();
					$('.ui.checkbox').checkbox();
					$('.ui.accordion').accordion();
					$('.ui.radio.checkbox').checkbox();
					$('.ui.checkbox').checkbox();
				let uiDivider = $('<div class="ui divider"></div>');
				uiDivider.css({ 'margin': '0rem 0' });
				$(errorString).css({
					'border': '3px solid', 'border-color': error.colorCode/*error.status === "unsolved" ? errorHighlightColors[numberOfUnsolvedErrors % 8]
						: "grey"*/
				});
				if (error.status == "unsolved") {
					numberOfUnsolvedErrors++;
				}
				$(errorString).css({ 'margin-right': '7px' });
			});
			$('.ui.radio.checkbox').on('click', event =>{
				
				try {
				console.log( "format or alternative" + " "  + event.currentTarget.parentElement.id);
				let errorId = event.currentTarget.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.id;
				errorId = errorId.replace("rec", "");
				errorId = parseInt( errorId ) - 1;
				errors[errorId].fixChoice = event.delegateTarget.firstChild.value;
				}
				catch{
					event.currentTarget.style.checked = true;
				}
				event.currentTarget.style.checked = true;
;			 });
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
		url = "http://localhost:" + port + "/validation?showResolutionAlternatives=" + showResolutionAlternatives;
	} else { // NOTE: If you are using the service with a different hostname, please change below accordingly
		url = "http://sybvals.cs.bilkent.edu.tr/validation?showResolutionAlternatives=" + showResolutionAlternatives;
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
			console.log( "result of one is come");
			return result;
		})
		.catch(e => {
			let errorContent = document.getElementById("errorContent");
			errorContent.innerHTML = "<b>Sorry! Cannot process the given file!</b><br><br>Error detail:<br>" + e;
			$('#errorModal').modal({ inverted: true }).modal('show');
		});
	$("#applyValidation").removeClass("loading");
	$("#applyValidation").css("background-color", "#d67664");
	if (res.errors.length > 0) {
		$("#fixFormatErrors").prop('disabled', false);
	}
	aspectRatio = res.aspectRatio;
	currentSbgn = res.sbgn;
	if (!res.errorMessage && (res.errors !== undefined || res.image !== undefined)) {
		let remainingErrors = 0;
		errors = res.errors;
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
		// get error info
		if (errors.length > 0) {
			res.errors.forEach((error) => {
				let errorNo = $('<div class="ui item"> <b>Error </b> ' + error.errorNo + '&nbsp &nbsp &nbsp &nbsp <b>Pattern:</b> ' + error.pattern + '</div>');
				let errorPattern = $('<div class="ui item"> <b>Pattern:</b> ' + error.pattern + '</div>');
				let errorRole = $('<div class="ui item"> <b>Role:</b> ' + error.role + '</div>');
				let errorLabel = $('<div class="ui item"> <b>Label:</b> ' + error.label + '&nbsp &nbsp &nbsp &nbsp <b>Role:</b> ' + error.role + '</div>');
				let errorText = $('<div class="ui item"> <b>Message:</b> ' + error.text + '</div>');
				let list = $('<div class="ui list">');
				let errorRectangle = $('<div class = "ui item" id ="errorNo' + error.errorNo + '">');
				let accordion = $('<div id ="rec' + error.errorNo + '"class="ui vertical accordion menu" style = "min-height: 0px !important;">');
				let item = $('<div id = "item' + error.errorNo + '"  class="field"> <a class="title" style = "background: #efefef; padding : 0; width : inherit !important;display:block;"> <i class="dropdown icon"></i>Resolution Alternatives</a><div class="content" style = "padding : 0"><div class="ui form"><div class="grouped fields" id ="solutionField' + error.errorNo + '"> </div></div></div></div>' );
				let option = $('<div class="field"><div onchange = "" class="ui radio checkbox"><input onclick = "" type="radio" name="test" value="ds"><label>Data Structure</label></div></div>');
				let classItem =  $('<a class="active title">');
				let str = ("#solutionField" + error.errorNo ).toString();
				//let str = document.getElementById(accordion[0].id).firstChild.children[1].children[0].children[0].id;
				//str += error.errorNo;
				let id = error.errorNo;
				let element = $( `#solutionField${id}` );
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();

				//$( `#solutionField${1}` ).append('<div class="field"><div onchange = "" class="ui radio checkbox"><input onclick = "" type="radio" name="test" value="ds"><label>Data Structure</label></div></div>');
				accordion.append( item);
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();
				

			
               
				list.append(errorNo);
				//list.append(errorRole);
				if( error.label){
                    list.append(errorLabel);
				}
				//list.append(errorPattern);
				list.append(errorText);
				console.log( showResolutionAlternatives);
				if( showResolutionAlternatives && error.fixCandidate !== undefined && error.fixCandidate.length > 0)
				list.append( accordion);
				errorRectangle.append(list);
				errorRectangle.append('</div>');
				list.css({ 'margin': '2px' });
				const errorString = "#errorNo" + error.errorNo;
				errorRectangle.css({ 'margin-top': '2px' });
				$("#errorsArea").append(errorRectangle);
				
				if( showResolutionAlternatives && error.fixCandidate !== undefined && error.fixCandidate.length > 0){
				for( let i = 0; i < error.fixCandidate.length; i++){
				//$( `#solutionField${error.errorNo}` ).append('<div class="field" style = "margin: 0.01em 0;"><div onchange = "" class="ui radio checkbox"><input onclick = "" type="radio" name="fixFor' + error.errorNo + '" value="' + error.fixCandidate[i].id+ '"><label style = "font-size:1em !important;margin-top:0px">' + error.fixCandidate[i].label +'</label></div></div>');
				$( `#solutionField${error.errorNo}` ).append('<div class="active field" style = "margin: 0.01em 0;"><div onchange = "" class="ui radio checkbox"><input onclick = "" type="radio" id = "' + 'resAlt' + error.errorNo + '-' + i + '"name="'+ 'fixFor' + error.errorNo + '" value="' + error.fixCandidate[i].id+ '" clicked ><label style = "font-size:1em !important;margin-top:0px">' + error.fixCandidate[i].label +'</label></div></div>');
					if( (error.defaultOption  ) === i){
						console.log( error.errorNo + " " + error.defaultOption + " " + i);
						console.log( document.getElementById("resAlt" + error.errorNo + "-" + i));
						//$('#resAlt' + errorNo + '-' + i).click();

					}
				}
				}
				let uiDivider = $('<div class="ui divider"></div>');
				uiDivider.css({ 'margin': '0rem 0' });
				$(errorString).css({ 'border': '3px solid', 'border-color': error.colorCode /*errorHighlightColors[(error.errorNo - 1) % 8]*/ });
				$(errorString).css({ 'margin-right': '7px' });
				$('.ui.accordion').accordion();
				$('.ui.radio.checkbox').checkbox();
				$('.ui.checkbox').checkbox();
			});
			$('.ui.radio.checkbox').on('click', event =>{
				console.log( event);
				console.log( "format or alternative" + " "  );
				try {
				let errorId = event.currentTarget.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.id;
				errorId = errorId.replace("rec", "");
				errorId = parseInt( errorId ) - 1;
				errors[errorId].fixChoice = event.delegateTarget.firstChild.value;
				}
				catch {
					event.currentTarget.style.checked = true;
				}
				event.currentTarget.style.checked = true;
;			 });
		}
		else {
			$("#errorsArea").text('Map is valid!');
		}
		errors.forEach( error => {
			$('#resAlt' + error.errorNo + '-' + error.defaultOption).click();
		})
		// get image info
		blobData = saveImage(res["image"], imageFormat, document.getElementById("file-name").innerHTML);
		let urlCreator = window.URL || window.webkitURL;
		let imageUrl = urlCreator.createObjectURL(blobData);
		var img = new Image();
		img.src = imageUrl;
		aspectRatio = img.naturalWidth / img.naturalHeight;
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
};

function dragElement(elmnt) {
	var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
	document.getElementById("dragImage").onmousedown = dragMouseDown;
	function dragMouseDown(e) {
		e = e || window.event;
		e.preventDefault();
		pos3 = e.clientX;
		pos4 = e.clientY;
		document.onmouseup = closeDragElement;
		document.onmousemove = elementDrag;
	}

	function elementDrag(e) {
		e = e || window.event;
		e.preventDefault();
		if (pos3 !== 0 && pos4 !== 0) {
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;
			elmnt.style.top = (elmnt.offsetTop - pos2 > 0 ? elmnt.offsetTop - pos2 : 0) + "px";
			elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
		}
	}

	function closeDragElement(e) {
		document.onmousedown = null;
		document.onmouseup = null;
		document.onmousemove = null;
	}
}

$('#draggableImageArea').mouseenter(function () {
	dragElement(document.getElementById("draggableImageArea"));
});
$('#applyValidation').click(function () {
	if (graphData !== undefined && !areNodesInProcess) {
		$("#applyValidation").addClass("loading");
		$("#applyValidation").css("background-color", "#f2711c");
		processValidation();
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
	$("#fixFormatErrors").prop('disabled', true);
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
			document.getElementById("errorsField").innerText = "Errors";
	        $('#errorsField').css({ width: '50px' });
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
	$("#imageWidth").prop("disabled",true);
	$("#imageHeight").prop("disabled",true);
	$("#color").val("#9ecae1");
	$("#colorScheme").val("greyscale");
	$("#imageBackground").val("#ffffff");
	$("#imageBackground").attr("disabled", true);
	$("#transparent").prop("checked", true);
	$("#highlightColor").val("#ff0000");
	$("#highlightWidth").val(10);
	$("#auto-size-graph").prop("checked", true);
	$("#resolution-alternatives-checkbox").prop("checked", true);
	showResolutionAlternatives = true;
	document.getElementById("imageWidth").disabled = true;
	document.getElementById("imageHeight").disabled = true;
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
$("#resolution-alternatives-checkbox").change( function (){
   showResolutionAlternatives = this.checked ? true : false;
});

$("#fixFormatErrors").click(function () {
	$("#applyValidation").prop('disabled', true);
	$("#fixFormatErrors").addClass("loading");
	//$("#fixFormatErrors").css("background-color", "#d67664");
	applyErrorFix();
});

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
	let imageContent = document.getElementById("imageContent");
	let imageSource = document.getElementById("resultImage1").src;
	var img = new Image();
	img.src = imageSource;
	imageContent.src = imageSource;
	aspectRatio = img.naturalWidth / img.naturalHeight;
	let imageTitle = document.getElementById("imageTitle");
	imageTitle.innerHTML = document.getElementById("file-name").innerHTML;
	document.getElementById("draggableImageArea").style.position = "absolute";
	document.getElementById("draggableImageArea").style.top = "400px";
	document.getElementById("draggableImageArea").style.left = "850px";
	document.getElementById("imageAreaPopUp").style.height = "500px";
	document.getElementById("imageAreaPopUp").style.width= "auto";	
	document.getElementById("imageAreaPopUp").style.aspectRatio = aspectRatio;
	document.getElementById("dragRegion").innerHTML = document.getElementById("file-name").innerHTML
	document.getElementById("draggableImageArea").style.display = "inline";
	document.getElementById("sbgnImageUI").style.display = "none";
});
