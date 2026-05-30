import { getSlideNumberFromUrl } from './slide';

export interface SlideObserverState {
  followPresenter: boolean;
  localSlideNumber: number | null;
  liveSlideNumber: number | null;
  displayedSlideNumber: number | null;
  pendingExtensionSlideNumber: number | null;
}

export interface SlideObserverEffects {
  ignoreReason: 'extension' | 'rerender' | null;
  liveSlideNumber: number | null;
  localSlideNumber: number | null;
  restoreSlideNumber: number | null;
}

export interface SlideObserverResult {
  state: SlideObserverState;
  effects: SlideObserverEffects;
}

function collectSlideNumbersFromNode(node: Node): number[] {
  const numbers: number[] = [];

  if (node instanceof HTMLImageElement) {
    const slideNumber = getSlideNumberFromUrl(node.src);
    if (slideNumber !== null) {
      numbers.push(slideNumber);
    }
  }

  if (node instanceof Element) {
    const images = node.querySelectorAll('img[src*="/svg/"]');
    for (const image of images) {
      if (image instanceof HTMLImageElement) {
        const slideNumber = getSlideNumberFromUrl(image.src);
        if (slideNumber !== null) {
          numbers.push(slideNumber);
        }
      }
    }
  }

  return numbers;
}

export function hasSlideTransition(
  mutations: MutationRecord[],
  fromSlide: number | null,
  toSlide: number
): boolean {
  if (fromSlide === null) return false;

  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
      const oldSlide = mutation.oldValue
        ? getSlideNumberFromUrl(mutation.oldValue)
        : null;
      const target = mutation.target;
      const newSlide =
        target instanceof HTMLImageElement ? getSlideNumberFromUrl(target.src) : null;

      if (oldSlide === fromSlide && newSlide === toSlide) {
        return true;
      }
    }

    if (mutation.type === 'childList') {
      const removedSlides = Array.from(mutation.removedNodes).flatMap(
        collectSlideNumbersFromNode
      );
      const addedSlides = Array.from(mutation.addedNodes).flatMap(
        collectSlideNumbersFromNode
      );

      if (removedSlides.includes(fromSlide) && addedSlides.includes(toSlide)) {
        return true;
      }
    }
  }

  return false;
}

function hasSlideMutation(mutations: MutationRecord[], slideNumber: number): boolean {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
      const oldSlide = mutation.oldValue
        ? getSlideNumberFromUrl(mutation.oldValue)
        : null;
      const target = mutation.target;
      const newSlide =
        target instanceof HTMLImageElement ? getSlideNumberFromUrl(target.src) : null;

      if (oldSlide === slideNumber || newSlide === slideNumber) {
        return true;
      }
    }

    if (mutation.type === 'childList') {
      const removedSlides = Array.from(mutation.removedNodes).flatMap(
        collectSlideNumbersFromNode
      );
      const addedSlides = Array.from(mutation.addedNodes).flatMap(
        collectSlideNumbersFromNode
      );

      if (removedSlides.includes(slideNumber) || addedSlides.includes(slideNumber)) {
        return true;
      }
    }
  }

  return false;
}

export function reduceObservedSlide(
  state: SlideObserverState,
  slideNumber: number,
  mutations: MutationRecord[]
): SlideObserverResult {
  if (slideNumber === state.pendingExtensionSlideNumber) {
    return {
      state: {
        ...state,
        displayedSlideNumber: slideNumber,
        pendingExtensionSlideNumber: null,
      },
      effects: {
        ignoreReason: 'extension',
        liveSlideNumber: null,
        localSlideNumber: null,
        restoreSlideNumber: null,
      },
    };
  }

  const hasLiveTransition = hasSlideTransition(
    mutations,
    state.liveSlideNumber,
    slideNumber
  );

  if (
    slideNumber === state.displayedSlideNumber &&
    !hasLiveTransition &&
    slideNumber === state.liveSlideNumber
  ) {
    return {
      state,
      effects: {
        ignoreReason: 'rerender',
        liveSlideNumber: null,
        localSlideNumber: null,
        restoreSlideNumber: null,
      },
    };
  }

  if (
    !state.followPresenter &&
    slideNumber === state.liveSlideNumber &&
    slideNumber !== state.displayedSlideNumber &&
    !hasLiveTransition
  ) {
    return {
      state,
      effects: {
        ignoreReason: 'rerender',
        liveSlideNumber: null,
        localSlideNumber: null,
        restoreSlideNumber: null,
      },
    };
  }

  if (!state.followPresenter) {
    const transitionFromLive = hasSlideTransition(
      mutations,
      state.liveSlideNumber,
      slideNumber
    );
    const presenterCaughtUpToLocal =
      slideNumber === state.localSlideNumber &&
      slideNumber === state.displayedSlideNumber &&
      slideNumber !== state.liveSlideNumber &&
      hasSlideMutation(mutations, slideNumber);

    const isPresenterChange = transitionFromLive ||
      presenterCaughtUpToLocal ||
      (slideNumber !== state.displayedSlideNumber && state.pendingExtensionSlideNumber === null);

    const newLiveSlideNumber = isPresenterChange ? slideNumber : state.liveSlideNumber;

    return {
      state: {
        ...state,
        displayedSlideNumber: slideNumber,
        liveSlideNumber: newLiveSlideNumber,
      },
      effects: {
        ignoreReason: null,
        liveSlideNumber:
          state.liveSlideNumber !== newLiveSlideNumber ? newLiveSlideNumber : null,
        localSlideNumber: null,
        restoreSlideNumber:
          state.localSlideNumber !== null && state.localSlideNumber !== slideNumber
            ? state.localSlideNumber
            : null,
      },
    };
  }

  return {
    state: {
      ...state,
      localSlideNumber: slideNumber,
      liveSlideNumber: slideNumber,
      displayedSlideNumber: slideNumber,
    },
    effects: {
      ignoreReason: null,
      liveSlideNumber: state.liveSlideNumber !== slideNumber ? slideNumber : null,
      localSlideNumber: state.localSlideNumber !== slideNumber ? slideNumber : null,
      restoreSlideNumber: null,
    },
  };
}
