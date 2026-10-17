export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < 6) return 'Пароль должен быть не менее 6 символов';
  if (password.length > 72) return 'Пароль должен содержать не более 72 символов';
  if (password !== confirmation) return 'Пароли не совпадают';
  return null;
}
