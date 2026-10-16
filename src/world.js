import * as THREE from 'three';

const noiseGLSL = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.5+noise(p*2.03)*.25+noise(p*4.01)*.125+noise(p*8.02)*.0625;}`;

export function createWorld(container, onReady, onNear) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex=0;
  scene.fog=new THREE.FogExp2('#d8c8b0',.009);
  const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.1,450);
  const camTarget=new THREE.Vector3(0,1.8,-12);
  camera.position.set(0,6.5,19);
  camera.lookAt(camTarget);
  const hemi=new THREE.HemisphereLight('#f6e0c1','#a7a88a',2.3);scene.add(hemi);
  const sunLight=new THREE.DirectionalLight('#ffe5b6',3.1);sunLight.position.set(-25,28,-22);sunLight.castShadow=true;
  sunLight.shadow.mapSize.set(1024,1024);sunLight.shadow.camera.left=-25;sunLight.shadow.camera.right=25;sunLight.shadow.camera.top=25;sunLight.shadow.camera.bottom=-25;sunLight.shadow.normalBias=.04;sunLight.shadow.bias=-.0005;sunLight.shadow.radius=5;scene.add(sunLight);
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{night:{value:0},time:{value:0}},vertexShader:`varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;varying vec3 vWorld;uniform float night;uniform float time;${noiseGLSL}
  void main(){vec3 d=normalize(vWorld);float h=max(d.y,0.);vec3 top=mix(vec3(.46,.65,.65),vec3(.035,.075,.16),night);vec3 horizon=mix(vec3(.98,.77,.58),vec3(.24,.40,.48),night);vec3 col=mix(horizon,top,smoothstep(0.,mix(.72,.38,night),h));vec3 sd=normalize(mix(vec3(-.30,.115,-1.),vec3(.34,.20,-1.),night));float dist=length(d-sd);col+=mix(vec3(.38,.17,.065),vec3(.06,.09,.11),night)*exp(-dist*dist*7.);float disc=1.-smoothstep(.029,.032,dist);col=mix(col,mix(vec3(1.,.93,.69),vec3(.87,.94,.88),night),disc);col+=vec3(.3,.24,.12)*exp(-dist*dist*400.)*.4;vec2 uv=d.xz/(d.y+.17);float clouds=fbm(uv*1.5+vec2(time*.002,0.));clouds=smoothstep(.47,.7,clouds)*smoothstep(.05,.2,h)*(1.-smoothstep(.35,.75,h));col=mix(col,mix(vec3(.95,.87,.74),vec3(.15,.24,.32),night),clouds*.48);vec2 starUV=d.xz/(d.y+.05)*170.;float stars=step(.994,hash(floor(starUV)))*pow(max(0.,1.-length(fract(starUV)-.5)*2.),3.);col+=stars*night*smoothstep(.03,.25,h)*(.6+.4*sin(time+hash(floor(starUV))*70.));gl_FragColor=vec4(col,1.);}`});
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(350,48,32),skyMat));

  const waterMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},night:{value:0}},vertexShader:`varying vec3 vPos;void main(){vPos=position;vec3 p=position;p.y+=sin(p.x*.45+p.z*.23)*.035;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`precision highp float;varying vec3 vPos;uniform float time;uniform float night;${noiseGLSL}
  void main(){vec2 p=vPos.xz;float shore=-2.+sin(p.x*.1)*1.5;if(p.y>shore)discard;float depth=shore-p.y;float n=fbm(p*vec2(.24,.7)+vec2(time*.025,-time*.055));float ripple=sin(p.y*2.8+n*5.+time*.7)*.5+.5;vec3 nearCol=mix(vec3(.47,.67,.62),vec3(.09,.29,.35),night);vec3 farCol=mix(vec3(.62,.72,.66),vec3(.16,.32,.39),night);vec3 color=mix(nearCol,farCol,smoothstep(0.,100.,depth));color+=(n-.4)*.13;float foam=(1.-smoothstep(.0,.28,abs(depth-(.7+sin(time*.5+n*2.)*.55))))*(.5+n*.5);foam*=1.-smoothstep(1.,3.,depth);color=mix(color,mix(vec3(.94,.94,.79),vec3(.59,.79,.76),night),foam*.72);float line=pow(ripple,27.)*(.25+n*.7);float pathX=mix(-.3,.34,night)*(-p.y+24.);float reflection=exp(-pow((p.x-pathX)/(3.+depth*.07),2.));color+=mix(vec3(.72,.44,.18),vec3(.36,.51,.50),night)*reflection*line*(.35+smoothstep(4.,40.,depth));float glint=pow(max(0.,noise(p*vec2(3.,7.)+vec2(time*.16,-time*.13))-.65)*2.85,4.);color+=vec3(.2,.24,.19)*glint;gl_FragColor=vec4(color,1.);}`});
  const waterGeo=new THREE.PlaneGeometry(450,320,80,60);waterGeo.rotateX(-Math.PI/2);waterGeo.translate(0,-.01,-140);scene.add(new THREE.Mesh(waterGeo,waterMat));

  const sandGeo=new THREE.PlaneGeometry(200,110,110,70);sandGeo.rotateX(-Math.PI/2);sandGeo.translate(0,0,44);
  const sandPos=sandGeo.attributes.position;
  for(let i=0;i<sandPos.count;i++){let x=sandPos.getX(i),z=sandPos.getZ(i);let dune=Math.pow(Math.max(0,(Math.abs(x)-11)/40),1.5)*2.5;let y=-.14+Math.max(0,z+3)*.018+dune*(.5+.5*Math.sin(z*.12+x*.11))+Math.sin(x*.21+z*.12)*.06;sandPos.setY(i,y);}
  sandGeo.computeVertexNormals();
  const sandMat=new THREE.MeshStandardMaterial({color:'#d9c7a4',roughness:1});
  const sand=new THREE.Mesh(sandGeo,sandMat);sand.receiveShadow=true;scene.add(sand);
  const wetMat=new THREE.MeshStandardMaterial({color:'#b3baa4',roughness:.68,transparent:true,opacity:.45});
  const wetGeo=new THREE.PlaneGeometry(170,3.2,100,1);wetGeo.rotateX(-Math.PI/2);
  for(let i=0;i<wetGeo.attributes.position.count;i++){const x=wetGeo.attributes.position.getX(i);wetGeo.attributes.position.setZ(i,wetGeo.attributes.position.getZ(i)-1.5+Math.sin(x*.1)*1.5);wetGeo.attributes.position.setY(i,.015);}
  scene.add(new THREE.Mesh(wetGeo,wetMat));

  const mats={rock:new THREE.MeshStandardMaterial({color:'#8e998a',flatShading:true,roughness:1}),rockLight:new THREE.MeshStandardMaterial({color:'#b3b6a0',flatShading:true,roughness:1}),rockDark:new THREE.MeshStandardMaterial({color:'#778a80',flatShading:true,roughness:1}),grass:new THREE.MeshStandardMaterial({color:'#919b72',side:THREE.DoubleSide,roughness:1}),grassLight:new THREE.MeshStandardMaterial({color:'#bec29a',side:THREE.DoubleSide,roughness:1})};
  function rock(x,y,z,sx,sy,sz,light=0){const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),light===1?mats.rockLight:light===2?mats.rockDark:mats.rock);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(Math.random()*.3,Math.random()*4,Math.random()*.2);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
  // Rock gardens softly enclose the walkable shore.
  [[-20,2,7,5,3,4],[-18,1,2,3.8,2,3],[-23,4,-3,6,6,5],[-27,5,-10,7,8,7],[-20,1,-8,3,2,3],[22,1,7,4,2,3],[26,2,3,5,4,4],[29,4,-1,6,6,5],[32,5,-8,6,8,6],[-12,.4,8,1.6,.8,1.3],[13,.35,3,1.5,.7,1],[-9,.25,-3,1,.45,.8],[15,.2,-4,1.2,.4,.8]].forEach((r,i)=>rock(...r,i%3));
  // An old stone gateway across the inlet.
  rock(34,1.8,-68,12,3,8,2);rock(29,6,-68,3,7,3,2);rock(39,5.8,-68,3,6.6,3,2);
  const arch=new THREE.Mesh(new THREE.TorusGeometry(5,1.5,5,10,Math.PI),mats.rockDark);arch.position.set(34,8.5,-68);arch.scale.y=.8;scene.add(arch);
  rock(-54,1,-115,18,4,12,2);rock(-44,2,-117,8,6,8,2);
  const grassBlades=[];
  function grass(x,z,scale=1){const group=new THREE.Group();group.position.set(x,.1+Math.max(0,z+3)*.018,z);const mat=Math.random()>.5?mats.grass:mats.grassLight;for(let j=0;j<5;j++){const h=(.5+Math.random()*.7)*scale;const g=new THREE.BufferGeometry();const b=(Math.random()-.5)*.3;g.setAttribute('position',new THREE.Float32BufferAttribute([b-.035,0,0,b+.035,0,0,b+Math.random()*.3,h,(Math.random()-.5)*.15],3));g.computeVertexNormals();const blade=new THREE.Mesh(g,mat);blade.rotation.y=Math.random()*6;group.add(blade);}scene.add(group);grassBlades.push(group);}
  for(let i=0;i<150;i++){let side=i%2?-1:1;grass(side*(12+Math.random()*12),2+Math.random()*22,.7+Math.random()*.5);}
  for(let i=0;i<22;i++)grass(-10+Math.random()*5,9+Math.random()*12,.7);
  for(let i=0;i<45;i++)grass((i%2?-1:1)*(7+Math.random()*5),9+Math.random()*10,.6+Math.random()*.35);
  for(let i=0;i<25;i++){const shell=new THREE.Mesh(new THREE.SphereGeometry(.065+Math.random()*.05,5,4),new THREE.MeshStandardMaterial({color:i%3?'#eee4cc':'#c5baa2',roughness:1}));shell.position.set((Math.random()-.5)*28,.06,-.5+Math.random()*13);shell.scale.y=.3;scene.add(shell);}
  function character(capeColor,scarfColor,isNPC){
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);
    const capeMat=new THREE.MeshStandardMaterial({color:capeColor,roughness:1,side:THREE.DoubleSide});
    const skin=new THREE.MeshStandardMaterial({color:'#e8d0a0',roughness:1});
    const hair=new THREE.MeshStandardMaterial({color:isNPC?'#e0d5b2':'#d9d9c9',roughness:1,flatShading:true});
    const bootMat=new THREE.MeshStandardMaterial({color:'#6f7660',roughness:1});
    const cape=new THREE.Mesh(new THREE.ConeGeometry(.5,1.05,7,1,true),capeMat);cape.position.y=.72;cape.rotation.y=.2;cape.castShadow=true;body.add(cape);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),skin);head.position.y=1.47;head.scale.y=1.1;head.castShadow=true;body.add(head);
    const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.27,8,6,0,Math.PI*2,0,Math.PI*.58),hair);hairCap.position.y=1.52;hairCap.rotation.z=-.18;body.add(hairCap);
    for(let k=0;k<6;k++){const tuft=new THREE.Mesh(new THREE.ConeGeometry(.10,.21,4),hair);tuft.position.set(Math.cos(k)*.19,1.71+Math.sin(k*3)*.05,Math.sin(k)*.18);tuft.rotation.z=Math.cos(k)*.7;body.add(tuft);}
    const scarfMat=new THREE.MeshStandardMaterial({color:scarfColor,roughness:1,side:THREE.DoubleSide});
    const scarf=new THREE.Mesh(new THREE.TorusGeometry(.19,.072,5,12),scarfMat);scarf.position.y=1.23;scarf.rotation.x=Math.PI/2;body.add(scarf);
    const tail=new THREE.Mesh(new THREE.PlaneGeometry(.14,.65,1,5),scarfMat);tail.position.set(.32,1.1,-.15);tail.rotation.set(.4,0,-1.2);body.add(tail);
    const legs=[];for(const x of [-.14,.14]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.27,3,5),bootMat);leg.position.set(x,.2,0);body.add(leg);legs.push(leg);}
    // A tiny star stitched onto the cape.
    const star=new THREE.Mesh(new THREE.OctahedronGeometry(.06),new THREE.MeshStandardMaterial({color:'#f3dfa8',emissive:'#e8ce8d',emissiveIntensity:.25}));star.position.set(.17,.93,.34);body.add(star);
    root.userData={body,cape,tail,legs,phase:Math.random()*6,sitting:false};scene.add(root);return root;
  }
  const npc=character('#809479','#dfbf70',true);npc.position.set(3.8,.05,-.1);npc.rotation.y=.28;
  const player=character('#eee7d1','#b9b998',false);player.position.set(5.3,.08,2.1);player.rotation.y=-2.6;
  const lantern=new THREE.Group();const lanternBody=new THREE.Mesh(new THREE.CylinderGeometry(.11,.13,.3,6),new THREE.MeshStandardMaterial({color:'#e3c58e',emissive:'#e8b260',emissiveIntensity:.6,transparent:true,opacity:.8}));lanternBody.position.y=.25;lantern.add(lanternBody);const lTop=new THREE.Mesh(new THREE.ConeGeometry(.16,.1,6),new THREE.MeshStandardMaterial({color:'#6b7865'}));lTop.position.y=.44;lantern.add(lTop);lantern.position.set(2.9,.05,.3);scene.add(lantern);
  const warmLight=new THREE.PointLight('#ffcf7e',1,7,2);warmLight.position.set(2.9,.6,.3);scene.add(warmLight);
  const birds=[];for(let i=0;i<7;i++){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.45,0,0),new THREE.Vector3(0,-.1,0),new THREE.Vector3(.45,0,0)]);const bird=new THREE.Line(geo,new THREE.LineBasicMaterial({color:'#6c8076',transparent:true,opacity:.7}));bird.position.set(-15+i*3,8+Math.random()*3,-45-Math.random()*25);scene.add(bird);birds.push(bird);}
  const moteGeo=new THREE.BufferGeometry(),moteData=new Float32Array(180*3);for(let i=0;i<180;i++){moteData[i*3]=(Math.random()-.5)*65;moteData[i*3+1]=Math.random()*7+.2;moteData[i*3+2]=-15+Math.random()*40;}moteGeo.setAttribute('position',new THREE.BufferAttribute(moteData,3));
  const motes=new THREE.Points(moteGeo,new THREE.PointsMaterial({color:'#ffedbc',size:.045,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(motes);
  let isNight=false,night=0,sitting=false,disposed=false,immersive=false;
  let yaw=0,pitch=0,drag=false,dragged=false,last={x:0,y:0},target=null;
  const keys=new Set(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const footprints=[];
  function footprint(){const m=new THREE.Mesh(new THREE.CircleGeometry(.075,8),new THREE.MeshBasicMaterial({color:'#9e9e82',transparent:true,opacity:.23,depthWrite:false}));m.rotation.x=-Math.PI/2;m.scale.y=1.7;m.position.set(player.position.x+(footprints.length%2?.1:-.1),.075+Math.max(0,player.position.z+3)*.018,player.position.z+.1);scene.add(m);footprints.push({mesh:m,life:1});if(footprints.length>100){const old=footprints.shift();scene.remove(old.mesh);old.mesh.geometry.dispose();old.mesh.material.dispose();}}
  const clampPosition=v=>{v.x=THREE.MathUtils.clamp(v.x,-11,17);const shore=-2+Math.sin(v.x*.1)*1.5;v.z=THREE.MathUtils.clamp(v.z,shore+1,17);v.y=.05+Math.max(0,v.z+3)*.018;return v;};
  const keydown=e=>{if(/INPUT|TEXTAREA/.test(document.activeElement?.tagName)||document.querySelector('dialog[open]')||!document.getElementById('breathing').hidden)return;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());target=null;if(sitting)setSitting(false);}};
  const keyup=e=>keys.delete(e.key.toLowerCase());
  addEventListener('keydown',keydown);addEventListener('keyup',keyup);addEventListener('blur',()=>keys.clear());
  renderer.domElement.addEventListener('pointerdown',e=>{drag=true;dragged=false;last={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
  renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;if(Math.abs(dx)+Math.abs(dy)>3)dragged=true;yaw=THREE.MathUtils.clamp(yaw-dx*.002,-.55,.55);pitch=THREE.MathUtils.clamp(pitch+dy*.002,-.12,.2);last={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointercancel',()=>drag=false);
  renderer.domElement.addEventListener('pointerup',e=>{drag=false;if(dragged)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=new THREE.Vector3();if(raycaster.ray.intersectPlane(groundPlane,hit)&&hit.z>-5&&hit.z<22&&Math.abs(hit.x)<23){target=clampPosition(hit.clone());if(sitting)setSitting(false);}});
  const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};addEventListener('resize',resize);
  function setSitting(value){sitting=value;player.userData.sitting=value;npc.userData.sitting=value;if(value){player.position.set(5.1,.11,.4);player.rotation.y=-.35;npc.rotation.y=-.25;target=null;keys.clear();}}
  const clock=new THREE.Clock();let step=0,frame=0,lastNear=null;
  const npcScreen=new THREE.Vector3();let bottle=null;
  function tick(){if(disposed)return;requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
    night=THREE.MathUtils.damp(night,isNight?1:0,1.4,dt);skyMat.uniforms.night.value=night;skyMat.uniforms.time.value=t;waterMat.uniforms.night.value=night;waterMat.uniforms.time.value=t;
    hemi.color.set('#f6e0c1').lerp(new THREE.Color('#94c2d1'),night);hemi.groundColor.set('#a7a88a').lerp(new THREE.Color('#365160'),night);hemi.intensity=2.3-night*1.15;sunLight.color.set('#ffe5b6').lerp(new THREE.Color('#a3d6de'),night);sunLight.intensity=3.1-night*2.2;sunLight.position.x=-25+night*55;
    sandMat.color.set('#d9c7a4').lerp(new THREE.Color('#6e858b'),night);wetMat.color.set('#b3baa4').lerp(new THREE.Color('#50777f'),night);scene.fog.color.set('#d8c8b0').lerp(new THREE.Color('#668a97'),night);warmLight.intensity=.5+night*4;motes.material.opacity=.28+night*.6;
    const move=new THREE.Vector3((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),0,(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0));
    if(target){move.copy(target).sub(player.position);move.y=0;if(move.length()<.12){target=null;move.set(0,0,0);}}
    const moving=move.lengthSq()>.001;
    if(moving){move.normalize();player.position.addScaledVector(move,dt*2.5);clampPosition(player.position);player.rotation.y=THREE.MathUtils.lerp(player.rotation.y,Math.atan2(move.x,move.z),.13);step+=dt;if(step>.3){step=0;footprint();}}
    for(const c of [npc,player]){const d=c.userData;d.body.position.y=THREE.MathUtils.damp(d.body.position.y,d.sitting?-.45:(c===player&&moving?Math.abs(Math.sin(t*8))*.045:Math.sin(t*1.3+d.phase)*.015),5,dt);d.cape.rotation.z=Math.sin(t*1.6+d.phase)*.025;d.tail.rotation.z=-1.2+Math.sin(t*2)*.15;for(let i=0;i<2;i++){d.legs[i].rotation.x=d.sitting?-1.25:(c===player&&moving?Math.sin(t*8+i*Math.PI)*.55:0);d.legs[i].position.z=d.sitting?.18:0;}}
    for(let i=0;i<grassBlades.length;i++)grassBlades[i].rotation.z=Math.sin(t*1.3+i*.7)*.05;
    for(let i=0;i<birds.length;i++){birds[i].position.x=-25+((t*.65+i*5)%65);birds[i].position.y=9+Math.sin(t*.65+i)*.5;birds[i].rotation.z=Math.sin(t*2+i)*.13;}
    motes.rotation.y=Math.sin(t*.03)*.05;motes.position.y=Math.sin(t*.25)*.2;
    for(let i=footprints.length-1;i>=0;i--){footprints[i].life-=dt*.012;footprints[i].mesh.material.opacity=Math.max(0,footprints[i].life*.23);}
    if(bottle){bottle.position.z-=dt*.7;bottle.position.y=.14+Math.sin(t*2)*.06;bottle.rotation.z=Math.sin(t*.8)*.15;if(bottle.position.z<-45){scene.remove(bottle);bottle=null;}}
    const followX=immersive?0:(player.position.x-5.3)*.16;const followZ=immersive?0:(player.position.z-2.1)*.12;
    const camDist=innerWidth<600?23:19;
    const framingX=innerWidth<600?3.5:0;
    const desired=new THREE.Vector3(Math.sin(yaw)*camDist+followX+framingX,6.5+pitch*15,Math.cos(yaw)*camDist+followZ);camera.position.lerp(desired,1-Math.exp(-dt*2));camera.lookAt(camTarget.x+followX+framingX,camTarget.y+pitch*8,camTarget.z+followZ);
    if(frame++%3===0){npcScreen.copy(npc.position);npcScreen.y+=2.25;npcScreen.project(camera);const label=document.getElementById('npc-label');if(label){label.style.left=`${(npcScreen.x*.5+.5)*innerWidth}px`;label.style.top=`${(-npcScreen.y*.5+.5)*innerHeight}px`;label.style.transform='translate(-50%,-100%)';label.style.opacity=npcScreen.z<1&&!sitting?'1':'0';}const near=player.position.distanceTo(npc.position)<4;if(near!==lastNear){lastNear=near;onNear?.(near);}}
    renderer.render(scene,camera);if(frame===2)onReady?.();
  }tick();
  return {setNight(value){isNight=value;},setSitting,setImmersive(value){immersive=value;},releaseBottle(){if(bottle)scene.remove(bottle);const mat=new THREE.MeshStandardMaterial({color:'#94bdac',roughness:.25,metalness:.15,transparent:true,opacity:.8});bottle=new THREE.Group();const glass=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.4,8),mat);glass.rotation.z=Math.PI*.4;bottle.add(glass);const cork=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.1,6),new THREE.MeshStandardMaterial({color:'#a3916f'}));cork.position.x=-.2;cork.rotation.z=Math.PI/2;bottle.add(cork);bottle.position.set(5,.1,-2.5);scene.add(bottle);},getState(){return {night:isNight,sitting,position:player.position.toArray()};}};
}
