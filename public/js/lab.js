/* ROS2Lab live lab: an Ubuntu 24.04 desktop with Terminator and turtlesim (ROS 2 Jazzy). Home page only.
   From docs/redesign/lab/lab.js. Site changes: names, topics and values the student can choose (node remaps, topic
   names, spawned turtles, --field values, Tab completion lists) go through esc() before p.out(); the command chips
   use the class lchip (app.css styles .chip); window.__lab exists only with ?debug=1. */
(function(){
'use strict';
var lab=document.getElementById('lab');if(!lab)return;
var desk=document.getElementById('desk');
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var W=Math.fround(11.088889),PX=500,CENTER=Math.fround(W/2);
var HOME='/home/student';

/* ---------- helpers ---------- */
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function pyf(v){var s=String(v);if(/^-?\d+$/.test(s))s+='.0';if(s==='-0.0')s='-0.0';return s;}
function f32(v){return pyf(Math.fround(v));}
function fix6(v){return Number(v).toFixed(6);}
function stamp(){var ms=Date.now();return Math.floor(ms/1000)+'.'+String(ms%1000).padStart(3,'0')+String(Math.floor(Math.random()*1e6)).padStart(6,'0');}
function logl(lvl,name,msg){var c=lvl==='WARN'?'lw':lvl==='ERROR'?'le':'';var t='['+lvl+'] ['+stamp()+'] ['+name+']: '+msg;return c?'<span class="'+c+'">'+esc(t)+'</span>':esc(t);}
function note(t){return '<span class="lnote">'+esc(t)+'</span>';}
function norm(a){while(a>Math.PI)a-=2*Math.PI;while(a<=-Math.PI)a+=2*Math.PI;return a;}
function uuid(){var s='';for(var i=0;i<32;i++)s+='0123456789abcdef'[Math.floor(Math.random()*16)];return s;}
function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
var pidSeq=4210;

/* ---------- interfaces ---------- */
var MSG={
 'geometry_msgs/msg/Twist':{py:'geometry_msgs.msg.Twist',f:[['linear','geometry_msgs/msg/Vector3'],['angular','geometry_msgs/msg/Vector3']]},
 'geometry_msgs/msg/Vector3':{py:'geometry_msgs.msg.Vector3',f:[['x','float64'],['y','float64'],['z','float64']]},
 'turtlesim/msg/Pose':{py:'turtlesim.msg.Pose',f:[['x','float32'],['y','float32'],['theta','float32'],['linear_velocity','float32'],['angular_velocity','float32']]},
 'turtlesim/msg/Color':{py:'turtlesim.msg.Color',f:[['r','uint8'],['g','uint8'],['b','uint8']]},
 'std_msgs/msg/String':{py:'std_msgs.msg.String',f:[['data','string']]}
};
var SRV={
 'std_srvs/srv/Empty':{py:'std_srvs.srv.Empty',req:[],res:[]},
 'turtlesim/srv/Spawn':{py:'turtlesim.srv.Spawn',req:[['x','float32'],['y','float32'],['theta','float32'],['name','string']],res:[['name','string']]},
 'turtlesim/srv/Kill':{py:'turtlesim.srv.Kill',req:[['name','string']],res:[]},
 'turtlesim/srv/SetPen':{py:'turtlesim.srv.SetPen',req:[['r','uint8'],['g','uint8'],['b','uint8'],['width','uint8'],['off','uint8']],res:[]},
 'turtlesim/srv/TeleportAbsolute':{py:'turtlesim.srv.TeleportAbsolute',req:[['x','float32'],['y','float32'],['theta','float32']],res:[]},
 'turtlesim/srv/TeleportRelative':{py:'turtlesim.srv.TeleportRelative',req:[['linear','float32'],['angular','float32']],res:[]}
};
var ACT={'turtlesim/action/RotateAbsolute':{goal:[['theta','float32']],res:[['delta','float32']],fb:[['remaining','float32']]}};
var IFACE={
 'geometry_msgs/msg/Twist':'# This expresses velocity in free space broken into its linear and angular parts.\n\nVector3  linear\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z\nVector3  angular\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z',
 'geometry_msgs/msg/Vector3':'# This represents a vector in free space.\n\n# This is semantically different than a point.\n# A vector is always anchored at the origin.\n# When a transform is applied to a vector, only the rotational component is applied.\n\nfloat64 x\nfloat64 y\nfloat64 z',
 'turtlesim/msg/Pose':'float32 x\nfloat32 y\nfloat32 theta\n\nfloat32 linear_velocity\nfloat32 angular_velocity',
 'turtlesim/msg/Color':'uint8 r\nuint8 g\nuint8 b',
 'std_msgs/msg/String':'# This was originally provided as an example message.\n# It is deprecated as of Foxy\n# It is recommended to create your own semantically meaningful message.\n# However if you would like to continue using this please use the equivalent in example_msgs.\n\nstring data',
 'std_srvs/srv/Empty':'---',
 'turtlesim/srv/Spawn':'float32 x\nfloat32 y\nfloat32 theta\nstring name # Optional.  A unique name will be created and returned if this is empty\n---\nstring name',
 'turtlesim/srv/Kill':'string name\n---',
 'turtlesim/srv/SetPen':'uint8 r\nuint8 g\nuint8 b\nuint8 width\nuint8 off\n---',
 'turtlesim/srv/TeleportAbsolute':'float32 x\nfloat32 y\nfloat32 theta\n---',
 'turtlesim/srv/TeleportRelative':'float32 linear\nfloat32 angular\n---',
 'turtlesim/action/RotateAbsolute':'# The desired heading in radians\nfloat32 theta\n---\n# The angular displacement in radians to the starting position\nfloat32 delta\n---\n# The remaining rotation in radians\nfloat32 remaining'
};
function defaults(fields,src){var o={};fields.forEach(function(f){var t=f[1];if(MSG[t])o[f[0]]=defaults(MSG[t].f);else if(t==='string')o[f[0]]='';else o[f[0]]=0;});return o;}
function fill(fields,cls,data){
  var o=defaults(fields);if(data==null)return o;
  if(typeof data!=='object'||data.__n!==undefined)throw new Error('The passed value needs to be a dictionary in YAML format');
  Object.keys(data).forEach(function(k){
    var f=fields.find(function(x){return x[0]===k;});
    if(!f)throw new Error("Failed to populate field: '"+cls+"' object has no attribute '"+k+"'");
    var t=f[1],v=data[k];
    if(MSG[t]){o[k]=fill(MSG[t].f,MSG[t].py.split('.').pop(),v);return;}
    if(t==='string'){if(typeof v==='string')o[k]=v;else if(typeof v==='boolean')o[k]=v?'True':'False';else if(v&&v.__n!==undefined)o[k]=v.__i?String(v.__n):pyf(v.__n);else throw new Error("Failed to populate field: The '"+k+"' field must be of type 'str'");return;}
    if(v===true||v===false)v={__n:v?1:0,__i:true};
    if(typeof v!=='object'||v.__n===undefined)throw new Error("Failed to populate field: The '"+k+"' field must be of type 'float'");
    if(t==='uint8'){v={__n:Math.trunc(v.__n),__i:true};if(v.__n<0||v.__n>255)throw new Error("Failed to populate field: The '"+k+"' field must be an unsigned integer in [0, 255]");}
    o[k]=v.__n;
  });
  return o;
}
function repr(fields,py,o){return py+'('+fields.map(function(f){var t=f[1],v=o[f[0]];if(MSG[t])return f[0]+'='+repr(MSG[t].f,MSG[t].py,v);if(t==='string')return f[0]+"='"+v+"'";if(t==='uint8')return f[0]+'='+v;return f[0]+'='+pyf(v);}).join(', ')+')';}
function yaml(fields,o,ind){ind=ind||'';return fields.map(function(f){var t=f[1],v=o[f[0]];if(MSG[t])return ind+f[0]+':\n'+yaml(MSG[t].f,v,ind+'  ');if(t==='string')return ind+f[0]+": '"+v+"'";if(t==='uint8')return ind+f[0]+': '+v;if(t==='float32')return ind+f[0]+': '+f32(v);return ind+f[0]+': '+pyf(v);}).join('\n');}

/* ---------- tiny YAML (flow style) parser ---------- */
function scalar(t){
  if(/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t))return {__n:+t,__i:/^[-+]?\d+$/.test(t)};
  if(/^(true|True|TRUE)$/.test(t))return true;if(/^(false|False|FALSE)$/.test(t))return false;
  return t;
}
function parseYaml(s){
  s=(s||'').trim();if(!s)return null;
  if(s[0]!=='{')s='{'+s+'}';
  var i=0;function ws(){while(i<s.length&&/\s/.test(s[i]))i++;}
  function q(){var c=s[i++],st=i;while(i<s.length&&s[i]!==c)i++;if(i>=s.length)throw 0;var r=s.slice(st,i);i++;return r;}
  function val(){ws();if(s[i]==='{')return obj();if(s[i]==='"'||s[i]==="'")return q();var st=i;while(i<s.length&&!/[,}]/.test(s[i]))i++;return scalar(s.slice(st,i).trim());}
  function key(){ws();if(s[i]==='"'||s[i]==="'")return q();var st=i;while(i<s.length&&s[i]!==':'&&s[i]!=='}'&&s[i]!==',')i++;return s.slice(st,i).trim();}
  function obj(){i++;var o={};ws();if(s[i]==='}'){i++;return o;}
    while(i<s.length){var k=key();ws();if(s[i]!==':')throw 0;i++;o[k]=val();ws();if(s[i]===','){i++;continue;}if(s[i]==='}'){i++;return o;}throw 0;}throw 0;}
  var r=obj();ws();if(i<s.length)throw 0;return r;
}

