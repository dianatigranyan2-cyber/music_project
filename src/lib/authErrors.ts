export function authErrorMessage(value:unknown,operation:'recovery'|'password'):string {
  const error=value&&typeof value==='object'?value as {code?:unknown;status?:unknown;name?:unknown}:{};
  if(error.code==='same_password')return 'Новый пароль совпадает с прежним. Придумайте другой пароль и повторите его во втором поле.';
  if(error.code==='over_email_send_rate_limit')return 'Лимит отправки писем временно исчерпан. Попробуйте позже.';
  if(error.code==='over_request_rate_limit'||error.status===429)return 'Слишком много запросов. Подождите немного и попробуйте ещё раз.';
  if(error.code==='email_address_not_authorized')return 'Отправка писем для этого адреса пока недоступна. Обратитесь к владельцу Melo.';
  if(error.code==='weak_password')return 'Пароль не соответствует требованиям. Используйте более длинный и сложный пароль.';
  if(['otp_expired','flow_state_expired','flow_state_not_found','bad_code_verifier','session_not_found','session_expired'].includes(String(error.code)))return 'Ссылка недействительна или истекла. Запросите новое письмо и откройте его в том же браузере.';
  if(error.name==='AuthRetryableFetchError'||error.name==='TypeError')return 'Не удалось подключиться. Проверьте интернет и попробуйте ещё раз.';
  return operation==='recovery'?'Не удалось отправить письмо. Попробуйте позже.':'Не удалось сохранить пароль. Попробуйте ещё раз.';
}
