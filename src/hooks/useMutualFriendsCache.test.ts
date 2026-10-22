import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useMutualFriendsCache,
  setMutualFriendsCache,
  invalidateMutualFriendsCache,
  getMutualFriendsFromCache,
} from './useMutualFriendsCache';

describe('useMutualFriendsCache', () => {
  beforeEach(() => {
    invalidateMutualFriendsCache();
    vi.clearAllMocks();
  });

  it('should initialize data synchronously from cache if present on mount', () => {
    const mockData = {
      count: 2,
      friends: [
        { displayName: 'Alice', nickname: 'alice', photoURL: null },
        { displayName: 'Bob', nickname: 'bob', photoURL: null },
      ],
    };

    setMutualFriendsCache('userA', 'userB', mockData.count, mockData.friends);

    const fetchFn = vi.fn().mockResolvedValue({ count: 99, friends: [] });

    const { result } = renderHook(() =>
      useMutualFriendsCache('userA', 'userB', fetchFn)
    );

    // Synchronous state initialization from cache
    expect(result.current.data).toEqual(mockData);
    expect(result.current.loading).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('should fetch data when cache is missing and update cache', async () => {
    const fetchedData = {
      count: 1,
      friends: [{ displayName: 'Charlie', nickname: 'charlie', photoURL: null }],
    };

    const fetchFn = vi.fn().mockResolvedValue(fetchedData);

    const { result } = renderHook(() =>
      useMutualFriendsCache('user1', 'user2', fetchFn)
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(fetchedData);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Verify cache updated
    const cached = getMutualFriendsFromCache('user1', 'user2');
    expect(cached?.count).toBe(1);
    expect(cached?.friends).toEqual(fetchedData.friends);
  });

  it('should deduplicate concurrent fetches for the same user pair', async () => {
    const fetchedData = {
      count: 3,
      friends: [],
    };

    let resolvePromise: (val: typeof fetchedData) => void = () => {};
    const fetchFn = vi.fn(
      () =>
        new Promise<typeof fetchedData>((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { result: hook1 } = renderHook(() =>
      useMutualFriendsCache('u1', 'u2', fetchFn)
    );
    const { result: hook2 } = renderHook(() =>
      useMutualFriendsCache('u1', 'u2', fetchFn)
    );

    expect(hook1.current.loading).toBe(true);
    expect(hook2.current.loading).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    resolvePromise(fetchedData);

    await waitFor(() => {
      expect(hook1.current.loading).toBe(false);
      expect(hook2.current.loading).toBe(false);
    });

    expect(hook1.current.data).toEqual(fetchedData);
    expect(hook2.current.data).toEqual(fetchedData);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should handle inline fetchFn functions without re-fetching or infinite loop', async () => {
    const fetchedData = { count: 5, friends: [] };
    const fetchFn = vi.fn().mockResolvedValue(fetchedData);

    // Render hook with a fresh inline arrow function every render
    const { result, rerender } = renderHook(
      ({ id1, id2 }) => useMutualFriendsCache(id1, id2, () => fetchFn()),
      { initialProps: { id1: 'userX', id2: 'userY' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(fetchedData);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Trigger re-render with new inline function reference
    rerender({ id1: 'userX', id2: 'userY' });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