/* ---------- message bus and ROS graph ---------- */
var bus={};
function subscribe(topic,cb){(bus[topic]=bus[topic]||[]).push(cb);return function(){bus[topic]=(bus[topic]||[]).filter(function(x){return x!==cb;});};}
function publish(topic,msg){(bus[topic]||[]).slice().forEach(function(cb){cb(msg);});}
function hasSubs(topic){return (bus[topic]||[]).length>0;}
var nodes=[];// {name, hidden, info()}
function addNode(n){nodes.push(n);graphDirty();return n;}
function removeNode(n){nodes=nodes.filter(function(x){return x!==n;});graphDirty();}
function visibleNodes(){return nodes.filter(function(n){return !n.hidden;});}
function findNode(name){return visibleNodes().find(function(n){return n.name===name;});}
var BASE_PUBS={'/parameter_events':'rcl_interfaces/msg/ParameterEvent','/rosout':'rcl_interfaces/msg/Log'};
function paramServices(n){var b='/'+n.replace(/^\//,'');return [[b+'/describe_parameters','rcl_interfaces/srv/DescribeParameters'],[b+'/get_parameter_types','rcl_interfaces/srv/GetParameterTypes'],[b+'/get_parameters','rcl_interfaces/srv/GetParameters'],[b+'/get_type_description','type_description_interfaces/srv/GetTypeDescription'],[b+'/list_parameters','rcl_interfaces/srv/ListParameters'],[b+'/set_parameters','rcl_interfaces/srv/SetParameters'],[b+'/set_parameters_atomically','rcl_interfaces/srv/SetParametersAtomically']];}
function allTopics(hidden){
  var m={'/parameter_events':'rcl_interfaces/msg/ParameterEvent','/rosout':'rcl_interfaces/msg/Log'};
  nodes.forEach(function(n){if(n.hidden&&!hidden&&!n.cli)return;var i=n.info();i.pubs.concat(i.subs).forEach(function(p){m[p[0]]=p[1];});});
  return m;
}
function counts(topic){var pc=0,sc=0,pn=[],sn=[];nodes.forEach(function(n){var i=n.info();if(i.pubs.some(function(p){return p[0]===topic;})){pc++;pn.push(n);}if(i.subs.some(function(p){return p[0]===topic;})){sc++;sn.push(n);}});return {pc:pc,sc:sc,pn:pn,sn:sn};}
function allServices(){var m={};nodes.forEach(function(n){if(n.cli)return;n.info().srvs.forEach(function(s){m[s[0]]=s[1];});});return m;}
function allActions(){var m={};nodes.forEach(function(n){var i=n.info();(i.asrv||[]).concat(i.acli||[]).forEach(function(a){m[a[0]]=a[1];});});return m;}
function qosParams(){return {'qos_overrides./parameter_events.publisher.depth':{t:'integer',v:1000,ro:true},'qos_overrides./parameter_events.publisher.durability':{t:'string',v:'volatile',ro:true},'qos_overrides./parameter_events.publisher.history':{t:'string',v:'keep_last',ro:true},'qos_overrides./parameter_events.publisher.reliability':{t:'string',v:'reliable',ro:true},'start_type_description_service':{t:'bool',v:true,ro:true},'use_sim_time':{t:'bool',v:false}};}

/* ---------- turtlesim ---------- */
var SIM=null,simTimer=null;
var simWin=document.getElementById('w-sim'),cvP=document.getElementById('cv-path'),cvS=document.getElementById('cv-spr');
var cP=cvP.getContext('2d'),cS=cvS.getContext('2d');
var SHELLS=[['#3E8E41','#2B6B2E'],['#C89B2C','#8A6A17'],['#3A7BC8','#22558F'],['#9B59B6','#6C3483'],['#D35454','#922B2B'],['#1ABC9C','#117A65']];
function bgColor(){return 'rgb('+SIM.params.background_r.v+','+SIM.params.background_g.v+','+SIM.params.background_b.v+')';}
function paintBg(){cvP.parentNode.style.background=bgColor();}
function clearPaths(){cP.clearRect(0,0,PX,PX);paintBg();}
function tpx(x){return x/W*PX;}function tpy(y){return PX-y/W*PX;}
function simLog(lvl,msg){if(SIM)SIM.pane.out(logl(lvl,SIM.name,msg));}
function spawnTurtle(name,x,y,th){
  var t={name:name,x:Math.fround(x),y:Math.fround(y),th:Math.fround(th),lin:0,liny:0,ang:0,last:-1e9,pen:{r:179,g:184,b:255,w:3,off:false},rot:null,shell:SHELLS[(SIM.spawned++)%SHELLS.length],wall:0};
  t.unsub=subscribe('/'+name+'/cmd_vel',function(m){if(t.rot){simLog('WARN','Velocity command received during rotation goal. Aborting goal');abortRot(t,'ABORTED');}t.lin=m.linear.x;t.liny=m.linear.y;t.ang=m.angular.z;t.last=performance.now();});
  SIM.turtles[name]=t;SIM.order.push(name);
  simLog('INFO','Spawning turtle ['+name+'] at x=['+fix6(x)+'], y=['+fix6(y)+'], theta=['+fix6(th)+']');
  graphDirty();return t;
}
function removeTurtle(name){var t=SIM.turtles[name];if(!t)return;t.unsub();if(t.rot)abortRot(t,'ABORTED');delete SIM.turtles[name];SIM.order=SIM.order.filter(function(n){return n!==name;});graphDirty();}
function abortRot(t,status){var r=t.rot;t.rot=null;t.ang=0;if(r&&r.done)r.done(status,norm(r.start-t.th));}
function startSim(p,name){
  SIM={name:name||'turtlesim',pane:p,turtles:{},order:[],spawned:0,idc:0,holo:false,
    params:Object.assign({background_b:{t:'integer',v:255,d:'Blue channel of the background color',rng:[0,255]},background_g:{t:'integer',v:86,d:'Green channel of the background color',rng:[0,255]},background_r:{t:'integer',v:69,d:'Red channel of the background color',rng:[0,255]},holonomic:{t:'bool',v:false,d:'If true, then turtles will be holonomic'}},qosParams())};
  SIM.node=addNode({name:'/'+SIM.name,params:SIM.params,info:function(){
    var subs=[['/parameter_events','rcl_interfaces/msg/ParameterEvent']],pubs=[['/parameter_events','rcl_interfaces/msg/ParameterEvent'],['/rosout','rcl_interfaces/msg/Log']],srvs=[['/clear','std_srvs/srv/Empty'],['/kill','turtlesim/srv/Kill'],['/reset','std_srvs/srv/Empty'],['/spawn','turtlesim/srv/Spawn']],asrv=[];
    SIM.order.forEach(function(n){subs.push(['/'+n+'/cmd_vel','geometry_msgs/msg/Twist']);pubs.push(['/'+n+'/color_sensor','turtlesim/msg/Color'],['/'+n+'/pose','turtlesim/msg/Pose']);srvs.push(['/'+n+'/set_pen','turtlesim/srv/SetPen'],['/'+n+'/teleport_absolute','turtlesim/srv/TeleportAbsolute'],['/'+n+'/teleport_relative','turtlesim/srv/TeleportRelative']);asrv.push(['/'+n+'/rotate_absolute','turtlesim/action/RotateAbsolute']);});
    srvs=srvs.concat(paramServices(SIM.name));
    return {subs:subs.sort(),pubs:pubs.sort(),srvs:srvs.sort(),cli:[],asrv:asrv.sort(),acli:[]};}});
  SIM.node.onParam=function(k){if(/^background_/.test(k))paintBg();if(k==='holonomic')SIM.holo=SIM.params.holonomic.v;};
  p.out(logl('INFO',SIM.name,'Starting turtlesim with node name /'+SIM.name));
  clearPaths();
  SIM.idc=1;spawnTurtle('turtle1',CENTER,CENTER,0);
  simWin.hidden=false;raise(simWin);fitSim();
  var last=performance.now();
  simTimer=setInterval(function(){var now=performance.now();var dt=Math.min(0.05,(now-last)/1000);last=now;tick(dt,now);},16);
  return {name:'turtlesim_node',kill:function(sig){stopSim(sig);}};
}
function stopSim(sig){
  if(!SIM)return;var p=SIM.pane;clearInterval(simTimer);SIM.order.slice().forEach(removeTurtle);removeNode(SIM.node);
  if(sig)p.out(logl('INFO','rclcpp','signal_handler(signum=2)'));
  SIM=null;simWin.hidden=true;cS.clearRect(0,0,PX,PX);
}
function tick(dt,now){
  if(!SIM)return;
  SIM.order.forEach(function(n){
    var t=SIM.turtles[n];if(!t)return;
    if(t.rot){var rem=norm(t.rot.target-t.th);t.lin=0;t.liny=0;
      if(Math.abs(rem)<0.02){var r=t.rot;t.rot=null;t.ang=0;simLog('INFO','Rotation goal completed successfully');if(r.done)r.done('SUCCEEDED',norm(r.start-t.th));}
      else{t.ang=rem<0?-1:1;t.last=now;if(t.rot.fb)t.rot.fb(rem);}}
    else if(now-t.last>1000){t.lin=0;t.liny=0;t.ang=0;}
    var ox=t.x,oy=t.y,ly=SIM.holo?t.liny:0;
    t.th=Math.fround(norm(t.th+t.ang*dt));
    var nx=t.x+(Math.cos(t.th)*t.lin-Math.sin(t.th)*ly)*dt,ny=t.y+(Math.sin(t.th)*t.lin+Math.cos(t.th)*ly)*dt;
    if(nx<0||nx>W||ny<0||ny>W){if(now-t.wall>500){simLog('WARN','Oh no! I hit the wall! (Clamping from [x='+fix6(nx)+', y='+fix6(ny)+'])');t.wall=now;}nx=Math.max(0,Math.min(W,nx));ny=Math.max(0,Math.min(W,ny));}
    t.x=Math.fround(nx);t.y=Math.fround(ny);
    if(!t.pen.off&&(t.x!==ox||t.y!==oy))line(t,ox,oy,t.x,t.y);
    if(hasSubs('/'+n+'/pose'))publish('/'+n+'/pose',{x:t.x,y:t.y,theta:t.th,linear_velocity:t.lin,angular_velocity:t.ang});
    if(hasSubs('/'+n+'/color_sensor')){var d=cP.getImageData(Math.max(0,Math.min(PX-1,Math.round(tpx(t.x)))),Math.max(0,Math.min(PX-1,Math.round(tpy(t.y)))),1,1).data;publish('/'+n+'/color_sensor',d[3]<128?{r:SIM.params.background_r.v,g:SIM.params.background_g.v,b:SIM.params.background_b.v}:{r:d[0],g:d[1],b:d[2]});}
  });
  drawSprites();
}
function line(t,x0,y0,x1,y1){cP.strokeStyle='rgb('+t.pen.r+','+t.pen.g+','+t.pen.b+')';cP.lineWidth=t.pen.w;cP.lineCap='round';cP.beginPath();cP.moveTo(tpx(x0),tpy(y0));cP.lineTo(tpx(x1),tpy(y1));cP.stroke();}
function drawSprites(){
  cS.clearRect(0,0,PX,PX);if(!SIM)return;
  SIM.order.forEach(function(n){var t=SIM.turtles[n];cS.save();cS.translate(tpx(t.x),tpy(t.y));cS.rotate(-t.th);
    var sh=t.shell;cS.lineWidth=1.6;cS.strokeStyle=sh[1];cS.fillStyle='#9ACD6B';
    [[9,-10],[9,10],[-9,-10],[-9,10]].forEach(function(l){cS.beginPath();cS.ellipse(l[0],l[1],5,3.4,l[1]>0?0.5:-0.5,0,7);cS.fill();cS.stroke();});
    cS.beginPath();cS.moveTo(-14,0);cS.lineTo(-19,0);cS.stroke();
    cS.beginPath();cS.ellipse(18,0,5.5,4.6,0,0,7);cS.fill();cS.stroke();
    cS.fillStyle=sh[0];cS.beginPath();cS.ellipse(0,0,14,11.5,0,0,7);cS.fill();cS.stroke();
    cS.strokeStyle='rgba(0,0,0,.35)';cS.beginPath();cS.ellipse(0,0,7,5.5,0,0,7);cS.moveTo(-14,0);cS.lineTo(-7,0);cS.moveTo(7,0);cS.lineTo(14,0);cS.moveTo(0,-11.5);cS.lineTo(0,-5.5);cS.moveTo(0,5.5);cS.lineTo(0,11.5);cS.stroke();
    cS.fillStyle='#111';cS.beginPath();cS.arc(20,-2,1.1,0,7);cS.arc(20,2,1.1,0,7);cS.fill();
    cS.restore();});
}
/* service handlers: return response object or throw */
function simService(name,req){
  if(name==='/clear'){simLog('INFO','Clearing turtlesim.');clearPaths();return {};}
  if(name==='/reset'){simLog('INFO','Resetting turtlesim.');SIM.order.slice().forEach(removeTurtle);SIM.spawned=0;clearPaths();SIM.idc=1;spawnTurtle('turtle1',CENTER,CENTER,0);return {};}
  if(name==='/spawn'){var nm=req.name;if(!nm){do{nm='turtle'+(++SIM.idc);}while(SIM.turtles[nm]);}
    else if(SIM.turtles[nm]){simLog('ERROR','A turtle named ['+nm+'] already exists');return {name:''};}
    spawnTurtle(nm,req.x,req.y,req.theta);return {name:nm};}
  if(name==='/kill'){if(!SIM.turtles[req.name]){simLog('ERROR','Tried to kill turtle ['+req.name+'], which does not exist');return {};}removeTurtle(req.name);return {};}
  var m=name.match(/^\/([^/]+)\/(set_pen|teleport_absolute|teleport_relative)$/);var t=m&&SIM.turtles[m[1]];
  if(t&&m[2]==='set_pen'){t.pen={r:req.r,g:req.g,b:req.b,w:req.width,off:!!req.off};return {};}
  if(t&&m[2]==='teleport_absolute'){var ox=t.x,oy=t.y;t.x=Math.fround(req.x);t.y=Math.fround(req.y);t.th=Math.fround(norm(req.theta));if(!t.pen.off)line(t,ox,oy,t.x,t.y);drawSprites();return {};}
  if(t&&m[2]==='teleport_relative'){var ox2=t.x,oy2=t.y;t.th=Math.fround(norm(t.th+req.angular));t.x=Math.fround(Math.max(0,Math.min(W,t.x+Math.cos(t.th)*req.linear)));t.y=Math.fround(Math.max(0,Math.min(W,t.y+Math.sin(t.th)*req.linear)));if(!t.pen.off)line(t,ox2,oy2,t.x,t.y);drawSprites();return {};}
  return null;
}
function simRotate(turtle,theta,fb,done){var t=SIM&&SIM.turtles[turtle];if(!t)return false;if(t.rot){simLog('WARN','Rotation goal received before a previous goal finished. Aborting previous goal');abortRot(t,'ABORTED');}t.rot={target:norm(theta),start:t.th,fb:fb,done:done};return true;}

/* ---------- Terminator: panes, splits, tabs ---------- */
var tbody=document.getElementById('tbody'),tabsBar=document.getElementById('tabs'),termWin=document.getElementById('w-term'),termTitle=document.getElementById('termTitle');
var tabs=[],cur=0,paneSeq=0,focused=null;
function promptHtml(p){return '<span class="pu">student@ros2lab</span>:<span class="pd">'+esc(p.cwd)+'</span>$ ';}
function titleOf(p){return 'student@ros2lab: '+p.cwd;}
function makePane(){
  var p={id:++paneSeq,hist:[],hidx:0,buf:'',cwd:'~',proc:null,queue:[],bg:[],tabHit:0};
  var e=el('div','tpane');e.innerHTML='<div class="ttl"><i aria-hidden="true"></i><span></span></div><div class="tscroll"><span class="tout"></span><span class="tin"><span class="tps"></span><span class="tbuf"></span><span class="tcur"> </span></span></div><textarea class="tkey" rows="1" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Terminal input"></textarea>';
  p.el=e;p.ttl=e.querySelector('.ttl span');p.scr=e.querySelector('.tscroll');p.outEl=e.querySelector('.tout');p.tin=e.querySelector('.tin');p.tps=e.querySelector('.tps');p.tbuf=e.querySelector('.tbuf');p.key=e.querySelector('.tkey');
  p.out=function(html){if(p.filter){html=p.filter(html);if(html==null)return;}var near=p.scr.scrollHeight-p.scr.scrollTop-p.scr.clientHeight<60;var s=el('span','',html+'\n');p.outEl.appendChild(s);while(p.outEl.childNodes.length>700)p.outEl.removeChild(p.outEl.firstChild);if(near||true)p.scr.scrollTop=p.scr.scrollHeight;};
  p.refresh=function(){p.tps.innerHTML=promptHtml(p);p.tbuf.textContent=p.buf;p.tin.hidden=!!p.proc;p.ttl.textContent=titleOf(p);if(focused===p)termTitle.textContent=titleOf(p);p.scr.scrollTop=p.scr.scrollHeight;};
  e.addEventListener('mousedown',function(ev){touched=true;if(ev.button===0)setTimeout(function(){focusPane(p);},0);});
  e.addEventListener('contextmenu',function(ev){ev.preventDefault();focusPane(p);openCtx(ev.clientX,ev.clientY);});
  p.key.addEventListener('keydown',function(ev){onKey(p,ev);});
  p.key.addEventListener('input',function(){var v=p.key.value;p.key.value='';if(!v)return;stopDemo();if(p.proc){if(p.proc.text)p.proc.text(v);return;}typeText(p,v);});
  p.key.addEventListener('paste',function(ev){ev.preventDefault();stopDemo();var t=(ev.clipboardData||window.clipboardData).getData('text');pasteText(p,t);});
  p.key.addEventListener('focus',function(){setFocusUI(p);});
  p.refresh();return p;
}
function pasteText(p,t){if(p.proc)return;var ls=t.replace(/\r/g,'').split('\n');ls.forEach(function(l,i){if(i<ls.length-1){p.buf+=l;enter(p);}else typeText(p,l);});}
function typeText(p,v){if(/\n/.test(v)){pasteText(p,v);return;}p.buf+=v;p.tabHit=0;p.refresh();}
function setFocusUI(p){focused=p;eachPane(function(q){q.el.classList.toggle('focus',q===p);});termTitle.textContent=titleOf(p);if(tabs[cur])tabs[cur].focus=p;renderTabsBar();}
function focusPane(p){setFocusUI(p);try{p.key.focus({preventScroll:true});}catch(e){p.key.focus();}}
function eachPane(fn,node){node=node||(tabs[cur]&&tabs[cur].root);if(!node)return;if(node.t==='p')fn(node.p);else{eachPane(fn,node.a);eachPane(fn,node.b);}}
function allPanes(){var r=[];tabs.forEach(function(t){(function w(n){if(n.t==='p')r.push(n.p);else{w(n.a);w(n.b);}})(t.root);});return r;}
function build(n){if(n.t==='p')return n.p.el;var d=el('div','tsplit '+(n.dir==='h'?'sh':'sv'));var a=build(n.a),b=build(n.b);a.style.flex=n.ratio+' 1 0';b.style.flex=(1-n.ratio)+' 1 0';var h=el('div','hd');d.appendChild(a);d.appendChild(h);d.appendChild(b);dragHandle(h,n,d);return d;}
function dragHandle(h,n,d){h.addEventListener('pointerdown',function(ev){ev.preventDefault();h.setPointerCapture(ev.pointerId);var r=d.getBoundingClientRect();function mv(e){var f=n.dir==='h'?(e.clientY-r.top)/r.height:(e.clientX-r.left)/r.width;n.ratio=Math.max(.15,Math.min(.85,f));d.children[0].style.flex=n.ratio+' 1 0';d.children[2].style.flex=(1-n.ratio)+' 1 0';}function up(){h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);}h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);});}
function render(){tbody.innerHTML='';if(!tabs[cur])return;tbody.appendChild(build(tabs[cur].root));renderTabsBar();eachPane(function(p){p.scr.scrollTop=p.scr.scrollHeight;});}
function renderTabsBar(){tabsBar.hidden=tabs.length<2;tabsBar.innerHTML='';tabs.forEach(function(t,i){var b=el('button','ttab'+(i===cur?' on':''),'<span>'+esc(titleOf(t.focus))+'</span><b aria-label="Close tab">×</b>');b.type='button';b.addEventListener('click',function(ev){if(ev.target.tagName==='B'){closeTab(i);return;}cur=i;render();focusPane(tabs[cur].focus);});tabsBar.appendChild(b);});}
function findParent(node,leaf,parent){if(node===leaf)return parent;if(node.t==='s')return findParent(node.a,leaf,node)||findParent(node.b,leaf,node);return null;}
function findLeaf(node,p){if(node.t==='p')return node.p===p?node:null;return findLeaf(node.a,p)||findLeaf(node.b,p);}
function split(dir,p){p=p||focused;var tab=tabs[cur];if(!tab||!p)return null;if(allPanes().length>=6){p.out(note('ros2lab: this demo window holds up to 6 terminals.'));return null;}
  var leaf=findLeaf(tab.root,p);var np=makePane();var s={t:'s',dir:dir,ratio:.5,a:{t:'p',p:p},b:{t:'p',p:np}};
  var par=findParent(tab.root,leaf,null);if(!par)tab.root=s;else if(par.a===leaf)par.a=s;else par.b=s;
  render();focusPane(np);return np;}
