/* games/ sayfasının kahramanı: oyun ve uygulamaların kapak görselleri, dönen bir halka üzerinde 3B kartlar olarak süzülür.
   Ana sayfadaki parçacık bulutundan bilerek farklı: burada gerçek görseller var; karta gelince öne çıkar, tıklayınca sayfasına gider.
   three.js klasik betik (assets/vendor/three.min.js). WebGL yoksa ya da hareket azaltılmışsa kartlar durağan kalır / sahne çizilmez. */
(function () {
  'use strict';
  var THREE = window.THREE, canvas = document.getElementById('games3d');
  if (!THREE || !canvas) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl;
  try { gl = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return; }
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var CARDS = [
    ['cyberacademy', '../cyberacademy/img/darknet-cover-t.webp', '--w-cyber'],
    ['locard', '../locard/img/keyart-t.webp', '--w-noir'],
    ['jellytrails', '../jellytrails/img/banner.webp', '--w-trails'],
    ['jellypipes', '../jellypipes/img/banner.webp', '--w-pipes'],
    ['jellyjars', '../jellyjars/img/banner.webp', '--w-jars'],
    ['jellylogic', '../jellylogic/img/banner.webp', '--w-logic'],
    ['jellyloops', '../jellyloops/img/banner.webp', '--w-loops'],
    ['jellypark', '../jellypark/img/banner.webp', '--w-park'],
    ['jellyseek', '../jellyseek/img/banner.webp', '--w-seek'],
    ['jellyslide', '../jellyslide/img/banner.webp', '--w-slide'],
    ['daypot', '../daypot/img/kitchen.webp', '--w-warm']
  ];
  var W = 2.9, H = 1.41, R = 6.6;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  var ring = new THREE.Group(); scene.add(ring);
  var meshes = [];

  function accent(v) { var s = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return s || '#888888'; }

  CARDS.forEach(function (c, i) {
    var holder = new THREE.Group(), a = i / CARDS.length * Math.PI * 2;
    holder.position.set(Math.sin(a) * R, Math.sin(a * 2 + 1) * .25, Math.cos(a) * R);
    holder.rotation.y = a;
    var border = new THREE.Mesh(new THREE.PlaneGeometry(W + .14, H + .14), new THREE.MeshBasicMaterial({ color: accent(c[2]), transparent: true, opacity: .9, side: THREE.FrontSide }));
    border.position.z = -.012; holder.add(border);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x202020, side: THREE.FrontSide }));
    holder.add(face);
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 500;
      var cx = cv.getContext('2d'), s = Math.max(cv.width / img.width, cv.height / img.height), w = img.width * s, h = img.height * s;
      cx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      var tex = new THREE.CanvasTexture(cv); face.material.map = tex; face.material.color.set(0xffffff); face.material.needsUpdate = true;
    };
    img.src = c[1];
    holder.userData = { slug: c[0], face: face, s: 1 };
    ring.add(holder); meshes.push(face);
  });

  var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(9, 9), hover = null, mx = 0, my = 0, tx = 0, ty = 0, spin = 0, spinV = .0016;
  function size() {
    var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    gl.setSize(w, h, false); camera.aspect = w / h;
    var narrow = w < 560; camera.position.set(0, narrow ? 3.8 : 3.2, narrow ? 21 : 16.4); camera.lookAt(0, -.5, 0); camera.updateProjectionMatrix();
  }
  size(); window.addEventListener('resize', size);
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    tx = mouse.x; ty = mouse.y;
  });
  canvas.addEventListener('pointerleave', function () { mouse.set(9, 9); tx = ty = 0; });
  canvas.addEventListener('click', function () { if (hover) location.href = '../' + hover.userData.slug + '/'; });

  var visible = true, running = false;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) loop(); }).observe(canvas);
  function frame() {
    mx += (tx - mx) * .05; my += (ty - my) * .05;
    ray.setFromCamera(mouse, camera);
    var hit = ray.intersectObjects(meshes)[0], h2 = hit ? hit.object.parent : null;
    if (h2 !== hover) { hover = h2; canvas.style.cursor = hover ? 'pointer' : 'default'; }
    spinV += ((hover ? 0 : .0016) - spinV) * .06; spin += spinV;
    ring.rotation.y = spin + mx * .5; ring.rotation.x = .1 + my * .08; ring.rotation.z = -.05;
    ring.children.forEach(function (c) { var t = c === hover ? 1.14 : 1; c.userData.s += (t - c.userData.s) * .12; c.scale.setScalar(c.userData.s); });
    gl.render(scene, camera);
  }
  function loop() {
    if (running) return; running = true;
    (function tick() { if (!visible || document.hidden) { running = false; return; } frame(); if (reduce) { running = false; return; } requestAnimationFrame(tick); })();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loop(); });
  canvas.classList.add('ready'); loop();
  if (reduce) setTimeout(frame, 600);
})();
