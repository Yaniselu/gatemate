import * as THREE from 'three';

/** One airport end of the trip, as the scene needs it. */
export interface JourneyEnd {
  code: string;
  city: string;
  lat: number;
  lon: number;
}

export type JourneyPhase = 'taxi' | 'takeoff' | 'cruise' | 'landing' | 'arrived';

export interface JourneyFrame {
  phase: JourneyPhase;
  /** 0–1 across the whole trip, for the progress bar. */
  progress: number;
  altitudeFt: number;
  speedKmh: number;
  /** 0–1 black overlay between the three acts. */
  fade: number;
}

/** Timeline in seconds: taxi and take-off at home, the route over the globe, approach and landing at the destination. */
const T = { taxi: 2.6, roll: 5.2, climb: 7.0, cruise: 12.6, approach: 15.6, rollout: 18.2, end: 18.8 };
export const JOURNEY_SECONDS = T.end;

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/**
 * The boarding-pass journey: a little jet taxis out, takes off, crosses a dotted globe along the real great-circle
 * route and lands at the destination. Everything is built from primitives and canvas textures: no downloads.
 */
export class FlightJourneyScene {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  private origin: Airfield;
  private dest: Airfield;
  private globe: GlobeAct;
  private disposables: { dispose(): void }[] = [];
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private lastAct = '';

