const WebSocket = require('ws');
const zlib = require("zlib");
const mixinjs = require("../index");
const config = require("./config"); 
const Koa = require('koa');
const app = new Koa();


let opts = config.mixin; 
let mixin = new mixinjs(opts); 
let token = mixin.authTokenGET("/","");

var options = {
    headers: {
        "Authorization" : "Bearer " + token,
        "perMessageDeflate": false
    }
};

const ws = new WebSocket('wss://blaze.mixin.one/', 'Mixin-Blaze-1',options);


ws.on('open', function open() {
  console.log('connected');
  mixin.sendMsg(ws, "LIST_PENDING_MESSAGES").then(function(receipt_id){
    console.log("list receipt_id:"+receipt_id);
  });
});

ws.on('message', function incoming(data) {
  mixin.decode(data).then(function(msgobj){
      return processing(ws, msgobj); 
  }).then(function(msgobj){

      if(msgobj.action && msgobj.action != 'ACKNOWLEDGE_MESSAGE_RECEIPT' && msgobj.action != 'LIST_PENDING_MESSAGES'){

          mixin.sendMsg(ws, "ACKNOWLEDGE_MESSAGE_RECEIPT", {message_id:msgobj.data.message_id}).then(function(receipt_id){
            console.log("send ACKNOWLEDGE_MESSAGE_RECEIPT id:"+receipt_id);
          });
      }else{
        console.log(msgobj);
      }
  }).catch(function(err){
      console.log(err);
  });
});

let textEventHandle = (ws, msgobj) =>{
  return new Promise((resolve, reject) => {
    const CNB = "965e5c6e-434c-3fa9-b780-c50f43cd955c";
    if(msgobj.data.data=="hi"){
      mixin.sendText(ws, "Payment:",msgobj).then(function(receipt_id){
        let payLink = "https://mixin.one/pay?recipient=" + config.mixin.client_id + "&asset=" + CNB + "&amount=10" + '&trace=' + mixin.newuuid() + "&memo=";
        let btn = '[{"label":"pay 10 CNB","action":"' + payLink + '","color":"#ff0033"}]'

        mixin.sendButton(ws, btn, msgobj).then(function(receipt_id){
          console.log("send payment button:"+receipt_id);
        });
        
      });
      
    }
  });

}

let processing = (ws, msgobj) =>{
  return new Promise((resolve, reject) => {
    if(msgobj.action == 'CREATE_MESSAGE'){
      if(msgobj.data.category == 'PLAIN_TEXT'){
        let msg = Buffer.from(msgobj.data.data , 'base64').toString('utf-8');
        msgobj.data.data = msg;
        textEventHandle(ws, msgobj).then(function(data){
          console.log(data);
        });
     }
    }
    resolve(msgobj);
  });
}

app.use(ctx => {
  ctx.body = 'Hello Koa';
});
app.listen(3000);
