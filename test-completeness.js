/* Completeness test: every account in the export must be counted, on all schemas */
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
  if(typeof node.href==='string'||typeof node.timestamp==='number'){
    var ln=null,lts=(typeof node.timestamp==='number')?node.timestamp:null;
    if(typeof node.href==='string'){
      var lm=node.href.match(/instagram\.com\/(?:_u\/)?([^\/\?]+)/);
      if(lm)ln=lm[1];
    }
    if(!ln&&typeof node.title==='string'&&node.title)ln=node.title;
    if(ln)setUser(out,ln,lts);
    return;
  }
  if(typeof node.value==='string'&&node.value){
    var ts2=(typeof node.timestamp==='number')?node.timestamp:null;
    setUser(out,node.value,ts2);
  }
  for(var k in node)collectUsers(node[k],out,depth+1);
}
function parseJson(text,fileName){
  text=String(text).replace(/^\uFEFF+/,'');
  if(/^PK/.test(text))throw new Error('ZIP');
  var data=JSON.parse(text);
  var out=new Map();
  collectUsers(data,out,0);
  var arr=[];out.forEach(function(v){arr.push({name:v.name,ts:v.ts});});
  return arr;
}
function assert(cond,msg){if(!cond){console.error('FAIL:',msg);process.exitCode=1;}else console.log('ok:',msg);}

/* 1. Legacy title+href schema (previously LOST accounts) */
var legacy=JSON.stringify({following:[
  {title:"bob",href:"https://www.instagram.com/bob"},
  {title:"carol",href:"https://www.instagram.com/carol"},
  {title:"dave",href:"https://www.instagram.com/dave"}
]});
var r1=parseJson(legacy);
assert(r1.length===3,'legacy title/href schema: all 3 counted (was 0 before fix): got '+r1.length);
assert(r1.every(function(e){return ['bob','carol','dave'].indexOf(e.name)>=0;}),'legacy names extracted from href');

/* 2. Legacy array-of-plain-strings schema */
var r2=parseJson(JSON.stringify({following:["erin","frank"]}));
assert(r2.length===2,'legacy plain-string schema: 2 counted');

/* 3. Mixed schemas across files merge without loss */
var modern=JSON.stringify({relationships_following:[{string_list_data:[{value:"grace",timestamp:1},{value:"bob",timestamp:2}]}]});
var merged=parseJson(legacy).concat(parseJson(modern));
var total=new Map();
merged.forEach(function(e){var k=keyOf(e.name);if(!total.has(k))total.set(k,e);});
assert(total.size===4,'mixed-schema merge: 4 unique (bob counted once across schemas): got '+total.size);

/* 4. ZIP file rejected with clear message */
try{parseJson('PK\u0003\u0004-binary-garbage','followers.zip');console.error('FAIL: zip not rejected');process.exitCode=1;}
catch(e){assert(e.message.indexOf('ZIP')>=0,'zip file rejected with helpful message: '+e.message);}

/* 5. BOM + CRLF + trailing newline (Windows-edited file) */
var winEdited='\uFEFF{"followers":\r\n[\r\n{"string_list_data":[{"value":"heidi","timestamp":1}]}\r\n]\r\n}';
assert(parseJson(winEdited).length===1,'Windows-edited file (BOM + CRLF) parses fully');

/* 6. No loss: 5000-entry file parsed completely */
var big=[];for(var i=0;i<5000;i++)big.push({string_list_data:[{value:'u'+i,timestamp:i}]});
var r6=parseJson(JSON.stringify({followers:big}));
assert(r6.length===5000,'large file: all 5000 entries counted');
console.log('done. exit code '+process.exitCode);