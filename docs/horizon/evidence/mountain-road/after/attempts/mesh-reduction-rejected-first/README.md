# First meshoptimizer reduction — all candidates rejected

Saved production funicular mesh only; no candidate was applied. The nominal zero-error result reduces 16,036 to 14,186 triangles but creates 9 inverted and 25 invisible tops. The 0.25 mm and 0.5 mm requests produce 10,166 and 8,328 triangles respectively, but change the boundary, leave three open edges and fail winding/visibility. Library error estimates are not independent surface-error proof. Later attempts must preserve the original doubles, closure, positive top winding and host seams.
