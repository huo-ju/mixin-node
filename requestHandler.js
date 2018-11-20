module.exports = function(err, body, resolve, reject){
  try{
    if(err){
      reject(err);
    }else if(body.error){
      reject(JSON.parse(body.error));
    }else{
      resolve(JSON.parse(body));
    }
  }catch(e){
    reject(e);
  }
}