'use strict'

let fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    coscript = require('coscript'),
    mdns = require('mdns'),
    async = require('async'),
    express = require('express'),
    uuid = require('node-uuid'),
    bodyParser = require('body-parser');

const host                      = process.env.PORT ? '0.0.0.0' : '127.0.0.1';
const port                      = process.env.PORT || 8080;
const TMP_DIR                   = '.tmp';
const script_isTextLayerAtPoint = fs.readFileSync(path.resolve(__dirname, 'isTextLayerAtPoint.cocoascript'), 'utf-8');
const script_updateTextLayer    = fs.readFileSync(path.resolve(__dirname, 'updateTextLayer.cocoascript'), 'utf-8');
const bonjour                   = mdns.createBrowser(mdns.tcp('http'));
const app                       = express();
// bonjour
let sketchProps = {
    ip: null,
    port: null,
    wsURL: null
}
let scriptToRun = script_isTextLayerAtPoint;

// mk tmp dir
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR);
}

// listen for HTTP services on the local machine
bonjour.on('serviceUp', function(service) {
    if(service.name.indexOf('Sketch Mirror') > -1) {
        // bonjour.stop();
        // hack, only use IPv4 ips for now. WebSocket doesn't like IPv6?
        service.addresses.some((ip) => {
            if (!ip.match(/[a-z]/i)) {
                sketchProps.ip = ip;
                sketchProps.port = service.port;
                sketchProps.wsURL = ip + ':' + (service.port + 1); // plus 1 to access the WS server

                return;
            }
        })
    }
});
bonjour.start();

// globals for now
let pt = null;
let txt = null;
let objectID = null;

// Express server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true})); 
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.use('/', express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.render('index', {
        title: 'Sketch inCopy',
        sketchProps: sketchProps,
        uuid: uuid.v4()
    });
});

app.post('/isTextLayerAtPoint', (req, res) => {
    pt = req.body.point;
    txt = null;
    scriptToRun = script_isTextLayerAtPoint;

    waterfall(res);
});

app.post('/updateTextLayer', (req, res) => {
    pt = null;
    txt = req.body.txt;
    scriptToRun = script_updateTextLayer;

    waterfall(res);
});

app.listen(port, host, () => {
    console.log('Running on: ' + host + ':' + port);
});

/*
* Waterfall & Steps
*/
function waterfall(res) {
    async.waterfall([
        createFileSignature,
        injectParams,
        runScript
    ],
    function(err, data) {
        if(err) {
            res.send(false);
        } else {
            if(scriptToRun === script_isTextLayerAtPoint) {
                objectID = data;
            } 
            res.send(true);
        }
    });
}

function createFileSignature(callback) {
    let identifier = new Date().getTime();
    let file = path.join(__dirname, TMP_DIR, identifier + '.cocoascript');

    callback(null, file);
}

function injectParams(file, callback) {
    let script = '';

    if(txt !== null) {
        script += 'var txt="' + txt + '";' + "\n";
    }
    if(pt !== null) {
        script += 'var point={x:' + pt.x + ',y:' + pt.y + '};' + "\n";
    }
    if(objectID !== null) {
        script += 'var objectID="' + objectID + '";' + "\n";
    }

    script += scriptToRun;
    fs.writeFileSync(file, script);

    callback(null, file);
}

function runScript(file, callback) {
    let cmd = '[[[COScript app:\"Sketch\"] delegate] runPluginAtURL:[NSURL fileURLWithPath:\"'+file+'\"]]';
    let child = spawn(coscript, ['-e', cmd]);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
        var data = data.trim();

        // cocoascript passes back literal string 1,0 for true,false
        if(data !== '0') {
            callback(null, data);
        } else {
            callback('No text layer at point', pt);
        }

        // clean-up tmp files
        fs.unlink(file);

        // clean-up child_processes
        child.kill();
    });
}