  constructor(private canvas: HTMLCanvasElement, from: JourneyEnd, to: JourneyEnd) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const track = <X extends { dispose(): void }>(x: X) => (this.disposables.push(x), x);
    this.origin = new Airfield(from, { top: '#0b1330', horizon: '#f59e6b', ground: '#1a2a30' }, track);
    this.dest = new Airfield(to, { top: '#0a0f26', horizon: '#8b5cf6', ground: '#17223a' }, track);
    this.globe = new GlobeAct(from, to, track);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait phones see less sideways: widen the lens a little.
    this.camera.fov = w / h < 1.2 ? 52 : 42;
    this.camera.updateProjectionMatrix();
  }

  /** Draws the trip at time t (seconds) and returns what the HUD should show. */
  render(t: number, now: number): JourneyFrame {
    let frame: JourneyFrame;
    let scene: THREE.Scene;
    let act: string;
    if (t < T.climb) {
      act = 'origin';
      scene = this.origin.scene;
      frame = this.departure(t);
    } else if (t < T.cruise) {
      act = 'globe';
      scene = this.globe.scene;
      frame = this.cruise(t);
    } else {
      act = 'dest';
      scene = this.dest.scene;
      frame = this.arrival(t);
    }
    // Snap the camera when the act changes (it's hidden behind the fade).
    if (act !== this.lastAct) {
      this.lastAct = act;
      this.camPos.copy(this.targetPos);
      this.camLook.copy(this.targetLook);
    } else {
      this.camPos.lerp(this.targetPos, 0.12);
      this.camLook.lerp(this.targetLook, 0.18);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.origin.tick(now);
    this.dest.tick(now);
    this.globe.tick(now);
    this.renderer.render(scene, this.camera);
    frame.progress = clamp01(t / T.end);
    return frame;
  }

  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();

  private departure(t: number): JourneyFrame {
    const a = this.origin;
    const plane = a.plane;
    let phase: JourneyPhase = 'taxi', speed = 0, alt = 0;
    if (t < T.taxi) {
      const u = smooth(span(t, 0, T.taxi));
      const p = a.taxiPath.getPointAt(u), d = a.taxiPath.getTangentAt(u);
      plane.position.copy(p);
      plane.rotation.set(0, Math.atan2(-d.z, d.x), 0);
      speed = 25 + 10 * Math.sin(u * Math.PI);
      this.targetPos.set(p.x - 9, 4.2, p.z + 9);
      this.targetLook.copy(p).setY(0.6);
    } else if (t < T.roll) {
      phase = 'takeoff';
      const u = span(t, T.taxi, T.roll);
      const x = -28 + 36 * u * u;
      const rot = smooth(span(x, 2, 8)) * 0.17;
      plane.position.set(x, 0, 0);
      plane.rotation.set(0, 0, rot);
      speed = 20 + 270 * u;
      // Low by the runway edge: the jet rushes past the lens.
      this.targetPos.set(-2 + u * 6, 1.1, -7.5);
      this.targetLook.set(x, 0.8, 0);
    } else {
      phase = 'takeoff';
      const u = span(t, T.roll, T.climb);
      const x = 8 + 38 * u, y = 15 * u * u + 2.5 * u;
      plane.position.set(x, y, 0);
      plane.rotation.set(0.05 * Math.sin(u * 3), 0, 0.17 + 0.05 * u);
      speed = 290 + 60 * u;
      alt = Math.round(y * 220);
      this.targetPos.set(6 + 10 * u, 1.6 + u * 3, -9 - u * 2);
      this.targetLook.set(x, y + 0.5, 0);
    }
    a.gear(plane.position.y < 3);
    const fade = smooth(span(t, T.climb - 0.45, T.climb)) + (1 - smooth(span(t, 0, 0.4)));
    return { phase, progress: 0, altitudeFt: alt, speedKmh: Math.round(speed), fade: clamp01(fade) };
  }

  private cruise(t: number): JourneyFrame {
    const g = this.globe;
    const u = span(t, T.climb, T.cruise);
    const k = smooth(u);
    g.placePlane(k);
    const mid = g.midpoint;
    // Behind and above the route, looking along it, so the planet's curve and horizon show; drifts sideways a little.
    const along = new THREE.Vector3().crossVectors(g.axis, mid).normalize();
    const lift = g.radius * (g.viewDistance - 1);
    // From the side of the route, raised, so the route crosses the frame and the planet's rim curves behind it.
    this.targetPos.copy(mid).multiplyScalar(g.radius + lift * 0.62)
      .addScaledVector(g.axis, -lift * 1.0)
      .addScaledVector(along, (k - 0.5) * lift * 0.18);
    this.targetLook.copy(mid).multiplyScalar(g.radius * 1.01).lerp(g.planeWorld, 0.25);
    const climbOut = smooth(span(u, 0, 0.18)), descent = smooth(span(u, 0.82, 1));
    const alt = Math.round(11000 * climbOut - 7000 * descent) * 3.28;
    const fade = (1 - smooth(span(t, T.climb, T.climb + 0.45))) + smooth(span(t, T.cruise - 0.45, T.cruise));
    return { phase: 'cruise', progress: 0, altitudeFt: Math.max(0, Math.round(alt / 100) * 100), speedKmh: Math.round(840 + 40 * Math.sin(u * Math.PI)), fade: clamp01(fade) };
  }

  private arrival(t: number): JourneyFrame {
    const a = this.dest;
    const plane = a.plane;
    let phase: JourneyPhase = 'landing', speed = 0, alt = 0;
    if (t < T.approach) {
      const u = span(t, T.cruise, T.approach);
      const x = -72 + 52 * u;
      // Glide slope with a flare over the last stretch.
      const y = Math.max(0, 13 * Math.pow(1 - u, 1.6));
      plane.position.set(x, y, 0);
      plane.rotation.set(0, 0, -0.04 + 0.12 * smooth(span(u, 0.75, 1)));
      speed = Math.round(300 - 40 * u);
      alt = Math.round(y * 220);
      this.targetPos.set(x - 10 + u * 4, y + 2.4 - u * 1.2, 6.5 - u * 9);
      this.targetLook.set(x + 2, y, 0);
      a.gear(u > 0.35);
      if (u > 0.985) a.touchdown(plane.position);
    } else {
      const u = span(t, T.approach, T.rollout);
      const e = 1 - Math.pow(1 - u, 2.4);
      const x = -20 + 30 * e;
      plane.position.set(x, 0, 0);
      plane.rotation.set(0, 0, 0.08 * (1 - smooth(span(u, 0, 0.25))));
      speed = Math.round(260 * (1 - e) + 15);
      phase = t > T.rollout ? 'arrived' : 'landing';
      this.targetPos.set(x + 4 - u * 2, 1.4 + u * 2.4, -7.5 + u * 1.5);
      this.targetLook.set(x, 0.6, 0);
      a.gear(true);
    }
    const fade = 1 - smooth(span(t, T.cruise, T.cruise + 0.45));
    return { phase, progress: 0, altitudeFt: alt, speedKmh: phase === 'arrived' ? 0 : speed, fade: clamp01(fade) };
  }

  /** Back to the start for a replay. */
  restart() {
    this.origin.reset();
    this.dest.reset();
    this.lastAct = '';
  }

  dispose() {
    this.origin.reset();
    this.dest.reset();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}

// ---------------------------------------------------------------------------------------------------------------

type Track = <X extends { dispose(): void }>(x: X) => X;

/** A runway, taxiway, terminal and tower at dusk, plus the jet that uses them. */
class Airfield {
  readonly scene = new THREE.Scene();
  readonly plane: THREE.Group;
  readonly taxiPath: THREE.CatmullRomCurve3;
  private gearGroup: THREE.Object3D;
  private blinkers: { sprite: THREE.Sprite; period: number; phase: number }[] = [];
  private puffs: { s: THREE.Sprite; born: number }[] = [];
  private puffTex: THREE.Texture;
  private landed = false;

  constructor(end: JourneyEnd, sky: { top: string; horizon: string; ground: string }, track: Track) {
    const s = this.scene;
    s.background = skyTexture(sky.top, sky.horizon, track);
    s.fog = new THREE.Fog(new THREE.Color(sky.horizon).lerp(new THREE.Color(sky.top), 0.55), 40, 170);
    s.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a1a22, 1.1));
    const sun = new THREE.DirectionalLight(new THREE.Color(sky.horizon).lerp(new THREE.Color('#ffffff'), 0.5), 2.2);
    sun.position.set(-30, 25, -40);
    s.add(sun);

    const mat = (c: string, extra: THREE.MeshStandardMaterialParameters = {}) => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...extra }));
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(600, 600)), mat(sky.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    s.add(ground);

    // Runway with centre line, threshold bars and edge lights.
    const rw = new THREE.Mesh(track(new THREE.PlaneGeometry(64, 3.4)), mat('#2a2f38', { roughness: 0.95 }));
    rw.rotation.x = -Math.PI / 2;
    s.add(rw);
    const white = mat('#e8edf5', { emissive: '#7a8597', emissiveIntensity: 0.4 });
    const dashGeo = track(new THREE.PlaneGeometry(1.6, 0.12));
    for (let x = -27; x < 30; x += 3.2) {
      const d = new THREE.Mesh(dashGeo, white);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0.005, 0);
      s.add(d);
    }
    const barGeo = track(new THREE.PlaneGeometry(2.2, 0.16));
    for (const end of [-1, 1]) for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const b = new THREE.Mesh(barGeo, white);
      b.rotation.x = -Math.PI / 2;
      b.position.set(end * 30.4, 0.005, i * 0.36);
      s.add(b);
    }
    const lights: number[] = [], colors: number[] = [];
    for (let x = -32; x <= 32; x += 2) for (const z of [-1.85, 1.85]) {
      lights.push(x, 0.08, z);
      const c = new THREE.Color(Math.abs(x) > 29 ? (x < 0 ? '#3ef08a' : '#ff4d4d') : '#ffe9b0');
      colors.push(c.r, c.g, c.b);
    }
    // Approach lights leading in from the west.
    for (let x = -34; x >= -60; x -= 2) { lights.push(x, 0.08, 0); colors.push(1, 0.95, 0.8); }
    const lg = track(new THREE.BufferGeometry());
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    s.add(new THREE.Points(lg, track(new THREE.PointsMaterial({ size: 0.55, map: glowTexture(track), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));

    // Taxiway with a yellow centre line from the apron to the runway's western end.
    this.taxiPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-14, 0, 9.5), new THREE.Vector3(-22, 0, 9.5), new THREE.Vector3(-27.5, 0, 8), new THREE.Vector3(-29.5, 0, 4),
      new THREE.Vector3(-28.8, 0, 0.6), new THREE.Vector3(-27.6, 0, 0),
    ], false, 'centripetal');
    const tw = new THREE.Mesh(track(new THREE.TubeGeometry(this.taxiPath, 60, 1.2, 4, false)), mat('#30353e'));
    tw.scale.y = 0.02;
    s.add(tw);
    const tl = new THREE.Mesh(track(new THREE.TubeGeometry(this.taxiPath, 60, 0.06, 4, false)), mat('#facc15', { emissive: '#facc15', emissiveIntensity: 0.6 }));
    tl.scale.y = 0.2;
    tl.position.y = 0.03;
    s.add(tl);
    const apron = new THREE.Mesh(track(new THREE.PlaneGeometry(26, 9)), mat('#2c323b'));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(-6, 0.004, 12);
    s.add(apron);

    // Terminal with a lit glass façade, a control tower and hangars.
    const term = new THREE.Mesh(track(new THREE.BoxGeometry(22, 3.2, 5)), mat('#cdd6e2', { roughness: 0.5, metalness: 0.2 }));
    term.position.set(-5, 1.6, 19);
    s.add(term);
    const glass = new THREE.Mesh(track(new THREE.PlaneGeometry(21, 1.6)), track(new THREE.MeshStandardMaterial({ color: '#0e2a3a', emissive: '#ffcf7a', emissiveIntensity: 0.9, emissiveMap: windowsTexture(track) })));
    glass.position.set(-5, 1.7, 16.48);
    glass.rotation.y = Math.PI;
    s.add(glass);
    const roof = new THREE.Mesh(track(new THREE.BoxGeometry(23, 0.3, 6)), mat('#94a3b8', { metalness: 0.4, roughness: 0.4 }));
    roof.position.set(-5, 3.3, 19);
    s.add(roof);
    const tower = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.6, 7, 12)), mat('#cbd5e1'));
    tower.position.set(12, 3.5, 17);
    s.add(tower);
    const cab = new THREE.Mesh(track(new THREE.CylinderGeometry(1.3, 1.0, 1.1, 12)), mat('#0f766e', { emissive: '#22c7d3', emissiveIntensity: 1.2 }));
    cab.position.set(12, 7.4, 17);
    s.add(cab);
    for (const [x, z] of [[24, 15], [31, 15]]) {
      const h = new THREE.Mesh(track(new THREE.BoxGeometry(6, 3, 5)), mat('#64748b', { metalness: 0.3 }));
      h.position.set(x, 1.5, z);
      s.add(h);
    }
    // City glow on the horizon.
    const city = new THREE.Points(track(cityGeometry()), track(new THREE.PointsMaterial({ size: 0.9, map: glowTexture(track), color: '#ffd59a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    s.add(city);

    const label = labelSprite(end.code, end.city, track);
    label.position.set(-5, 6.4, 19);
    label.scale.set(9, 2.25, 1);
    s.add(label);

    const p = buildJet(track);
    this.plane = p.group;
    this.gearGroup = p.gear;
    this.blinkers = p.blinkers;
    s.add(this.plane);
    this.puffTex = glowTexture(track, 'rgba(230,235,245,1)');
  }

  gear(down: boolean) {
    this.gearGroup.visible = down;
  }

  touchdown(at: THREE.Vector3) {
    if (this.landed) return;
    this.landed = true;
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, opacity: 0.7 }));
      s.position.set(at.x - 0.4 - i * 0.25, 0.2, (i % 2 ? 1 : -1) * 0.45);
      s.scale.setScalar(0.4);
      this.scene.add(s);
      this.puffs.push({ s, born: performance.now() + i * 40 });
    }
  }

  reset() {
    this.landed = false;
    for (const p of this.puffs) {
      this.scene.remove(p.s);
      p.s.material.dispose();
    }
    this.puffs = [];
  }

  tick(now: number) {
    for (const b of this.blinkers) b.sprite.visible = ((now / 1000 + b.phase) % b.period) < 0.12;
    for (const p of this.puffs) {
      const age = (now - p.born) / 1000;
      if (age < 0) continue;
      p.s.scale.setScalar(0.4 + age * 2.2);
      p.s.material.opacity = Math.max(0, 0.7 - age * 0.55);
      p.s.position.y = 0.2 + age * 0.5;
    }
  }
}