function closePane(p){p=p||focused;if(!p)return;killAll(p);var tab=tabs.find(function(t){return findLeaf(t.root,p);});var ti=tabs.indexOf(tab);
  var leaf=findLeaf(tab.root,p);var par=findParent(tab.root,leaf,null);
  if(!par){closeTab(ti,true);return;}
  var sib=par.a===leaf?par.b:par.a;var gp=findParent(tab.root,par,null);if(!gp)tab.root=sib;else if(gp.a===par)gp.a=sib;else gp.b=sib;
  var first=sib;while(first.t!=='p')first=first.a;tab.focus=first.p;render();focusPane(first.p);}
function newTab(){var p=makePane();tabs.push({root:{t:'p',p:p},focus:p});cur=tabs.length-1;render();focusPane(p);return p;}
function closeTab(i,already){var t=tabs[i];if(!t)return;if(!already)(function w(n){if(n.t==='p')killAll(n.p);else{w(n.a);w(n.b);}})(t.root);tabs.splice(i,1);if(!tabs.length){termWin.hidden=true;document.getElementById('reopen').hidden=false;focused=null;return;}cur=Math.max(0,Math.min(cur,tabs.length-1));render();focusPane(tabs[cur].focus);}
function openTerminator(){termWin.hidden=false;document.getElementById('reopen').hidden=true;if(!tabs.length)newTab();raise(termWin);}
function killAll(p){if(p.proc){var pr=p.proc;p.proc=null;pr.kill(false);}p.bg.forEach(function(b){b.kill(false);});p.bg=[];}
function moveFocus(dir){if(!focused)return;var r0=focused.el.getBoundingClientRect(),cx=r0.left+r0.width/2,cy=r0.top+r0.height/2,best=null,bd=1e9;eachPane(function(q){if(q===focused)return;var r=q.el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,dx=x-cx,dy=y-cy;var ok=dir==='Left'?dx<-5:dir==='Right'?dx>5:dir==='Up'?dy<-5:dy>5;if(!ok)return;var d=Math.abs(dx)+Math.abs(dy);if(d<bd){bd=d;best=q;}});if(best)focusPane(best);}

/* context menu */
var ctx=document.getElementById('ctx');
function openCtx(x,y){var r=desk.getBoundingClientRect();ctx.hidden=false;ctx.style.left=Math.min(x-r.left,r.width-200)+'px';ctx.style.top=Math.min(y-r.top,r.height-ctx.offsetHeight-6)+'px';}
ctx.addEventListener('click',function(ev){var b=ev.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act');ctx.hidden=true;var p=focused;
  if(a==='copy'){var s=String(window.getSelection());if(s&&navigator.clipboard)navigator.clipboard.writeText(s).catch(function(){});}
  if(a==='paste'&&navigator.clipboard&&navigator.clipboard.readText)navigator.clipboard.readText().then(function(t){pasteText(p,t);}).catch(function(){});
  if(a==='sh')split('h');if(a==='sv')split('v');if(a==='tab')newTab();if(a==='close')closePane();if(a==='clear'&&p){p.outEl.innerHTML='';}
  if(p&&a!=='close')focusPane(focused);});
document.addEventListener('mousedown',function(ev){if(!ev.target.closest('#ctx'))ctx.hidden=true;});

/* windows: raise and drag */
var zTop=10;function raise(w){w.style.zIndex=++zTop;}
desk.querySelectorAll('.win').forEach(function(w){w.addEventListener('pointerdown',function(){raise(w);});var bar=w.querySelector('.wt');
  bar.addEventListener('pointerdown',function(ev){if(ev.target.closest('.wb')||window.innerWidth<760)return;ev.preventDefault();var r=w.getBoundingClientRect(),d=desk.getBoundingClientRect(),ox=ev.clientX-r.left,oy=ev.clientY-r.top;bar.setPointerCapture(ev.pointerId);
    function mv(e){var x=Math.max(-r.width+80,Math.min(d.width-80,e.clientX-d.left-ox)),y=Math.max(26,Math.min(d.height-34,e.clientY-d.top-oy));w.style.left=x+'px';w.style.top=y+'px';w.style.right='auto';}
    function up(){bar.removeEventListener('pointermove',mv);bar.removeEventListener('pointerup',up);}bar.addEventListener('pointermove',mv);bar.addEventListener('pointerup',up);});});
