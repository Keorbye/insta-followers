/* Crash test: adversarial inputs against the app logic */
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
  text=String(text).replace(/^\uFEFF+/,'');
  var data=JSON.parse(text);
  var out=new Map();
  collectUsers(data,out,0);
  var arr=[];
  out.forEach(function(v){arr.push({name:v.name,ts:v.ts});});
  return arr;
}
var crashes=0;
function t(label,fn){
  try{var r=fn();console.log('ok  :',label,'->',JSON.stringify(r));}
  catch(e){crashes++;console.error('CRASH:',label,'->',e.message);}
}

/* 1. File starting with UTF-8 BOM (Notepad "UTF-8 with BOM" save) */
t('BOM-prefixed JSON',function(){
  var a=parseJson('\uFEFF{"followers":[{"string_list_data":[{"value":"alice","timestamp":1}]}]}');
  return a.length;
});

/* 2. Empty / whitespace file */
t('empty string',function(){return parseJson('');});
t('whitespace only',function(){return parseJson('   \n  ');});

/* 3. JSON that is null / number / string */
t('null literal',function(){return parseJson('null');});
t('number literal',function(){return parseJson('42');});
t('string literal',function(){return parseJson('"hello"');});
t('empty object',function(){return parseJson('{}');});
t('empty array',function(){return parseJson('[]');});

/* 4. Wrong types inside string_list_data */
t('sld with number value',function(){return parseJson('{"followers":[{"string_list_data":[{"value":123,"timestamp":1}]}]}').length;});
t('sld with null entries',function(){return parseJson('{"followers":[{"string_list_data":[null,null]}]}').length;});
t('sld not array',function(){return parseJson('{"followers":{"string_list_data":"oops"}}').length;});
t('timestamp as string',function(){return parseJson('{"followers":[{"string_list_data":[{"value":"a","timestamp":"123"}]}]}').length;});

/* 5. Deeply nested structure (depth limit) */
t('deep nesting 30 levels',function(){
  var o={value:"deepuser",timestamp:5};var n={value:"deepuser",timestamp:5};
  var root=n;for(var i=0;i<30;i++){root.next={value:"deepuser",timestamp:5};root=root.next;}
  return parseJson(JSON.stringify(n)).length;
});

/* 6. Hostile keys (__proto__, constructor) */
t('__proto__ key in JSON',function(){
  var a=parseJson('{"followers":[{"string_list_data":[{"value":"x","timestamp":1}]}],"__proto__":{"polluted":true}}');
  return a.length;
});

/* 7. Unicode / emoji usernames, very long names */
t('unicode username',function(){return parseJson('{"followers":[{"string_list_data":[{"value":"\\ud83d\\ude00_user","timestamp":1}]}]}').length;});
t('10k-char username',function(){return parseJson('{"followers":[{"string_list_data":[{"value":"'+'a'.repeat(10000)+'","timestamp":1}]}]}').length;});

/* 8. ts edge: timestamp 0 */
t('timestamp 0',function(){
  var a=parseJson('{"followers":[{"string_list_data":[{"value":"a","timestamp":0}]}]}');
  return [a.length,a[0].ts];
});

/* 9. Huge array (100k entries) perf sanity */
t('100k users',function(){
  var arr=[];for(var i=0;i<100000;i++)arr.push({string_list_data:[{value:'user_'+i,timestamp:i}]});
  var start=Date.now();
  var a=parseJson(JSON.stringify({followers:arr}));
  return [a.length,(Date.now()-start)+'ms'];
});

/* 10. Duplicate identical users within one file */
t('same user 3x one file',function(){
  var a=parseJson('{"followers":[{"string_list_data":[{"value":"a","timestamp":9},{"value":"a","timestamp":3},{"value":"A","timestamp":7}]}]}');
  return [a.length,a[0].ts];
});

/* 11. href fallback with odd URLs */
t('href with query + trailing',function(){
  var a=parseJson('{"followers":[{"title":"x","string_list_data":[{"href":"https://www.instagram.com/_u/bob?hl=en/"}]}]}');
  return a;
});

/* 12. csv date with null ts (replicating csvEsc section logic) */
t('csv row null ts',function(){
  var e={name:'x',ts:null};
  return e.ts?new Date(e.ts*1000).toISOString().slice(0,10):'';
});

/* 13. HTML file detection (browser-side regex replicated) */
t('HTML file rejected',function(){
  var text='<!DOCTYPE html><html><body>login</body></html>';
  if(/^\s*<(!doctype|html)/i.test(text))throw new Error('This is an HTML file.');
  return 'no-crash-but-should-reject';
});

console.log(crashes?('CRASHES: '+crashes):'ALL INPUTS HANDLED');process.exitCode=crashes?1:0;