/** A dotted night globe with the great-circle route glowing between the two airports. */
class GlobeAct {
  readonly scene = new THREE.Scene();
  readonly radius = 10;
  readonly midpoint: THREE.Vector3;
  readonly axis: THREE.Vector3;
  readonly viewDistance: number;
  readonly planeWorld = new THREE.Vector3();
  private a: THREE.Vector3;
  private b: THREE.Vector3;
  private angle: number;
  private jet: THREE.Group;
  private trail: THREE.Line;
  private trailPts: Float32Array;
  private pulses: THREE.Sprite[] = [];

  constructor(from: JourneyEnd, to: JourneyEnd, track: Track) {
    const s = this.scene, R = this.radius;
    s.background = new THREE.Color('#030614');
    s.add(new THREE.AmbientLight(0x8899cc, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(30, 20, 40);
    s.add(key);

    // Stars.
    const star: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(180 + Math.random() * 120);
      star.push(v.x, v.y, v.z);
    }
    const sg = track(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.Float32BufferAttribute(star, 3));
    s.add(new THREE.Points(sg, track(new THREE.PointsMaterial({ size: 0.9, color: '#c7d2fe', transparent: true, opacity: 0.8, depthWrite: false }))));

    // Ocean sphere, dotted grid of the planet and an atmosphere rim.
    s.add(new THREE.Mesh(track(new THREE.SphereGeometry(R * 0.995, 64, 48)), track(new THREE.MeshStandardMaterial({ color: '#0a1636', roughness: 0.6, metalness: 0.1, emissive: '#061028', emissiveIntensity: 0.6 }))));
    const dots: number[] = [];
    const N = 9000;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      dots.push(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R);
    }
    const dg = track(new THREE.BufferGeometry());
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    s.add(new THREE.Points(dg, track(new THREE.PointsMaterial({ size: 0.06, color: '#5eead4', transparent: true, opacity: 0.7 }))));
    s.add(new THREE.Mesh(track(new THREE.SphereGeometry(R * 1.12, 64, 48)), track(new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 n; void main(){ float i = pow(0.72 - dot(n, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.25,0.55,1.0,1.0) * i; }',
    }))));

