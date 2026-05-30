export const SLIDE_SRC_PATTERN = /\/svg\/(\d+)([?#].*)?$/;

export interface SlideImageLike {
  src: string;
  getBoundingClientRect(): Pick<DOMRect, 'width' | 'height'>;
}

export function getSlideNumberFromUrl(src: string): number | null {
  const match = src.match(SLIDE_SRC_PATTERN);
  return match ? parseInt(match[1], 10) : null;
}

export function replaceSlideNumberInUrl(src: string, slideNumber: number): string | null {
  if (slideNumber < 1 || !SLIDE_SRC_PATTERN.test(src)) return null;

  return src.replace(
    SLIDE_SRC_PATTERN,
    (_match, _currentSlide, suffix = '') => `/svg/${slideNumber}${suffix}`
  );
}

export function isVisibleSlideImage(image: SlideImageLike): boolean {
  const rect = image.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function selectVisibleSlideImage<T extends SlideImageLike>(images: T[]): T | null {
  const slideImages = images.filter((image) => getSlideNumberFromUrl(image.src) !== null);
  return slideImages.find(isVisibleSlideImage) || slideImages[0] || null;
}

export function setSlideImageNumber(
  image: SlideImageLike,
  slideNumber: number
): number | null {
  const newSrc = replaceSlideNumberInUrl(image.src, slideNumber);
  if (newSrc === null) return null;

  image.src = newSrc;
  return slideNumber;
}
