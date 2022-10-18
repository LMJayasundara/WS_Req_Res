const WebSocket = require('ws');
const PORT = 8080;
var http = require('http');
var express = require('express');
var app = express();
const wsEvents = require('ws-events');

var req_res_reconn = null;

var server = new http.createServer({}, app);

var wss = new WebSocket.Server({
    server,
    verifyClient: function (info, cb) {
        var authentication = Buffer.from(info.req.headers.authorization,'base64').toString('utf-8');
        var loginInfo = authentication.trim().split(':');
        info.req.identity = loginInfo[0];
        cb(true, 200, 'Authorized');
    }
});

class req_from_client{
    constructor(evt, req_topic, res_topic, res_msg){
        this.evt = evt;
        this.req_topic = req_topic;
        this.res_topic = res_topic;
        this.res_msg = res_msg;
    };

    req_res(){
        return new Promise((resolve, reject) => {
            this.evt.on(this.req_topic, (ack)=> {
                this.evt.emit(this.res_topic, {
                    state: this.res_msg
                });
                resolve(ack);
            });
        });
    };
};

class req_from_server{
    constructor(evt, req_topic, res_topic, req_msg){
        this.evt = evt;
        this.req_topic = req_topic;
        this.res_topic = res_topic;
        this.req_msg = req_msg;
        this.count = 0;
        this.retry = 5;
        this.reconn_interval = 5000;
    };

    req(){
        return new Promise((resolve, reject) => {
            this.evt.emit(this.req_topic, {
                state: this.req_msg
            });
            resolve();
        });
    };

    res() {
        return new Promise((resolve, reject) => {
            this.evt.on(this.res_topic, (ack)=>{
                clearInterval(req_res_reconn);
                resolve(ack);
            });
            req_res_reconn = setTimeout(() => {
                if (++this.count === this.retry) {
                    clearInterval(req_res_reconn);
                    console.log('Restart...');
                    // Charger reboot code shoud be implement here
                }
                else{
                    console.log("Retry...");
                    this.req_res();
                }
            }, this.reconn_interval);
        });
    };

    req_res() {
        return new Promise((resolve, reject) => {
            this.req().then(()=>{
                this.res().then((ack)=>{
                    resolve(ack);
                });
            });
        });
    };
};

wss.on('connection', function (ws, request) {
    ws.id = request.identity;
    console.log("Connected Charger ID: "  + ws.id);

    wss.clients.forEach(function (client) {
        if(client.id == request.identity && client.readyState === client.OPEN){
            client.send(JSON.stringify(""));

            var evt = wsEvents(client);
            let reqC1 = new req_from_client(evt, 'Creq', 'Cres', 'res from server'); // evt, req_topic, res_topic, req_msg
            let reqS1 = new req_from_server(evt, 'Sreq', 'Sres', 'req from server'); 

            ws.on('message', function () {
                reqC1.req_res().then((ack)=>{
                    console.log(ack);
                });
            });

            reqS1.req_res().then((ack)=>{
                console.log(ack);
            });
        };
    });

    ws.on('close', function () {
        console.log('Client disconnected ', ws.id);
    });

});

server.listen(PORT, ()=>{
    console.log( (new Date()) + " Server is listening on port " + PORT);
});