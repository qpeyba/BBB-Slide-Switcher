
export enum MessageType {
  GET_CURRENT_SLIDE = 'GET_CURRENT_SLIDE',
  NEXT_SLIDE = 'NEXT_SLIDE',
  PREV_SLIDE = 'PREV_SLIDE',
  GO_TO_SLIDE = 'GO_TO_SLIDE',
  SLIDE_NUMBER_CHANGED = 'SLIDE_NUMBER_CHANGED',
  LIVE_SLIDE_CHANGED = 'LIVE_SLIDE_CHANGED',
  GET_LAST_SLIDE = 'GET_LAST_SLIDE',
  SET_FOLLOW_PRESENTER = 'SET_FOLLOW_PRESENTER',
}

export interface Message {
  type: MessageType;
  slideNumber?: number;
  followPresenter?: boolean;
}

export interface SlideState {
  followPresenter: boolean;
  lastLiveSlide: number | null;
  localSlide: number | null;
}

export const STORAGE_KEYS = {
  FOLLOW_PRESENTER: 'followPresenter',
  LAST_LIVE_SLIDE: 'lastLiveSlide',
  LOCAL_SLIDE: 'localSlide',
} as const;
