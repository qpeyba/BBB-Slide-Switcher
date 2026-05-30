import { describe, expect, it } from 'vitest';
import {
  hasSlideTransition,
  reduceObservedSlide,
  SlideObserverState,
} from './slide-state';

function baseState(overrides: Partial<SlideObserverState> = {}): SlideObserverState {
  return {
    followPresenter: false,
    localSlideNumber: 3,
    liveSlideNumber: 4,
    displayedSlideNumber: 3,
    pendingExtensionSlideNumber: null,
    ...overrides,
  };
}

function slideImage(slideNumber: number): HTMLImageElement {
  const image = document.createElement('img');
  image.src = `https://bbb.local/presentation/svg/${slideNumber}`;
  return image;
}

function childListMutation(
  removedSlide: number,
  addedSlide: number
): MutationRecord {
  const root = document.createElement('div');
  const removed = slideImage(removedSlide);
  const added = slideImage(addedSlide);
  root.append(removed);

  return {
    type: 'childList',
    target: root,
    addedNodes: [added] as unknown as NodeList,
    removedNodes: [removed] as unknown as NodeList,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  };
}

describe('slide observer state', () => {
  it('updates live slide when presenter catches up to local slide while unfollowed', () => {
    const result = reduceObservedSlide(
      baseState({
        localSlideNumber: 5,
        liveSlideNumber: 4,
        displayedSlideNumber: 5,
      }),
      5,
      [childListMutation(4, 5)]
    );

    expect(result.effects.liveSlideNumber).toBe(5);
    expect(result.effects.restoreSlideNumber).toBeNull();
    expect(result.state.liveSlideNumber).toBe(5);
  });

  it('does not overwrite live slide on local slide rerender while unfollowed', () => {
    const result = reduceObservedSlide(
      baseState({
        localSlideNumber: 3,
        liveSlideNumber: 5,
        displayedSlideNumber: 3,
      }),
      3,
      []
    );

    expect(result.effects.ignoreReason).toBe('rerender');
    expect(result.effects.liveSlideNumber).toBeNull();
    expect(result.state.liveSlideNumber).toBe(5);
  });

  it('updates live slide and restores local slide while unfollowed', () => {
    const result = reduceObservedSlide(
      baseState({
        localSlideNumber: 3,
        liveSlideNumber: 4,
        displayedSlideNumber: 3,
      }),
      5,
      [childListMutation(4, 5)]
    );

    expect(result.effects.liveSlideNumber).toBe(5);
    expect(result.effects.restoreSlideNumber).toBe(3);
    expect(result.effects.localSlideNumber).toBeNull();
  });

  it('updates local slide from live slide while following presenter', () => {
    const result = reduceObservedSlide(
      baseState({
        followPresenter: true,
        localSlideNumber: 4,
        liveSlideNumber: 4,
        displayedSlideNumber: 4,
      }),
      5,
      [childListMutation(4, 5)]
    );

    expect(result.effects.liveSlideNumber).toBe(5);
    expect(result.effects.localSlideNumber).toBe(5);
    expect(result.effects.restoreSlideNumber).toBeNull();
  });

  it('ignores extension-owned slide changes as live events', () => {
    const result = reduceObservedSlide(
      baseState({
        pendingExtensionSlideNumber: 3,
      }),
      3,
      []
    );

    expect(result.effects.ignoreReason).toBe('extension');
    expect(result.effects.liveSlideNumber).toBeNull();
    expect(result.state.pendingExtensionSlideNumber).toBeNull();
  });

  it('detects live slide replacement from child list mutations', () => {
    expect(hasSlideTransition([childListMutation(4, 5)], 4, 5)).toBe(true);
  });
});
