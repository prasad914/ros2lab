/* Robot simulator catalogue (same robots and links as public/robots/index.json and rviz.html?robot=<id>) */
(function(){
'use strict';
var R={{ROBOTS}},IM={{ROBOT_IMGS}};
var CATS=[{id:'mobile',t:'Mobile robots',b:'Wheeled robots: differential, car-like and mecanum drives with lidar, camera and IMU.'},{id:'manipulator',t:'Manipulators',b:'Arms on a fixed base: plan with MoveIt 2, pick and place, follow trajectories.'},{id:'legged',t:'Legged robots & humanoids',b:'Quadrupeds, a hexapod and humanoids: many joints, a floating base.'},{id:'drone',t:'Drones',b:'Multirotors with velocity control.'},{id:'hybrid',t:'Hybrid robots',b:'An arm on a mobile base or on legs: navigation and manipulation in one robot.'}];
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function first(t){var m=String(t||'').match(/^.*?[.!?](\s|$)/);return (m?m[0]:String(t||'')).trim();}
function course(r){return /^tb3_/.test(r.id);}
function facts(r){var o=[];if(r.official)o.push('Official Jazzy workspace');o.push(r.vendor||'ROS2Lab course robot');if(r.moveit)o.push('MoveIt 2');var arm=r.cat==='manipulator';if(r.gazebo)o.push(arm?'Gazebo + ros2_control':r.sensors.length?'Gazebo sensors':'Gazebo');else if(arm)o.push('ros2_control');return o;}
function status(r){return course(r)?'<span class="st st-ok">Course robot</span>':'<span class="st st-test">Under test</span>';}
function card(r){return '<a class="rcard" href="#robot" data-go="robot" data-robot="'+r.id+'" data-s="'+esc((r.title+' '+(r.vendor||'')+' '+r.id+' '+r.about+' '+r.cat+' '+r.sensors.map(function(s){return s[1]+' '+s[0];}).join(' ')).toLowerCase())+'"><span class="rpic"><img src="'+IM[r.id]+'" alt="" width="400" height="300"></span><span class="rbody"><span class="rtop">'+status(r)+'</span><b>'+esc(r.title)+'</b><span class="rabout">'+esc(first(r.about))+'</span><span class="rfacts">'+facts(r).map(function(f){return '<i>'+esc(f)+'</i>';}).join('')+'</span></span><span class="ropen">Open ›</span></a>';}
R.forEach(function(r){if(r.id==='tb3_waffle_pi'&&!r.sensors.length){r.sensors=[['lidar','gpu_lidar','scan'],['camera','camera','camera/image_raw'],['imu','imu','imu']];r.maxV=0.26;r.maxW=1.82;}});
var by={};CATS.forEach(function(c){by[c.id]=[];});R.forEach(function(r){(by[r.cat]=by[r.cat]||[]).push(r);});
Object.keys(by).forEach(function(k){by[k].sort(function(a,b){return (course(b)-course(a))||(!!a.vendor-!!b.vendor);});});
var list=document.getElementById('sim-list'),tabs=document.getElementById('sim-tabs'),q=document.getElementById('sim-q'),feat=document.getElementById('sim-feat');
feat.innerHTML=['tb3_burger','tb3_waffle','tb3_waffle_pi'].map(function(id){var r=R.find(function(x){return x.id===id;});return '<a class="fcard" href="#robot" data-go="robot" data-robot="'+id+'"><img src="'+IM[id]+'" alt="" width="400" height="300"><b>'+esc(r.title.replace('TurtleBot3 ',''))+'</b><span>'+esc(r.sensors.map(function(s){return s[0];}).join(', ')||'lidar, IMU')+'</span></a>';}).join('');
list.innerHTML=CATS.filter(function(c){return by[c.id].length;}).map(function(c){return '<section class="rsec" data-cat="'+c.id+'" id="sim-'+c.id+'"><header><h2>'+c.t+' <span class="cnt">'+by[c.id].length+'</span></h2><p>'+c.b+'</p></header><div class="rgrid">'+by[c.id].filter(function(r){return !course(r);}).map(card).join('')+(c.id==='mobile'?'<a class="rcard tbref" href="#robot" data-go="robot" data-robot="tb3_burger"><span class="rbody"><b>TurtleBot3 Burger, Waffle and Waffle Pi</b><span class="rabout">The course robots are shown at the top of this page.</span></span><span class="ropen">Open ›</span></a>':'')+'</div></section>';}).join('')+
 '<section class="rsec" data-cat="own"><header><h2>Your own robot</h2><p>Open your .urdf / .urdf.xacro and mesh files, or a package folder, with a workspace of its own. Nothing is uploaded: the files stay on your computer.</p></header><div class="rgrid"><a class="rcard own" href="rviz.html?robot=own" data-live="rviz.html?robot=own"><span class="rpic ownpic">&lt;/&gt;</span><span class="rbody"><b>My robot package</b><span class="rabout">Your URDF, built and launched like the others.</span></span><span class="ropen">Open ›</span></a></div></section>';
var active='all';
tabs.innerHTML=[['all','All',R.length]].concat(CATS.filter(function(c){return by[c.id].length;}).map(function(c){return [c.id,c.t,by[c.id].length];})).map(function(t){return '<button type="button" data-cat="'+t[0]+'" aria-pressed="'+(t[0]==='all')+'">'+t[1]+' <span>'+t[2]+'</span></button>';}).join('');
function paint(){var term=(q.value||'').trim().toLowerCase();tabs.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.cat===active?'true':'false');});
  list.querySelectorAll('.rsec').forEach(function(s){var n=0;s.querySelectorAll('.rcard').forEach(function(c){var ok=!term||c.classList.contains('own')||(c.dataset.s||'').indexOf(term)>=0;c.hidden=!ok;if(ok&&!c.classList.contains('own'))n++;});s.hidden=!(active==='all'||s.dataset.cat===active)||(term&&!n&&s.dataset.cat!=='own')||(s.dataset.cat==='own'&&active!=='all');});}
