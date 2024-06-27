# SyBValS
**Sy**stems **B**iology **Val**idation **S**ervice (SyBValS) is a web service to validate maps in SBGNML format and to produce graphical images of the map with an option to highlight errors. After validating maps, if desired, SyBValS will resolve these errors when possible, reproducing the image after any fixes and returning the corrected SBGN file.

Here is an example map with errors after the user applies **Validate**:

![A screenshot from the sample deployment of SyBValS for validation](img/sybvals-ss-validation.png)

Notice how each error is color-coded both in its text description and in the image, respectively.

Here is the same map after the user applied **Resolve Errors**:

![A screenshot from the sample deployment of SyBValS for validation](img/sybvals-ss-resolved.png)

All problems have now been fixed.

The main capabilities of SyBValS include:
- validate and create an image of a map in SBGNML format, and
- resolve the errors in a map in SBGNML format, recreate an image of the validated map and produce corrected version of the input SBGN file.

Backed by these capabilities, SyBValS can be used to validate, resolve, and generate images of SBGN models (e.g., for including in web pages or scientific articles).

SyBValS is distributed under the [MIT License](https://github.com/iVis-at-Bilkent/sbgn-validation-service/blob/main/LICENSE).
Here is a sample server deployment along with a simple client-side demo:

<p align="center">
<a href="http://sybvals.cs.bilkent.edu.tr"><img src="https://www.cs.bilkent.edu.tr/~ivis/images/demo1.png" height=42px></a>
</p>

## Setup of a service

In order to deploy and run a local instance of the service, please follow the steps below:

### Installation
```
git clone https://github.com/iVis-at-Bilkent/sybvals.git
cd sybvals
npm install   // this may take a while
```

### Starting server
The default port is 3400, you can change it by setting 'PORT' environment variable.
```
npm run start
```

**Note #1:** We recommend the use of Node.js version 20.x and npm version 10.x. We used Node.js v20.14.0 and npm v10.7.0 during development.

**Note #2:** This service uses [Puppeteer](https://pptr.dev) to generate the output. Please refer to the [Puppeteer documentation](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#troubleshooting) to ensure that your machine is configured properly to run Chrome headlessly.

### Docker
Alternatively, you can use Dockerfile provided in the root directory. Please note that Dockerfile currently works in Linux and Windows environments and **does not** work in macOS because of Puppeteer related issues. To run the Dockerfile (below commands may require *sudo* in Linux environment):

First, `cd` into the folder where Dockerfile is located.

Then, build a Docker image with name *sybvals* (this may take a while).
```
docker build -t sybvals .
```
Lastly, run the image from port 3000. If you want to use another port, please change the first port number in below command.
```
docker run -p 3400:3400 sybvals
```

## Supported formats
SyBValS supports [SBGNML](https://github.com/sbgn/sbgn/wiki/SBGN_ML) as the input format. The notation used for this format:

### SBGNML Stylesheet
-------------------------
<a href="https://raw.githubusercontent.com/iVis-at-Bilkent/sbgn-validation-service/main/img/SBGNML_stylesheet.svg" title="SBGNML stylesheet"><img width="500" src="img/SBGNML_stylesheet.svg"></a>

## Usage

Sending request to the local deployment via curl to validate map:
```
curl -X POST -H "Content-Type: text/plain" --data "request_body" http://localhost:3400/validation
```
and via Fetch API 

```
let settings = {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'text/plain'
  },
  body: request_body
};

let result = await fetch("http://localhost:3400/validation", settings)
  .then(response => response.json())
  .then(res => {
    return res;
  })
  .catch(e => {
    return e;
  });
```

where `validation` is indicating validation is applied to map in SBGNML.

`request_body`  needs to be formed in the following way:
```
file_content + JSON.stringfy(options)
```
where `options` is an object consisting of `imageOptions`. Example:
```
options = {
  imageOptions: {
    format: 'png',              // output format
    background: 'transparent',  // background color
    color: 'greyscale'          // node color
    width: 1280,                // desired width
    height: 720,                // desired height
    autoSize: false,            // automatically size image with no padding
    highlightWidth: 10          // underlay padding used to highlight errors
  }
}
```
**Note:** While sending the requests via curl, any `"` in the `request_body` should be replaced with `\"` and all newline characters should be removed.

Image options support three output formats: `png`, `jpg` and `svg`. `background` attribute should be a hex color code or `transparent`. `color` attribute should be one of the following predefined color schemes: `bluescale`, `greyscale`, `red_blue`, `green_brown`, `purple_brown`, `purple_green`, `grey_red`, and `black_white`. If `autoSize` attribute is `true`, then `width` and `height` values are ignored.

After the request is sent, the server will validate the map in SBGNML format and return the error information in JSON format and image information (in `base64uri` encoding for `png` and `jpg` formats and in `xml` for the `svg` format). Error information will contain error number, error pattern, textual explanation of the error, id of the graph element involved in the error and highlight color of the error in the corresponding image.

If an error occurs during validation, the response of the server will consist of an error message.

For instance, a sample SBGNML file can be validated and a corresponding PNG image can be generated by making a query to the sample deployment of SyBValS web service via curl in the following way:
```
curl -X POST -H "Content-Type: text/plain" --data "<?xml version='1.0' encoding='UTF-8' standalone='yes'?> <sbgn xmlns='http://sbgn.org/libsbgn/0.2'> <map language='hybrid any'> <glyph id='glyph1' class='simple chemical'> <label text='DHA-P'/> <bbox x='30' y='20' w='60' h='60'/> </glyph> <glyph id='glyph2' class='simple chemical'> <label text='GA-3P'/> <bbox x='30' y='220' w='60' h='60'/> </glyph> <glyph id='pn1' class='process'> <bbox x='50' y='140' w='20' h='20'/> <port id='pn1.1' x='60' y='130'/> <port id='pn1.2' x='60' y='170'/> </glyph> <arc id='a2' class='consumption' source='pn1.2' target='glyph2'> <start x='60' y='170.625'/> <end x='60' y='219.375'/> </arc> <arc id='a1' class='production' source='pn1.1' target='glyph1'> <start x='60' y='129.375'/> <end x='60' y='83.75'/> </arc> </map> </sbgn>{\"imageOptions\":{\"format\":\"png\",\"background\":\"transparent\", \"width\": 1280, \"height\": 1280, \"color\":\"bluescale\", \"highlightWidth\": 10}}" http://sybvals.cs.bilkent.edu.tr/validation
```
and the corresponding response with error and image information will be as follows:

```
{"errors":[{"text":"Arc with class consumption must have source reference to glyph of EPN classes\n","pattern":"pd10101","role":"a2","color" : "#1e90ff"."errorNo":1}..."image":"data:image/png;base64,iVBORw0KGgoAAAA..."
```

The same query can be done via Fetch API in the following way:
```
let settings = {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'text/plain'
  },
  body: <?xml version='1.0' encoding='UTF-8' standalone='yes'?>
        <sbgn xmlns="http://sbgn.org/libsbgn/0.2">
          <map language="PD">
            <glyph id="glyph1" class="simple chemical">
              <label text="DHA-P"/>
              <bbox x="30" y="20" w="60" h="60"/>
            </glyph>
            <glyph id="glyph2" class="simple chemical">
              <label text="GA-3P"/>
              <bbox x="30" y="220" w="60" h="60"/>
            </glyph>
            <glyph id="pn1" class="process">
              <bbox x="50" y="140" w="20" h="20"/>
              <port id="pn1.1" x="60" y="130"/>
              <port id="pn1.2" x="60" y="170"/>
            </glyph>
            <arc id="a2" class="consumption" source="pn1.2" target="glyph2">
              <start x="60" y="170.625"/>
              <end x="60" y="219.375"/>
            </arc>
            <arc id="a1" class="production" source="pn1.1" target="glyph1">
              <start x="60" y="129.375"/>
              <end x="60" y="83.75"/>
            </arc>
          </map>
        </sbgn>{imageOptions":{"format":"png","background":"transparent","width":1280,"height":720,"color":"bluescale","highlightWidth":10}} // file_content + JSON.stringfy(options)
};

let result = await fetch("http://sybvals.cs.bilkent.edu.tr/validation, settings)
  .then(response => response.json())
  .then(res => {
    return res;
  })
  .catch(e => {
    return e;
  });

let errorInfo = result["errors"];                     // [{"text": "Arc with class consumption must have source reference to glyph of EPN classes",...}]
let imageInfo = result["imageErrorsHighlighted"];     // data:image/png;base64,iVBORw0KGgoAAAANSUhE... (in `base64uri` for `png` and `jpg` and in `xml` for `svg`)
```

Sending request to the sample deployment via curl to resolve errors after validation of map:

```
curl -X POST -H "Content-Type: text/plain" --data "<?xml version='1.0' encoding='UTF-8' standalone='yes'?> <sbgn xmlns='http://sbgn.org/libsbgn/0.2'> <map language='hybrid any'> <glyph id='glyph1' class='simple chemical'> <label text='DHA-P'/> <bbox x='30' y='20' w='60' h='60'/> </glyph> <glyph id='glyph2' class='simple chemical'> <label text='GA-3P'/> <bbox x='30' y='220' w='60' h='60'/> </glyph> <glyph id='pn1' class='process'> <bbox x='50' y='140' w='20' h='20'/> <port id='pn1.1' x='60' y='130'/> <port id='pn1.2' x='60' y='170'/> </glyph> <arc id='a2' class='consumption' source='pn1.2' target='glyph2'> <start x='60' y='170.625'/> <end x='60' y='219.375'/> </arc> <arc id='a1' class='production' source='pn1.1' target='glyph1'> <start x='60' y='129.375'/> <end x='60' y='83.75'/> </arc> </map> </sbgn>{\"imageOptions\":{\"format\":\"png\",\"background\":\"transparent\", \"width\": 1280, \"height\": 1280, \"color\":\"bluescale\", \"highlightWidth\": 10}}" http://sybvals.cs.bilkent.edu.tr/fixError
```
The same query can be done via Fetch API in the following way:
```
let settings = {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'text/plain'
  },
  body: <?xml version='1.0' encoding='UTF-8' standalone='yes'?>
        <sbgn xmlns="http://sbgn.org/libsbgn/0.2">
          <map language="PD">
            <glyph id="glyph1" class="simple chemical">
              <label text="DHA-P"/>
              <bbox x="30" y="20" w="60" h="60"/>
            </glyph>
            <glyph id="glyph2" class="simple chemical">
              <label text="GA-3P"/>
              <bbox x="30" y="220" w="60" h="60"/>
            </glyph>
            <glyph id="pn1" class="process">
              <bbox x="50" y="140" w="20" h="20"/>
              <port id="pn1.1" x="60" y="130"/>
              <port id="pn1.2" x="60" y="170"/>
            </glyph>
            <arc id="a2" class="consumption" source="pn1.2" target="glyph2">
              <start x="60" y="170.625"/>
              <end x="60" y="219.375"/>
            </arc>
            <arc id="a1" class="production" source="pn1.1" target="glyph1">
              <start x="60" y="129.375"/>
              <end x="60" y="83.75"/>
            </arc>
          </map>
        </sbgn>{imageOptions":{"format":"png","background":"transparent","color":"bluescale","autoSize":"true","highlightWidth":10}} // file_content + JSON.stringfy(options)
};

let result = await fetch("http://sybvals.cs.bilkent.edu.tr/fixError, settings)
  .then(response => response.json())
  .then(res => {
    return res;
  })
  .catch(e => {
    return e;
  });

let errorInfo = result["errors"];    // [{"text": "Arc with class consumption must have source reference to glyph of EPN classes",...}]
let imageInfo = result["image"];     // data:image/png;base64,iVBORw0KGgoAAAANSUhE... (in `base64uri` for `png` and `jpg` and in `xml` for `svg`)
```
Please note that `fixError` option is used instead of `validation` to indicate that error resolving is applied to the map.

## Credits

SyBValS uses [the Express framework](https://expressjs.com/) for handling HTTP requests. Actual operations are performed using [Cytoscape.js](https://js.cytoscape.org) and its extensions (see the `package.json` file for a complete listing). Among these extensions, [Cytosnap](https://github.com/cytoscape/cytosnap) is particularly needed for creating a headless Chrome instance, on which graph creation, rendering, layout and image creation of the input graphs are performed.

Icons in the client demo are made by [Freepik](http://www.freepik.com) and [Flaticon](https://www.flaticon.com) licensed with 
[Creative Commons BY 3.0](http://creativecommons.org/licenses/by/3.0/).

Third-party libraries used in web service:
[sbgnml-to-cytoscape](https://www.npmjs.com/package/sbgnml-to-cytoscape),
[cytoscape-sbgn-stylesheet](https://github.com/iVis-at-Bilkent/cytoscape-sbgn-stylesheet),
[cytosnap](https://github.com/iVis-at-Bilkent/cytosnap),
[libsbmljs](https://libsbmljs.github.io),
[express](https://www.npmjs.com/package/express),
[cors](https://www.npmjs.com/package/cors),
[jQuery](https://www.npmjs.com/package/jquery),
[jsdom](https://www.npmjs.com/package/jsdom),
[nodemon](https://www.npmjs.com/package/nodemon),
[jest](https://www.npmjs.com/package/jest),
[super-test](https://www.npmjs.com/package/supertest)

Third-party libraries used in demo client:
[Semantic UI](https://semantic-ui.com),
[underscore.js](https://underscorejs.org),
[backbone.js](https://backbonejs.org),
[FileSaver.js](https://github.com/eligrey/FileSaver.js/)

## Team

[Yusuf Ziya Özgül](https://github.com/YusufZiyaOzgul), [Hasan Balci](https://github.com/hasanbalci) and [Ugur Dogrusoz](https://github.com/ugurdogrusoz) of [i-Vis at Bilkent University](http://www.cs.bilkent.edu.tr/~ivis)
