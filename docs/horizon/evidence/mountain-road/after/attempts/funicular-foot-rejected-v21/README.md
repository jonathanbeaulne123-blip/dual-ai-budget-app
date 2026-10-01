# Rejected no-propagated-hint geometry

Both runs use the same candidate source. The first failed runner attempted to serialize an undefined post-construction diagnostic and hid the real exception. The corrected runner records the actual construction failure: nonmanifold top edges. Four edges have excess incident faces; there are no duplicate triangles that could safely be removed. This candidate is not applied. The passed v20 remains the geometry candidate.
