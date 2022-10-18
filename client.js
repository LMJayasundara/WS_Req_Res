const WebSocket = require('ws');
const URL = "ws://127.0.0.1:8080/";
var reconn = null;
var req_res_reconn = null;
const wsEvents = require('ws-events');
const username = "ID001";

class req_from_server{
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

class req_from_client{
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

function startWebsocket() {
    var ws = new WebSocket(URL, {
        perMessageDeflate: false,
        headers: {
            Authorization: Buffer.from(username).toString('base64'),
        },
    });

    ////////////////////////////////////////////

    const heartbeat = (ws) => {
        console.log("ping to server");
        clearTimeout(ws.pingTimeout);
    };
    
    const ping = () => { heartbeat(ws) };

    ////////////////////////////////////////////

    var evt = wsEvents(ws);
    let reqC1 = new req_from_client(evt, 'Creq', 'Cres', 'req from client'); // evt, req_topic, res_topic, req_msg
    let reqS1 = new req_from_server(evt, 'Sreq', 'Sres', 'res from client');

    ws.on('ping', ping);

    ws.on('open', function() {
        ws.send("");
        clearInterval(reconn);

        reqC1.req_res().then((ack)=>{
            console.log(ack);
        });
        
    });

    ws.on('message', function() {
        reqS1.req_res().then((ack)=>{
            console.log(ack);
        });
    });

    ws.on('error', function (err) {
        console.log(err.message);
    });

    ws.on('close', function() {
        ws = null;
        clearInterval(req_res_reconn);
        try {clearTimeout(ws.pingTimeout)} catch (error) {};
        reconn = setTimeout(startWebsocket, 5000);
    });
};

startWebsocket();