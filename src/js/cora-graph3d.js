/* CORA · motor 3D local sobre lienzo 2D.
   Extraído del mapa de la propuesta curricular para que ambos planes usen la
   misma red tridimensional, sin bibliotecas externas ni WebGL.
   Uso: const g = CoraGraph3D.create(host, opciones); g.setData({nodes, links});
   Cada nodo trae id, name y su posición fx, fy, fz; cada enlace, source y target. */
(function () {
  'use strict';

  const DEFAULT_VIEW = { yaw: -0.34, pitch: 0.18, zoom: 1.12, panX: 0, panY: 0 };

  function pathPolygon(ctx, points, fill, stroke) {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
  }
  const hexagon = (r) => Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [Math.cos(a) * r, Math.sin(a) * r]; });

  function drawShape(ctx, node, r, color, zoom) {
    const dark = '#294557';
    ctx.save();
    ctx.translate(node.screenX, node.screenY);
    const visualScale = Math.max(0.58, node.scale * Math.sqrt(zoom));
    ctx.scale(visualScale, visualScale);
    const shape = node.shape || 'sphere';
    if (shape === 'sphere' || shape === 'core') {
      const size = shape === 'core' ? r * 1.35 : r;
      const gradient = ctx.createRadialGradient(-size * 0.35, -size * 0.4, 1, 0, 0, size * 1.25);
      gradient.addColorStop(0, shape === 'core' ? '#f3ffff' : color);
      gradient.addColorStop(0.42, color);
      gradient.addColorStop(1, '#15334a');
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.shadowColor = shape === 'core' ? '#70d8dc88' : '#01060c99';
      ctx.shadowBlur = shape === 'core' ? 18 : 9;
      ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff80'; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-size * 0.22, -size * 0.48, size * 0.29, size * 0.12, -0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff99'; ctx.fill();
      if (shape === 'core') { ctx.beginPath(); ctx.arc(0, 0, size * 1.55, 0, Math.PI * 2); ctx.strokeStyle = '#70d8dc55'; ctx.lineWidth = 1; ctx.stroke(); }
    } else if (shape === 'cube') {
      const s = r * 0.78;
      pathPolygon(ctx, [[-s, -s], [0, -s * 1.55], [s, -s], [0, -s * 0.48]], '#f4fbff', dark);
      pathPolygon(ctx, [[-s, -s], [0, -s * 0.48], [0, s * 1.22], [-s, s * 0.56]], color || '#b8cfdd', '#6e899b');
      pathPolygon(ctx, [[0, -s * 0.48], [s, -s], [s, s * 0.56], [0, s * 1.22]], '#d5e3eb', '#6e899b');
    } else if (shape === 'triangle') {
      const s = r * 1.1;
      pathPolygon(ctx, [[0, -s], [s * 0.96, s * 0.75], [-s * 0.96, s * 0.75]], color || '#dce8f0', '#7995a7');
      ctx.beginPath(); ctx.moveTo(-s * 0.96, s * 0.75); ctx.lineTo(0, s * 0.42); ctx.lineTo(s * 0.96, s * 0.75);
      ctx.strokeStyle = '#ffffffaa'; ctx.stroke();
    } else if (shape === 'diamond') {
      const s = r;
      pathPolygon(ctx, [[0, -s], [s * 0.8, 0], [0, s], [-s * 0.8, 0]], color || '#e9f3f7', '#8098a6');
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0);
      ctx.strokeStyle = '#ffffffa8'; ctx.stroke();
    } else if (shape === 'hex') {
      pathPolygon(ctx, hexagon(r), color || '#dce8f0', '#7892a1');
      ctx.beginPath(); ctx.moveTo(-r * 0.72, -r * 0.43); ctx.lineTo(0, 0); ctx.lineTo(r * 0.72, -r * 0.43);
      ctx.strokeStyle = '#ffffffaa'; ctx.stroke();
    } else {
      pathPolygon(ctx, hexagon(r), color || '#dce8f0', '#8197a5');
    }
    ctx.restore();
  }

  function wrapLines(text, max = 34, maxLines = 3) {
    const words = String(text || '').split(/\s+/), lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim();
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, max - 3) + '…'; }
    return lines;
  }

  function create(host, options = {}) {
    const opt = {
      nodeColor: () => '#dce8f0',
      nodeRadius: () => 8,
      linkStyle: () => ({ color: '#90a4b355', width: 0.95 }),
      tooltip: (node) => [node.name || node.id],
      onNodeClick: () => {},
      isActive: () => true,
      ariaLabel: 'Visualización tridimensional interactiva de la red curricular',
      ...options,
    };
    const canvas = document.createElement('canvas');
    canvas.className = 'cora-graph3d-canvas';
    canvas.setAttribute('aria-label', opt.ariaLabel);
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;
    host.prepend(canvas);

    const view = { ...DEFAULT_VIEW, drag: null, hovered: '', projected: [] };
    const state = { width: 0, height: 0, data: { nodes: [], links: [] }, frame: 0, focusId: '' };

    function project() {
      const w = state.width, h = state.height, pts = state.data.nodes;
      const spanX = Math.max(600, ...pts.map((n) => Math.abs(n.fx || 0) * 2));
      const spanY = Math.max(600, ...pts.map((n) => Math.abs(n.fy || 0) * 2));
      const scale = Math.min(w / (spanX * 1.24), h / (spanY * 1.24)) * view.zoom;
      const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch), focal = 1350;
      return pts.map((node) => {
        const x = node.fx || 0, y = node.fy || 0, z = node.fz || 0;
        const rx = x * cy - z * sy, rz = x * sy + z * cy, ry = y * cp - rz * sp, depth = y * sp + rz * cp;
        const perspective = focal / Math.max(320, focal - depth);
        return { ...node, screenX: w / 2 + (rx * scale + view.panX) * perspective, screenY: h / 2 + (ry * scale + view.panY) * perspective, depth, scale: perspective };
      });
    }

    function hitTest(x, y, pad) {
      return [...view.projected].reverse().find((n) => Math.hypot(n.screenX - x, n.screenY - y) < opt.nodeRadius(n) * Math.max(0.8, n.scale) + pad);
    }

    function draw(time = 0) {
      const w = state.width, h = state.height;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0f2d57'); bg.addColorStop(1, '#071733');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#dbe8f01a';
      for (let i = 0; i < 36; i++) ctx.fillRect((i * 197 + 43) % w, (i * 113 + 29) % h, 1.2, 1.2);

      const projected = project(), byId = new Map(projected.map((n) => [n.id, n]));
      view.projected = projected;
      const links = state.data.links
        .map((link) => ({ link, a: byId.get(typeof link.source === 'object' ? link.source.id : link.source), b: byId.get(typeof link.target === 'object' ? link.target.id : link.target) }))
        .filter((x) => x.a && x.b)
        .sort((x, y) => (x.a.depth + x.b.depth) - (y.a.depth + y.b.depth));
      for (const { link, a, b } of links) {
        const style = opt.linkStyle(link);
        ctx.beginPath(); ctx.moveTo(a.screenX, a.screenY); ctx.lineTo(b.screenX, b.screenY);
        ctx.strokeStyle = style.color; ctx.lineWidth = style.width; ctx.stroke();
        if (style.arrow || style.bead) {
          const dx = b.screenX - a.screenX, dy = b.screenY - a.screenY, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
          const accent = style.accent || '#8be0d8';
          if (style.arrow) {
            const px = a.screenX + dx * 0.78, py = a.screenY + dy * 0.78, size = 4.5;
            ctx.beginPath(); ctx.moveTo(px + ux * size, py + uy * size);
            ctx.lineTo(px - ux * size * 0.7 - uy * size * 0.65, py - uy * size * 0.7 + ux * size * 0.65);
            ctx.lineTo(px - ux * size * 0.7 + uy * size * 0.65, py - uy * size * 0.7 - ux * size * 0.65);
            ctx.closePath(); ctx.fillStyle = accent; ctx.fill();
          }
          if (style.bead) {
            const t = (time * 0.00022 + (String(link.id || '').length * 0.13)) % 1;
            ctx.beginPath(); ctx.arc(a.screenX + dx * t, a.screenY + dy * t, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = accent; ctx.fill();
          }
        }
      }
      projected.sort((a, b) => a.depth - b.depth);
      for (const node of projected) {
        const r = opt.nodeRadius(node), hover = node.id === view.hovered, focus = node.id === state.focusId;
        drawShape(ctx, node, r + (hover || focus ? 2 : 0), focus ? '#ffffff' : opt.nodeColor(node), view.zoom);
        if (hover) {
          const lines = [].concat(...[].concat(opt.tooltip(node)).map((text, i) => (i === 0 ? wrapLines(text) : [String(text)])));
          ctx.font = '600 12px Inter, system-ui, sans-serif';
          const tw = Math.max(...lines.map((text) => ctx.measureText(text).width)) + 14, boxH = lines.length * 16 + 8;
          let boxY = node.screenY + r + 13;
          if (boxY + boxH > h - 4) boxY = node.screenY - r - boxH - 10;
          ctx.fillStyle = '#071725e8'; ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(node.screenX - tw / 2, boxY, tw, boxH, 5); else ctx.rect(node.screenX - tw / 2, boxY, tw, boxH);
          ctx.fill();
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          lines.forEach((text, i) => { ctx.fillStyle = i === 0 || lines.length < 2 ? '#ffffff' : '#bbd5e1'; ctx.fillText(text, node.screenX, boxY + 8 + i * 16); });
        }
      }
      if (view.drag) {
        ctx.fillStyle = '#dce8f0a8'; ctx.font = '11px Inter,system-ui,sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(view.drag.mode === 'rotate' ? 'Girando la red' : 'Desplazando la red', 16, 22);
      }
    }

    function resize() {
      const rect = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!rect.width || !rect.height) return;
      const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        state.width = rect.width; state.height = rect.height;
        draw(performance.now());
      }
    }

    function start() {
      if (state.frame) return;
      const animate = (time) => {
        if (!opt.isActive() || !host.isConnected || host.offsetParent === null) { state.frame = 0; return; }
        resize(); draw(time);
        state.frame = requestAnimationFrame(animate);
      };
      state.frame = requestAnimationFrame(animate);
    }

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
      view.drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, panX: view.panX, panY: view.panY, mode: e.button === 2 || e.shiftKey ? 'pan' : 'rotate', moved: false };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (view.drag) {
        const dx = e.clientX - view.drag.x, dy = e.clientY - view.drag.y;
        view.drag.moved ||= Math.abs(dx) + Math.abs(dy) > 4;
        if (view.drag.mode === 'pan') { view.panX = view.drag.panX + dx; view.panY = view.drag.panY + dy; }
        else { view.yaw = view.drag.yaw + dx * 0.006; view.pitch = Math.max(-1.25, Math.min(1.25, view.drag.pitch + dy * 0.005)); }
      } else {
        const r = canvas.getBoundingClientRect();
        view.hovered = hitTest(e.clientX - r.left, e.clientY - r.top, 6)?.id || '';
        canvas.style.cursor = view.hovered ? 'pointer' : 'grab';
      }
    });
    canvas.addEventListener('pointerleave', () => { view.hovered = ''; if (!view.drag) canvas.style.cursor = 'grab'; });
    canvas.addEventListener('pointerup', (e) => {
      const drag = view.drag; view.drag = null;
      if (!drag || drag.moved) return;
      const r = canvas.getBoundingClientRect(), node = hitTest(e.clientX - r.left, e.clientY - r.top, 7);
      if (node) opt.onNodeClick(node);
    });
    canvas.addEventListener('pointercancel', () => { view.drag = null; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.zoom = Math.max(0.5, Math.min(4.2, view.zoom * Math.exp(-e.deltaY * 0.001))); }, { passive: false });
    canvas.addEventListener('dblclick', () => Object.assign(view, DEFAULT_VIEW));

    return {
      canvas,
      setData(data, focusId = '') { state.data = data; state.focusId = focusId; resize(); draw(performance.now()); start(); },
      resetView() { Object.assign(view, DEFAULT_VIEW); },
      resize() { resize(); start(); },
    };
  }

  window.CoraGraph3D = { create };
})();
