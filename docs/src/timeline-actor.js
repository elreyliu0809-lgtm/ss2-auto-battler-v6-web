/* Independent consumer of source SS2 layered timelines. Local timing/transform
   contract is explicit in each actor; this is not the original engine runtime. */
(function (global, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else global.SS2TimelineRenderer = value;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const IDENTITY_COLOR = [255, 255, 255, 0, 0, 0];
  const imageCaches = new WeakMap();
  const orderedLayers = new WeakMap();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function matrix(display) {
    const [x, y, sx, sy, skewX, skewY] = display;
    return [Math.cos(skewY * RAD) * sx, Math.sin(skewY * RAD) * sx,
      -Math.sin(skewX * RAD) * sy, Math.cos(skewX * RAD) * sy, x, y];
  }
  function multiply(p, q) {
    return [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1],
      p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
      p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
  }
  const point = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  function angleDelta(a, b, direction) {
    let delta = b - a;
    // Authored full turns remain full turns. A direction flag only resolves a
    // sub-turn interval; this avoids silently flattening -1080/-720 keyframes.
    if (Math.abs(delta) < 360) {
      if (direction === 'ccw' && delta < 0) delta += 360;
      if (direction === 'cw' && delta > 0) delta -= 360;
    }
    return delta;
  }
  function sampleLayer(frames, frame) {
    if (!frames.length || frame < frames[0].si) return null;
    let lo = 0, hi = frames.length;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (frames[mid].si <= frame) lo = mid; else hi = mid; }
    const a = frames[lo], b = frames[lo + 1];
    if (a.empty) return null;
    const out = { ...a, display: a.display.slice(), color: a.color.slice(), elapsed: Math.max(0, frame - a.si) };
    if (b && !b.empty && a.tween === 'motion' && b.si > a.si) {
      const t = clamp((frame - a.si) / (b.si - a.si), 0, 1);
      out.display = a.display.map((v, i) => v + (i >= 4 ? angleDelta(v, b.display[i], a.tr) : b.display[i] - v) * t);
      out.alpha = a.alpha + (b.alpha - a.alpha) * t;
      out.color = a.color.map((v, i) => v + (b.color[i] - v) * t);
    }
    return out;
  }
  function childFrame(sample, node) {
    const start = Math.max(0, sample.firstFrame || 0), count = Math.max(1, node.maxFrames);
    if (sample.loop === 'single frame') return Math.min(count - 1, start);
    const progressed = start + sample.elapsed;
    if (sample.loop === 'play once') return Math.min(count - 1, progressed);
    return ((progressed % count) + count) % count;
  }
  function composeColor(parent, child) {
    return [0, 1, 2].map(i => parent[i] * child[i] / 255)
      .concat([0, 1, 2].map(i => child[i + 3] * parent[i] / 255 + parent[i + 3]));
  }
  function transformRGBA(rgba, color) {
    return [0, 1, 2].map(i => clamp(Math.round(rgba[i] * color[i] / 255 + color[i + 3]), 0, 255)).concat(rgba[3]);
  }
  function neutral(color) { return color.every((v, i) => Math.abs(v - IDENTITY_COLOR[i]) < 0.001); }
  function regionGeometry(region, anchor = [0.5, 0.5]) {
    const [,, rw, rh] = region.rect;
    const width = region.rotated ? rh : rw, height = region.rotated ? rw : rh;
    const [ox, oy] = region.offset || [0, 0];
    const [originalWidth, originalHeight] = region.originalSize || [width, height];
    const ax = Number(anchor[0]), ay = Number(anchor[1]);
    if (!Number.isFinite(ax) || !Number.isFinite(ay)) throw Error('Invalid source sprite anchor');
    return { width, height, left: -originalWidth * ax + (originalWidth - width) / 2 + ox,
      top: -originalHeight * (1 - ay) + (originalHeight - height) / 2 - oy };
  }
  function sampleActor(d, action, time) {
    if (d.format !== 'legacy-timeline-v1') throw Error('Unsupported layered actor format');
    const animation = d.animations[action];
    if (!animation) throw Error('Missing real source action ' + action);
    const rootFrame = clamp(Math.max(0, time) * d.fps, 0, animation.maxFrames - 1);
    const primitives = [], active = new Set();
    function visit(name, frame, parentMatrix, parentAlpha, parentColor, depth, parentBlend) {
      const node = d.nodes[name];
      if (!node) throw Error('Missing source sub-timeline ' + name);
      if (depth > 24 || active.has(name)) throw Error('Cyclic/deep source sub-timeline ' + name);
      active.add(name);
      // Exported layer z is a front-to-back depth rank, not a Canvas paint index.
      // Paint back-to-front within each nested timeline; never globally sort children.
      if (!orderedLayers.has(node)) orderedLayers.set(node, [...node.layers].sort((a, b) => b.z - a.z || (b.sourceOrder || 0) - (a.sourceOrder || 0)));
      for (const layer of orderedLayers.get(node)) {
        const sampled = sampleLayer(layer.frames, frame);
        if (!sampled) continue;
        if (sampled.kind === 'var') {
          if (Object.prototype.hasOwnProperty.call(d.variableBindings || {}, sampled.link) && d.variableBindings[sampled.link] === null) continue;
          throw Error('Unresolved optional source attachment ' + sampled.link);
        }
        const alpha = parentAlpha * sampled.alpha;
        if (alpha <= 0.001) continue;
        const combined = multiply(parentMatrix, matrix(sampled.display));
        const color = composeColor(parentColor, sampled.color);
        const blend = sampled.blend || parentBlend || 'normal';
        if (sampled.kind === 'sub') {
          const sub = d.nodes[sampled.link];
          if (!sub) throw Error('Missing source sub-timeline ' + sampled.link);
          visit(sampled.link, childFrame(sampled, sub), combined, alpha, color, depth + 1, blend);
        } else if (sampled.kind === 'symbol' || sampled.kind === 'bitmap') {
          const region = d.atlas[sampled.link];
          if (!region) throw Error('Missing source image region ' + sampled.link);
          const anchor = node.anchors?.[sampled.link] || [0.5, 0.5], g = regionGeometry(region, anchor);
          const quad = [[g.left, -g.top], [g.left + g.width, -g.top],
            [g.left + g.width, -g.top - g.height], [g.left, -g.top - g.height]]
            .map(([px, py]) => point(combined, px, py));
          if (![...combined, alpha, ...color, ...quad.flat()].every(Number.isFinite)) throw Error('Nonfinite source pose');
          primitives.push({ page: region.page, regionKey: sampled.link, region, matrix: combined,
            alpha, color, blend, quad, anchor, node: name, frame, z: layer.z });
        } else throw Error('Unsupported source element ' + sampled.kind);
      }
      active.delete(name);
    }
    visit(animation.node, rootFrame, [1, 0, 0, 1, 0, 0], 1, IDENTITY_COLOR, 0, 'normal');
    return primitives;
  }
  function makeCanvas(width, height) {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height)
      : typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) throw Error('Layer color transform requires a browser canvas');
    canvas.width = width; canvas.height = height;
    return canvas;
  }
  function tintedTile(image, region, color) {
    let cache = imageCaches.get(image);
    if (!cache) { cache = new Map(); imageCaches.set(image, cache); }
    const key = region.rect.join(',') + '/' + Number(region.rotated) + '/' + color.map(v => Math.round(v * 1000) / 1000).join(',');
    if (cache.has(key)) return cache.get(key);
    const g = regionGeometry(region), tile = makeCanvas(g.width, g.height), ctx = tile.getContext('2d', { willReadFrequently: true });
    const [sx, sy, sw, sh] = region.rect;
    if (region.rotated) {
      ctx.save(); ctx.translate(0, g.height); ctx.rotate(-Math.PI / 2);
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh); ctx.restore();
    } else ctx.drawImage(image, sx, sy, sw, sh, 0, 0, g.width, g.height);
    if (!neutral(color)) {
      const pixels = ctx.getImageData(0, 0, g.width, g.height), bytes = pixels.data;
      for (let i = 0; i < bytes.length; i += 4) {
        const transformed = transformRGBA([bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]], color);
        bytes[i] = transformed[0]; bytes[i + 1] = transformed[1]; bytes[i + 2] = transformed[2];
      }
      ctx.putImageData(pixels, 0, 0);
    }
    if (cache.size >= 128) cache.delete(cache.keys().next().value);
    cache.set(key, tile);
    return tile;
  }
  function draw(ctx, d, images, action, time, x, y, scale = 1, flip = false) {
    const primitives = sampleActor(d, action, time);
    ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -scale : scale, -scale);
    for (const primitive of primitives) {
      const image = images[primitive.page];
      if (!image) throw Error('Missing actual layered texture ' + primitive.page);
      const region = primitive.region, g = regionGeometry(region, primitive.anchor), [sx, sy, sw, sh] = region.rect;
      ctx.save(); ctx.transform(...primitive.matrix); ctx.globalAlpha = primitive.alpha;
      ctx.globalCompositeOperation = primitive.blend === 'add' ? 'lighter' : 'source-over'; ctx.scale(1, -1);
      if (neutral(primitive.color) && !region.rotated) ctx.drawImage(image, sx, sy, sw, sh, g.left, g.top, g.width, g.height);
      else ctx.drawImage(tintedTile(image, region, primitive.color), g.left, g.top, g.width, g.height);
      ctx.restore();
    }
    ctx.restore();
    return { drawn: primitives.length, sourceAction: action, sourceTime: time };
  }
  return Object.freeze({ draw, sampleActor, sampleLayer, childFrame, matrix, multiply, point,
    angleDelta, composeColor, transformRGBA, regionGeometry, contract: 'LOCAL_ADAPTATION_30FPS_SOURCE_KEYFRAMES' });
});
