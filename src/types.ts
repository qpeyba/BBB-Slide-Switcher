
export enum MessageType {
  GET_CURRENT_SLIDE = 'GET_CURRENT_SLIDE',
  NEXT_SLIDE = 'NEXT_SLIDE',
  PREV_SLIDE = 'PREV_SLIDE',
  SLIDE_NUMBER_CHANGED = 'SLIDE_NUMBER_CHANGED',
  GET_LAST_SLIDE = 'GET_LAST_SLIDE',
  SET_FOLLOW_PRESENTER = 'SET_FOLLOW_PRESENTER',
}

export interface SlideInfo {
  slideNumber: number;
}

export interface Message {
  type: MessageType;
  payload?: SlideInfo;
}

export const STORAGE_KEYS = {
  FOLLOW_PRESENTER: 'followPresenter',
  LAST_LIVE_SLIDE: 'lastLiveSlide',
} as const;
