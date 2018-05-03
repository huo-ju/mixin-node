const fs = require('fs');
const mixinjs = require('../index');
const config = require("./config");

const cert = fs.readFileSync(config.mixin.privatekey);
let opts = config.mixin;
let mixin = new mixinjs(opts);

var asset_id = "965e5c6e-434c-3fa9-b780-c50f43cd955c"; //CNB
var recipient_id = "********-9d0b-4152-9c5a-839d286f7e4f"; //Account ID
var amount = "100.022";
var memo ="test transfer"

mixin.transferFromBot(asset_id, recipient_id, amount, memo) 
.then( (result) =>{
  console.log(result);
}).catch( (err) => {
  console.log(err); 
});
