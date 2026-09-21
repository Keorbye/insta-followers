/* End-to-end verification of the "Not following back" list */
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
      var key=e.name.toLowerCase();
      var prev=total.get(key);
      if(prev===undefined)total.set(key,e);
      else if(e.ts!=null&&(prev.ts==null||e.ts<prev.ts))prev.ts=e.ts;
    });
  });
  var arr=[];total.forEach(function(e){arr.push(e);});
  return arr;
}
function assert(cond,msg){if(!cond){console.error('FAIL:',msg);process.exitCode=1;}else console.log('ok:',msg);}

/* Scenario:
   FOLLOWERS (files merged): Alice, bob_99 (split across files as BOB_99/bob_99), carol, dave
   FOLLOWING: alice (case diff), BOB_99 (case diff, split across 2 following files), carol, eve, frank, frank (dupe same case, other file)
   Expected:
   - following total = 6 (alice, bob_99, carol, eve, frank, x?)
   Actually: alice, bob_99, carol, eve, frank -> 5
   - nfb = eve, frank  (2)  -- alice/bob_99/carol DO follow back despite case diffs
   - mutuals = 3
   - fans = dave (1)
*/
var followersFiles=[
  JSON.stringify({followers:[{string_list_data:[{value:"Alice",timestamp:100},{value:"BOB_99",timestamp:200}]}]}),
  JSON.stringify({followers:[{string_list_data:[{value:"bob_99",timestamp:150},{value:"carol",timestamp:300},{value:"dave",timestamp:400}]}]})
];
var followingFiles=[
  JSON.stringify({relationships_following:[{string_list_data:[{value:"alice",timestamp:10},{value:"BOB_99",timestamp:20},{value:"carol",timestamp:30}]}]}),
  JSON.stringify({relationships_following:[{string_list_data:[{value:"eve",timestamp:40},{value:"frank",timestamp:50},{value:"frank",timestamp:60}]}]})
];
var followers=mergeFiles(followersFiles);
var following=mergeFiles(followingFiles);

assert(followers.length===4,'followers merged to 4 (bob_99 deduped across files): got '+followers.length);
assert(following.length===5,'following merged to 5 (frank deduped): got '+following.length);

var fSet=new Map();followers.forEach(function(e){fSet.set(e.name.toLowerCase(),e);});
var gSet=new Map();following.forEach(function(e){gSet.set(e.name.toLowerCase(),e);});
var lists={nfb:[],fans:[],mutuals:[]};
following.forEach(function(e){if(!fSet.has(e.name.toLowerCase()))lists.nfb.push(e);else lists.mutuals.push(e);});
followers.forEach(function(e){if(!gSet.has(e.name.toLowerCase()))lists.fans.push(e);});

var nfbNames=lists.nfb.map(function(e){return e.name;}).sort();
assert(nfbNames.join(',')==='eve,frank','nfb = eve,frank (case-insensitive matching): got '+nfbNames.join(','));
assert(lists.nfb.length===2,'nfb count = 2');
assert(lists.mutuals.length===3,'mutuals count = 3');
assert(lists.fans.length===1&&lists.fans[0].name==='dave','fans = dave only');

/* No duplicates in nfb */
var seen=new Set(),dup=false;
lists.nfb.forEach(function(e){var k=e.name.toLowerCase();if(seen.has(k))dup=true;seen.add(k);});
assert(!dup,'no duplicate entries in nfb list');

/* Everyone in nfb is genuinely absent from followers (case-insensitive) */
var missing=lists.nfb.filter(function(e){return fSet.has(e.name.toLowerCase());});
assert(missing.length===0,'nfb contains no one who follows back');

/* nfb + mutuals partition the following list exactly */
assert(lists.nfb.length+lists.mutuals.length===following.length,'nfb + mutuals == total following');
console.log('E2E done. exit code '+process.exitCode);