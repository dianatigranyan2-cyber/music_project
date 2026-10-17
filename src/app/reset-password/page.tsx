import {ResetPasswordForm} from './ResetPasswordForm';
export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<{error?:string}>}){
 const params=await searchParams;return <ResetPasswordForm expired={!!params.error}/>;
}
