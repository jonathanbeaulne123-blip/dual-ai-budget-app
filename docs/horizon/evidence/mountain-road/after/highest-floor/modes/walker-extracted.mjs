function walker(body, geography, world, HORIZON_WALKABLE_DEGREES) {
  let held = false, leftSupport = false, velocityY = 0, swimming = false, lastMovementBlocker = null;
  const gateOpen = () => true;
  const waterLevel = (x, z, y) => geography.waterLevel(x, z, y);
  function move(dx, dz, _dt) {
    const length = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(length / 0.15));
    let moved = 0;
    held = false;
    leftSupport = false;
    for (let i = 0; i < steps; i++) {
      const x = body.x + dx / steps, z = body.z + dz / steps;
      if (!gateOpen(x, z)) {
        held = true;
        break;
      }
      if (x < 0.4 || z < 0.4 || x > world.extent.w - 0.4 || z > world.extent.h - 0.4) break;
      const hit = geography.surface(x, z, body.y, 0.48), wet = waterLevel(x, z, body.y), water = wet !== null && (!hit || hit.y < wet - 0.3);
      const height = hit && !water && velocityY === 0 ? Math.max(body.y, hit.y) : body.y;
      const obstacle = geography.blocker(x, z, height, 0.3, [dx / steps, dz / steps]);
      if (obstacle || hit && !water && hit.slope > HORIZON_WALKABLE_DEGREES) {
        lastMovementBlocker = { at: [x, body.y, z], surface: hit, obstacle, water };
        break;
      }
      body.x = x;
      body.z = z;
      if (!swimming && (!hit || body.y - hit.y > 0.48 || water)) {
        moved += length / steps;
        leftSupport = true;
        break;
      }
      if (velocityY === 0 && hit && !water && Math.abs(body.y - hit.y) <= 0.5) body.y = hit.y;
      moved += length / steps;
    }
    return moved;
  }
  return { move, report: () => ({ held, leftSupport, lastMovementBlocker }) };
}
export {
  walker
};
