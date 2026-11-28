import {useTranslation} from 'react-i18next';
import i18n from './i18n';
import ja from './original-ja.json';
import vi from './original-vi.json';
i18n.addResourceBundle('ja','original',ja,true,true);
i18n.addResourceBundle('vi','original',vi,true,true);
i18n.addResourceBundle('vi','translation',{
  manageMedications:'Quản lý lịch thuốc',edit:'Sửa lịch',stopConfirm:'Ngừng các cữ chưa đến của lịch này? Thao tác này không thay đổi chỉ định điều trị.',
  canceled:'Lịch này đã hủy',readAloud:'Đọc trả lời',connected:'Đã đồng ý liên kết',acceptLink:'Đồng ý liên kết',noFamily:'Chưa có liên kết gia đình',
  invalidCredentials:'Tên đăng nhập hoặc mật khẩu không chính xác.',
  adherenceSummary:'{{taken}}/{{total}} cữ đã xác nhận ({{percent}}%)',
  checkinSummary:'Tâm trạng: {{mood}} • Thể trạng: {{physical}}',
  permissionDenied:'Tài khoản không có quyền thực hiện thao tác này. Vui lòng kiểm tra liên kết gia đình.',
  previewNotifications:'Expo Go chỉ dùng để xem trước. Nhắc thuốc trên thiết bị và push cần development build.',
},true,true);
i18n.addResourceBundle('ja','translation',{
  manageMedications:'お薬の予定を管理',edit:'予定を編集',stopConfirm:'この予定の今後の通知を停止しますか？治療の指示を変更するものではありません。',
  canceled:'この予定は取り消されました',readAloud:'回答を読み上げる',connected:'同意済みの連携',acceptLink:'連携に同意',noFamily:'ご家族との連携はありません',
  invalidCredentials:'ユーザー名またはパスワードが正しくありません。',
  adherenceSummary:'{{total}}回中{{taken}}回を確認（{{percent}}%）',
  checkinSummary:'気分：{{mood}}・体調：{{physical}}',
  permissionDenied:'この操作の権限がありません。ご家族との連携をご確認ください。',
  previewNotifications:'Expo Goはプレビュー用です。端末の服薬通知とプッシュ通知には開発ビルドが必要です。',
},true,true);
export function useOriginalLabels(){
  useTranslation('original');
  return (value:string) => {
    const key=value.trim();
    if(!key)return value;
    const result=i18n.t(key,{ns:'original',keySeparator:false,nsSeparator:false,defaultValue:key});
    return value.replace(key,result);
  };
}
export function signalLabel(value:string){return i18n.t('signal_'+value,{defaultValue:value});}
export function adherenceLabel(taken:number,total:number,percent:number){return i18n.t('adherenceSummary',{taken,total,percent});}
export function checkinSummaryLabel(mood:string,physical:string){return i18n.t('checkinSummary',{mood:signalLabel(mood),physical:signalLabel(physical)});}
