/* certificate views: sample on home + Verify page (same data shape as the site's sample in js/index.js) */
(function(){
'use strict';
var R=window.__renderCertificate;if(!R)return;
function sample(){var now=new Date(),until=new Date(now);until.setFullYear(until.getFullYear()+2);var reg=new Date(now.getTime()-45*86400000);
  var sig="data:image/svg+xml;utf8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90"><path d="M10 62 C 30 20, 45 20, 52 58 S 70 80, 82 40 S 104 18, 112 52 S 132 70, 146 38 S 168 30, 176 56 S 200 66, 214 40 S 240 36, 252 50 L 290 46" fill="none" stroke="#1D2B53" stroke-width="3" stroke-linecap="round"/><path d="M30 76 L 270 70" stroke="#1D2B53" stroke-width="2"/></svg>');
  return {certId:"R2L-2026-SAMPLE0001",name:"Your Name Here",about:"Your programme, department and college, or your designation and workplace",registeredAt:reg,issuedAt:now,validUntil:until,
    course:"ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes",
    modules:["Week 1: Talk to the robot's computer","Week 2: Build the robot's brain","Week 3: Introduction to ROS","Week 4: Speak ROS 2","Week 5: ROS programming fundamentals","Week 6: Writing your own ROS 2 nodes"],
    tests:[[16,20],[13,16],[12,15],[14,18],[13,16],[15,16]].map(function(x,i){return {title:'Week '+(i+1)+' test',best:x[0],max:x[1],pct:x[0]/x[1]*100};}),
    testAverage:82,projectTitle:"Your personal capstone project",projectScore:88,signature:sig,instructor:"Robotics & ROS 2 Lab",instructorTitle:"Course team, ROS2Lab"};}
var big=document.getElementById('cert-big'),mini=document.getElementById('cert-mini'),st=document.getElementById('vstatus');
function drawBig(){if(!big.firstChild)big.appendChild(R(sample(),{sample:true,verifyUrl:"https://www.ros2lab.com/certificate.html?id=R2L-2026-SAMPLE0001"}));}
if(mini&&'IntersectionObserver' in window){var io=new IntersectionObserver(function(e){if(e[0].isIntersecting){io.disconnect();mini.appendChild(R(sample(),{sample:true,verifyUrl:"https://www.ros2lab.com/certificate.html?id=R2L-2026-SAMPLE0001"}));}},{rootMargin:'300px'});io.observe(mini);}
document.getElementById('verify').addEventListener('submit',function(e){e.preventDefault();var id=document.getElementById('cid').value.trim().toUpperCase();
  if(id==='R2L-2026-SAMPLE0001'){st.className='vstatus';st.innerHTML='<b>Sample certificate.</b> This is what a genuine ROS2Lab certificate looks like. A real ID shows “Genuine and valid”, the holder’s name, the issue date and the expiry date.';big.hidden=false;return;}
  st.className='vstatus err';big.hidden=true;
  st.textContent=/^R2L-\d{4}-[A-Z0-9]{10}$/.test(id)?'No certificate with the ID '+id+' exists in our records.':'This does not look like a ROS2Lab certificate ID.';});
var prev=window.__onView;window.__onView=function(v){if(prev)prev(v);if(v==='certificate')drawBig();};
if(location.hash==='#certificate')drawBig();
})();
