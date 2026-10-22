/* Playground: games and concept animations (from public/js/games/registry.js and anims/registry.js) */
(function(){
'use strict';
var D={{PG}};
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var ok=D.games.filter(function(g){return g.ok;}),locked=D.games.filter(function(g){return !g.ok;});
var GLYPH={paths:'cd ~/',radio:'/topic',pizza:'goal →',tsa:'T · S · A',source:'source',turtle:'ros2 run'};
document.getElementById('pg-games').innerHTML=ok.map(function(g){return '<a class="pgc" href="playground.html#'+g.id+'" data-live="playground.html#'+g.id+' (the game '+esc(g.t)+')"><span class="pgg">'+esc(GLYPH[g.id]||'ros2')+'</span><span class="pgb"><span class="meta">Week '+g.w+' · '+esc(g.l)+'</span><b>'+esc(g.t)+'</b><span>'+esc(g.d)+'</span><span class="pgbadge">Badge: '+esc(g.b)+'</span></span><span class="pgplay">Play ›</span></a>';}).join('');
document.getElementById('pg-badges').textContent='Badge card: 0 of '+ok.length+' earned';
document.getElementById('pg-locked-n').textContent='('+locked.length+', not yet validated)';
document.getElementById('pg-locked').innerHTML=locked.map(function(g){return '<div class="pgc off"><span class="pgb"><span class="meta">'+(g.w>6?'With the Simulator':'Week '+g.w)+' · '+esc(g.l)+'</span><b>'+esc(g.t)+'</b><span>'+esc(g.d)+'</span></span><span class="st st-test">Not yet validated</span></div>';}).join('');
var weeks={};D.anims.forEach(function(a){(weeks[a.w]=weeks[a.w]||[]).push(a);});
document.getElementById('pg-anims').innerHTML=Object.keys(weeks).sort(function(a,b){return a-b;}).map(function(w){return '<div class="pgw"><h3>Week '+w+'</h3><ul>'+weeks[w].map(function(a){return '<li><a href="playground.html#lab-'+a.id+'" data-live="playground.html#lab-'+a.id+' (the animation)"><b>'+esc(a.t)+'</b><span>'+esc(a.c)+'</span></a></li>';}).join('')+'</ul></div>';}).join('');
})();
