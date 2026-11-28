import {ApiError} from './client';
import i18n from '../localization/i18n';
export function userMessage(error:unknown,fallback:string):string {
  if(error instanceof ApiError && error.status===0)return i18n.t('error');
  if(error instanceof ApiError && error.status===403)return i18n.t('permissionDenied');
  return fallback;
}