tabs.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;active=b.dataset.cat;paint();});
q.addEventListener('input',paint);
/* robot page */
var sel='tb3_burger';
document.addEventListener('click',function(e){var a=e.target.closest('[data-robot]');if(a)sel=a.getAttribute('data-robot');var l=e.target.closest('[data-live]');if(l){e.preventDefault();toast('On the live site this opens '+l.getAttribute('data-live'));}},true);
function toast(t){var d=document.getElementById('toast');if(!d){d=document.createElement('div');d.id='toast';d.setAttribute('role','status');document.body.appendChild(d);}d.textContent=t;d.classList.add('on');clearTimeout(d._t);d._t=setTimeout(function(){d.classList.remove('on');},2600);}
function renderRobot(){var r=R.find(function(x){return x.id===sel;})||R[0];var c=CATS.find(function(x){return x.id===r.cat;});
  document.getElementById('rb-cat').textContent=c?c.t:'';
  var rows=[['Type',c?c.t:''],['Made by',r.vendor||'ROS2Lab (course robot)'],['Fixed frame',r.frame?'<code>'+esc(r.frame)+'</code>':''],['Description file',r.file?'<code>'+esc(r.file)+'</code>':''],['Package',r.pkg?'<code>'+esc(r.pkg)+'</code>':''],['Gazebo',r.gazebo?'Yes':'Not in this simulator'],['MoveIt 2',r.moveit?'Yes':''],['Max speed',r.maxV?(r.maxV+' m/s, '+r.maxW+' rad/s'):''],['Sensors',r.sensors.length?r.sensors.map(function(s){return esc(s[0])+' <span class="mut">('+esc(s[1])+(s[2]?', <code>/'+esc(s[2])+'</code>':'')+')</span>';}).join('<br>'):''],['Source',r.src?'<a href="'+esc(r.src)+'" target="_blank" rel="noopener">'+esc(r.src.replace('https://github.com/',''))+'</a>'+(r.lic?' · '+esc(r.lic):''):'']].filter(function(x){return x[1];});
  var real=r.real&&r.real.length?'<h3>Real robots like this</h3><ul class="rreal">'+r.real.map(function(x){return '<li><a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.title)+'</a></li>';}).join('')+'</ul>':'';
  var url='rviz.html?robot='+encodeURIComponent(r.id);
  document.getElementById('rb').innerHTML='<div class="rbpic"><img src="'+IM[r.id]+'" alt="'+esc(r.title)+'" width="400" height="300"></div><div class="rbinfo">'+status(r)+'<h1>'+esc(r.title)+'</h1><p class="rblede">'+esc(r.about)+'</p>'+(r.note?'<p class="rbnote">'+esc(r.note)+'</p>':'')+
   '<div class="rbact"><a class="btn btn-main" href="'+url+'" data-live="'+url+'">Open in the simulator</a><a class="btn btn-sec" href="#simulator" data-go="simulator">All robots</a></div>'+
   (course(r)?'':'<p class="rbwarn"><b>Under test.</b> This robot opens in RViz'+(r.gazebo?' and Gazebo':'')+', but it is not used in the course lessons yet.</p>')+
   '<dl class="rbdl">'+rows.map(function(x){return '<dt>'+x[0]+'</dt><dd>'+x[1]+'</dd>';}).join('')+'</dl>'+real+'</div>';}
window.__onView=function(v){if(v==='robot')renderRobot();if(v==='simulator')paint();};
paint();
if(location.hash==='#robot')renderRobot();
})();
