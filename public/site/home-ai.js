(function(){
  "use strict";
  // Always open the landing page at the beginning of the hero unless a section link was requested.
  if("scrollRestoration" in history) history.scrollRestoration="manual";
  if(!location.hash) requestAnimationFrame(function(){window.scrollTo(0,0);});
  const roles=["Full Stack Developer","Cloud & DevOps Engineer","Data Professional","QA Automation Engineer","SAP Consultant"];
  let roleIndex=0;
  function rotateRole(){
    const el=document.getElementById("aiRole"); if(!el)return;
    el.style.opacity="0"; el.style.transform="translateY(6px)";
    setTimeout(function(){roleIndex=(roleIndex+1)%roles.length;el.textContent=roles[roleIndex];el.style.opacity="1";el.style.transform="translateY(0)";},220);
  }
  function parallax(){
    const stage=document.querySelector(".ai-stage"); if(!stage||!matchMedia("(pointer:fine)").matches)return;
    stage.addEventListener("pointermove",function(e){const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;stage.style.transform="rotateY("+(x*3)+"deg) rotateX("+(-y*2)+"deg)";});
    stage.addEventListener("pointerleave",function(){stage.style.transform="";});
  }
  function createGlobe(){
    const canvas=document.getElementById("aiGlobe"); if(!canvas)return;
    const ctx=canvas.getContext("2d"),points=[]; let angle=0,frame=0;
    for(let i=0;i<190;i++){const y=1-(i/(189))*2,r=Math.sqrt(1-y*y),phi=i*Math.PI*(3-Math.sqrt(5));points.push({x:Math.cos(phi)*r,y:y,z:Math.sin(phi)*r});}
    function resize(){const box=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=box.width*d;canvas.height=box.height*d;ctx.setTransform(d,0,0,d,0,0);}
    function draw(){const w=canvas.clientWidth,h=canvas.clientHeight,cx=w/2,cy=h/2,r=Math.min(w,h)*.36;ctx.clearRect(0,0,w,h);angle+=.0028;const projected=points.map(p=>{const x=p.x*Math.cos(angle)-p.z*Math.sin(angle),z=p.x*Math.sin(angle)+p.z*Math.cos(angle);return{x:cx+x*r,y:cy+p.y*r,z:z,a:.2+(z+1)*.38};});
      const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.22);glow.addColorStop(0,"rgba(47,174,255,.16)");glow.addColorStop(.7,"rgba(78,84,255,.06)");glow.addColorStop(1,"transparent");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,r*1.22,0,Math.PI*2);ctx.fill();
      ctx.lineWidth=.65;for(let i=0;i<projected.length;i++){for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);if(d<r*.19&&a.z>-.45&&b.z>-.45){ctx.strokeStyle="rgba(73,196,255,"+((1-d/(r*.19))*.18)+")";ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}}
      projected.sort((a,b)=>a.z-b.z).forEach(p=>{ctx.fillStyle="rgba(111,226,255,"+p.a+")";ctx.beginPath();ctx.arc(p.x,p.y,p.z>.25?1.7:1.05,0,Math.PI*2);ctx.fill();});
      ctx.strokeStyle="rgba(105,215,255,.32)";ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(cx,cy,r*1.12,r*.32,angle*.35,0,Math.PI*2);ctx.stroke();frame=requestAnimationFrame(draw);}
    resize();addEventListener("resize",resize,{passive:true});if(matchMedia("(prefers-reduced-motion: reduce)").matches){draw();cancelAnimationFrame(frame);}else draw();
  }
  document.addEventListener("DOMContentLoaded",function(){setInterval(rotateRole,2600);parallax();createGlobe();});
})();