desk.addEventListener('click',function(ev){var b=ev.target.closest('.wb');if(!b)return;var w=b.closest('.win'),a=b.getAttribute('data-w');
  if(a==='close'){if(w===simWin&&SIM){var p=SIM.pane;var pr=p.proc;if(pr&&pr.name==='turtlesim_node'){p.proc=null;stopSim(false);procEnd(p);}else{p.bg=p.bg.filter(function(b){return b.name!=='turtlesim_node';});stopSim(false);}}
    else if(w===termWin){tabs.slice().forEach(function(t,i){});while(tabs.length)closeTab(0);}
    else if(w.id==='w-rqt'){w.hidden=true;rqtOpen=false;if(rqtPane){var rp=rqtPane;rqtPane=null;if(rp.proc&&rp.proc.name==='rqt_graph'){rp.proc=null;procEnd(rp);}}}}
  if(a==='max'){w.classList.toggle('max');if(w===simWin)fitSim();}
  if(a==='min'){w.classList.add('mini');setTimeout(function(){w.classList.remove('mini');},900);}});
document.getElementById('reopen').addEventListener('click',openTerminator);
function fitSim(){}

/* ---------- keyboard ---------- */
function onKey(p,ev){
  var k=ev.key,ctrl=ev.ctrlKey||ev.metaKey;
  if(ctrl&&ev.shiftKey&&(k==='O'||k==='o')){ev.preventDefault();split('h',p);return;}
  if(ctrl&&ev.shiftKey&&(k==='E'||k==='e')){ev.preventDefault();split('v',p);return;}
  if(ctrl&&ev.shiftKey&&(k==='C'||k==='c')){return;}
  if(ctrl&&ev.shiftKey&&(k==='V'||k==='v')){return;}
  if(ev.altKey&&/^Arrow/.test(k)){ev.preventDefault();moveFocus(k.slice(5));return;}
  stopDemo();
  if(ctrl&&(k==='c'||k==='C')){ev.preventDefault();sigint(p);return;}
  if(p.proc){if(p.proc.key&&p.proc.key(ev))ev.preventDefault();else if(k==='Enter'){ev.preventDefault();p.out('');}return;}
  if(ctrl&&(k==='l'||k==='L')){ev.preventDefault();p.outEl.innerHTML='';return;}
  if(ctrl&&(k==='u'||k==='U')){ev.preventDefault();p.buf='';p.refresh();return;}
  if(ctrl&&(k==='d'||k==='D')){ev.preventDefault();if(!p.buf){p.out(promptHtml(p)+'exit');closePane(p);}return;}
  if(k==='Enter'){ev.preventDefault();enter(p);return;}
  if(k==='Backspace'){ev.preventDefault();p.buf=p.buf.slice(0,-1);p.refresh();return;}
  if(k==='Tab'){ev.preventDefault();complete(p);return;}
  if(k==='ArrowUp'){ev.preventDefault();if(p.hidx>0){p.hidx--;p.buf=p.hist[p.hidx];p.refresh();}return;}
  if(k==='ArrowDown'){ev.preventDefault();if(p.hidx<p.hist.length-1){p.hidx++;p.buf=p.hist[p.hidx];}else{p.hidx=p.hist.length;p.buf='';}p.refresh();return;}
  if(k.length===1&&!ctrl&&!ev.altKey){ev.preventDefault();p.buf+=k;p.tabHit=0;p.refresh();}
}
function sigint(p){if(p.proc){var pr=p.proc;p.proc=null;p.out('^C'+(pr.sigText||''));pr.kill(true);procEnd(p,true);}else{p.out(promptHtml(p)+esc(p.buf)+'^C');p.buf='';p.refresh();}}
function procEnd(p,interrupted){p.queue=interrupted?[]:p.queue;if(p.queue.length&&!p.proc){var n=p.queue.shift();execOne(p,n);}p.refresh();}
function enter(p){var line=p.buf;p.buf='';p.out(promptHtml(p)+esc(line));if(line.trim()){if(p.hist[p.hist.length-1]!==line)p.hist.push(line);}p.hidx=p.hist.length;
  var parts=splitChain(line);p.queue=parts.slice(1);if(parts.length)execOne(p,parts[0]);p.refresh();}
function splitChain(line){var out=[],curr='',q=null;for(var i=0;i<line.length;i++){var c=line[i];if(q){curr+=c;if(c===q)q=null;continue;}if(c==='"'||c==="'"){q=c;curr+=c;continue;}if(c===';'||(c==='&'&&line[i+1]==='&')){if(curr.trim())out.push(curr.trim());curr='';if(c==='&')i++;continue;}curr+=c;}if(curr.trim())out.push(curr.trim());return out;}
function tokenize(s){var a=[],c='',q=null,has=false;for(var i=0;i<s.length;i++){var ch=s[i];if(q){if(ch===q)q=null;else c+=ch;continue;}if(ch==='"'||ch==="'"){q=ch;has=true;continue;}if(/\s/.test(ch)){if(c||has){a.push(c);c='';has=false;}continue;}c+=ch;}if(c||has)a.push(c);return a;}
function grepFilter(pat,ci){var re=new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),ci?'gi':'g');var tmp=document.createElement('div');return function(html){tmp.innerHTML=html;var lines=tmp.textContent.split('\n').filter(function(l){re.lastIndex=0;return re.test(l);});if(!lines.length)return null;return lines.map(function(l){return esc(l).replace(new RegExp(esc(pat).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),ci?'gi':'g'),function(m){return '<b class="le">'+m+'</b>';});}).join('\n');};}
function execOne(p,cmd){
  var pm=cmd.match(/^(.*?)\s*\|\s*grep\s+(-i\s+)?(?:"([^"]*)"|'([^']*)'|(\S+))\s*$/);
  if(pm){p.filter=grepFilter(pm[3]||pm[4]||pm[5]||'',!!pm[2]);var before=p.proc;execOne(p,pm[1]);var pr=p.proc;if(pr&&pr!==before){var k0=pr.kill;pr.kill=function(s){p.filter=null;k0(s);};var f0=pr.finish;pr.finish=function(){p.filter=null;f0&&f0();};}else p.filter=null;return;}
  var bgMode=/\s&$/.test(cmd)||/^[^&]*[^&]&$/.test(cmd);if(bgMode)cmd=cmd.replace(/&\s*$/,'').trim();
  var argv=tokenize(cmd).map(function(t){return t.replace(/\$(ROS_DISTRO|HOME|USER|ROS_VERSION)\b|\$\{(ROS_DISTRO|HOME|USER)\}/g,function(m,a,b){return ENV[a||b]||'';});});
  if(!argv.length)return;
  var proc=null;try{proc=dispatch(p,argv);}catch(e){p.out(esc(e.message||String(e)));}
  if(proc){if(bgMode){var j=p.bg.length+1,pid=++pidSeq;p.out('['+j+'] '+pid);proc.job=j;p.bg.push(proc);var k0=proc.kill;proc.kill=function(s){p.bg=p.bg.filter(function(x){return x!==proc;});k0(s);};proc.finish=function(){p.bg=p.bg.filter(function(x){return x!==proc;});};}else{p.proc=proc;proc.finish=function(){if(p.proc===proc){p.proc=null;procEnd(p);}};}}
  else if(p.queue.length&&!p.proc){var n=p.queue.shift();execOne(p,n);}
  p.refresh();
}