    this.a = toVec(from.lat, from.lon);
    this.b = toVec(to.lat, to.lon);
    this.angle = Math.max(0.02, this.a.angleTo(this.b));
    this.axis = new THREE.Vector3().crossVectors(this.a, this.b).normalize();
    if (this.axis.lengthSq() < 1e-6) this.axis.set(0, 1, 0);
    this.midpoint = this.a.clone().add(this.b).normalize();
    // Close for a short hop, further out for an ocean crossing.
    this.viewDistance = 1 + Math.max(0.3, this.angle * 1.25);

    // The route: a raised arc, faint in full and bright behind the jet.
    const full: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) full.push(this.arcPoint(i / 96));
    const dashed = new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(full)), track(new THREE.LineDashedMaterial({ color: '#94a3b8', dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.6 })));
    dashed.computeLineDistances();
    s.add(dashed);
    this.trailPts = new Float32Array(97 * 3);
    const tg = track(new THREE.BufferGeometry());
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPts, 3));
    tg.setDrawRange(0, 0);
    this.trail = new THREE.Line(tg, track(new THREE.LineBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.95 })));
    s.add(this.trail);

    for (const [end, v, color] of [[from, this.a, '#22d3ee'], [to, this.b, '#f472b6']] as const) {
      const pos = v.clone().multiplyScalar(R * 1.002);
      const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(track), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      dot.position.copy(pos);
      dot.scale.setScalar(0.35);
      s.add(dot);
      const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(track), color, transparent: true, depthWrite: false }));
      pulse.position.copy(pos);
      s.add(pulse);
      this.pulses.push(pulse);
      const lab = labelSprite(end.code, end.city, track);
      const size = Math.min(1.6, 0.5 + this.angle * 1.2);
      lab.position.copy(v.clone().multiplyScalar(R + size * 0.45));
      lab.scale.set(size * 2, size * 0.5, 1);
      s.add(lab);
    }

    this.jet = buildJet(track).group;
    this.jet.scale.setScalar(0.07 + this.angle * 0.06);
    s.add(this.jet);
  }

  private arcPoint(k: number) {
    const v = this.a.clone().applyAxisAngle(this.axis, this.angle * k);
    const lift = 1 + Math.sin(Math.PI * k) * Math.min(0.12, 0.02 + this.angle * 0.12);
    return v.multiplyScalar(this.radius * lift);
  }

  placePlane(k: number) {
    const p = this.arcPoint(k), ahead = this.arcPoint(Math.min(1, k + 0.01)), behind = this.arcPoint(Math.max(0, k - 0.01));
    this.jet.position.copy(p);
    this.planeWorld.copy(p);
    const fwd = ahead.sub(behind).normalize(), up = p.clone().normalize();
    const m = new THREE.Matrix4().makeBasis(fwd, up, new THREE.Vector3().crossVectors(fwd, up).normalize());
    this.jet.quaternion.setFromRotationMatrix(m);
    const n = Math.max(1, Math.round(k * 96));
    for (let i = 0; i <= n; i++) {
      const q = this.arcPoint((i / 96));
      this.trailPts.set([q.x, q.y, q.z], i * 3);
    }
    this.trail.geometry.attributes['position'].needsUpdate = true;
    this.trail.geometry.setDrawRange(0, n + 1);
  }

  tick(now: number) {
    this.pulses.forEach((p, i) => {
      const u = ((now / 1400 + i * 0.5) % 1);
      p.scale.setScalar(0.3 + u * 1.2);
      p.material.opacity = 1 - u;
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------

/** A twin-engine jet in Gatemate colours, ~5 units long, nose along +X, wheels at y = 0. */
function buildJet(track: Track) {
  const g = new THREE.Group();
  const body = track(new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35, metalness: 0.25 }));
  const teal = track(new THREE.MeshStandardMaterial({ color: '#0fb5c3', roughness: 0.4, metalness: 0.3, emissive: '#0a5f68', emissiveIntensity: 0.25 }));
  const grey = track(new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.4, metalness: 0.6 }));
  const dark = track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.3 }));

  const fus = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.34, 3.6, 8, 20)), body);
  fus.rotation.z = Math.PI / 2;
  fus.position.y = 0.72;
  g.add(fus);
  const belly = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.3, 3.2, 6, 16)), teal);
  belly.rotation.z = Math.PI / 2;
  belly.scale.set(1, 1, 0.98);
  belly.position.set(-0.05, 0.6, 0);
  g.add(belly);
  const windows = new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 0.07, 0.7)), dark);
  windows.position.set(0.2, 0.86, 0);
  g.add(windows);
  const cockpit = new THREE.Mesh(track(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), dark);
  cockpit.position.set(2.05, 0.82, 0);
  cockpit.rotation.z = -0.9;
  cockpit.scale.set(1, 0.6, 1.3);
  g.add(cockpit);

  // Swept wings and tailplane from extruded shapes.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.55, 0);
  wingShape.lineTo(-0.35, 2.6);
  wingShape.lineTo(-0.75, 2.6);
  wingShape.lineTo(-0.6, 0);
  wingShape.closePath();
  const wingGeo = track(new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false }));
  for (const side of [1, -1]) {
    const w = new THREE.Mesh(wingGeo, body);
    w.rotation.x = side * Math.PI / 2;
    w.position.set(0.1, 0.55, 0);
    w.rotateX(side * -0.06);
    g.add(w);
    const eng = new THREE.Mesh(track(new THREE.CylinderGeometry(0.17, 0.15, 0.7, 16)), grey);
    eng.rotation.z = Math.PI / 2;
    eng.position.set(0.35, 0.36, side * 0.95);
    g.add(eng);
    const intake = new THREE.Mesh(track(new THREE.CircleGeometry(0.15, 16)), dark);
    intake.rotation.y = Math.PI / 2;
    intake.position.set(0.71, 0.36, side * 0.95);
    g.add(intake);
  }
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(0.75, 0);
  tailShape.lineTo(0.15, 1.15);
  tailShape.lineTo(-0.25, 1.15);
  tailShape.closePath();
  const fin = new THREE.Mesh(track(new THREE.ExtrudeGeometry(tailShape, { depth: 0.05, bevelEnabled: false })), teal);
  fin.position.set(-2.15, 0.9, -0.025);
  g.add(fin);
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0.3, 0);
  stabShape.lineTo(-0.15, 0.95);
  stabShape.lineTo(-0.4, 0.95);
  stabShape.lineTo(-0.35, 0);
  stabShape.closePath();
  const stabGeo = track(new THREE.ExtrudeGeometry(stabShape, { depth: 0.04, bevelEnabled: false }));
  for (const side of [1, -1]) {
    const st = new THREE.Mesh(stabGeo, body);
    st.rotation.x = side * Math.PI / 2;
    st.position.set(-1.95, 0.85, 0);
    g.add(st);
  }

  // Landing gear.
  const gear = new THREE.Group();
  const wheel = track(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 12));
  const strut = track(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6));
  for (const [x, z] of [[1.6, 0], [0, 0.45], [0, -0.45]]) {
    const w = new THREE.Mesh(wheel, dark);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.11, z);
    gear.add(w);
    const s = new THREE.Mesh(strut, grey);
    s.position.set(x, 0.32, z);
    gear.add(s);
  }
  g.add(gear);

  // Navigation lights: steady red/green tips, flashing white strobes and a red beacon.
  const glow = glowTexture(track);
  const light = (color: string, x: number, y: number, z: number, size: number) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    g.add(s);
    return s;
  };
  light('#ff3b3b', -0.7, 0.57, -2.62, 0.35);
  light('#3bff7a', -0.7, 0.57, 2.62, 0.35);
  const blinkers = [
    { sprite: light('#ffffff', -0.72, 0.58, -2.64, 0.9), period: 1.1, phase: 0 },
    { sprite: light('#ffffff', -0.72, 0.58, 2.64, 0.9), period: 1.1, phase: 0 },
    { sprite: light('#ff2a2a', 0.2, 1.08, 0, 0.6), period: 1.4, phase: 0.5 },
  ];
  return { group: g, gear, blinkers };
}

