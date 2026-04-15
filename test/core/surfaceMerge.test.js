/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import { combinedRefIndex } from '../../src/core/surfaceMerge.js';

function glass(priority, n) {
  return {
    stackPriority: priority,
    getRefIndexAt() {
      return n;
    }
  };
}

describe('combinedRefIndex', () => {
  it('returns 1 for an empty list', () => {
    expect(combinedRefIndex([], {}, {}, { objs: [] })).toBe(1);
  });

  it('picks higher stackPriority', () => {
    const low = glass(1, 1.4);
    const high = glass(3, 1.52);
    const scene = { objs: [low, high] };
    expect(combinedRefIndex([low, high], {}, {}, scene)).toBe(1.52);
  });

  it('breaks ties by later scene index', () => {
    const a = glass(1, 1.4);
    const b = glass(1, 1.6);
    const scene = { objs: [a, b] };
    expect(combinedRefIndex([a, b], {}, {}, scene)).toBe(1.6);
  });
});