/* ---------- shell ---------- */
var ENV={ROS_DISTRO:'jazzy',ROS_VERSION:'2',ROS_PYTHON_VERSION:'3',HOME:HOME,USER:'student',SHELL:'/bin/bash',AMENT_PREFIX_PATH:'/opt/ros/jazzy',ROS_AUTOMATIC_DISCOVERY_RANGE:'',LANG:'en_US.UTF-8'};
var FS={'~':['Desktop','Documents','Downloads','ros2_ws'],'~/ros2_ws':['build','install','log','src'],'~/ros2_ws/src':[],'~/ros2_ws/build':[],'~/ros2_ws/install':['setup.bash'],'~/ros2_ws/log':[],'~/Desktop':[],'~/Documents':[],'~/Downloads':[]};
function resolve(cwd,arg){if(!arg||arg==='~')return '~';if(arg.indexOf(HOME)===0)arg='~'+arg.slice(HOME.length);var parts=(arg[0]==='~'?arg:cwd+'/'+arg).split('/');var out=[];parts.forEach(function(s){if(!s||s==='.')return;if(s==='..'){if(out.length>1)out.pop();return;}out.push(s);});return out.join('/')||'~';}
function dispatch(p,a){
  var c=a[0];
  switch(c){
  case 'clear':p.outEl.innerHTML='';return null;
  case 'pwd':p.out(p.cwd==='~'?HOME:HOME+p.cwd.slice(1));return null;
  case 'whoami':p.out('student');return null;
  case 'hostname':p.out('ros2lab');return null;
  case 'echo':p.out(esc(a.slice(1).join(' ')));return null;
  case 'date':p.out(new Date().toString().replace(/ GMT.*$/,''));return null;
  case 'history':p.out(p.hist.map(function(h,i){return '  '+String(i+1).padStart(3)+'  '+esc(h);}).join('\n'));return null;
  case 'cd':{var t=resolve(p.cwd,a[1]);if(!FS[t]){p.out('bash: cd: '+esc(a[1])+': No such file or directory');return null;}p.cwd=t;return null;}
  case 'ls':{var dir=resolve(p.cwd,a.slice(1).filter(function(x){return x[0]!=='-';})[0]||'.');var list=FS[dir];if(!list){p.out("ls: cannot access '"+esc(a[a.length-1])+"': No such file or directory");return null;}p.out(list.map(function(f){return FS[dir+'/'+f]?'<span class="pd">'+f+'</span>':f;}).join('  '));return null;}
  case 'source':case '.':{var f=a[1]||'';if(/^\/opt\/ros\/jazzy\/setup\.(bash|sh|zsh)$/.test(f)||/install\/setup\.bash$/.test(f)||f==='~/.bashrc')return null;p.out('bash: '+esc(f)+': No such file or directory');return null;}
  case 'printenv':if(a[1]){if(ENV[a[1]]!==undefined)p.out(esc(ENV[a[1]]));return null;}p.out(Object.keys(ENV).filter(function(k){return ENV[k];}).map(function(k){return k+'='+ENV[k];}).join('\n'));return null;
  case 'env':p.out(Object.keys(ENV).filter(function(k){return ENV[k];}).map(function(k){return k+'='+ENV[k];}).join('\n'));return null;
  case 'lsb_release':p.out('No LSB modules are available.\nDistributor ID:\tUbuntu\nDescription:\tUbuntu 24.04.1 LTS\nRelease:\t24.04\nCodename:\tnoble');return null;
  case 'uname':p.out(a[1]==='-a'?'Linux ros2lab 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux':'Linux');return null;
  case 'exit':closePane(p);return null;
  case 'jobs':p.out(p.bg.map(function(b,i){return '['+(i+1)+']+  Running                 '+esc(b.cmd||b.name)+' &';}).join('\n'));return null;
  case 'kill':{var m=(a[1]||'').match(/^%(\d+)$/);var b=m&&p.bg[+m[1]-1];if(b){b.kill(true);p.out('['+m[1]+']+  Terminated              '+esc(b.cmd||b.name));}else p.out('bash: kill: '+esc(a[1]||'')+': no such job');return null;}
  case 'sudo':p.out('[sudo] password for student: ');p.out(note('ros2lab: this practice computer has no sudo access. Everything you need is already installed.'));return null;
  case 'apt':case 'apt-get':p.out('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?');return null;
  case 'help':p.out(note('ROS2Lab practice computer. Try:\n  ros2 run turtlesim turtlesim_node      start the turtle\n  ros2 run turtlesim turtle_teleop_key   drive it with the arrow keys\n  ros2 node list | ros2 topic list | ros2 service list | ros2 param list | ros2 action list\n  rqt_graph                              see how nodes connect\nTerminator: Ctrl+Shift+O split below, Ctrl+Shift+E split right, Alt+arrow move, right-click for menu.'));return null;
  case 'rqt_graph':return startRqt(p);
  case 'rqt':return startRqt(p);
  case 'terminator':newTab();return null;
  case 'ros2':return ros2(p,a.slice(1));
  case 'python3':case 'python':p.out(note('ros2lab: Python files are written in the course lab (Week 5).'));return null;
  case 'colcon':p.out(note('ros2lab: colcon build is part of the course lab (Week 5).'));return null;
  case 'cat':case 'nano':case 'vim':case 'gedit':case 'code':p.out(note('ros2lab: the file editor is part of the course lab.'));return null;
  default:p.out(esc(c)+': command not found');return null;
  }
}
function needArgs(p,usage,names){var prog=usage.split(' [')[0];p.out('usage: '+usage+'\n'+prog+': error: the following arguments are required: '+(names||'node_name'));}
var R2USAGE='usage: ros2 [-h] [--use-python-default-buffering] Call `ros2 &lt;command&gt; -h` for more detailed usage. ...\n\nros2 is an extensible command-line tool for ROS 2.\n\noptions:\n  -h, --help            show this help message and exit\n  --use-python-default-buffering\n                        Do not force line buffering in stdout and instead use\n                        the python default buffering, which might be affected\n                        by PYTHONUNBUFFERED/-u and depends on whatever stdout\n                        is interactive or not\n\nCommands:\n  action     Various action related sub-commands\n  bag        Various rosbag related sub-commands\n  component  Various component related sub-commands\n  daemon     Various daemon related sub-commands\n  doctor     Check ROS setup and other potential issues\n  interface  Show information about ROS interfaces\n  launch     Run a launch file\n  lifecycle  Various lifecycle related sub-commands\n  multicast  Various multicast related sub-commands\n  node       Various node related sub-commands\n  param      Various param related sub-commands\n  pkg        Various package related sub-commands\n  run        Run a package specific executable\n  security   Various security related sub-commands\n  service    Various service related sub-commands\n  topic      Various topic related sub-commands\n  wtf        Use `wtf` as alias to `doctor`\n\n  Call `ros2 &lt;command&gt; -h` for more detailed usage.';
var VERBS={
 node:[['info','Output information about a node'],['list','Output a list of available nodes']],
 topic:[['bw','Display bandwidth used by topic'],['delay','Display delay of topic from timestamp in header'],['echo','Output messages from a topic'],['find','Output a list of available topics of a given type'],['hz','Print the average publishing rate to screen'],['info','Print information about a topic'],['list','Output a list of available topics'],['pub','Publish a message to a topic'],['type',"Print a topic's type"]],
 service:[['call','Call a service'],['echo','Echo a service'],['find','Output a list of available services of a given type'],['list','Output a list of available services'],['type',"Output a service's type"]],
 param:[['delete','Delete parameter'],['describe','Show descriptive information about declared parameters'],['dump','Show all of the parameters of a node in a YAML file format'],['get','Get parameter'],['list','Output a list of available parameters'],['load','Load parameter file for a node'],['set','Set parameter']],
 action:[['info','Print information about an action'],['list','Output a list of action names'],['send_goal','Send an action goal']],
 interface:[['list','List all interface types available'],['package','Output a list of available interface types within one package'],['packages','Output a list of packages that provide interfaces'],['proto','Output an interface prototype'],['show','Output the interface definition']],
 pkg:[['create','Create a new ROS 2 package'],['executables','Output a list of package specific executables'],['list','Output a list of available packages'],['prefix','Output the prefix path of a package'],['xml','Output the XML of the package manifest or a specific tag']]
};
function verbHelp(p,g){var v=VERBS[g];var w=Math.max.apply(null,v.map(function(x){return x[0].length;}));p.out('usage: ros2 '+g+' [-h]\n                 Call `ros2 '+g+' &lt;command&gt; -h` for more detailed usage.\n                 ...\n\nVarious '+g+' related sub-commands\n\noptions:\n  -h, --help            show this help message and exit\n\nCommands:\n'+v.map(function(x){return '  '+x[0].padEnd(w+2)+x[1];}).join('\n')+'\n\n  Call `ros2 '+g+' &lt;command&gt; -h` for more detailed usage.');}
function badVerb(p,g,v){p.out('usage: ros2 '+g+' [-h] Call `ros2 '+g+' &lt;command&gt; -h` for more detailed usage. ...\nros2 '+g+": error: argument Call `ros2 "+g+" &lt;command&gt; -h` for more detailed usage.: invalid choice: '"+esc(v)+"' (choose from "+VERBS[g].map(function(x){return "'"+x[0]+"'";}).join(', ')+')');}
function flags(a,extra){var f={},pos=[],VK=['r','rate','w','window','qos-profile','field'].concat(extra||[]);for(var i=0;i<a.length;i++){var x=a[i];if(x==='--ros-args'){f.rosargs=a.slice(i+1);break;}if(x==='-1'){f['1']=true;continue;}if(/^-/.test(x)&&!/^-\d/.test(x)){var m=x.match(/^--?([^=]+)=(.*)$/);if(m){f[m[1]]=m[2];continue;}var k=x.replace(/^--?/,'');if(VK.indexOf(k)>=0){f[k]=a[++i];continue;}f[k]=true;continue;}pos.push(x);}f._=pos;return f;}
function ros2(p,a){
  if(!a.length||a[0]==='-h'||a[0]==='--help'){p.out(R2USAGE);return null;}
  var g=a[0],rest=a.slice(1),f=flags(rest);
  if(VERBS[g]&&(!rest.length||rest[0]==='-h'||rest[0]==='--help')){verbHelp(p,g);return null;}
  if(VERBS[g]&&!VERBS[g].some(function(x){return x[0]===rest[0];})){badVerb(p,g,rest[0]);return null;}
  var v=rest[0],args=flags(rest.slice(1),g==='topic'&&v==='pub'?['t','times']:[]),pos=args._;
  switch(g){
  case 'run':return rosRun(p,rest);
  case 'node':
    if(v==='list'){var ns=visibleNodes().map(function(n){return n.name;}).sort();var dup=ns.some(function(n,i){return ns.indexOf(n)!==i;});if(dup)p.out('WARNING: Be aware that there are nodes in the graph that share an exact name, which can have unintended side effects.');if(ns.length)p.out(esc(ns.join('\n')));return null;}
    if(v==='info'){if(!pos[0]){needArgs(p,'ros2 node info [-h] [--spin-time SPIN_TIME] [-s] [--no-daemon] [--include-hidden] node_name','node_name');return null;}var n=findNode(pos[0]);if(!n){p.out("Unable to find node '"+esc(pos[0])+"'");return null;}var i=n.info();
      function blk(t,l){return '  '+t+':\n'+(l.length?l.map(function(x){return '    '+x[0]+': '+x[1];}).join('\n')+'\n':'\n');}
      p.out(esc(n.name+'\n'+blk('Subscribers',i.subs)+blk('Publishers',i.pubs)+blk('Service Servers',i.srvs)+blk('Service Clients',i.cli||[])+blk('Action Servers',i.asrv||[])+blk('Action Clients',i.acli||[])));return null;}
    break;
  case 'topic':return rosTopic(p,v,args,pos);
  case 'service':return rosService(p,v,args,pos);
  case 'param':return rosParam(p,v,args,pos);
  case 'action':return rosAction(p,v,args,pos);
  case 'interface':
    if(v==='show'||v==='proto'){var t=pos[0];if(!t){needArgs(p,'ros2 interface '+v+' [-h] type','type');return null;}if(!IFACE[t]){var pk=t.split('/')[0];p.out(pk&&['geometry_msgs','turtlesim','std_msgs','std_srvs'].indexOf(pk)<0?"Unknown package '"+esc(pk)+"'":"Could not find the interface '"+esc(t)+"'");return null;}
      if(v==='proto'){var spec=MSG[t]?MSG[t].f:SRV[t]?SRV[t].req:ACT[t].goal;p.out('"'+yaml(spec,defaults(spec))+'\n"');return null;}p.out(esc(IFACE[t]));return null;}
    if(v==='package'){var pk2=pos[0];var l=Object.keys(IFACE).filter(function(x){return x.split('/')[0]===pk2;});if(!l.length){p.out("Unknown package '"+esc(pk2||'')+"'");return null;}p.out(l.join('\n'));p.out(note('ros2lab: this practice computer lists the interfaces used in turtlesim lessons.'));return null;}
    p.out(note('ros2lab: `ros2 interface '+v+'` prints hundreds of types. Try: ros2 interface package turtlesim'));return null;
  case 'pkg':
    if(v==='executables'){var ex=['turtlesim draw_square','turtlesim mimic','turtlesim turtle_teleop_key','turtlesim turtlesim_node'];if(pos[0]&&pos[0]!=='turtlesim'){p.out(pos[0]==='rqt_graph'?'rqt_graph rqt_graph':'Package not found');return null;}p.out(ex.join('\n'));return null;}
    if(v==='prefix'){p.out(['turtlesim','geometry_msgs','std_msgs','std_srvs','rqt_graph','rclcpp','rclpy'].indexOf(pos[0])>=0?'/opt/ros/jazzy':'Package not found');return null;}
    p.out(note('ros2lab: `ros2 pkg '+v+'` is practised in the course lab (Week 5).'));return null;
  case 'daemon':if(v==='status'){p.out('The daemon is running');return null;}if(v==='stop'){p.out('The daemon has been stopped');return null;}if(v==='start'){p.out('The daemon has been started');return null;}p.out('usage: ros2 daemon [-h] Call `ros2 daemon &lt;command&gt; -h` for more detailed usage. ...');return null;
  case 'launch':case 'bag':case 'doctor':case 'wtf':case 'component':case 'lifecycle':case 'multicast':case 'security':p.out(note('ros2lab: `ros2 '+g+'` is covered in the full course lab. This page shows turtlesim.'));return null;
  default:p.out("usage: ros2 [-h] [--use-python-default-buffering] Call `ros2 &lt;command&gt; -h` for more detailed usage. ...\nros2: error: argument Call `ros2 &lt;command&gt; -h` for more detailed usage.: invalid choice: '"+esc(g)+"' (choose from 'action', 'bag', 'component', 'daemon', 'doctor', 'extension_points', 'extensions', 'interface', 'launch', 'lifecycle', 'multicast', 'node', 'param', 'pkg', 'run', 'security', 'service', 'topic', 'wtf')");return null;
  }
  return null;
}
function rosArgs(ra){var o={node:null,remap:{},params:{}};if(!ra)return o;for(var i=0;i<ra.length;i++){var x=ra[i]||'',v=null;if(x==='-r'||x==='--remap')v=ra[++i]||'';else if(x==='-p'||x==='--param'){var pv=(ra[++i]||'').split(':=');o.params[pv[0]]=pv.slice(1).join(':=');continue;}else if(/:=/.test(x))v=x;if(v){var kv=v.split(':=');if(kv[0]==='__node')o.node=kv[1];else o.remap[kv[0].replace(/^\//,'')]=kv[1];}}return o;}
function nodeRemap(ra,def){if(!ra)return def;for(var i=0;i<ra.length;i++){var m=(ra[i]||'').match(/^__node:=(.+)$/);if(m)return m[1];}return def;}
function rosRun(p,a){
  var f=flags(a),pos=f._;if(pos.length<2){p.out('usage: ros2 run [-h] [--prefix PREFIX] package_name executable_name ...\nros2 run: error: the following arguments are required: package_name, executable_name');return null;}
  var pk=pos[0],ex=pos[1];
  if(pk==='rqt_graph'&&ex==='rqt_graph')return startRqt(p);
  if(pk!=='turtlesim'){p.out('Package \''+esc(pk)+'\' not found');return null;}
  var RA=rosArgs(f.rosargs);
  if(ex==='turtlesim_node'){if(SIM){p.out(note('ros2lab: one turtlesim window runs at a time here. It is already running in another terminal.'));return null;}var pr=startSim(p,RA.node||'turtlesim');Object.keys(RA.params).forEach(function(k){var o=SIM.params[k];if(!o)return;var sv=scalar(RA.params[k]);if(o.t==='integer'&&sv&&sv.__i)o.v=sv.__n;else if(o.t==='bool'&&typeof sv==='boolean')o.v=sv;});paintBg();SIM.holo=SIM.params.holonomic.v;return pr;}
    if(ex==='turtle_teleop_key')return startTeleop(p,RA.node||'teleop_turtle',RA);
  if(ex==='draw_square')return startDrawSquare(p);
  if(ex==='mimic'){p.out(note('ros2lab: mimic needs two turtlesim windows, which this page does not run.'));return null;}
  p.out('No executable found');return null;
}
function cliNode(pubs,subs){return addNode({name:'/_ros2cli_'+(++pidSeq),hidden:true,cli:true,info:function(){return {pubs:pubs.concat([['/parameter_events','rcl_interfaces/msg/ParameterEvent'],['/rosout','rcl_interfaces/msg/Log']]),subs:subs,srvs:[],cli:[],asrv:[],acli:[]};}});}

/* topic */
function rosTopic(p,v,args,pos){
  var tps=allTopics(args['include-hidden-topics']);
  if(v==='list'){var ks=Object.keys(tps).sort();p.out(esc(ks.map(function(k){return args.t||args['show-types']?k+' ['+tps[k]+']':k;}).join('\n')));return null;}
  if(v==='type'){if(!tps[pos[0]])return null;p.out(esc(tps[pos[0]]));return null;}
  if(v==='find'){p.out(esc(Object.keys(tps).filter(function(k){return tps[k]===pos[0];}).sort().join('\n')));return null;}
  if(v==='info'){var t=pos[0];if(!tps[t]){p.out('Unknown topic \''+esc(t||'')+'\'');return null;}var c=counts(t);var s='Type: '+tps[t]+'\n'+(args.v||args.verbose?'\n':'')+'Publisher count: '+c.pc+'\n';
      if(args.v||args.verbose){c.pn.forEach(function(n){s+='\nNode name: '+n.name.replace(/^\//,'')+'\nNode namespace: /\nTopic type: '+tps[t]+'\nTopic type hash: RIHS01_…\nEndpoint type: PUBLISHER\nGID: …\nQoS profile:\n  Reliability: RELIABLE\n  History (Depth): UNKNOWN\n  Durability: VOLATILE\n  Lifespan: Infinite\n  Deadline: Infinite\n  Liveliness: AUTOMATIC\n  Liveliness lease duration: Infinite\n';});s+='\n';}
      s+='Subscription count: '+c.sc;
      if(args.v||args.verbose){c.sn.forEach(function(n){s+='\n\nNode name: '+n.name.replace(/^\//,'')+'\nNode namespace: /\nTopic type: '+tps[t]+'\nEndpoint type: SUBSCRIPTION\nQoS profile:\n  Reliability: RELIABLE\n  Durability: VOLATILE';});}
      p.out(esc(s));return null;}
  if(v==='echo'){var t2=pos[0];if(!t2){needArgs(p,'ros2 topic echo [-h] topic_name [message_type]','topic_name');return null;}var ty=pos[1]||tps[t2];
    if(!ty){p.out('WARNING: topic ['+esc(t2)+'] does not appear to be published yet\nCould not determine the type for the passed topic');return null;}
    var spec=MSG[ty];if(!spec){p.out(note('ros2lab: echo of '+esc(ty)+' is not shown on this page.'));return null;}
    if(!tps[t2])p.out('WARNING: topic ['+esc(t2)+'] does not appear to be published yet');
    var node=cliNode([],[[t2,ty]]);var buf=[],once=args.once,fieldF=args.field;
    var timer=setInterval(function(){if(buf.length){p.out(buf.join('\n'));buf=[];}},60);
    var proc;var un=subscribe(t2,function(m){var body=fieldF?(function(){var v=m;fieldF.split('.').forEach(function(k){v=v&&v[k];});return esc(typeof v==='number'?pyf(v):JSON.stringify(v));})():esc(yaml(spec.f,m));buf.push(body+'\n---');if(once){p.out(buf.join('\n'));buf=[];proc.kill();proc.finish();}});
    proc={name:'ros2',kill:function(){un();clearInterval(timer);removeNode(node);}};return proc;}
  if(v==='hz'){var t3=pos[0];if(!t3){needArgs(p,'ros2 topic hz [-h] topic_name','topic_name');return null;}if(!tps[t3])p.out('WARNING: topic ['+esc(t3)+'] does not appear to be published yet');
    var node3=cliNode([],[[t3,tps[t3]||'']]);var stamps=[],win=+args.window||10000;
    var un3=subscribe(t3,function(){stamps.push(performance.now()/1000);if(stamps.length>win)stamps.shift();});
    var tm=setInterval(function(){var n=stamps.length;if(n<2)return;var d=[];for(var i=1;i<n;i++)d.push(stamps[i]-stamps[i-1]);var mean=d.reduce(function(a,b){return a+b;},0)/d.length;var sd=Math.sqrt(d.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/d.length);p.out('average rate: '+(1/mean).toFixed(3)+'\n\tmin: '+Math.min.apply(null,d).toFixed(3)+'s max: '+Math.max.apply(null,d).toFixed(3)+'s std dev: '+sd.toFixed(5)+'s window: '+n);},1000);
    return {name:'ros2',kill:function(){un3();clearInterval(tm);removeNode(node3);}};}
  if(v==='pub'){var tp=pos[0],ty2=pos[1];if(!tp||!ty2){p.out('usage: ros2 topic pub [-h] [-r N] [-p N] [-1 | -t TIMES] [-w WAIT_MATCHING_SUBSCRIPTIONS] [--keep-alive N] [-n NODE_NAME] [--qos-profile {...}] topic_name message_type [values]\nros2 topic pub: error: the following arguments are required: topic_name, message_type');return null;}
    var sp=MSG[ty2];if(!sp){p.out('The passed message type is invalid');return null;}
    var data;try{data=fill(sp.f,sp.py.split('.').pop(),parseYaml(pos[2]));}catch(e){p.out(esc(e&&e.message?e.message:'The passed value needs to be a dictionary in YAML format'));return null;}
    var once2=args.once||args['1'],times=args.t||args.times?+(args.t||args.times):(once2?1:Infinity),rate=+(args.r||args.rate||1);
    var node4=cliNode([[tp,ty2]],[]);var cnt=0,iv=null,waitIv=null,done=false;var proc2;
    function go(){p.out('publisher: beginning loop');function one(){cnt++;p.out('publishing #'+cnt+': '+esc(repr(sp.f,sp.py,data))+'\n');publish(tp,JSON.parse(JSON.stringify(data)));if(cnt>=times){finish();}}one();if(!done)iv=setInterval(one,1000/rate);}
    function finish(){done=true;clearInterval(iv);clearInterval(waitIv);setTimeout(function(){removeNode(node4);proc2.finish&&proc2.finish();},300);}
    if(once2&&!hasSubs(tp)){p.out('Waiting for at least 1 matching subscription(s)...');waitIv=setInterval(function(){if(hasSubs(tp)){clearInterval(waitIv);go();}},200);}else setTimeout(go,120);
    proc2={name:'ros2',kill:function(){done=true;clearInterval(iv);clearInterval(waitIv);removeNode(node4);}};return proc2;}
  p.out(note('ros2lab: `ros2 topic '+v+'` is practised in the course lab.'));return null;
}
/* service */
function rosService(p,v,args,pos){
  var ss=allServices();
  if(v==='list'){p.out(esc(Object.keys(ss).sort().map(function(k){return args.t||args['show-types']?k+' ['+ss[k]+']':k;}).join('\n')));return null;}
  if(v==='type'){if(!ss[pos[0]])return null;p.out(esc(ss[pos[0]]));return null;}
  if(v==='find'){p.out(esc(Object.keys(ss).filter(function(k){return ss[k]===pos[0];}).sort().join('\n')));return null;}
  if(v==='call'){var nm=pos[0],ty=pos[1];if(!nm||!ty){p.out('usage: ros2 service call [-h] [-r N] service_name service_type [values]\nros2 service call: error: the following arguments are required: service_name, service_type');return null;}
    var sp=SRV[ty];if(!sp){if(/^rcl_interfaces|type_description/.test(ty)){p.out(note('ros2lab: parameter services are easier with `ros2 param`. Try: ros2 param list'));return null;}p.out('The passed service type is invalid');return null;}
    var cls=sp.py.split('.').pop()+'_Request',req;try{req=fill(sp.req,cls,parseYaml(pos[2]));}catch(e){p.out(esc(e&&e.message?e.message:'The passed value needs to be a dictionary in YAML format'));return null;}
    var node=cliNode([],[]),iv=null,proc;
    function call(){var res=SIM&&ss2()[nm]===ty?simService(nm,req):null;
      p.out('requester: making request: '+esc(repr(sp.req,sp.py+'_Request',req))+'\n\nresponse:\n'+esc(repr(sp.res,sp.py+'_Response',res||defaults(sp.res)))+'\n');removeNode(node);proc.finish&&proc.finish();}
    function ss2(){return allServices();}
    if(ss[nm]&&ss[nm]!==ty){p.out(note('ros2lab: '+nm+' has type '+ss[nm]+'.'));removeNode(node);return null;}
    proc={name:'ros2',kill:function(){clearInterval(iv);removeNode(node);}};
    if(ss[nm]){setTimeout(call,150);}else{p.out('waiting for service to become available...');iv=setInterval(function(){if(allServices()[nm]===ty){clearInterval(iv);call();}},250);}
    return proc;}
  p.out(note('ros2lab: `ros2 service '+v+'` is practised in the course lab.'));return null;
}
/* params */
function ptype(t){return t==='integer'?'Integer':t==='double'?'Double':t==='bool'?'Boolean':'String';}
function pval(o){return o.t==='bool'?(o.v?'True':'False'):o.t==='double'?pyf(o.v):String(o.v);}
function rosParam(p,v,args,pos){
  var withP=visibleNodes().filter(function(n){return n.params;});
  if(v==='list'){var list=pos[0]?withP.filter(function(n){return n.name===pos[0];}):withP;if(pos[0]&&!list.length){p.out('Node not found');return null;}
    p.out(esc(list.sort(function(a,b){return a.name<b.name?-1:1;}).map(function(n){return n.name+':\n'+Object.keys(n.params).sort().map(function(k){return '  '+k+(args['param-type']?' (type: '+n.params[k].t+')':'');}).join('\n');}).join('\n')));return null;}
  var n=findNode(pos[0]||'');
  if(['get','set','describe','delete','dump','load'].indexOf(v)>=0&&!pos[0]){needArgs(p,'ros2 param '+v+' [-h] node_name'+(v==='get'||v==='describe'||v==='delete'?' parameter_name':v==='set'?' parameter_name value':v==='load'?' parameter_file':''),'node_name'+(v==='get'||v==='describe'||v==='delete'?', parameter_name':v==='set'?', parameter_name, value':v==='load'?', parameter_file':''));return null;}
  if(!n||!n.params){p.out('Node not found');return null;}
  if(v==='get'){var o=n.params[pos[1]];if(!o){p.out('Parameter not set');return null;}p.out(esc(ptype(o.t)+' value is: '+pval(o)));return null;}
  if(v==='describe'){var k=pos[1],o2=n.params[k];if(!o2){p.out("Parameter not set");return null;}var s='Parameter name: '+k+'\n  Type: '+(o2.t==='bool'?'boolean':o2.t)+'\n'+(o2.d?'  Description: '+o2.d+'\n':'')+'  Constraints:\n'+(o2.ro?'    Read only: true\n':'')+(o2.rng?'    Min value: '+o2.rng[0]+'\n    Max value: '+o2.rng[1]+'\n    Step: 1\n':'');p.out(esc(s.replace(/\n$/,'')));return null;}
  if(v==='set'){var k2=pos[1],raw=pos[2];var o3=n.params[k2];if(raw===undefined){needArgs(p,'ros2 param set [-h] node_name parameter_name value','value');return null;}
    var sv=scalar(raw),nt=typeof sv==='boolean'?'bool':(sv&&sv.__n!==undefined)?(sv.__i?'integer':'double'):'string',nv=typeof sv==='boolean'?sv:(sv&&sv.__n!==undefined)?sv.__n:raw;
    if(!o3){p.out('Setting parameter failed: parameter \''+esc(k2)+'\' cannot be set because it was not declared');return null;}
    if(o3.ro){p.out("Setting parameter failed: parameter '"+esc(k2)+"' cannot be set because it is read-only");return null;}
    if(o3.t!==nt){p.out('Setting parameter failed: Wrong parameter type, parameter {'+esc(k2)+'} is of type {'+o3.t+'}, setting it to {'+nt+'} is not allowed.');return null;}
    if(o3.rng&&(nv<o3.rng[0]||nv>o3.rng[1])){p.out('Setting parameter failed: Parameter {'+esc(k2)+"} doesn't comply with integer range.");return null;}
    o3.v=nv;p.out('Set parameter successful');if(n.onParam)n.onParam(k2);return null;}
  if(v==='dump'){var keys=Object.keys(n.params).sort(),out=n.name+':\n  ros__parameters:\n',qos=false;
    keys.forEach(function(k){var o=n.params[k];if(/^qos_overrides/.test(k)){if(!qos){qos=true;out+='    qos_overrides:\n      /parameter_events:\n        publisher:\n          depth: 1000\n          durability: volatile\n          history: keep_last\n          reliability: reliable\n';}return;}out+='    '+k+': '+(o.t==='bool'?String(o.v):o.t==='double'?pyf(o.v):o.v)+'\n';});p.out(esc(out.replace(/\n$/,'')));return null;}
  if(v==='delete'){p.out('Deleting parameter failed: cannot undeclare a statically typed parameter');return null;}
  p.out(note('ros2lab: parameter files are practised in the course lab.'));return null;
}
/* actions */
function rosAction(p,v,args,pos){
  var as=allActions();
  if(v==='list'){p.out(esc(Object.keys(as).sort().map(function(k){return args.t||args['show-types']?k+' ['+as[k]+']':k;}).join('\n')));return null;}
  if(v==='info'){var a=pos[0];if(!as[a]){p.out('Action: '+esc(a||'')+'\nAction clients: 0\nAction servers: 0');return null;}var cl=[],sv=[];visibleNodes().forEach(function(n){var i=n.info();if((i.asrv||[]).some(function(x){return x[0]===a;}))sv.push(n.name);if((i.acli||[]).some(function(x){return x[0]===a;}))cl.push(n.name);});
    p.out(esc('Action: '+a+'\nAction clients: '+cl.length+(cl.length?'\n'+cl.map(function(x){return '    '+x;}).join('\n'):'')+'\nAction servers: '+sv.length+(sv.length?'\n'+sv.map(function(x){return '    '+x;}).join('\n'):'')));return null;}
  if(v==='send_goal'){var an=pos[0],ty=pos[1];if(!an||!ty){p.out('usage: ros2 action send_goal [-h] [-f] action_name action_type goal\nros2 action send_goal: error: the following arguments are required: action_name, action_type, goal');return null;}
    if(!ACT[ty]){p.out('The passed action type is invalid');return null;}
    var goal;try{goal=fill(ACT[ty].goal,'RotateAbsolute_Goal',parseYaml(pos[2]));}catch(e){p.out(esc(e&&e.message?e.message:'The passed value needs to be a dictionary in YAML format'));return null;}
    var fb=args.f||args.feedback,iv=null,proc,lastFb=0,id=uuid();
    function send(){p.out('Sending goal:\n     theta: '+pyf(goal.theta)+'\n');var turtle=an.split('/')[1];
      var ok=simRotate(turtle,goal.theta,fb?function(rem){var now=performance.now();if(now-lastFb>120){lastFb=now;p.out('Feedback:\n    remaining: '+f32(rem)+'\n');}}:null,function(status,delta){p.out('Result:\n    delta: '+f32(delta)+'\n\nGoal finished with status: '+status);proc.finish&&proc.finish();});
      p.out('Goal accepted with ID: '+id+'\n');if(!ok){p.out('Goal finished with status: ABORTED');proc.finish&&proc.finish();}}
    proc={name:'ros2',kill:function(){clearInterval(iv);var t=SIM&&SIM.turtles[an.split('/')[1]];if(t&&t.rot){t.rot.done=null;t.rot=null;t.ang=0;}}};
    p.out('Waiting for an action server to become available...');
    if(as[an])setTimeout(send,200);else iv=setInterval(function(){if(allActions()[an]){clearInterval(iv);send();}},250);
    return proc;}
  return null;
}
/* teleop */
var teleops=[];
function startTeleop(p,name,ra){ra=ra||{remap:{}};var CMD='/'+(ra.remap['turtle1/cmd_vel']||'turtle1/cmd_vel').replace(/^\//,''),ACTN='/'+(ra.remap['turtle1/rotate_absolute']||'turtle1/rotate_absolute').replace(/^\//,''),TURTLE=ACTN.split('/')[1];
  p.out('Reading from keyboard\n---------------------------\nUse arrow keys to move the turtle.\nUse g|b|v|c|d|e|r|t keys to rotate to absolute orientations. \'f\' to cancel a rotation.\n\'q\' to quit.');
  var params=Object.assign({scale_angular:{t:'double',v:2.0},scale_linear:{t:'double',v:2.0}},qosParams());
  var node=addNode({name:'/'+name,params:params,info:function(){return {subs:[['/parameter_events','rcl_interfaces/msg/ParameterEvent']],pubs:[['/parameter_events','rcl_interfaces/msg/ParameterEvent'],['/rosout','rcl_interfaces/msg/Log'],[CMD,'geometry_msgs/msg/Twist']],srvs:paramServices(name),cli:[],asrv:[],acli:[[ACTN,'turtlesim/action/RotateAbsolute']]};}});
  var ANG={g:0,t:0.7854,r:1.5708,e:2.3562,d:3.1416,c:-2.3562,v:-1.5708,b:-0.7854};
  var proc={name:'turtle_teleop_key',
    drive:function(k){var l=params.scale_linear.v,a=params.scale_angular.v;var tw={linear:{x:0,y:0,z:0},angular:{x:0,y:0,z:0}};
      if(k==='ArrowUp')tw.linear.x=l;else if(k==='ArrowDown')tw.linear.x=-l;else if(k==='ArrowLeft')tw.angular.z=a;else if(k==='ArrowRight')tw.angular.z=-a;else return false;publish(CMD,tw);return true;},
    key:function(ev){var k=ev.key;if(proc.drive(k))return true;var lk=k.toLowerCase();
      if(ANG[lk]!==undefined){simRotate(TURTLE,ANG[lk],null,null);return true;}
      if(lk==='f'){var t=SIM&&SIM.turtles[TURTLE];if(t&&t.rot){t.rot.done=null;t.rot=null;t.ang=0;simLog('INFO','Rotation goal canceled');}return true;}
      if(lk==='q'){proc.kill();proc.finish();return true;}return false;},
    kill:function(){removeNode(node);teleops=teleops.filter(function(x){return x!==proc;});padUI();}};
  teleops.push(proc);padUI();return proc;
}
var pad=document.getElementById('pad');
function padUI(){pad.hidden=!teleops.length;}
pad.addEventListener('click',function(ev){var b=ev.target.closest('[data-k]');if(!b||!teleops.length)return;stopDemo();teleops[teleops.length-1].drive(b.getAttribute('data-k'));});
/* draw_square (approximation of the demo node) */
function startDrawSquare(p){
  var node=addNode({name:'/draw_square',params:qosParams(),info:function(){return {subs:[['/parameter_events','rcl_interfaces/msg/ParameterEvent'],['/turtle1/pose','turtlesim/msg/Pose']],pubs:[['/parameter_events','rcl_interfaces/msg/ParameterEvent'],['/rosout','rcl_interfaces/msg/Log'],['/turtle1/cmd_vel','geometry_msgs/msg/Twist']],srvs:paramServices('draw_square'),cli:[['/reset','std_srvs/srv/Empty']],asrv:[],acli:[]};}});
  var state='wait',goal=null,pose=null,iv,un=subscribe('/turtle1/pose',function(m){pose=m;});
  iv=setInterval(function(){if(!SIM)return;if(state==='wait'){simService('/reset',{});state='fwd';pose=null;return;}if(!pose)return;var tw={linear:{x:0,y:0,z:0},angular:{x:0,y:0,z:0}};
    if(state==='fwd'){if(!goal)goal={x:pose.x,y:pose.y,th:pose.theta};var d=Math.hypot(pose.x-goal.x,pose.y-goal.y);if(d<2.0)tw.linear.x=1.0;else{state='turn';goal={th:norm(goal.th+Math.PI/2)};}}
    if(state==='turn'){var r=norm(goal.th-pose.theta);if(Math.abs(r)>0.02)tw.angular.z=r>0?0.4:-0.4;else{state='fwd';goal=null;}}
    publish('/turtle1/cmd_vel',tw);},16);
  return {name:'draw_square',kill:function(){clearInterval(iv);un();removeNode(node);}};
}
/* rqt_graph */
var rqtWin=document.getElementById('w-rqt'),rqtSvg=document.getElementById('rqt-svg'),rqtOpen=false,rqtPane=null;
function startRqt(p){rqtWin.hidden=false;raise(rqtWin);rqtOpen=true;rqtPane=p;drawGraph();return {name:'rqt_graph',kill:function(){rqtWin.hidden=true;rqtOpen=false;rqtPane=null;}};}
var gdTimer=null;function graphDirty(){if(!rqtOpen)return;clearTimeout(gdTimer);gdTimer=setTimeout(drawGraph,150);}
function drawGraph(){
  if(!rqtOpen)return;var vn=visibleNodes(),topics={};
  vn.forEach(function(n){var i=n.info();i.pubs.forEach(function(t){if(/^\/(rosout|parameter_events)$/.test(t[0]))return;(topics[t[0]]=topics[t[0]]||{p:[],s:[]}).p.push(n.name);});i.subs.forEach(function(t){if(/^\/(rosout|parameter_events)$/.test(t[0]))return;(topics[t[0]]=topics[t[0]]||{p:[],s:[]}).s.push(n.name);});});
  var act=Object.keys(topics).filter(function(t){return topics[t].p.length&&topics[t].s.length;}).sort();
  var left=[],right=[];vn.forEach(function(n){var isSub=act.some(function(t){return topics[t].s.indexOf(n.name)>=0;}),isPub=act.some(function(t){return topics[t].p.indexOf(n.name)>=0;});if(isSub)right.push(n.name);else left.push(n.name);});
  var H=Math.max(160,Math.max(left.length,right.length,act.length)*62+40),s='<rect width="520" height="'+H+'" fill="#fff"/>';
  function pos(arr,i){return 30+(H-60)*(arr.length===1?0.5:i/(arr.length-1));}
  var P={};left.forEach(function(n,i){P[n]=[80,pos(left,i)];});right.forEach(function(n,i){P[n]=[440,pos(right,i)];});var TP={};act.forEach(function(t,i){TP[t]=[260,pos(act,i)];});
  s+='<defs><marker id="ah" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#333"/></marker></defs>';
  act.forEach(function(t){var tp=TP[t];topics[t].p.forEach(function(n){if(P[n])s+='<path d="M'+(P[n][0]+62)+' '+P[n][1]+' L'+(tp[0]-70)+' '+tp[1]+'" stroke="#333" stroke-width="1.3" fill="none" marker-end="url(#ah)"/>';});topics[t].s.forEach(function(n){if(P[n])s+='<path d="M'+(tp[0]+70)+' '+tp[1]+' L'+(P[n][0]-62)+' '+P[n][1]+'" stroke="#333" stroke-width="1.3" fill="none" marker-end="url(#ah)"/>';});});
  Object.keys(P).forEach(function(n){s+='<ellipse cx="'+P[n][0]+'" cy="'+P[n][1]+'" rx="62" ry="20" fill="#fff" stroke="#000"/><text x="'+P[n][0]+'" y="'+(P[n][1]+4)+'" text-anchor="middle" font-size="12">'+esc(n)+'</text>';});
  act.forEach(function(t){var tp=TP[t];s+='<rect x="'+(tp[0]-70)+'" y="'+(tp[1]-16)+'" width="140" height="32" fill="#fff" stroke="#000"/><text x="'+tp[0]+'" y="'+(tp[1]+4)+'" text-anchor="middle" font-size="12">'+esc(t)+'</text>';});
  if(!vn.length)s+='<text x="260" y="'+(H/2)+'" text-anchor="middle" font-size="13" fill="#666">No nodes running</text>';
  rqtSvg.setAttribute('viewBox','0 0 520 '+H);rqtSvg.innerHTML=s;
}
document.getElementById('rqt-refresh').addEventListener('click',drawGraph);

/* ---------- tab completion ---------- */
var CMDS=['ros2','clear','ls','cd','pwd','echo','source','printenv','history','whoami','hostname','exit','help','rqt_graph','lsb_release','jobs','kill'];
function complete(p){
  var b=p.buf,toks=tokenize(b);if(/\s$/.test(b)||!b)toks.push('');var w=toks[toks.length-1],i=toks.length-1,c=[];
  if(i===0)c=CMDS;
  else if(toks[0]==='ros2'){
    if(i===1)c=['action','bag','component','daemon','doctor','interface','launch','lifecycle','multicast','node','param','pkg','run','security','service','topic','wtf'];
    else if(i===2&&VERBS[toks[1]])c=VERBS[toks[1]].map(function(x){return x[0];});
    else if(toks[1]==='run'){if(i===2)c=['turtlesim','rqt_graph'];else if(i===3)c=toks[2]==='turtlesim'?['draw_square','mimic','turtle_teleop_key','turtlesim_node']:['rqt_graph'];}
    else if(toks[1]==='topic'){if(i===3)c=Object.keys(allTopics());else if(i===4&&toks[2]==='pub')c=Object.keys(MSG);else if(i===4)c=[allTopics()[toks[3]]].filter(Boolean);}
    else if(toks[1]==='service'){if(i===3)c=Object.keys(allServices());else if(i===4)c=[allServices()[toks[3]]].filter(Boolean);}
    else if(toks[1]==='action'){if(i===3)c=Object.keys(allActions());else if(i===4)c=Object.keys(ACT);}
    else if(toks[1]==='node'||toks[1]==='param'){if(i===3)c=visibleNodes().map(function(n){return n.name;});else if(i===4&&toks[1]==='param'){var n=findNode(toks[3]);c=n&&n.params?Object.keys(n.params):[];}}
    else if(toks[1]==='interface'&&i===3)c=Object.keys(IFACE);
  } else if(toks[0]==='cd'||toks[0]==='ls'){var base=w.lastIndexOf('/')>=0?w.slice(0,w.lastIndexOf('/')+1):'';var dir=resolve(p.cwd,base||'.');c=(FS[dir]||[]).filter(function(f){return FS[dir+'/'+f];}).map(function(f){return base+f+'/';});}
  else if(toks[0]==='source')c=['/opt/ros/jazzy/setup.bash','install/setup.bash'];
  var m=c.filter(function(x){return x.indexOf(w)===0;});if(!m.length)return;
  if(m.length===1){var add=m[0].slice(w.length);p.buf+=add+(/\/$/.test(m[0])?'':' ');p.refresh();return;}
  var pre=m.reduce(function(a,b){var k=0;while(k<a.length&&a[k]===b[k])k++;return a.slice(0,k);});
  if(pre.length>w.length){p.buf+=pre.slice(w.length);p.refresh();return;}
  p.tabHit++;if(p.tabHit>=2){p.out(promptHtml(p)+esc(p.buf));p.out(esc(m.join('  ')));p.tabHit=0;}
}

/* ---------- command chips ---------- */
var CHIPS={
  'Start':['ros2 run turtlesim turtlesim_node','ros2 run turtlesim turtle_teleop_key','ros2 run turtlesim draw_square'],
  'Nodes':['ros2 node list','ros2 node info /turtlesim'],
  'Topics':['ros2 topic list -t','ros2 topic echo /turtle1/pose','ros2 topic hz /turtle1/pose','ros2 topic info /turtle1/cmd_vel','ros2 topic pub -r 1 /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 1.8}}"'],
  'Services':['ros2 service list -t','ros2 service call /spawn turtlesim/srv/Spawn "{x: 2, y: 2, theta: 0.2, name: \'\'}"','ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 140, b: 0, width: 4}"','ros2 service call /clear std_srvs/srv/Empty','ros2 service call /reset std_srvs/srv/Empty'],
  'Parameters':['ros2 param list','ros2 param get /turtlesim background_r','ros2 param set /turtlesim background_r 150','ros2 param dump /turtlesim'],
  'Actions':['ros2 action list -t','ros2 action send_goal --feedback /turtle1/rotate_absolute turtlesim/action/RotateAbsolute "{theta: 1.57}"'],
  'Tools':['rqt_graph','ros2 interface show geometry_msgs/msg/Twist','ros2 pkg executables turtlesim']
};
var gtabs=document.getElementById('gtabs'),chipBox=document.getElementById('chips');
Object.keys(CHIPS).forEach(function(g,i){var b=el('button','gt'+(i===0?' on':''),g);b.type='button';b.addEventListener('click',function(){gtabs.querySelectorAll('.gt').forEach(function(x){x.classList.toggle('on',x===b);});showChips(g);});gtabs.appendChild(b);});
function showChips(g){chipBox.innerHTML='';CHIPS[g].forEach(function(cmd){var b=el('button','lchip');b.type='button';b.textContent=cmd;b.addEventListener('click',function(){stopDemo();runChip(cmd);});chipBox.appendChild(b);});}
showChips('Start');
function freePane(){if(termWin.hidden)openTerminator();if(focused&&!focused.proc)return focused;var f=allPanes().filter(function(q){return !q.proc;});var inTab=[];eachPane(function(q){if(!q.proc)inTab.push(q);});if(inTab.length){focusPane(inTab[0]);return inTab[0];}var np=split(focused&&focused.el.offsetWidth>focused.el.offsetHeight*1.6?'v':'h');return np||focused;}
function runChip(cmd){var p=freePane();if(!p||p.proc)return;typeInto(p,cmd);}
var typing=null;
function typeInto(p,cmd,done){focusPane(p);p.buf='';if(reduce){p.buf=cmd;enter(p);if(done)done();return;}var i=0;clearInterval(typing);typing=setInterval(function(){i+=2;p.buf=cmd.slice(0,i);p.refresh();if(i>=cmd.length){clearInterval(typing);typing=null;setTimeout(function(){if(allPanes().indexOf(p)<0||p.proc)return;enter(p);if(done)done();},120);}},16);}

/* ---------- guided demo ---------- */
var demo=null,touched=false;
function stopDemo(){touched=true;if(demo){demo.stop=true;demo=null;document.getElementById('demo-btn').textContent='Play demo';}}
function wait(ms){return new Promise(function(r){setTimeout(r,reduce?Math.min(ms,50):ms);});}
function typeP(p,cmd){return new Promise(function(r){typeInto(p,cmd,r);});}
async function playDemo(){
  if(demo){stopDemo();return;}var me=demo={stop:false};document.getElementById('demo-btn').textContent='Stop demo';
  function alive(){return demo===me&&!me.stop;}
  resetLab();var p1=allPanes()[0];await wait(300);if(!alive())return;
  await typeP(p1,'ros2 run turtlesim turtlesim_node');await wait(900);if(!alive())return;
  var p2=split('h',p1);await wait(300);if(!alive()||!p2)return;
  await typeP(p2,'ros2 node list');await wait(700);if(!alive())return;
  await typeP(p2,'ros2 topic pub -r 1 /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 1.8}}"');await wait(5200);if(!alive())return;
  sigint(p2);await wait(400);
  await typeP(p2,'ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 140, b: 0, width: 4}"');await wait(700);if(!alive())return;
  await typeP(p2,'ros2 run turtlesim turtle_teleop_key');await wait(500);if(!alive())return;
  var seq=['ArrowUp','ArrowLeft','ArrowUp','ArrowUp','ArrowRight','ArrowUp'];for(var i=0;i<seq.length;i++){if(!alive())return;if(teleops.length)teleops[0].drive(seq[i]);await wait(1050);}
  if(demo===me){demo=null;document.getElementById('demo-btn').textContent='Play demo';p2.out(note('Your turn: click this terminal and use the arrow keys. Press Ctrl+C to stop.'));}
}
document.getElementById('demo-btn').addEventListener('click',playDemo);
function resetLab(){clearInterval(typing);typing=null;allPanes().forEach(killAll);tabs=[];cur=0;if(SIM)stopSim(false);teleops=[];padUI();rqtWin.hidden=true;rqtOpen=false;termWin.hidden=false;document.getElementById('reopen').hidden=true;newTab();}
document.getElementById('reset-btn').addEventListener('click',function(){stopDemo();resetLab();});
document.getElementById('split-h').addEventListener('click',function(){stopDemo();if(termWin.hidden)openTerminator();split('h');});
document.getElementById('split-v').addEventListener('click',function(){stopDemo();if(termWin.hidden)openTerminator();split('v');});

/* clock */
var clock=document.getElementById('clock');function tickClock(){var d=new Date();clock.textContent=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+'  '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}tickClock();setInterval(tickClock,15000);

/* start */
newTab();var first=allPanes()[0];
first.out(note('Welcome to the ROS2Lab practice computer (Ubuntu 24.04, ROS 2 Jazzy).\nType a command, or pick one below. Type help for tips.'));
var started=false;
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&!started){started=true;io.disconnect();setTimeout(function(){if(!demo&&!SIM&&!touched)playDemo();},400);}});},{threshold:.45});io.observe(desk);}
if(/[?&]debug=1(&|$)/.test(location.search))window.__lab={run:function(cmd){var p=freePane();p.buf=cmd;enter(p);return p;},panes:allPanes,sim:function(){return SIM;},stopDemo:stopDemo,split:split,sigint:function(){sigint(focused);},focused:function(){return focused;}};
})();