function toVec(lat: number, lon: number) {
  const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)).normalize();
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, track: Track) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = track(new THREE.CanvasTexture(cv));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyTexture(top: string, horizon: string, track: Track) {
  return canvasTex(4, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.62, new THREE.Color(top).lerp(new THREE.Color(horizon), 0.45).getStyle());
    g.addColorStop(0.86, horizon);
    g.addColorStop(1, new THREE.Color(horizon).lerp(new THREE.Color('#000000'), 0.5).getStyle());
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 256);
  }, track);
}

function glowTexture(track: Track, color = 'rgba(255,255,255,1)') {
  return canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.6)'));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }, track);
}

function ringTexture(track: Track) {
  return canvasTex(128, 128, (c) => {
    c.strokeStyle = 'rgba(255,255,255,1)';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.stroke();
  }, track);
}

function windowsTexture(track: Track) {
  return canvasTex(256, 32, (c) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, 256, 32);
    for (let x = 2; x < 256; x += 8) {
      c.fillStyle = Math.random() > 0.2 ? '#fff' : '#555';
      c.fillRect(x, 4, 6, 24);
    }
  }, track);
}

function labelSprite(code: string, city: string, track: Track) {
  const tex = canvasTex(512, 128, (c) => {
    c.fillStyle = 'rgba(8,12,28,0.72)';
    const r = 30;
    c.beginPath();
    c.roundRect(4, 14, 504, 100, r);
    c.fill();
    c.strokeStyle = 'rgba(34,199,211,0.9)';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = '800 58px Inter, system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.fillText(code, 36, 66);
    const w = c.measureText(code).width;
    c.fillStyle = 'rgba(203,213,225,0.95)';
    c.font = '600 36px Inter, system-ui, sans-serif';
    const name = city.length > 16 ? city.slice(0, 15) + '…' : city;
    c.fillText(name, 36 + w + 22, 68);
  }, track);
  return new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })));
}

function cityGeometry() {
  const pts: number[] = [];
  for (let i = 0; i < 260; i++) {
    const x = -120 + Math.random() * 240, z = 70 + Math.random() * 60;
    pts.push(x, 0.3 + Math.random() * 1.2, z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}
