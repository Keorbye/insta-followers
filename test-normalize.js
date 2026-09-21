/* Regression test: invisible-character mismatches causing false NFB entries */
function keyOf(name){
  return name.normalize('NFC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g,'')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g,' ')
    .trim()
    .toLowerCase();
}
function setUser(out,name,ts){
  var key=keyOf(name);
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
function parseJson(text){
  var out=new Map();
  collectUsers(JSON.parse(text),out,0);
  var arr=[];out.forEach(function(v){arr.push({name:v.name,ts:v.ts});});
  return arr;
}
function mergeFiles(fileTexts){
  var total=new Map();
  fileTexts.forEach(function(t){
    parseJson(t).forEach(function(e){
      var key=keyOf(e.name);
      var prev=total.get(key);
      if(prev===undefined)total.set(key,e);
      else if(e.ts!=null&&(prev.ts==null||e.ts<prev.ts))prev.ts=e.ts;
    });
  });
  var arr=[];total.forEach(function(e){arr.push(e);});
  return arr;
}
function analyze(followers,following){
  var fSet=new Map();followers.forEach(function(e){fSet.set(keyOf(e.name),e);});
  var gSet=new Map();following.forEach(function(e){gSet.set(keyOf(e.name),e);});
  var lists={nfb:[],fans:[],mutuals:[]};
  following.forEach(function(e){if(!fSet.has(keyOf(e.name)))lists.nfb.push(e);else lists.mutuals.push(e);});
  followers.forEach(function(e){if(!gSet.has(keyOf(e.name)))lists.fans.push(e);});
  return lists;
}
function assert(cond,msg){if(!cond){console.error('FAIL:',msg);process.exitCode=1;}else console.log('ok:',msg);}

function ent(v){return JSON.stringify({followers:[{string_list_data:[{value:v,timestamp:1}]}]});}
function entF(v){return JSON.stringify({relationships_following:[{string_list_data:[{value:v,timestamp:1}]}]});}

/* Case: 'sam_01' follows you and you follow them, but exports differ invisibly */
var followers=mergeFiles([
  ent('sam_01'),              // clean
  ent('jess\u00A0k'),         // NBSP inside (unlikely but possible via copy-paste pollution)
  ent('caf\u00E9_lover')      // precomposed é
]);
var following=mergeFiles([
  entF('sam_01\u200B'),       // trailing zero-width space
  entF(' SAM_01 '),           // padded + case
  entF('cafe\u0301_lover'),   // e + combining acute (NFD form)
  entF('stranger_1'),
  entF('stranger_2')
]);
var lists=analyze(followers,following);
var nfb=lists.nfb.map(function(e){return keyOf(e.name);}).sort();
assert(nfb.join(',')==='stranger_1,stranger_2','nfb = strangers only, no false entries from invisible chars: got ['+nfb.join(',')+']');
assert(lists.mutuals.length===2,'mutuals = 2 (sam_01 + café_lover matched despite ZWS/NFD forms): got '+lists.mutuals.length);
assert(lists.fans.length===1&&keyOf(lists.fans[0].name)==='jess k','fans = jess k only (NBSP normalized, not in following)');
assert(followers.length===3,'no phantom duplicates from normalization: followers = 3');
assert(following.length===4,'following = 4 unique (sam_01 variants + padded SAM_01 deduped)');
console.log('done. exit code '+process.exitCode);