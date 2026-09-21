/* Test harness replicating FIXED logic from index.html */
function setUser(out,name,ts){
  var key=name.toLowerCase();
  var prev=out.get(key);
  if(prev===undefined){out.set(key,{name:name,ts:(ts==null)?null:ts});return;}
  if(ts!=null&&(prev.ts==null||ts<prev.ts))prev.ts=ts;
}
function collectUsers(node,out,depth){
  if(depth>12||node==null)return;
  if(Array.isArray(node)){
    for(var i=0;i<node.length;i++){
      var it=node[i];
      if(typeof it==='string'){setUser(out,it,null);continue;}
      collectUsers(it,out,depth+1);
    }
    return;
  }
  if(typeof node!=='object')return;
  var sld=node.string_list_data;
  if(Array.isArray(sld)){
    for(var j=0;j<sld.length;j++){
      var s=sld[j],name=null,ts=null;
      if(s&&typeof s==='object'){
        if(typeof s.value==='string'&&s.value)name=s.value;
        if(typeof s.timestamp==='number')ts=s.timestamp;
      }
      if(!name&&typeof node.title==='string'&&node.title)name=node.title;
      if(!name&&s&&typeof s.href==='string'){
        var m=s.href.match(/instagram\.com\/(?:_u\/)?([^\/\?]+)/);
        if(m)name=m[1];
      }
      if(name)setUser(out,name,ts);
    }
    return;
  }
  if(typeof node.value==='string'&&node.value){
    var ts2=(typeof node.timestamp==='number')?node.timestamp:null;
    setUser(out,node.value,ts2);
  }
  for(var k in node)collectUsers(node[k],out,depth+1);
}
function parseJson(text,fileName){
  var data=JSON.parse(text);
  var out=new Map();
  collectUsers(data,out,0);
  var arr=[];
  out.forEach(function(v){arr.push({name:v.name,ts:v.ts});});
  return arr;
}
function mergeFiles(fileTexts){
  var total=new Map();
  fileTexts.forEach(function(t){
    parseJson(t).forEach(function(e){
      var key=e.name.toLowerCase();
      var prev=total.get(key);
      if(prev===undefined)total.set(key,e);
      else if(e.ts!=null&&(prev.ts==null||e.ts<prev.ts))prev.ts=e.ts;
    });
  });
  var arr=[];total.forEach(function(e){arr.push(e);});
  return arr;
}

/* ---- Tests ---- */
function assert(cond,msg){if(!cond){console.error('FAIL:',msg);process.exitCode=1;}else console.log('ok:',msg);}

// Current schema followers
var f1=JSON.stringify({followers:[{string_list_data:[{value:"alice",timestamp:1700000000,href:"https://www.instagram.com/alice"},{value:"Bob",timestamp:1700000100}]}]});
var a=parseJson(f1);
assert(a.length===2,'current schema: 2 users parsed, got '+a.length);
assert(a[1].ts===1700000100,'timestamp preserved');

// Legacy title schema
var f2=JSON.stringify({"relationship_followers":[{title:"carol",string_list_data:[{href:"https://www.instagram.com/carol/"}]}]});
assert(parseJson(f2).length===1,'legacy title schema: 1 user, got '+parseJson(f2).length);

// Multi-file merge with case difference -> must dedup to 1
var merged=mergeFiles([f1, JSON.stringify({followers:[{string_list_data:[{value:"bob",timestamp:1700000200}]}]})]);
assert(merged.length===2,'case-insensitive merge: Bob/bob counted once (2 total), got '+merged.length);
var bob=merged.find(function(e){return e.name.toLowerCase()==='bob';});
assert(bob.ts===1700000100,'earliest timestamp kept for merged bob');

// Case-diff within a single file
var one=JSON.stringify({followers:[{string_list_data:[{value:"Dave",timestamp:1},{value:"dave",timestamp:2}]}]});
assert(parseJson(one).length===1,'case-insensitive within one file: 1 user');

// analyze() comparison sanity: nfb/mutuals/fans partition
var followers=mergeFiles([f1,JSON.stringify({followers:[{string_list_data:[{value:"erin",timestamp:5}]}]})]);
var following=mergeFiles([JSON.stringify({relationships_following:[{string_list_data:[{value:"ALICE",timestamp:9},{value:"frank",timestamp:10}]}]})]);
var fSet=new Map();followers.forEach(function(e){fSet.set(e.name.toLowerCase(),e);});
var gSet=new Map();following.forEach(function(e){gSet.set(e.name.toLowerCase(),e);});
var nfb=[],fans=[],mutuals=[];
following.forEach(function(e){if(!fSet.has(e.name.toLowerCase()))nfb.push(e);else mutuals.push(e);});
followers.forEach(function(e){if(!gSet.has(e.name.toLowerCase()))fans.push(e);});
assert(nfb.length===1&&nfb[0].name==='frank','nfb: frank only');
assert(mutuals.length===1&&mutuals[0].name==='ALICE','mutuals: ALICE (case-insensitive match with alice)');
assert(fans.length===2,'fans: Bob and erin');
console.log('done. exit code '+process.exitCode);