export const SLIDE_SRC_PATTERN = /\/svg\/(\d+)([?#].*)?$/;
export const SLIDE_SELECTORS = [
  '#slide-background-shape_image',
  'img[alt="tl_image_asset"]',
  'img[src*="/svg/"]',
];

export interface SlideImageLike {
  src: string;
  getBoundingClientRect(): Pick<DOMRect, 'width' | 'height'>;
}

export interface CurrentVisibleSlide {
  image: HTMLImageElement;
  slideNumber: number;
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
  const visibleImages = slideImages.filter(isVisibleSlideImage);
  visibleImages.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
  });

  return visibleImages[0] || slideImages[0] || null;
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

function isSlideImage(element: Element): element is HTMLImageElement {
  return element instanceof HTMLImageElement && getSlideNumberFromUrl(element.src) !== null;
}

export function findSlideImage(root: ParentNode = document): HTMLImageElement | null {
  const images: HTMLImageElement[] = [];

  for (const selector of SLIDE_SELECTORS) {
    const elements = root.querySelectorAll(selector);
    for (const element of elements) {
      if (isSlideImage(element) && !images.includes(element)) {
        images.push(element);
      }
    }
  }

  return selectVisibleSlideImage(images);
}

export function getCurrentVisibleSlide(
  root: ParentNode = document
): CurrentVisibleSlide | null {
  const image = findSlideImage(root);
  if (!image) return null;

  const slideNumber = getSlideNumberFromUrl(image.src);
  if (slideNumber === null) return null;

  return { image, slideNumber };
}

export function setVisibleSlide(slideNumber: number, root: ParentNode = document): number | null {
  const image = findSlideImage(root);
  if (!image) return null;

  return setSlideImageNumber(image, slideNumber);
}
